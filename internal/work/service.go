package work

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/action"
	"github.com/jackt/pset/internal/change"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/probnum"
	"github.com/jackt/pset/internal/runner"
	"github.com/jackt/pset/internal/store"
)

// Config is what the work is built from.
type Config struct {
	Store   *store.Store
	Actions *action.Catalog
	// Runner is nil when the service is built only to declare its actions.
	Runner *runner.Runner
	// Seconds is the time spent on each question (internal/study); nil
	// leaves Seconds out.
	Seconds func(ctx context.Context, ids []string) (map[string]int, error)
}

// Service keeps the student's sets and their questions, on the store
// (track 5a of ideas/backend-courses.md). Finding, reading and the guides
// are track 5b and 5c.
type Service struct{ c Config }

// The caps the old homework kept.
const (
	maxTitle  = 200
	maxDrafts = 40
	maxDraft  = 4000
)

// New is the work, with its actions declared in c.Actions.
func New(c Config) *Service {
	s := &Service{c}
	a := c.Actions
	action.Add(a, action.Def[AddSet]{
		ID: "set.add", Name: "Add set", Undoable: true,
		Undone: "Took back adding {name}.", Redone: "Added {name} again.",
		Run: s.addSet,
		Try: func(sd action.Seed) AddSet {
			return AddSet{CourseID: sd.CourseID, Title: "Problem set 5", Due: "2026-12-01"}
		},
	})
	action.Add(a, action.Def[RenameSet]{
		ID: "set.rename", Name: "Rename set", Undoable: true,
		Undone: "Renamed back to {name}.", Redone: "Renamed to {name} again.",
		Run: s.renameSet,
		Try: func(sd action.Seed) RenameSet { return RenameSet{ID: sd.SetID, Title: "Problem set 4 (corrected)"} },
	})
	action.Add(a, action.Def[SetDue]{
		ID: "set.due", Name: "Change due date", Undoable: true,
		Undone: "{name} is due when it was.", Redone: "Changed when {name} is due again.",
		Run: s.setDue,
		Try: func(sd action.Seed) SetDue { return SetDue{ID: sd.SetID, Due: "2026-12-08"} },
	})
	action.Add(a, action.Def[TurnIn]{
		ID: "set.turn_in", Name: "Turn in", Undoable: true,
		Undone: "{name} is back as it was.", Redone: "Changed whether {name} is turned in again.",
		Run: s.turnIn,
		Try: func(sd action.Seed) TurnIn { return TurnIn{ID: sd.SetID, TurnedIn: true} },
	})
	action.Add(a, action.Def[RemoveSet]{
		ID: "set.remove", Name: "Remove set", Undoable: true, Removes: true,
		Undone: "Brought back {name}.", Redone: "Removed {name} again.",
		Run: s.removeSet,
		Try: func(sd action.Seed) RemoveSet { return RemoveSet{ID: sd.SetID} },
	})
	action.Add(a, action.Def[AddQuestions]{
		ID: "question.add", Name: "Add questions", Undoable: true,
		Undone: "Took back the questions added to {name}.", Redone: "Added the questions to {name} again.",
		Run: s.addQuestions,
		Try: func(sd action.Seed) AddQuestions {
			return AddQuestions{SetID: sd.SetID, Drafts: []Draft{{Text: "3.1 #7", Find: true}, {Text: "Sketch the circuit."}}}
		},
	})
	action.Add(a, action.Def[QuestionMark]{
		ID: "question.done", Name: "Mark done", Undoable: true,
		Undone: "{name} is back as it was.", Redone: "Marked {name} again.",
		Run: s.markDone,
		Try: func(sd action.Seed) QuestionMark { return QuestionMark{ID: sd.QuestionID, Done: true} },
	})
	action.Add(a, action.Def[QuestionReveal]{
		ID: "question.reveal", Name: "Show help", Undoable: true,
		Undone: "Hid it again on {name}.", Redone: "Showed it again on {name}.",
		Run: s.reveal,
		Try: func(sd action.Seed) QuestionReveal { return QuestionReveal{ID: sd.QuestionID, Reveal: RevealHint} },
	})
	action.Add(a, action.Def[QuestionMove]{
		ID: "question.move", Name: "Move question", Undoable: true,
		Undone: "Moved {name} back.", Redone: "Moved {name} again.",
		Run: s.move,
		Try: func(sd action.Seed) QuestionMove { return QuestionMove{ID: sd.QuestionID, Position: 1} },
	})
	action.Add(a, action.Def[QuestionNotes]{
		ID: "question.notes", Name: "Edit notes", Undoable: true,
		Undone: "{name}'s notes are back as they were.", Redone: "Changed {name}'s notes again.",
		Run: s.setNotes,
		Try: func(sd action.Seed) QuestionNotes {
			return QuestionNotes{ID: sd.QuestionID, Notes: []string{"Only part (c).", "No PSpice."}}
		},
	})
	action.Add(a, action.Def[RemoveQuestion]{
		ID: "question.remove", Name: "Remove question", Undoable: true, Removes: true,
		Undone: "Brought back {name}.", Redone: "Removed {name} again.",
		Run: s.removeQuestion,
		Try: func(sd action.Seed) RemoveQuestion { return RemoveQuestion{ID: sd.QuestionID} },
	})
	return s
}

