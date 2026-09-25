package library

import (
	"context"
	"encoding/json"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/probnum"
)

// detectProblems works out how a book numbers its problems from its
// pages' text (index i is PDF page i+1) and its numbered contents.
func detectProblems(secs []section, pages []string) (probnum.Style, bool) {
	var parts []probnum.Part
	for _, s := range secs {
		if n := probnum.PartNumber(s.Title); n != "" {
			parts = append(parts, probnum.Part{Number: n, Title: s.Title, Start: s.StartPage, End: s.EndPage})
		}
	}
	return probnum.Detect(pages, parts)
}

// Parts is the book's numbered chapters and sections, on PDF pages, in
// contents order.
func (s *Service) Parts(ctx context.Context, bookID string) ([]probnum.Part, error) {
	secs, err := loadSections(ctx, s.c.DB, bookID)
	if err != nil {
		return nil, err
	}
	var parts []probnum.Part
	for _, sec := range secs {
		if n := probnum.PartNumber(sec.Title); n != "" {
			parts = append(parts, probnum.Part{Number: n, Title: sec.Title, Start: sec.StartPage, End: sec.EndPage})
		}
	}
	return parts, nil
}

// saveProblems stores a detected style, never over one the student
// confirmed.
func saveProblems(ctx context.Context, d queryer, bookID string, st probnum.Style) error {
	b, _ := json.Marshal(st)
	_, err := d.ExecContext(ctx, `UPDATE books SET problem_style = ?, updated_at = ? WHERE id = ?
		AND (problem_style = '' OR json_extract(problem_style, '$.confirmed') = 0)`, string(b), db.Now(), bookID)
	return err
}

// patchProblems is the student's word on the style: confirmed, and sure.
// The heading and the example stay while the form they came with does.
func patchProblems(cur *probnum.Style, p ProblemsPatch) (probnum.Style, error) {
	switch p.Form {
	case probnum.FormChapter, probnum.FormSection, probnum.FormLocal:
	default:
		return probnum.Style{}, httpx.Invalid("problems", "That isn't a way of numbering problems.")
	}
	switch p.Where {
	case probnum.WhereChapter, probnum.WhereSection:
	default:
		return probnum.Style{}, httpx.Invalid("problems", "Problems sit after each section or at each chapter's end.")
	}
	st := probnum.Style{Form: p.Form, Where: p.Where, Sure: true, Confirmed: true}
	if cur != nil {
		st.Heading = cur.Heading
		if cur.Form == p.Form {
			st.Example = cur.Example
		}
	}
	return st, nil
}

// fillProblems works out the style of every ready book from before
// styles, from the text and contents it already has.
func fillProblems(ctx context.Context, d queryer) error {
	rows, err := d.QueryContext(ctx, `SELECT id, page_count FROM books WHERE problem_style = '' AND state = 'ready'`)
	if err != nil {
		return err
	}
	type bare struct {
		id    string
		count int
	}
	var todo []bare
	for rows.Next() {
		var b bare
		if err := rows.Scan(&b.id, &b.count); err != nil {
			rows.Close()
			return err
		}
		todo = append(todo, b)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, b := range todo {
		secs, err := loadSections(ctx, d, b.id)
		if err != nil {
			return err
		}
		stored, err := loadPages(ctx, d, b.id)
		if err != nil {
			return err
		}
		texts := make([]string, b.count)
		for _, p := range stored {
			if p.Number >= 1 && p.Number <= b.count {
				texts[p.Number-1] = p.Text
			}
		}
		st, ok := detectProblems(secs, texts)
		if !ok {
			// Nothing numbered to go on: the student is asked.
			st = probnum.Style{}
		}
		if err := saveProblems(ctx, d, b.id, st); err != nil {
			return err
		}
	}
	return nil
}
