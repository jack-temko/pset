package place

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"fmt"
	"math"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/store"
)

// kinds is each kind's group and the kind of thing that owns it: the rule's
// table (ideas/actions-conditions-place-grill.md).
var kinds = map[Kind]struct {
	group Group
	owner change.Resource
}{
	KindProblem:   {GroupWhere, change.ResourceSet},
	KindPage:      {GroupWhere, change.ResourceMaterial},
	KindLine:      {GroupWhere, change.ResourceDocument},
	KindSides:     {GroupLayout, change.ResourceCourse},
	KindZoom:      {GroupLayout, change.ResourceMaterial},
	KindAskDraft:  {GroupUnsent, change.ResourceCourse},
	KindNoteDraft: {GroupUnsent, change.ResourceQuestion},
	KindNewSet:    {GroupUnsent, change.ResourceCourse},
}

// owners is where each kind of owner lives.
var owners = map[change.Resource]string{
	change.ResourceCourse:   "courses",
	change.ResourceSet:      "sets",
	change.ResourceMaterial: "materials",
	change.ResourceQuestion: "questions",
	change.ResourceDocument: "documents",
}

// The bounds a place is kept within: a page bug never fills the store.
const (
	// maxText is the most a draft keeps, all its fields together.
	maxText = 20000
	// maxID is the longest id a place names.
	maxID = 100
	// maxTabs is the most tabs a workspace has.
	maxTabs = 50
	// maxPage is the highest page or block a place points at.
	maxPage = 100000
)

// bad is a place the page sent that can't be one: a page bug, said once.
var bad = errs.Define(errs.Entry{
	ID:     "place.bad",
	Kind:   errs.KindOurs,
	What:   "PSet couldn't remember where you were.",
	Why:    "The page sent a place it can't keep: {why}.",
	Fix:    "Reload the page.",
	Action: errs.ActionReload,
	Status: http.StatusBadRequest,
})

func refuse(format string, args ...any) error {
	return bad.New("why", fmt.Sprintf(format, args...))
}

// value is the fields a place's kind fills, as stored.
type value struct {
	QuestionID string  `json:"questionId,omitempty"`
	Page       int     `json:"page,omitempty"`
	Down       float64 `json:"down,omitempty"`
	Block      *int    `json:"block,omitempty"`
	Sides      []Side  `json:"sides,omitempty"`
	Split      float64 `json:"split,omitempty"`
	Zoom       float64 `json:"zoom,omitempty"`
	Text       string  `json:"text,omitempty"`
	AboutID    string  `json:"aboutId,omitempty"`
	Title      string  `json:"title,omitempty"`
	Due        string  `json:"due,omitempty"`
}

// check is a place's fields as its kind fills them, the rest dropped, or why
// it can't be kept.
func check(p Place) (value, error) {
	k, ok := kinds[p.Kind]
	if !ok {
		return value{}, refuse("no place is %q", p.Kind)
	}
	if p.OwnerKind != k.owner || p.OwnerID == "" {
		return value{}, refuse("a %s place belongs to a %s", p.Kind, k.owner)
	}
	if p.TabID != "" && p.Kind != KindPage && p.Kind != KindZoom {
		return value{}, refuse("only a page or zoom is per tab")
	}
	for _, id := range []string{p.OwnerID, p.TabID, p.QuestionID, p.AboutID} {
		if len(id) > maxID {
			return value{}, refuse("an id is %d characters at most", maxID)
		}
	}
	finite := func(f float64) bool { return !math.IsNaN(f) && !math.IsInf(f, 0) }
	var v value
	switch p.Kind {
	case KindProblem:
		if p.QuestionID == "" {
			return value{}, refuse("a problem place names its problem")
		}
		v.QuestionID = p.QuestionID
	case KindPage:
		if p.Page < 1 || p.Page > maxPage || !finite(p.Down) || p.Down < 0 || p.Down > 1 {
			return value{}, refuse("a page is from 1, and down from 0 to 1")
		}
		v.Page, v.Down = p.Page, p.Down
	case KindLine:
		if p.Block == nil || *p.Block < 0 || *p.Block > maxPage {
			return value{}, refuse("a line is a block from 0")
		}
		v.Block = p.Block
	case KindSides:
		if err := checkSides(p.Sides); err != nil {
			return value{}, err
		}
		if !finite(p.Split) || p.Split < 0 || p.Split > 1 {
			return value{}, refuse("a split is from 0 to 1")
		}
		v.Sides, v.Split = p.Sides, p.Split
	case KindZoom:
		if !finite(p.Zoom) || p.Zoom < 0.1 || p.Zoom > 8 {
			return value{}, refuse("a zoom is from 0.1 to 8")
		}
		v.Zoom = p.Zoom
	case KindAskDraft:
		v.Text, v.AboutID = p.Text, p.AboutID
	case KindNoteDraft:
		v.Text = p.Text
	case KindNewSet:
		if p.Due != "" {
			if _, err := time.Parse(time.DateOnly, p.Due); err != nil {
				return value{}, refuse("a due date is YYYY-MM-DD")
			}
		}
		v.Title, v.Due, v.Text = p.Title, p.Due, p.Text
	}
	if utf8.RuneCountInString(v.Text)+utf8.RuneCountInString(v.Title)+len(v.AboutID)+len(v.Due) > maxText {
		return value{}, refuse("a draft is kept to %d characters", maxText)
	}
	return v, nil
}