// cleanTitle is a set's title as typed, tidied and checked.
func cleanTitle(t string) (string, error) {
	t = strings.Join(strings.Fields(t), " ")
	if t == "" {
		return "", titleEmpty.New().OnField("title")
	}
	if utf8.RuneCountInString(t) > maxTitle {
		return "", titleTooLong.New("max", strconv.Itoa(maxTitle)).OnField("title")
	}
	return t, nil
}

// cleanDate is a due date as typed: empty, or YYYY-MM-DD.
func cleanDate(d string) (string, error) {
	d = strings.TrimSpace(d)
	if d == "" {
		return "", nil
	}
	if _, err := time.Parse("2006-01-02", d); err != nil {
		return "", badDueDate.New().OnField("due")
	}
	return d, nil
}

// visible fails Gone unless the thing is there and not hidden by a removal
// (its own or an owner's): every action on a set or question checks it in
// its write.
func visible(ctx context.Context, tx *sql.Tx, k change.Resource, id, thing string) error {
	var ok bool
	if err := tx.QueryRowContext(ctx, `SELECT `+store.Visible(k, "?"), id).Scan(&ok); err != nil {
		return errs.Database.Wrap(err)
	}
	if !ok {
		return errs.Gone.New("thing", thing)
	}
	return nil
}

func (s *Service) addSet(ctx context.Context, do *action.Do, in AddSet) error {
	title, err := cleanTitle(in.Title)
	if err != nil {
		return err
	}
	due, err := cleanDate(in.Due)
	if err != nil {
		return err
	}
	id := uuid.NewString()
	return do.Write(ctx, change.ResourceSet, id, func(tx *sql.Tx) error {
		if err := visible(ctx, tx, change.ResourceCourse, in.CourseID, "course"); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, `INSERT INTO sets (id, course_id, title, due, created_at) VALUES (?, ?, ?, ?, ?)`,
			id, in.CourseID, title, due, db.Now())
		return errs.Database.Of(err)
	})
}

// updateSet sets one column of a visible set, unless it already holds the
// value.
func (s *Service) updateSet(ctx context.Context, do *action.Do, id, column, value string) error {
	return do.Write(ctx, change.ResourceSet, id, func(tx *sql.Tx) error {
		if err := visible(ctx, tx, change.ResourceSet, id, "set"); err != nil {
			return err
		}
		var cur string
		if err := tx.QueryRowContext(ctx, `SELECT `+column+` FROM sets WHERE id = ?`, id).Scan(&cur); err != nil {
			return errs.Database.Wrap(err)
		}
		if cur == value {
			return action.ErrUnchanged
		}
		res, err := tx.ExecContext(ctx, `UPDATE sets SET `+column+` = ? WHERE id = ?`, value, id)
		return action.One(res, err, "set")
	})
}

