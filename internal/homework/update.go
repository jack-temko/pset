package homework

import (
	"context"
	"encoding/json"
	"slices"
	"strings"

	"github.com/jackt/pset/internal/probnum"
)

// Updating a set from a document: the one comparison behind reading a
// course page again (the dates already added) and "Update from an
// assignment" on any set. A document's lines against a set's questions
// come out as what's new (added), what's changed (a problem's
// professor's instructions, rewritten), and what the document no longer
// lists (offered for removal). Nothing already there is found or written
// again unless its instructions change.

// setContents is what a set has, to tell a document's lines it already
// holds.
type setContents struct {
	qs      []setQ
	byLabel map[string]*setQ
	texts   map[string]bool
}

type setQ struct {
	id    string
	label string
	notes []string
	// inBook questions only: every label it's known by.
	labels []string
}

// setHas reads a set's contents; no set is an empty one. A problem is
// known by the labels it was added under and the one finding gave it,
// since the finder may name it the book's way.
func (s *Service) setHas(ctx context.Context, setID string, style probnum.Style) (setContents, error) {
	c := setContents{byLabel: map[string]*setQ{}, texts: map[string]bool{}}
	if setID == "" {
		return c, nil
	}
	rows, err := s.c.DB.QueryContext(ctx, `SELECT id, text, in_book, label, notes FROM questions WHERE homework_id = ? ORDER BY position`, setID)
	if err != nil {
		return c, err
	}
	defer rows.Close()
	for rows.Next() {
		var q setQ
		var text, notes string
		var inBook bool
		if err := rows.Scan(&q.id, &text, &inBook, &q.label, &notes); err != nil {
			return c, err
		}
		c.texts[normText(text)] = true
		if !inBook {
			continue
		}
		q.notes = []string{}
		json.Unmarshal([]byte(notes), &q.notes)
		for _, sp := range splitDraft(Draft{Text: text, InBook: true}, style) {
			q.labels = append(q.labels, sp.label)
		}
		if q.label != "" && !slices.Contains(q.labels, q.label) {
			q.labels = append(q.labels, q.label)
		}
		if len(q.labels) > 0 {
			q.label = q.labels[0]
		}
		c.qs = append(c.qs, q)
	}
	if err := rows.Err(); err != nil {
		return c, err
	}
	for i := range c.qs {
		for _, l := range c.qs[i].labels {
			c.byLabel[l] = &c.qs[i]
		}
	}
	return c, nil
}

// compare marks a document's date against the set: each line's labels
// the set has, whether it has the whole line, whose instructions
// changed, and the set's problems the date doesn't list.
func (c setContents) compare(g *AssignmentGroup) {
	g.Gone = []SetQuestion{}
	listed := map[string]bool{}
	for ri := range g.Rows {
		row := &g.Rows[ri]
		row.Present, row.Changed, row.Added = []string{}, []NotesChange{}, false
		for _, l := range row.Labels {
			q := c.byLabel[l]
			if q == nil {
				continue
			}
			listed[q.id] = true
			row.Present = append(row.Present, l)
			if row.Kind == RowKindBook && !slices.Equal(q.notes, row.Notes) {
				row.Changed = append(row.Changed, NotesChange{QuestionID: q.id, Label: l, Was: q.notes, Now: row.Notes})
			}
		}
		if row.Kind == RowKindBook && len(row.Labels) > 0 {
			row.Added = len(row.Present) == len(row.Labels)
		} else {
			row.Added = c.texts[normText(row.Text)]
		}
	}
	if len(c.qs) == 0 {
		return
	}
	for _, q := range c.qs {
		if !listed[q.id] {
			g.Gone = append(g.Gone, SetQuestion{QuestionID: q.id, Label: q.label})
		}
	}
}

// holds says whether the set has a line: a problem by label, anything by
// its text.
func (c setContents) holds(d Draft, label string) bool {
	return (d.InBook && label != "" && c.byLabel[label] != nil) || c.texts[normText(d.Text)]
}

// normText is a line's text as compared: case and spacing don't count.
func normText(t string) string {
	return strings.ToLower(strings.Join(strings.Fields(t), " "))
}

// updateSet applies what the student kept of a date's changes to its set:
// new lines added (what the set has skipped), instructions rewritten
// (only those questions' guides are written again), and questions taken
// out. It reports whether anything changed.
func (s *Service) updateSet(ctx context.Context, g ImportGroup, style probnum.Style) (bool, error) {
	has, err := s.setHas(ctx, g.SetID, style)
	if err != nil {
		return false, err
	}
	var rows []Draft
	for _, r := range g.Rows {
		if strings.TrimSpace(r.Text) == "" {
			continue
		}
		for _, sp := range splitDraft(r, style) {
			if !has.holds(sp.Draft, sp.label) {
				rows = append(rows, sp.Draft)
			}
		}
	}
	mine := map[string]bool{}
	for _, q := range has.qs {
		mine[q.id] = true
	}
	changed := false
	for _, n := range g.Notes {
		if !mine[n.QuestionID] {
			continue
		}
		notes := n.Notes
		if _, err := s.UpdateQuestion(ctx, n.QuestionID, QuestionPatch{Notes: &notes}); err != nil {
			return changed, err
		}
		changed = true
	}
	for _, id := range g.Remove {
		if !mine[id] {
			continue
		}
		if err := s.RemoveQuestion(ctx, id); err != nil && !isNotFound(err) {
			return changed, err
		}
		changed = true
	}
	if len(rows) > 0 {
		if _, err := s.Add(ctx, g.SetID, rows); err != nil {
			return changed, err
		}
		changed = true
	}
	return changed, nil
}
