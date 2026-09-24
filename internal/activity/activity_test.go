package activity

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackt/pset/internal/db"
)

type hw struct{}

func (hw) QuestionsDoneSince(context.Context, time.Time) (int, int, error) { return 5, 2, nil }

func TestHeartbeatsBecomeTheWeek(t *testing.T) {
	ctx := context.Background()
	d, _ := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	defer d.Close()
	db.Migrate(ctx, d, append([]db.Migration{{Name: "t/books", SQL: `CREATE TABLE books (id TEXT PRIMARY KEY)`}}, Migrations()...))
	d.Exec(`INSERT INTO books VALUES ('a'), ('b')`)
	s := New(d, hw{})
	clock := time.Date(2026, 9, 21, 10, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return clock }
	beat := func(book string, k Kind, n int) {
		for range n {
			if err := s.Record(ctx, Heartbeat{BookID: book, Kind: k}); err != nil {
				t.Fatal(err)
			}
			clock = clock.Add(Beat)
		}
	}
	beat("a", KindReading, 4)  // 2 minutes
	beat("a", KindHomework, 6) // 3 minutes
	beat("b", KindAsking, 2)   // 1 minute
	// A second tab beating in the same half-minute counts once.
	clock = clock.Add(-Beat * 2 / 3)
	s.Record(ctx, Heartbeat{BookID: "b", Kind: KindAsking})
	// Last week's time doesn't count.
	d.Exec(`INSERT INTO heartbeats VALUES ('a', 'reading', '2026-09-10T10:00:00Z')`)

	w, err := s.Week(ctx, time.Date(2026, 9, 21, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	if w.Reading != 2 || w.Homework != 3 || w.Asking != 1 || w.Questions != 5 || w.ProblemSets != 2 {
		t.Fatalf("%+v", w)
	}
	if len(w.ByBook) != 2 || w.ByBook[0].BookID != "a" || w.ByBook[0].Minutes != 5 {
		t.Fatalf("by book %+v", w.ByBook)
	}
	if err := s.Record(ctx, Heartbeat{BookID: "a", Kind: "napping"}); err == nil {
		t.Fatal("unknown kind accepted")
	}
}

func TestClearForgetsTimeButNotQuestions(t *testing.T) {
	ctx := context.Background()
	d, _ := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	defer d.Close()
	db.Migrate(ctx, d, append([]db.Migration{{Name: "t/books", SQL: `CREATE TABLE books (id TEXT PRIMARY KEY)`}}, Migrations()...))
	d.Exec(`INSERT INTO books VALUES ('a')`)
	s := New(d, hw{})
	s.now = func() time.Time { return time.Date(2026, 9, 21, 10, 0, 0, 0, time.UTC) }
	if err := s.Record(ctx, Heartbeat{BookID: "a", Kind: KindReading}); err != nil {
		t.Fatal(err)
	}
	d.Exec(`INSERT INTO heartbeats VALUES ('a', 'homework', '2026-09-21T09:00:00Z')`)

	if err := s.Clear(ctx); err != nil {
		t.Fatal(err)
	}
	w, err := s.Week(ctx, time.Date(2026, 9, 21, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	if w.Reading != 0 || w.Homework != 0 || w.Asking != 0 || len(w.ByBook) != 0 {
		t.Fatalf("time left after clear: %+v", w)
	}
	if w.Questions != 5 || w.ProblemSets != 2 {
		t.Fatalf("questions worked should stay: %+v", w)
	}
}