func (s *Service) renameSet(ctx context.Context, do *action.Do, in RenameSet) error {
	title, err := cleanTitle(in.Title)
	if err != nil {
		return err
	}
	return s.updateSet(ctx, do, in.ID, "title", title)
}

func (s *Service) setDue(ctx context.Context, do *action.Do, in SetDue) error {
	due, err := cleanDate(in.Due)
	if err != nil {
		return err
	}
	return s.updateSet(ctx, do, in.ID, "due", due)
}

// turnIn marks a set turned in at the moment it is first marked, and keeps
// that moment if it is marked again; unmarking clears it.
func (s *Service) turnIn(ctx context.Context, do *action.Do, in TurnIn) error {
	return do.Write(ctx, change.ResourceSet, in.ID, func(tx *sql.Tx) error {
		if err := visible(ctx, tx, change.ResourceSet, in.ID, "set"); err != nil {
			return err
		}
		var at string
		if err := tx.QueryRowContext(ctx, `SELECT turned_in_at FROM sets WHERE id = ?`, in.ID).Scan(&at); err != nil {
			return errs.Database.Wrap(err)
		}
		if (at != "") == in.TurnedIn {
			return action.ErrUnchanged
		}
		next := ""
		if in.TurnedIn {
			next = db.Now()
		}
		res, err := tx.ExecContext(ctx, `UPDATE sets SET turned_in_at = ? WHERE id = ?`, next, in.ID)
		return action.One(res, err, "set")
	})
}

func (s *Service) removeSet(ctx context.Context, do *action.Do, in RemoveSet) error {
	return do.Write(ctx, change.ResourceSet, in.ID, func(tx *sql.Tx) error {
		if err := visible(ctx, tx, change.ResourceSet, in.ID, "set"); err != nil {
			return err
		}
		res, err := tx.ExecContext(ctx, `UPDATE sets SET removed_at = ? WHERE id = ?`, db.Now(), in.ID)
		return action.One(res, err, "set")
	})
}

// split is one question a draft becomes.
type split struct {
	text, label string
	notes       []string
	find        bool
}

// splitDraft is a draft as questions: a reference to several problems one
// each, in the textbook's numbering, with the professor's notes it carries;
// anything else one question as typed.
func splitDraft(d Draft, style probnum.Style) []split {
	refs, ok := ParseRefs(d.Text, style)
	if !d.Find || !ok {
		return []split{{text: strings.TrimSpace(d.Text), label: labelFromText(d.Text), find: d.Find}}
	}
	if len(refs) == 1 {
		return []split{{text: strings.TrimSpace(d.Text), label: refs[0].Label(style), notes: notesOf(refs[0]), find: true}}
	}
	out := make([]split, 0, len(refs))
	for _, r := range refs {
		text := r.Label(style)
		if r.Part != "" {
			text += r.Part
		}
		if r.Note != "" {
			text += " (" + r.Note + ")"
		}
		out = append(out, split{text: text, label: r.Label(style), notes: notesOf(r), find: true})
	}
	return out
}

// labelFromText is a typed problem's label: its first line, cut short.
func labelFromText(text string) string {
	first, _, _ := strings.Cut(strings.TrimSpace(text), "\n")
	first = strings.TrimSpace(first)
	if r := []rune(first); len(r) > 40 {
		return strings.TrimSpace(string(r[:39])) + "…"
	}
	return first
}

// style is how the course's textbooks number their problems, for reading a
// reference: the oldest textbook's that has worked it out. Track 5b's finder
// picks per set (ideas/dependencies-grill.md, D11).
func style(ctx context.Context, tx *sql.Tx, setID string) (probnum.Style, error) {
	var raw string
	err := tx.QueryRowContext(ctx, `SELECT m.problems FROM materials m JOIN sets t ON t.course_id = m.course_id
		WHERE t.id = ? AND m.textbook = 1 AND m.removed_at = '' AND m.problems != 'null'
		ORDER BY m.added_at, m.id LIMIT 1`, setID).Scan(&raw)
	var st probnum.Style
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return st, nil
	case err != nil:
		return st, errs.Database.Wrap(err)
	}
	return st, errs.Data.Of(json.Unmarshal([]byte(raw), &st))
}

