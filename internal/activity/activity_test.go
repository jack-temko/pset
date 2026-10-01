package activity

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackt/pset/internal/db"
)

type hw struct{}

func (hw) QuestionsDoneSince(context.Context, time.Time) (int, int, error) { return 5, 2, nil }

var books = db.Migration{Name: "t/books", SQL: `CREATE TABLE books (id TEXT PRIMARY KEY)`}

func open(t *testing.T, migs []db.Migration) *sql.DB {
	t.Helper()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	if err := db.Migrate(context.Background(), d, append([]db.Migration{books}, migs...)); err != nil {
		t.Fatal(err)
	}
	d.Exec(`INSERT INTO books VALUES ('a'), ('b')`)
	return d
}

var monday = time.Date(2026, 9, 21, 0, 0, 0, 0, time.UTC)

func at(h, m int) string {
	return monday.Add(time.Duration(h)*time.Hour + time.Duration(m)*time.Minute).Format(time.RFC3339)
}

func TestStretchesBecomeTheWeek(t *testing.T) {
	ctx := context.Background()
	s := New(open(t, Migrations()), hw{})
	s.now = func() time.Time { return monday.Add(12 * time.Hour) }
	save := func(st Stretch) {
		t.Helper()
		if err := s.Save(ctx, st); err != nil {
			t.Fatal(err)
		}
	}
	// 25 minutes of homework on paper with the question open, saved as it
	// grew, then once more late and stale: its end only moves on.
	save(Stretch{"h1", "a", KindHomework, at(9, 0), at(9, 10), ""})
	save(Stretch{"h1", "a", KindHomework, at(9, 0), at(9, 25), ""})
	save(Stretch{"h1", "a", KindHomework, at(9, 0), at(9, 20), ""})
	// Reading in two tabs at once, overlapping: 10 minutes, not 16.
	save(Stretch{"r1", "a", KindReading, at(10, 0), at(10, 8), ""})
	save(Stretch{"r2", "a", KindReading, at(10, 2), at(10, 10), ""})
	save(Stretch{"k1", "b", KindAsking, at(11, 0), at(11, 3), ""})
	// Last week's time doesn't count, and a stretch across the week's
	// start counts from it.
	save(Stretch{"old", "b", KindAsking, monday.Add(-2 * time.Hour).Format(time.RFC3339), monday.Add(-time.Hour).Format(time.RFC3339), ""})
	save(Stretch{"edge", "b", KindAsking, monday.Add(-time.Hour).Format(time.RFC3339), at(0, 2), ""})
	// A clock ahead of the server's can't claim the future.
	save(Stretch{"ahead", "b", KindReading, at(11, 58), at(14, 0), ""})

	w, err := s.Week(ctx, monday)
	if err != nil {
		t.Fatal(err)
	}
	if w.Homework != 25 || w.Reading != 12 || w.Asking != 5 || w.Questions != 5 || w.ProblemSets != 2 {
		t.Fatalf("%+v", w)
	}
	if len(w.ByBook) != 2 || w.ByBook[0].BookID != "a" || w.ByBook[0].Minutes != 35 || w.ByBook[1].Minutes != 7 {
		t.Fatalf("by book %+v", w.ByBook)
	}
	if err := s.Save(ctx, Stretch{"x", "a", "napping", at(1, 0), at(1, 1), ""}); err == nil {
		t.Fatal("unknown kind accepted")
	}
	if err := s.Save(ctx, Stretch{"y", "gone", KindReading, at(1, 0), at(1, 1), ""}); err == nil {
		t.Fatal("a book that doesn't exist got time")
	}
}

