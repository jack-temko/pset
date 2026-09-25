package homework

import (
	"context"
	"database/sql"
	"regexp"
	"slices"
	"strings"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/jobs"
)

// The professor's notes on a problem: what to do ("do c", "also graph
// the solution"), what not to ("no PSpice or MultiSim"), what's changed
// ("for 500 packets, each with 150 bits"). The guide follows them over
// the book. Spec: ideas/professor-notes.md.

var (
	// Points are for the grade, not the working: "4 pts each", "(9 pts)".
	notePoints = regexp.MustCompile(`(?i)^\d+\s*(pts?|points?)\.?(\s+each)?$`)
	// A page hint is where to find it, which the finder already used.
	notePage = regexp.MustCompile(`(?i)^(all\s+)?(on|at)\s+(page|pg\.?|p\.)\s*\d+$`)
)

// maxNotes and maxNote bound a question's notes.
const (
	maxNotes = 12
	maxNote  = 300
)

// notesOf is a reference's note as the professor's instructions, one a
// line: a list of short ones split apart ("do c, 6 pts each"), a sentence
// kept whole, the points and page hints left out, and a part the
// reference names ("7c") said plainly.
func notesOf(ref Ref) []string {
	var out []string
	if ref.Part != "" {
		out = append(out, "Only part ("+ref.Part+").")
	}
	for _, chunk := range strings.Split(ref.Note, ";") {
		pieces := strings.Split(chunk, ",")
		// A sentence with a comma in it stays one note; a list of short
		// ones splits.
		short := true
		for _, p := range pieces {
			if len(strings.Fields(p)) > 4 {
				short = false
			}
		}
		if !short {
			pieces = []string{chunk}
		}
		for _, p := range pieces {
			p = strings.TrimSpace(strings.TrimRight(strings.TrimSpace(p), "."))
			if p == "" || notePoints.MatchString(p) || notePage.MatchString(p) {
				continue
			}
			out = append(out, p)
		}
	}
	return out
}

// cleanNotes is notes as the student typed them: trimmed, blank lines
// dropped, a list marker taken off, within the caps.
func cleanNotes(lines []string) ([]string, error) {
	out := []string{}
	for _, l := range lines {
		l = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(l), "- "))
		if l == "" {
			continue
		}
		if len([]rune(l)) > maxNote {
			return nil, httpx.Invalid("notes", "Keep each note under %d characters.", maxNote)
		}
		out = append(out, l)
	}
	if len(out) > maxNotes {
		return nil, httpx.Invalid("notes", "Keep it to %d notes.", maxNotes)
	}
	return out, nil
}

// setNotes replaces a question's notes. A guide that's written, or being
// written, is written again from them; one not started yet just reads
// them when it does.
func (s *Service) setNotes(ctx context.Context, q row, lines []string) (Question, error) {
	notes, err := cleanNotes(lines)
	if err != nil {
		return Question{}, err
	}
	if slices.Equal(notes, q.Notes) {
		return q.Question, nil
	}
	switch q.State {
	case StatePending, StateLocating, StateLocated, StateReading:
		// Nothing written from the old notes yet.
		if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET notes = ?, updated_at = ? WHERE id = ?`, mustJSON(notes), db.Now(), q.ID); err != nil {
			return Question{}, err
		}
		return s.publishQuestion(ctx, q.ID)
	}
	if q.Page == nil && q.InBook {
		// Failed before it was found: the notes wait for the find.
		if _, err := s.c.DB.ExecContext(ctx, `UPDATE questions SET notes = ?, updated_at = ? WHERE id = ?`, mustJSON(notes), db.Now(), q.ID); err != nil {
			return Question{}, err
		}
		return s.publishQuestion(ctx, q.ID)
	}
	return s.rewrite(ctx, q, nextStep(q.ID, false), `notes = ?`, mustJSON(notes))
}

// rewrite changes a question and writes its guide again: whatever guide
// it had, or was writing, is stopped and cleared, and next is queued. set
// is the change, as SQL assignments with their arguments.
func (s *Service) rewrite(ctx context.Context, q row, next jobs.Spec, set string, args ...any) (Question, error) {
	s.c.Queue.StopSubject(ctx, q.ID)
	err := db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		// Memory lines go with the guide they came from, but for the one
		// that found the problem; the new guide starts its own.
		args := append(args, MemoryUseFound, StateLocated, db.Now(), q.ID)
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET `+set+`, hint = '[]', walkthrough = '[]', rounds = '[]',
			memory = coalesce((SELECT json_group_array(json(value)) FROM json_each(memory) WHERE json_extract(value, '$.use') = ?), '[]'),
			state = ?, failure = '', reason = '', activity = '', updated_at = ? WHERE id = ?`, args...); err != nil {
			return err
		}
		_, err := s.c.Queue.Enqueue(ctx, tx, next)
		return err
	})
	if err != nil {
		return Question{}, err
	}
	s.c.Queue.Wake()
	return s.publishQuestion(ctx, q.ID)
}
