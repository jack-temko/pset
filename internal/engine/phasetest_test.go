package engine

import (
	"context"
	"testing"

	"github.com/jackt/pset/internal/store"
)

// seedPrepareTask attaches a prepare task to an already-seeded book, so one
// phase can be exercised without driving a whole import. The phases are the
// real ones; only the source of the book row is faked.
func seedPrepareTask(t *testing.T, e *Engine, book *store.Book) *store.Task {
	t.Helper()
	ctx := context.Background()
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	task := &store.Task{Kind: store.TaskPrepare, BookID: &book.ID}
	if err := s.CreateTask(ctx, task); err != nil {
		t.Fatal(err)
	}
	// The book row is already here, so examining is behind us: mark that
	// phase done the way a resumed run would find it, and the rest of the
	// plan runs against the seeded book.
	examined := &store.Phase{TaskID: task.ID, Seq: 0, Key: "examine", Name: "Examine the pages"}
	if err := s.UpsertPhase(ctx, examined); err != nil {
		t.Fatal(err)
	}
	examined.Status = store.PhaseDone
	if err := s.SavePhase(ctx, examined); err != nil {
		t.Fatal(err)
	}
	return task
}

// runPhaseFor runs one named phase of a prepare task against a seeded book
// and reports the phase row it left behind, plus the error it returned.
func runPhaseFor(t *testing.T, e *Engine, book *store.Book, key string) (*store.Phase, error) {
	t.Helper()
	ctx := context.Background()
	task := seedPrepareTask(t, e, book)

	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	p := &pipeline{eng: e, s: s, task: task, ctx: ctx, book: book}
	specs, err := p.preparePlan(ctx)
	if err != nil {
		t.Fatalf("plan a prepare task: %v", err)
	}
	var spec PhaseSpec
	for seq, candidate := range specs {
		if candidate.Key != key {
			continue
		}
		spec = candidate
		row, derr := p.declare(ctx, seq, candidate)
		if derr != nil {
			t.Fatalf("declare phase %q: %v", key, derr)
		}
		runErr := p.runPhase(ctx, row, spec)
		fresh, ferr := s.PhaseByKey(ctx, task.ID, key)
		if ferr != nil {
			t.Fatalf("reload phase %q: %v", key, ferr)
		}
		return fresh, runErr
	}
	t.Fatalf("a prepare task has no phase %q", key)
	return nil, nil
}

// readinessOf recomputes a book's derived preparation state.
func readinessOf(t *testing.T, e *Engine, book *store.Book) store.Readiness {
	t.Helper()
	ctx := context.Background()
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	settings, err := e.Config(ctx)
	if err != nil {
		t.Fatal(err)
	}
	r, err := s.Readiness(ctx, book.ID, settings.EmbedModel)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

// storedPageNumbers lists the page numbers a book has committed, in order.
func storedPageNumbers(t *testing.T, dbPath, bookID string) []int {
	t.Helper()
	s, err := store.Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	pages, err := s.Pages(context.Background(), bookID)
	if err != nil {
		t.Fatal(err)
	}
	out := make([]int, 0, len(pages))
	for _, p := range pages {
		out = append(out, p.Number)
	}
	return out
}