// The heartbeats before stretches become stretches: a book's beats of one
// kind a half-minute apart run together, each the half-minute before it.
func TestBeatsBecomeStretches(t *testing.T) {
	ctx := context.Background()
	migs := Migrations()
	d := open(t, migs[:1])
	beat := func(book, kind string, h, m, sec int) {
		d.Exec(`INSERT INTO heartbeats VALUES (?, ?, ?)`, book, kind, db.At(monday.Add(time.Duration(h)*time.Hour+time.Duration(m)*time.Minute+time.Duration(sec)*time.Second)))
	}
	for i := range 4 { // 2 minutes of reading
		beat("a", "reading", 9, 0, 30*i)
	}
	for i := range 6 { // 3 minutes of homework, with a gap before the last two
		sec := 30 * i
		if i >= 4 {
			sec += 600
		}
		beat("a", "homework", 10, 0, sec)
	}
	beat("b", "asking", 11, 0, 0)
	if err := db.Migrate(ctx, d, append([]db.Migration{books}, migs...)); err != nil {
		t.Fatal(err)
	}
	var n int
	d.QueryRow(`SELECT count(*) FROM study`).Scan(&n)
	if n != 4 {
		t.Fatalf("%d stretches, want 4", n)
	}
	if err := d.QueryRow(`SELECT count(*) FROM heartbeats`).Scan(&n); err == nil {
		t.Fatal("the heartbeats table survived")
	}
	w, err := New(d, nil).Week(ctx, monday)
	if err != nil {
		t.Fatal(err)
	}
	if w.Reading != 2 || w.Homework != 3 || w.Asking != 1 {
		t.Fatalf("%+v", w)
	}
}

func TestClearForgetsTimeButNotQuestions(t *testing.T) {
	ctx := context.Background()
	s := New(open(t, Migrations()), hw{})
	s.now = func() time.Time { return monday.Add(12 * time.Hour) }
	if err := s.Save(ctx, Stretch{"r", "a", KindReading, at(9, 0), at(9, 30), ""}); err != nil {
		t.Fatal(err)
	}
	if err := s.Clear(ctx); err != nil {
		t.Fatal(err)
	}
	w, err := s.Week(ctx, monday)
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

func TestTimeIsSaidByQuestion(t *testing.T) {
	ctx := context.Background()
	s := New(open(t, Migrations()), hw{})
	s.now = func() time.Time { return monday.Add(12 * time.Hour) }
	save := func(st Stretch) {
		t.Helper()
		if err := s.Save(ctx, st); err != nil {
			t.Fatal(err)
		}
	}
	// 4.25 open for 10 minutes, then 4.32 for 20 (the stretch saved as it
	// grew), then 4.25 again for 5 more: a question's time is all its
	// stretches.
	save(Stretch{"a1", "a", KindHomework, at(9, 0), at(9, 4), "q425"})
	save(Stretch{"a1", "a", KindHomework, at(9, 0), at(9, 10), "q425"})
	save(Stretch{"b1", "a", KindHomework, at(9, 10), at(9, 30), "q432"})
	save(Stretch{"a2", "a", KindHomework, at(9, 30), at(9, 35), "q425"})
	// Two tabs on 4.32 at once: the overlap counts once.
	save(Stretch{"b2", "a", KindHomework, at(9, 20), at(9, 40), "q432"})
	// Homework time with no question, and reading, are not for a question.
	save(Stretch{"h", "a", KindHomework, at(10, 0), at(10, 9), ""})
	save(Stretch{"r", "a", KindReading, at(11, 0), at(11, 9), ""})

	got, err := s.QuestionSeconds(ctx, []string{"q425", "q432", "q000"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got["q425"] != 15*60 || got["q432"] != 30*60 {
		t.Fatalf("seconds %v, want q425 15m and q432 30m (9:10 to 9:40, the overlap once)", got)
	}
	if none, _ := s.QuestionSeconds(ctx, nil); len(none) != 0 {
		t.Fatalf("no ids: %v", none)
	}
	// The week still counts every stretch: the question is an extra.
	w, err := s.Week(ctx, monday)
	if err != nil {
		t.Fatal(err)
	}
	if w.Homework != 49 {
		t.Fatalf("homework minutes %d, want 49 (9:00 to 9:40 and 10:00 to 10:09)", w.Homework)
	}
}

func TestOnlyHomeworkTimeIsForAQuestion(t *testing.T) {
	s := New(open(t, Migrations()), hw{})
	s.now = func() time.Time { return monday.Add(12 * time.Hour) }
	if err := s.Save(context.Background(), Stretch{"r", "a", KindReading, at(9, 0), at(9, 30), "q1"}); err == nil {
		t.Fatal("reading time was taken for a question")
	}
	if err := s.Save(context.Background(), Stretch{"h", "a", KindHomework, at(9, 0), at(9, 30), string(make([]byte, 65))}); err == nil {
		t.Fatal("a 65-character question id was taken")
	}
}
