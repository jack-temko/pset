package library

import (
	"context"
	"encoding/json"
	"slices"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/pagenum"
)

// detectRuns works out how a book's printed numbers run from its pages'
// text (index i is PDF page i+1), from the numbers in their heads and
// feet: see pagenum.Detect.
func detectRuns(pages []string) ([]pagenum.Run, bool) {
	nums := make([][]int, len(pages))
	for i, text := range pages {
		if lines := nonEmptyLines(text); len(lines) > 0 {
			nums[i] = append([]int{}, edgeNumbers(lines)...)
		}
	}
	return pagenum.Detect(nums)
}

func runsJSON(runs []pagenum.Run) string {
	b, _ := json.Marshal(pagenum.New(runs).Runs())
	return string(b)
}

// checkRuns is the student's numbering, checked: every run starts inside
// the book, and its offset keeps printed page 1 inside it too.
func checkRuns(runs []pagenum.Run, pageCount int) error {
	if len(runs) == 0 {
		return httpx.Invalid("pageRuns", "Say where printed page 1 is.")
	}
	for _, r := range runs {
		if r.From < 1 || (pageCount > 0 && r.From > pageCount) {
			return httpx.Invalid("pageRuns", "Each PDF page has to be inside the book: 1 to %d.", max(pageCount, 1))
		}
		if printed := r.From - r.Offset; printed < 1-pageCount || (pageCount > 0 && r.Offset >= pageCount) {
			return httpx.Invalid("pageRuns", "PDF page %d can't be printed as page %d.", r.From, printed)
		}
	}
	return nil
}

// fillPageRuns works out the numbering of every book from before runs,
// from the text it already has. A detected numbering replaces the old
// offset when the student never set it, or when it agrees with them
// somewhere: a book whose scan lost a page had one of its two offsets
// right, and keeps it where it was right.
func fillPageRuns(ctx context.Context, d queryer) error {
	rows, err := d.QueryContext(ctx, `SELECT id, page_count, page_offset, edited FROM books WHERE page_runs = '' AND state = 'ready'`)
	if err != nil {
		return err
	}
	type bare struct {
		id            string
		count, offset int
		edited        bool
	}
	var todo []bare
	for rows.Next() {
		var b bare
		if err := rows.Scan(&b.id, &b.count, &b.offset, &b.edited); err != nil {
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
		pages, err := loadPages(ctx, d, b.id)
		if err != nil {
			return err
		}
		texts := make([]string, b.count)
		for _, p := range pages {
			if p.Number >= 1 && p.Number <= b.count {
				texts[p.Number-1] = p.Text
			}
		}
		runs := []pagenum.Run{{From: 1, Offset: b.offset}}
		if found, ok := detectRuns(texts); ok {
			agrees := slices.ContainsFunc(found, func(r pagenum.Run) bool { return r.Offset == b.offset })
			if !b.edited || agrees {
				runs = found
			}
		}
		if _, err := d.ExecContext(ctx, `UPDATE books SET page_runs = ?, page_offset = ?, updated_at = ? WHERE id = ?`,
			runsJSON(runs), runs[0].Offset, db.Now(), b.id); err != nil {
			return err
		}
	}
	return nil
}