func checkSides(sides []Side) error {
	if len(sides) < 1 || len(sides) > 2 {
		return refuse("a workspace has one side or two")
	}
	seen := map[string]bool{}
	for i := range sides {
		if sides[i].Tabs == nil {
			sides[i].Tabs = []Tab{}
		}
		s := sides[i]
		open := false
		for _, t := range s.Tabs {
			switch {
			case len(seen) >= maxTabs:
				return refuse("a workspace has %d tabs at most", maxTabs)
			case len(t.ID) > maxID || len(t.ThingID) > maxID || len(s.Open) > maxID:
				return refuse("an id is %d characters at most", maxID)
			case t.ID == "" || seen[t.ID]:
				return refuse("each tab has its own id")
			case t.Kind != TabKindSet && t.Kind != TabKindMaterial && t.Kind != TabKindAsk:
				return refuse("no tab holds %q", t.Kind)
			case t.Kind != TabKindAsk && t.ThingID == "":
				return refuse("a %s tab names its %s", t.Kind, t.Kind)
			}
			seen[t.ID] = true
			open = open || t.ID == s.Open
		}
		if (len(s.Tabs) > 0 && !open) || (len(s.Tabs) == 0 && s.Open != "") {
			return refuse("a side shows one of its own tabs")
		}
	}
	return nil
}

// Service keeps the student's places on the store.
type Service struct {
	store *store.Store
}

// New is the places on s.
func New(s *store.Store) *Service { return &Service{store: s} }

// Owner names a thing a place belongs to.
type Owner struct {
	Kind change.Resource
	ID   string
}

// Of is the places of the given things: what a tab reads when it opens.
func (s *Service) Of(ctx context.Context, things []Owner) (Places, error) {
	out := Places{Places: []Place{}}
	for _, o := range things {
		rows, err := s.store.DB.QueryContext(ctx, `SELECT id, seq, owner_kind, owner_id, kind, tab_id, value FROM places
			WHERE owner_kind = ? AND owner_id = ? AND value != '{}' ORDER BY kind, tab_id`, string(o.Kind), o.ID)
		if err != nil {
			return Places{}, errs.Database.Wrap(err)
		}
		for rows.Next() {
			var p Place
			var raw string
			if err := rows.Scan(&p.ID, &p.Seq, &p.OwnerKind, &p.OwnerID, &p.Kind, &p.TabID, &raw); err != nil {
				cleanup.Close(rows)
				return Places{}, errs.Database.Wrap(err)
			}
			var v value
			if err := json.Unmarshal([]byte(raw), &v); err != nil {
				cleanup.Close(rows)
				return Places{}, errs.Data.Wrap(err)
			}
			out.Places = append(out.Places, fill(p, v))
		}
		err = rows.Err()
		cleanup.Close(rows)
		if err != nil {
			return Places{}, errs.Database.Wrap(err)
		}
	}
	return out, nil
}

