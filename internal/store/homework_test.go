package store

import (
	"context"
	"path/filepath"
	"slices"
	"testing"
	"time"
)

func hwStore(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	if err := s.Migrate(context.Background()); err != nil {
		t.Fatal(err)
	}
	return s
}

func seedHomeworkBook(t *testing.T, s *Store) *Book {
	t.Helper()
	b := &Book{SHA256: "hw-book-" + newID(), FilePath: "/tmp/none.pdf", Title: "Probability", PageCount: 10}
	if err := s.CreateBook(context.Background(), b); err != nil {
		t.Fatal(err)
	}
	return b
}

func TestHomeworkCRUD(t *testing.T) {
	s := hwStore(t)
	book := seedHomeworkBook(t, s)
	ctx := context.Background()

	due := "2026-10-03"
	hw := &Homework{BookID: book.ID, Title: "Problem Set 4", DueDate: &due, SourceText: "1. … 2. …"}
	if err := s.CreateHomework(ctx, hw); err != nil {
		t.Fatalf("create: %v", err)
	}
	if hw.Status != HomeworkGenerating || hw.ID == "" {
		t.Fatalf("homework = %+v, want a generating row with an id", hw)
	}

	got, err := s.HomeworkByID(ctx, hw.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Problem Set 4" || got.DueDate == nil || *got.DueDate != due ||
		got.Status != HomeworkGenerating || got.TurnedIn || got.SourceText != "1. … 2. …" {
		t.Fatalf("homework = %+v", got)
	}
	if got.QuestionCount != 0 {
		t.Errorf("question count = %d, want 0", got.QuestionCount)
	}

	// Print scales default to the designed layout and update in place.
	if got.QuestionScale != 100 || got.FigureScale != 100 {
		t.Errorf("default scales = %d/%d, want 100/100", got.QuestionScale, got.FigureScale)
	}
	sixty, oneFifty := 60, 150
	if _, err := s.UpdateHomework(ctx, hw.ID, nil, nil, nil, &sixty, &oneFifty); err != nil {
		t.Fatal(err)
	}
	if got, err = s.HomeworkByID(ctx, hw.ID); err != nil {
		t.Fatal(err)
	}
	if got.QuestionScale != 60 || got.FigureScale != 150 {
		t.Errorf("updated scales = %d/%d, want 60/150", got.QuestionScale, got.FigureScale)
	}

	// The ref joins the book identity.
	ref, err := s.HomeworkRefByID(ctx, hw.ID)
	if err != nil {
		t.Fatal(err)
	}
	if ref.BookSHA256 != book.SHA256 || ref.BookTitle != book.Title {
		t.Errorf("ref = %+v, want book identity", ref)
	}

	// Patch: rename, set turned-in, clear the due date.
	if _, err := s.UpdateHomework(ctx, hw.ID, strptr("Problem Set 4 — fixed"), strptr(""), boolptr(true), nil, nil); err != nil {
		t.Fatal(err)
	}
	got, _ = s.HomeworkByID(ctx, hw.ID)
	if got.Title != "Problem Set 4 — fixed" || got.DueDate != nil || !got.TurnedIn {
		t.Fatalf("after patch = %+v", got)
	}

	// Delete cascades the questions and is idempotent-strict.
	if err := s.DeleteHomework(ctx, hw.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.HomeworkByID(ctx, hw.ID); err != ErrNotFound {
		t.Fatalf("get after delete = %v, want ErrNotFound", err)
	}
}

func strptr(s string) *string { return &s }
func boolptr(b bool) *bool    { return &b }

func TestHomeworkQuestions(t *testing.T) {
	s := hwStore(t)
	book := seedHomeworkBook(t, s)
	ctx := context.Background()

	hw := &Homework{BookID: book.ID, Title: "PS"}
	if err := s.CreateHomework(ctx, hw); err != nil {
		t.Fatal(err)
	}

	rect := HomeworkRect{X: 0.1, Y: 0.2, W: 0.5, H: 0.3}
	page := 7
	guide := &HomeworkGuide{
		Setup:     "One string, one tension.",
		Hints:     []string{"draw free bodies"},
		Steps:     []string{"$m_2 g - T = m_2 a$", "add the equations"},
		Equations: []HomeworkEquation{{Title: "Accel", Tex: "a = \\frac{m_2 g}{m_1+m_2}", Note: "while taut"}},
		Answer:    "a = 5.9 m/s²",
	}
	qs := []*HomeworkQuestion{
		{HomeworkID: hw.ID, Transcription: "two blocks", Status: QuestionReady, Page: &page, QuestionRect: &rect,
			Diagrams: []HomeworkDiagram{{Label: "pulley", Rect: HomeworkRect{X: 0.2, Y: 0.3, W: 0.2, H: 0.2}}}, Guide: guide},
		{HomeworkID: hw.ID, Transcription: "a crate", Status: QuestionFailed, Error: "no page matched"},
		{HomeworkID: hw.ID, Transcription: "define entropy", Status: QuestionPending, Standalone: true},
	}
	for _, q := range qs {
		if err := s.InsertQuestion(ctx, q); err != nil {
			t.Fatalf("insert %q: %v", q.Transcription, err)
		}
	}
	if qs[0].Position != 1 || qs[1].Position != 2 || qs[2].Position != 3 {
		t.Fatalf("positions = %d %d %d, want 1 2 3", qs[0].Position, qs[1].Position, qs[2].Position)
	}

	got, err := s.Questions(ctx, hw.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Fatalf("%d questions, want 3", len(got))
	}
	first := got[0]
	if first.Page == nil || *first.Page != 7 || first.QuestionRect == nil || *first.QuestionRect != rect {
		t.Errorf("first = %+v, want page 7 with the rect", first)
	}
	if first.Guide == nil || first.Guide.Answer != "a = 5.9 m/s²" || len(first.Guide.Equations) != 1 ||
		first.Guide.Equations[0].Note != "while taut" {
		t.Errorf("first guide = %+v", first.Guide)
	}
	if len(first.Diagrams) != 1 || first.Diagrams[0].Label != "pulley" {
		t.Errorf("first diagrams = %+v", first.Diagrams)
	}
	if got[1].Error != "no page matched" || got[2].Guide != nil || got[2].Page != nil {
		t.Errorf("failed/pending rows = %+v %+v", got[1], got[2])
	}
	if !got[2].Standalone || got[0].Standalone {
		t.Errorf("standalone flags = %v %v, want only question 3 standalone", got[0].Standalone, got[2].Standalone)
	}
	if got[0].Guide.Hints == nil || got[1].Diagrams == nil {
		t.Error("empty JSON collections must read back as empty, not nil")
	}

	hwRow, _ := s.HomeworkByID(ctx, hw.ID)
	if hwRow.QuestionCount != 3 {
		t.Errorf("count = %d, want 3", hwRow.QuestionCount)
	}

	// Move 3 → 1: the others shift down and positions stay dense.
	if err := s.MoveQuestion(ctx, hw.ID, qs[2].ID, 1); err != nil {
		t.Fatal(err)
	}
	got, _ = s.Questions(ctx, hw.ID)
	if got[0].ID != qs[2].ID || got[1].ID != qs[0].ID || got[2].ID != qs[1].ID {
		t.Fatalf("order after move = %s %s %s", got[0].ID, got[1].ID, got[2].ID)
	}
	for i, q := range got {
		if q.Position != i+1 {
			t.Errorf("position %d = %d, want %d", i, q.Position, i+1)
		}
	}

	// Delete the middle: the last shifts up.
	if _, err := s.DeleteQuestion(ctx, got[1].ID); err != nil {
		t.Fatal(err)
	}
	got, _ = s.Questions(ctx, hw.ID)
	if len(got) != 2 || got[0].ID != qs[2].ID || got[1].ID != qs[1].ID {
		t.Fatalf("order after delete = %+v", got)
	}
	if !slices.Contains([]string{got[0].Status, got[1].Status}, QuestionFailed) {
		t.Errorf("statuses = %q %q, want the failed row kept", got[0].Status, got[1].Status)
	}
}

func TestHomeworkCascadeAndList(t *testing.T) {
	s := hwStore(t)
	book := seedHomeworkBook(t, s)
	ctx := context.Background()

	ids := []string{}
	for _, title := range []string{"a", "b"} {
		hw := &Homework{BookID: book.ID, Title: title}
		if err := s.CreateHomework(ctx, hw); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, hw.ID)
		if err := s.InsertQuestion(ctx, &HomeworkQuestion{HomeworkID: hw.ID, Status: QuestionPending}); err != nil {
			t.Fatal(err)
		}
	}

	list, err := s.Homeworks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].Title != "b" || list[0].QuestionCount != 1 || list[0].BookTitle == "" {
		t.Fatalf("list = %+v, want newest first with counts and book identity", list)
	}

	// Deleting a homework cascades its questions.
	if err := s.DeleteHomework(ctx, ids[0]); err != nil {
		t.Fatal(err)
	}
	qs, _ := s.Questions(ctx, ids[0])
	if len(qs) != 0 {
		t.Fatalf("questions after homework delete = %+v, want empty", qs)
	}
	list, _ = s.Homeworks(ctx)
	if len(list) != 1 || list[0].Title != "b" {
		t.Fatalf("list after delete = %+v, want only the surviving row", list)
	}
}

