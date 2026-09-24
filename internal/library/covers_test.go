package library

import (
	"context"
	"fmt"
	"testing"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
)

func TestPickCover(t *testing.T) {
	// Your three books all seed teal (d9, 37 and bb are 1 mod 6).
	used := map[Cover]int{}
	var got []Cover
	for _, sha := range []string{"d9aa", "37bb", "bbcc"} {
		c := pickCover(sha, used)
		used[c]++
		got = append(got, c)
	}
	if got[0] != CoverTeal || got[1] == got[0] || got[2] == got[0] || got[2] == got[1] {
		t.Fatalf("picked %v", got)
	}
	// Six books wear six colours; the seventh doubles one up.
	used = map[Cover]int{}
	for i := range 7 {
		used[pickCover(fmt.Sprintf("%02x", i*6), used)]++
	}
	for _, c := range covers {
		if used[c] < 1 || used[c] > 2 {
			t.Fatalf("spread %v", used)
		}
	}
}

func TestUploadPicksDistinctCovers(t *testing.T) {
	e := newEnv(t)
	seen := map[Cover]bool{}
	for i := range 3 {
		var up BookChanged
		e.upload(t, fmt.Sprintf("b%d.pdf", i), fixturePDF(t, 0, 2, fmt.Sprintf("Book %d", i)), &up)
		if !validCover(up.Book.Cover) || seen[up.Book.Cover] {
			t.Fatalf("book %d: cover %q (have %v)", i, up.Book.Cover, seen)
		}
		seen[up.Book.Cover] = true
	}
}

func TestFillCoversGivesOldBooksDistinctColours(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	for i, sha := range []string{"d9", "37", "bb"} {
		if _, err := e.svc.c.DB.ExecContext(ctx, `INSERT INTO books (id, sha256, title, state, created_at, updated_at) VALUES (?, ?, 'Old', 'ready', ?, ?)`,
			fmt.Sprint("old", i), sha, fmt.Sprintf("2026-09-0%dT00:00:00Z", i+1), db.Now()); err != nil {
			t.Fatal(err)
		}
	}
	if err := fillCovers(ctx, e.svc.c.DB); err != nil {
		t.Fatal(err)
	}
	books, _ := e.svc.List(ctx)
	seen := map[Cover]bool{}
	for _, b := range books {
		if !validCover(b.Cover) || seen[b.Cover] {
			t.Fatalf("covers %+v", books)
		}
		seen[b.Cover] = true
	}
	if books[0].Cover != CoverTeal {
		t.Fatalf("the oldest keeps its seeded colour: %q", books[0].Cover)
	}
}

func TestChangingTheCover(t *testing.T) {
	e := newEnv(t)
	var up BookChanged
	e.upload(t, "a.pdf", fixturePDF(t, 0, 2, "A"), &up)
	id := up.Book.ID
	e.waitFor(t, id, StateReady)

	var er httpx.Error
	bad := Cover("plaid")
	if code := e.do(t, "PATCH", "/api/books/"+id, BookPatch{Cover: &bad}, &er); code != 422 || er.Field != "cover" {
		t.Fatalf("plaid: %d %+v", code, er)
	}
	rose := CoverRose
	var b Book
	if code := e.do(t, "PATCH", "/api/books/"+id, BookPatch{Cover: &rose}, &b); code != 200 || b.Cover != CoverRose {
		t.Fatalf("rose: %d %+v", code, b)
	}
	// A colour isn't a name: a retried import may still name the book.
	r, _ := getBook(context.Background(), e.svc.c.DB, id)
	if r.Edited {
		t.Fatal("changing the colour marked the name as edited")
	}
}