func (s *Service) addQuestions(ctx context.Context, do *action.Do, in AddQuestions) error {
	var drafts []Draft
	for _, d := range in.Drafts {
		if strings.TrimSpace(d.Text) == "" {
			continue
		}
		if utf8.RuneCountInString(d.Text) > maxDraft {
			return draftTooLong.New().OnField("drafts")
		}
		drafts = append(drafts, d)
	}
	switch {
	case len(drafts) == 0:
		return noDrafts.New().OnField("drafts")
	case len(drafts) > maxDrafts:
		return tooManyDrafts.New("max", strconv.Itoa(maxDrafts)).OnField("drafts")
	}
	return do.Write(ctx, change.ResourceSet, in.SetID, func(tx *sql.Tx) error {
		if err := visible(ctx, tx, change.ResourceSet, in.SetID, "set"); err != nil {
			return err
		}
		st, err := style(ctx, tx, in.SetID)
		if err != nil {
			return err
		}
		// After every row, removed ones too: a removal undone keeps its
		// place, and a new one never lands on it.
		var next int
		if err := tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(position) + 1, 0) FROM questions WHERE set_id = ?`, in.SetID).Scan(&next); err != nil {
			return errs.Database.Wrap(err)
		}
		now := db.Now()
		for _, d := range drafts {
			for _, q := range splitDraft(d, st) {
				notes, err := json.Marshal(runLists(q.notes))
				if err != nil {
					return errs.Data.Wrap(err)
				}
				if _, err := tx.ExecContext(ctx, `INSERT INTO questions (id, set_id, position, text, label, notes, find, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, uuid.NewString(), in.SetID, next, q.text, q.label, string(notes), q.find, now); err != nil {
					return errs.Database.Wrap(err)
				}
				next++
			}
		}
		return nil
	})
}

// updateQuestion writes a visible question's columns, by a function of its
// current row; nil from fn is nothing to change.
func (s *Service) updateQuestion(ctx context.Context, do *action.Do, id string, fn func(tx *sql.Tx) (string, []any, error)) error {
	return do.Write(ctx, change.ResourceQuestion, id, func(tx *sql.Tx) error {
		if err := visible(ctx, tx, change.ResourceQuestion, id, "question"); err != nil {
			return err
		}
		set, args, err := fn(tx)
		if err != nil {
			return err
		}
		if set == "" {
			return action.ErrUnchanged
		}
		res, err := tx.ExecContext(ctx, `UPDATE questions SET `+set+` WHERE id = ?`, append(args, id)...)
		return action.One(res, err, "question")
	})
}

func (s *Service) markDone(ctx context.Context, do *action.Do, in QuestionMark) error {
	return s.updateQuestion(ctx, do, in.ID, func(tx *sql.Tx) (string, []any, error) {
		var at string
		if err := tx.QueryRowContext(ctx, `SELECT done_at FROM questions WHERE id = ?`, in.ID).Scan(&at); err != nil {
			return "", nil, errs.Database.Wrap(err)
		}
		if (at != "") == in.Done {
			return "", nil, nil
		}
		next := ""
		if in.Done {
			next = db.Now()
		}
		return "done_at = ?", []any{next}, nil
	})
}

