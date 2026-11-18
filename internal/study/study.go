package study

import (
	"context"
	"database/sql"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/store"
)

// Service records study time and sums it.
type Service struct {
	s   *store.Store
	now func() time.Time
}

// New is time spent on s, with its clear action declared in c.
func New(s *store.Store, c *action.Catalog) *Service {
	svc := &Service{s: s, now: time.Now}
	action.Add(c, action.Def[struct{}]{
		ID: "time.clear", Name: "Forget time spent",
		Run: func(ctx context.Context, do *action.Do, _ struct{}) error {
			return do.Write(ctx, "", "", func(tx *sql.Tx) error {
				_, err := tx.ExecContext(ctx, `DELETE FROM study`)
				return errs.Database.Of(err)
			})
		},
	})
	return svc
}

// Limits on what a stretch can claim: none ends in the future, and none is
// longer than a sitting. A page that sends more is clamped, not refused,
// since its clock may be off.
const (
	maxAhead   = 5 * time.Second
	maxStretch = 6 * time.Hour
	maxID      = 64
)

// Save records a stretch of study, or its latest end: saving the same
// stretch again only moves its end, and never back. A course that is gone
// (removed, or never there) is refused.
func (s *Service) Save(ctx context.Context, st Stretch) error {
	switch st.Kind {
	case KindReading, KindHomework, KindAsking:
	default:
		return unknownKind.New("kind", strconv.Quote(string(st.Kind))).OnField("kind")
	}
	if st.ID == "" || len(st.ID) > maxID {
		return badID.New().OnField("id")
	}
	if len(st.QuestionID) > maxID {
		return badQuestionID.New().OnField("questionId")
	}
	if st.QuestionID != "" && st.Kind != KindHomework {
		return notHomework.New().OnField("questionId")
	}
	from, err1 := time.Parse(time.RFC3339Nano, st.Started)
	to, err2 := time.Parse(time.RFC3339Nano, st.Ended)
	if err1 != nil || err2 != nil {
		return badTimes.New().OnField("started")
	}
	to = minTime(to.UTC(), s.now().UTC().Add(maxAhead))
	from = maxTime(minTime(from.UTC(), to), to.Add(-maxStretch))
	res, err := s.s.DB.ExecContext(ctx, `INSERT INTO study (id, course_id, kind, started, ended, question_id)
		SELECT ?, id, ?, ?, ?, ? FROM courses WHERE id = ? AND removed_at = ''
		ON CONFLICT (id) DO UPDATE SET ended = max(ended, excluded.ended)`,
		st.ID, string(st.Kind), db.At(from), db.At(to), st.QuestionID, st.CourseID)
	if err != nil {
		return errs.Database.Wrap(err)
	}
	if n, err := res.RowsAffected(); err != nil || n == 0 {
		return errs.Gone.New("thing", "course")
	}
	return nil
}

// Week sums everything since the start of the student's week, which the page
// sends because it knows the local calendar. Stretches that overlap (two tabs
// on one course) count once: each total is the length of their union. A
// removed course's time is left out.
func (s *Service) Week(ctx context.Context, since time.Time) (Week, error) {
	w := Week{ByCourse: []CourseMinutes{}}
	rows, err := s.s.DB.QueryContext(ctx, `SELECT st.course_id, st.kind, st.started, st.ended FROM study st
		JOIN courses c ON c.id = st.course_id AND c.removed_at = ''
		WHERE st.ended > ?`, db.At(since))
	if err != nil {
		return Week{}, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	var all []span
	byKind := map[Kind][]span{}
	byCourse := map[string][]span{}
	for rows.Next() {
		var course, from, to string
		var k Kind
		if err := rows.Scan(&course, &k, &from, &to); err != nil {
			return Week{}, errs.Database.Wrap(err)
		}
		sp, ok := parse(from, to)
		if !ok {
			continue
		}
		sp.from = maxTime(sp.from, since)
		if !sp.to.After(sp.from) {
			continue
		}
		all = append(all, sp)
		byKind[k] = append(byKind[k], sp)
		byCourse[course] = append(byCourse[course], sp)
	}
	if err := rows.Err(); err != nil {
		return Week{}, errs.Database.Wrap(err)
	}
	w.Total = minutes(all)
	w.Homework, w.Reading, w.Asking = minutes(byKind[KindHomework]), minutes(byKind[KindReading]), minutes(byKind[KindAsking])
	for course, spans := range byCourse {
		if m := minutes(spans); m > 0 {
			w.ByCourse = append(w.ByCourse, CourseMinutes{CourseID: course, Minutes: m})
		}
	}
	sort.Slice(w.ByCourse, func(i, j int) bool {
		if w.ByCourse[i].Minutes != w.ByCourse[j].Minutes {
			return w.ByCourse[i].Minutes > w.ByCourse[j].Minutes
		}
		return w.ByCourse[i].CourseID < w.ByCourse[j].CourseID
	})
	return w, nil
}

// QuestionSeconds is the time spent on each of the questions, in seconds:
// the stretches with that question open, an overlap counted once. A question
// with none is absent. Track 5's set progress reads it.
func (s *Service) QuestionSeconds(ctx context.Context, ids []string) (map[string]int, error) {
	out := map[string]int{}
	if len(ids) == 0 {
		return out, nil
	}
	marks := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	rows, err := s.s.DB.QueryContext(ctx, `SELECT question_id, started, ended FROM study WHERE question_id IN (`+marks+`)`, args...)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	by := map[string][]span{}
	for rows.Next() {
		var id, from, to string
		if err := rows.Scan(&id, &from, &to); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		if sp, ok := parse(from, to); ok {
			by[id] = append(by[id], sp)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, errs.Database.Wrap(err)
	}
	for id, spans := range by {
		if n := int(covered(spans).Round(time.Second) / time.Second); n > 0 {
			out[id] = n
		}
	}
	return out, nil
}

type span struct{ from, to time.Time }

// parse is a stored stretch as a span; false for one that is unreadable or
// covers no time.
func parse(from, to string) (span, bool) {
	a, err1 := time.Parse(time.RFC3339Nano, from)
	b, err2 := time.Parse(time.RFC3339Nano, to)
	if err1 != nil || err2 != nil || !b.After(a) {
		return span{}, false
	}
	return span{a, b}, true
}

// minutes is how long the spans cover together, an overlap once, rounded to
// the minute.
func minutes(spans []span) int {
	return int(covered(spans).Round(time.Minute) / time.Minute)
}

// covered is how long the spans cover together, an overlap once.
func covered(spans []span) time.Duration {
	if len(spans) == 0 {
		return 0
	}
	sort.Slice(spans, func(i, j int) bool { return spans[i].from.Before(spans[j].from) })
	var total time.Duration
	cur := spans[0]
	for _, sp := range spans[1:] {
		if !sp.from.After(cur.to) {
			cur.to = maxTime(cur.to, sp.to)
			continue
		}
		total += cur.to.Sub(cur.from)
		cur = sp
	}
	return total + cur.to.Sub(cur.from)
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

// Routes mounts saving a stretch and the week; forgetting it all is an
// action.
func (s *Service) Routes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/time", httpx.Take(func(r *http.Request, st Stretch) error {
		return s.Save(r.Context(), st)
	}))
	// With no since it is all the time kept: what clearing it would forget.
	mux.HandleFunc("GET /api/time", httpx.Reply(func(r *http.Request) (Week, error) {
		raw := r.URL.Query().Get("since")
		if raw == "" {
			return s.Week(r.Context(), time.Time{})
		}
		since, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return Week{}, badSince.New().OnField("since")
		}
		return s.Week(r.Context(), since)
	}))
}
