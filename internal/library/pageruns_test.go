package library

import (
	"context"
	"fmt"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/jobs"
	"github.com/jackt/pset/internal/pagenum"
)

// scanText is a scanned page's text with its printed number in the head,
// as OCR reads a book's running head: "84 CHAPTER 2 ...".
func scanText(printed int) string {
	if printed < 1 {
		return "Preface\nSome words about the book.\nMore of them."
	}
	return fmt.Sprintf("%d CHAPTER 2 First-Order Differential Equations\nThe body of the page.\nMore of it.\nAnd a last line.", printed)
}

// A scan that lost printed page 85, as Boyce's did.
func lostPageBook(pages int) []string {
	out := make([]string, pages)
	for p := 1; p <= pages; p++ {
		switch {
		case p <= 12:
			out[p-1] = scanText(0)
		case p <= 96:
			out[p-1] = scanText(p - 12)
		default:
			out[p-1] = scanText(p - 11)
		}
	}
	return out
}

func TestDetectRunsFromScanText(t *testing.T) {
	runs, ok := detectRuns(lostPageBook(200))
	if want := []pagenum.Run{{From: 1, Offset: 12}, {From: 97, Offset: 11}}; !ok || !reflect.DeepEqual(runs, want) {
		t.Fatalf("runs %+v %v, want %+v", runs, ok, want)
	}
}

// Books from before runs get theirs from the text they have: a book the
// student never numbered takes what's detected, one they did keeps
// theirs unless the detected runs agree with it somewhere.
func TestFillPageRuns(t *testing.T) {
	ctx := context.Background()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	if err := db.Migrate(ctx, d, append(jobs.Migrations(), Migrations()...)); err != nil {
		t.Fatal(err)
	}
	add := func(id string, offset int, edited bool, texts []string) {
		if _, err := d.Exec(`INSERT INTO books (id, sha256, title, page_count, page_offset, edited, state, created_at, updated_at)
			VALUES (?, ?, 'T', ?, ?, ?, 'ready', '', '')`, id, id, len(texts), offset, edited); err != nil {
			t.Fatal(err)
		}
		for i, text := range texts {
			if err := savePage(ctx, d, id, storedPage{Number: i + 1, Text: text, Status: "text"}); err != nil {
				t.Fatal(err)
			}
		}
	}
	add("lost", 11, true, lostPageBook(200))  // the stored offset is right after the gap
	add("mine", 3, true, lostPageBook(200))   // the student set something else entirely
	add("plain", 0, false, lostPageBook(200)) // never set: detection wins
	if err := fillPageRuns(ctx, d); err != nil {
		t.Fatal(err)
	}
	for id, want := range map[string][]pagenum.Run{
		"lost":  {{From: 1, Offset: 12}, {From: 97, Offset: 11}},
		"mine":  {{From: 1, Offset: 3}},
		"plain": {{From: 1, Offset: 12}, {From: 97, Offset: 11}},
	} {
		b, err := getBook(ctx, d, id)
		if err != nil || !reflect.DeepEqual(b.PageRuns, want) {
			t.Errorf("%s: %+v %v, want %+v", id, b.PageRuns, err, want)
		}
	}
}