func (s *Service) reveal(ctx context.Context, do *action.Do, in QuestionReveal) error {
	switch in.Reveal {
	case RevealHint, RevealWalkthrough, RevealAnswers:
	default:
		return badReveal.New("stage", strconv.Quote(string(in.Reveal))).OnField("reveal")
	}
	return s.updateQuestion(ctx, do, in.ID, func(tx *sql.Tx) (string, []any, error) {
		var raw string
		if err := tx.QueryRowContext(ctx, `SELECT revealed FROM questions WHERE id = ?`, in.ID).Scan(&raw); err != nil {
			return "", nil, errs.Database.Wrap(err)
		}
		var cur []Reveal
		if err := json.Unmarshal([]byte(raw), &cur); err != nil {
			return "", nil, errs.Data.Wrap(err)
		}
		if slices.Contains(cur, in.Reveal) {
			return "", nil, nil
		}
		next, err := json.Marshal(append(cur, in.Reveal))
		if err != nil {
			return "", nil, errs.Data.Wrap(err)
		}
		return "revealed = ?", []any{string(next)}, nil
	})
}

func (s *Service) setNotes(ctx context.Context, do *action.Do, in QuestionNotes) error {
	lines, err := cleanNotes(in.Notes)
	if err != nil {
		return err
	}
	next, err := json.Marshal(runLists(lines))
	if err != nil {
		return errs.Data.Wrap(err)
	}
	return s.updateQuestion(ctx, do, in.ID, func(tx *sql.Tx) (string, []any, error) {
		var cur string
		if err := tx.QueryRowContext(ctx, `SELECT notes FROM questions WHERE id = ?`, in.ID).Scan(&cur); err != nil {
			return "", nil, errs.Database.Wrap(err)
		}
		if cur == string(next) {
			return "", nil, nil
		}
		return "notes = ?", []any{string(next)}, nil
	})
}

// move puts a question at a place among its set's questions still there,
// from 0, and numbers them all again in order. A removed question keeps
// its number: undoing its removal puts it back about where it was.
func (s *Service) move(ctx context.Context, do *action.Do, in QuestionMove) error {
	return do.Write(ctx, change.ResourceQuestion, in.ID, func(tx *sql.Tx) error {
		if err := visible(ctx, tx, change.ResourceQuestion, in.ID, "question"); err != nil {
			return err
		}
		rows, err := tx.QueryContext(ctx, `SELECT id, position FROM questions WHERE removed_at = ''
			AND set_id = (SELECT set_id FROM questions WHERE id = ?) ORDER BY position, created_at, id`, in.ID)
		if err != nil {
			return errs.Database.Wrap(err)
		}
		var ids []string
		pos := map[string]int{}
		for rows.Next() {
			var id string
			var p int
			if err := rows.Scan(&id, &p); err != nil {
				return errs.Database.Of(errors.Join(err, rows.Close()))
			}
			ids, pos[id] = append(ids, id), p
		}
		if err := errors.Join(rows.Err(), rows.Close()); err != nil {
			return errs.Database.Wrap(err)
		}
		from := slices.Index(ids, in.ID)
		to := min(max(in.Position, 0), len(ids)-1)
		if from == to {
			return action.ErrUnchanged
		}
		ids = slices.Insert(slices.Delete(ids, from, from+1), to, in.ID)
		// The numbers they take: their own, in order, so removed rows
		// between them keep theirs.
		numbers := make([]int, 0, len(ids))
		for _, id := range ids {
			numbers = append(numbers, pos[id])
		}
		slices.Sort(numbers)
		for i, id := range ids {
			if pos[id] == numbers[i] {
				continue
			}
			if _, err := tx.ExecContext(ctx, `UPDATE questions SET position = ? WHERE id = ?`, numbers[i], id); err != nil {
				return errs.Database.Wrap(err)
			}
		}
		return nil
	})
}

func (s *Service) removeQuestion(ctx context.Context, do *action.Do, in RemoveQuestion) error {
	return do.Write(ctx, change.ResourceQuestion, in.ID, func(tx *sql.Tx) error {
		if err := visible(ctx, tx, change.ResourceQuestion, in.ID, "question"); err != nil {
			return err
		}
		res, err := tx.ExecContext(ctx, `UPDATE questions SET removed_at = ? WHERE id = ?`, db.Now(), in.ID)
		return action.One(res, err, "question")
	})
}
