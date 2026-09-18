package store

import (
	"context"
	"testing"
)

func TestReset(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}

	if err := s.CreateBookWithPages(ctx,
		&Book{SHA256: "r1", FilePath: "/1.pdf", FileSize: 1},
		[]Page{{Number: 1, Text: "one"}, {Number: 2, Text: "two"}}); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateBookWithPages(ctx,
		&Book{SHA256: "r2", FilePath: "/2.pdf", FileSize: 2},
		[]Page{{Number: 1, Text: "other"}}); err != nil {
		t.Fatal(err)
	}
	task := &Task{Kind: TaskPrepare, Status: TaskDone}
	if err := s.CreateTask(ctx, task); err != nil {
		t.Fatal(err)
	}

	books, pages, finishedTasks, err := s.Reset(ctx)
	if err != nil {
		t.Fatalf("reset: %v", err)
	}
	if books != 2 || pages != 3 || finishedTasks != 1 {
		t.Fatalf("removed %d books / %d pages / %d tasks, want 2 / 3 / 1", books, pages, finishedTasks)
	}

	all, err := s.Books(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 0 {
		t.Fatalf("books after reset = %d, want 0", len(all))
	}
	if n, err := s.UnsettledTaskCount(ctx); err != nil || n != 0 {
		t.Fatalf("jobs after reset = %d/%v, want 0", n, err)
	}

	v, err := s.Version(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if v != LatestVersion() {
		t.Fatalf("version after reset = %d, want %d (schema is kept)", v, LatestVersion())
	}

	if books, pages, finishedTasks, err = s.Reset(ctx); err != nil || books != 0 || pages != 0 || finishedTasks != 0 {
		t.Fatalf("second reset = (%d, %d, %d, %v), want (0, 0, 0, nil)", books, pages, finishedTasks, err)
	}
}