func TestUnderstandingNotesRoundTrip(t *testing.T) {
	ctx := context.Background()
	s := testStore(t)
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := &Book{SHA256: "notes-book", FilePath: "/n.pdf", FileSize: 1}
	if err := s.CreateBook(ctx, b); err != nil {
		t.Fatal(err)
	}
	hw := &Homework{BookID: b.ID, Title: "notes"}
	if err := s.CreateHomework(ctx, hw); err != nil {
		t.Fatal(err)
	}
	q := &HomeworkQuestion{HomeworkID: hw.ID, Status: QuestionReady, Transcription: "3.36"}
	if err := s.InsertQuestion(ctx, q); err != nil {
		t.Fatal(err)
	}
	q.UnderstandingNotes = append(q.UnderstandingNotes,
		UnderstandingNote{Note: "the 2A source points up", At: time.Now().UTC()},
		UnderstandingNote{Note: "answer in polar form", At: time.Now().UTC()})
	if err := s.UpdateQuestionContent(ctx, q); err != nil {
		t.Fatal(err)
	}
	got, err := s.QuestionByID(ctx, q.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.UnderstandingNotes) != 2 || got.UnderstandingNotes[0].Note != "the 2A source points up" {
		t.Fatalf("notes = %+v", got.UnderstandingNotes)
	}
}