// fill puts a stored value's fields on a place, with its group.
func fill(p Place, v value) Place {
	p.Group = kinds[p.Kind].group
	p.QuestionID, p.Page, p.Down, p.Block = v.QuestionID, v.Page, v.Down, v.Block
	p.Sides, p.Split, p.Zoom = v.Sides, v.Split, v.Zoom
	p.Text, p.AboutID, p.Title, p.Due = v.Text, v.AboutID, v.Title, v.Due
	return p
}

// Set keeps a place, in place of the one its owner had of that kind (and
// tab). A tab's page or zoom is also the material's last, which a newly
// opened tab starts from; new sides drop the spots of the tabs they closed.
func (s *Service) Set(ctx context.Context, p Place) (Place, error) {
	v, err := check(p)
	if err != nil {
		return Place{}, err
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return Place{}, errs.Data.Wrap(err)
	}
	now := db.Now()
	// Nothing in it (a draft typed away): the place is cleared, not kept.
	empty := string(raw) == "{}"
	err = s.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
		var n int
		q := `SELECT count(*) FROM ` + owners[p.OwnerKind] + ` WHERE id = ?`
		if p.OwnerKind != change.ResourceDocument {
			// A document has no removal of its own: it goes with its owner.
			q += ` AND removed_at = ''`
		}
		if err := tx.QueryRowContext(ctx, q, p.OwnerID).Scan(&n); err != nil {
			return errs.Database.Wrap(err)
		}
		if n == 0 {
			return errs.Gone.New("thing", string(p.OwnerKind))
		}
		tabs := []string{p.TabID}
		if p.TabID != "" {
			open, err := tabOpen(ctx, tx, p.OwnerID, p.TabID)
			if err != nil {
				return err
			}
			// The material's last spot always; the tab's own only while the
			// tab is open: a write that lands after its tab closed would
			// bring the spot back for good.
			tabs = []string{""}
			if open {
				tabs = append(tabs, p.TabID)
			}
		}
		for _, tab := range tabs {
			if empty {
				_, err := tx.ExecContext(ctx, `UPDATE places SET value = '{}', updated_at = ? WHERE owner_kind = ? AND owner_id = ? AND kind = ? AND tab_id = ? AND value != '{}'`,
					now, string(p.OwnerKind), p.OwnerID, string(p.Kind), tab)
				if err != nil {
					return errs.Database.Wrap(err)
				}
				continue
			}
			if _, err := tx.ExecContext(ctx, `INSERT INTO places (id, owner_kind, owner_id, kind, tab_id, value, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (owner_kind, owner_id, kind, tab_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
				WHERE places.value != excluded.value`,
				uuid.NewString(), string(p.OwnerKind), p.OwnerID, string(p.Kind), tab, string(raw), now); err != nil {
				return errs.Database.Wrap(err)
			}
		}
		if p.Kind == KindSides {
			return closeTabs(ctx, tx, p.OwnerID, v.Sides)
		}
		return nil
	})
	if err != nil {
		return Place{}, err
	}
	if empty {
		return fill(Place{OwnerKind: p.OwnerKind, OwnerID: p.OwnerID, Kind: p.Kind, TabID: p.TabID}, value{}), nil
	}
	got, err := s.Of(ctx, []Owner{{p.OwnerKind, p.OwnerID}})
	if err != nil {
		return Place{}, err
	}
	want := p.TabID
	for _, q := range got.Places {
		if q.Kind == p.Kind && q.TabID == want {
			return q, nil
		}
	}
	// A closed tab's write kept only the material's last spot.
	for _, q := range got.Places {
		if q.Kind == p.Kind && q.TabID == "" {
			return q, nil
		}
	}
	return Place{}, errs.Gone.New("thing", "place")
}

