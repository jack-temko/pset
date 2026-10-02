package library

import (
	"context"
	"strconv"

	"github.com/jackt/pset/internal/db"
)

// Covers: every book is a clothbound board in one of six colours, the
// --cover-* tokens in web/src/index.css. A book's colour is picked when it
// is added and kept: the one fewest books on the shelf wear, with the
// search starting at the colour its sha seeds, so ties go the way the hash
// says. The student can change it in the Book dialog.

// covers in the order the seed counts through them.
var covers = []Cover{CoverIndigo, CoverTeal, CoverAmber, CoverRose, CoverViolet, CoverSlate}

func validCover(c Cover) bool {
	for _, x := range covers {
		if x == c {
			return true
		}
	}
	return false
}

// pickCover is the colour fewest books wear (used counts them), searched
// from the one the sha's first byte seeds.
func pickCover(sha string, used map[Cover]int) Cover {
	seed := 0
	if len(sha) >= 2 {
		if b, err := strconv.ParseUint(sha[:2], 16, 8); err == nil {
			seed = int(b)
		}
	}
	best := covers[seed%len(covers)]
	for i := range covers {
		c := covers[(seed+i)%len(covers)]
		if used[c] < used[best] {
			best = c
		}
	}
	return best
}

// coversInUse counts the colours the shelf's books wear.
func coversInUse(ctx context.Context, q queryer) (map[Cover]int, error) {
	rows, err := q.QueryContext(ctx, `SELECT cover, count(*) FROM books WHERE cover != '' GROUP BY cover`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	used := map[Cover]int{}
	for rows.Next() {
		var c Cover
		var n int
		if err := rows.Scan(&c, &n); err != nil {
			return nil, err
		}
		used[c] = n
	}
	return used, rows.Err()
}

// fillCovers gives a colour to every book without one, oldest first, as
// if each had been picked when it was added: books from before colours
// were kept.
func fillCovers(ctx context.Context, d queryer) error {
	rows, err := d.QueryContext(ctx, `SELECT id, sha256 FROM books WHERE cover = '' ORDER BY created_at, id`)
	if err != nil {
		return err
	}
	type bare struct{ id, sha string }
	var todo []bare
	for rows.Next() {
		var b bare
		if err := rows.Scan(&b.id, &b.sha); err != nil {
			rows.Close()
			return err
		}
		todo = append(todo, b)
	}
	rows.Close()
	if err := rows.Err(); err != nil || len(todo) == 0 {
		return err
	}
	used, err := coversInUse(ctx, d)
	if err != nil {
		return err
	}
	for _, b := range todo {
		c := pickCover(b.sha, used)
		used[c]++
		if _, err := d.ExecContext(ctx, `UPDATE books SET cover = ?, updated_at = ? WHERE id = ?`, c, db.Now(), b.id); err != nil {
			return err
		}
	}
	return nil
}