// tabOpen is whether a material's course has the tab open on this material,
// or keeps no sides yet (a first visit writes its spot before its layout;
// the layout's first write then empties any spot it doesn't have open).
func tabOpen(ctx context.Context, tx *sql.Tx, materialID, tabID string) (bool, error) {
	var course string
	if err := tx.QueryRowContext(ctx, `SELECT course_id FROM materials WHERE id = ?`, materialID).Scan(&course); err != nil {
		return false, errs.Database.Wrap(err)
	}
	var raw string
	err := tx.QueryRowContext(ctx, `SELECT value FROM places WHERE owner_kind = 'course' AND owner_id = ? AND kind = 'sides' AND tab_id = '' AND value != '{}'`, course).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return true, nil
	}
	if err != nil {
		return false, errs.Database.Wrap(err)
	}
	var v value
	if err := json.Unmarshal([]byte(raw), &v); err != nil {
		return false, errs.Data.Wrap(err)
	}
	for _, sd := range v.Sides {
		for _, t := range sd.Tabs {
			if t.ID == tabID && t.Kind == TabKindMaterial && t.ThingID == materialID {
				return true, nil
			}
		}
	}
	return false, nil
}

// closeTabs empties every per-tab spot and zoom of the course's materials
// whose tab the new sides don't have open, whenever and however it was
// written. A course has one layout, so two browser tabs on it share it: the
// last to write wins, and closes the other's tabs (an open question against
// C6). Like any place cleared, an empty one reads as none and the purge
// takes it: only the purge deletes.
func closeTabs(ctx context.Context, tx *sql.Tx, courseID string, after []Side) error {
	open := map[string]bool{}
	for _, s := range after {
		for _, t := range s.Tabs {
			if t.Kind == TabKindMaterial {
				open[t.ID+"\x00"+t.ThingID] = true
			}
		}
	}
	rows, err := tx.QueryContext(ctx, `SELECT id, tab_id, owner_id FROM places WHERE owner_kind = 'material' AND tab_id != '' AND value != '{}'
		AND owner_id IN (SELECT id FROM materials WHERE course_id = ?)`, courseID)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	var shut []string
	for rows.Next() {
		var id, tab, material string
		if err := rows.Scan(&id, &tab, &material); err != nil {
			cleanup.Close(rows)
			return errs.Database.Wrap(err)
		}
		if !open[tab+"\x00"+material] {
			shut = append(shut, id)
		}
	}
	err = rows.Err()
	cleanup.Close(rows)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	for _, id := range shut {
		if _, err := tx.ExecContext(ctx, `UPDATE places SET value = '{}' WHERE id = ?`, id); err != nil {
			return errs.Database.Wrap(err)
		}
	}
	return nil
}

// Clear forgets a place: a draft that was sent. It is emptied, which reads
// as none; the purge deletes it.
func (s *Service) Clear(ctx context.Context, id string) error {
	return s.store.Write(ctx, change.ActorPSet, "", func(tx *sql.Tx) error {
		// Only a draft is cleared so: what the student typed and sent.
		_, err := tx.ExecContext(ctx, `UPDATE places SET value = '{}' WHERE id = ? AND value != '{}'
			AND kind IN ('ask_draft', 'note_draft', 'new_set')`, id)
		return errs.Database.Of(err)
	})
}

// Routes mounts the places: read once by a tab as it opens, written as the
// student moves, cleared when a draft is sent.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/places", httpx.Reply(func(r *http.Request) (Places, error) {
		var things []Owner
		for _, o := range r.URL.Query()["owner"] {
			kind, id, ok := strings.Cut(o, ":")
			if !ok || id == "" || owners[change.Resource(kind)] == "" {
				return Places{}, refuse("an owner is kind:id, not %q", o)
			}
			things = append(things, Owner{change.Resource(kind), id})
		}
		return s.Of(r.Context(), things)
	}))
	mux.HandleFunc("PUT /api/places", httpx.Send(http.StatusOK, func(r *http.Request, p Place) (Place, error) {
		return s.Set(r.Context(), p)
	}))
	mux.HandleFunc("DELETE /api/places/{id}", httpx.Act(func(r *http.Request) error {
		return s.Clear(r.Context(), r.PathValue("id"))
	}))
}
