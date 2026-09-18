package engine

import (
	"context"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
)

func TestQuestionLabel(t *testing.T) {
	cases := []struct {
		text  string
		label string
		ok    bool
	}{
		{"3.36", "3.36", true},
		{"3.24 (use matlab)", "3.24", true},
		{"Problem 3.5", "3.5", true},
		{"prob. 3.5.", "3.5", true},
		{"12.5 V is applied across the load", "", false},
		{"Use mesh analysis", "", false},
		{"3.36 Use mesh analysis to obtain the currents", "", false},
		{"13.36", "13.36", true},
	}
	for _, c := range cases {
		label, ok := questionLabel(c.text)
		if ok != c.ok || label != c.label {
			t.Errorf("questionLabel(%q) = %q,%v want %q,%v", c.text, label, ok, c.label, c.ok)
		}
	}
}

func TestQuestionQuery(t *testing.T) {
	query, hint := questionQuery("3.36\n(hint: Chapter 3)")
	if query != "3.36" || hint != "Chapter 3" {
		t.Errorf("query/hint = %q,%q", query, hint)
	}
	query, hint = questionQuery("Use mesh analysis")
	if query != "Use mesh analysis" || hint != "" {
		t.Errorf("plain query = %q,%q", query, hint)
	}
}

func TestQuestionChapter(t *testing.T) {
	if n, ok := questionChapter("3.36", ""); !ok || n != 3 {
		t.Errorf("label chapter = %d,%v want 3,true", n, ok)
	}
	if n, ok := questionChapter("", "the assignment cites Chapter 12"); !ok || n != 12 {
		t.Errorf("hint chapter = %d,%v want 12,true", n, ok)
	}
	if _, ok := questionChapter("", "section 3"); ok {
		t.Error("a section hint is not a chapter")
	}
	if n, ok := questionChapter("3.36", "Chapter 12"); !ok || n != 3 {
		t.Errorf("label must win over hint: %d,%v", n, ok)
	}
}

func TestLabelScanPages(t *testing.T) {
	pages := []store.Page{
		{Number: 2, Text: "intro\n\n3.36 Use mesh analysis to obtain the currents."},
		{Number: 5, Text: "see 13.36 and (3.36) for why\nFig. 3.36 shows the circuit\n3.36\nProb. 3.36 was assigned"},
		{Number: 7, Text: "3.36\tUse nodal analysis instead."},
		{Number: 9, Text: "3.360 is not the label"},
	}
	got := labelScanPages(pages, "3.36")
	if len(got) != 2 || got[0] != 2 || got[1] != 7 {
		t.Fatalf("scan = %v, want [2 7] — references must never hit", got)
	}

	var many []store.Page
	for i := 1; i <= hwScanMaxHits+3; i++ {
		many = append(many, store.Page{Number: i, Text: "3.36 statement text"})
	}
	if got := labelScanPages(many, "3.36"); len(got) != hwScanMaxHits {
		t.Fatalf("capped scan = %d hits, want %d", len(got), hwScanMaxHits)
	}
}

func TestChapterSpan(t *testing.T) {
	sections := []store.Section{
		{Title: "Chapter 7 Prelude", StartPage: 1, EndPage: 1},
		{Title: "Chapter 8 Kettle Array", StartPage: 2, EndPage: 3},
		{Title: "Chapter 9 Storms", StartPage: 4},
	}
	start, end, ok := chapterSpan(sections, 8, 10)
	if !ok || start != 2 || end != 3 {
		t.Errorf("span with an end page = %d..%d,%v want 2..3,true", start, end, ok)
	}
	start, end, ok = chapterSpan(sections, 9, 10)
	if !ok || start != 4 || end != 10 {
		t.Errorf("span to the book end = %d..%d,%v want 4..10,true", start, end, ok)
	}
	if _, _, ok = chapterSpan(sections, 5, 10); ok {
		t.Error("an absent chapter must not span")
	}
	if _, _, ok = chapterSpan(sections, 80, 10); ok {
		t.Error("chapter 80 must not match chapter 8")
	}
	// An end page beyond the book's own page count clamps.
	start, end, ok = chapterSpan(sections, 8, 2)
	if !ok || start != 2 || end != 2 {
		t.Errorf("clamped span = %d..%d,%v want 2..2,true", start, end, ok)
	}
}

func TestSweepBatches(t *testing.T) {
	batches := sweepBatches(100, 130)
	if len(batches) != 2 || len(batches[0]) != 8 || len(batches[1]) != 8 ||
		batches[0][0] != 115 || batches[1][7] != 130 {
		t.Fatalf("batches = %v, want the last 16 pages of the span in two batches", batches)
	}
	if batches := sweepBatches(5, 4); batches != nil {
		t.Errorf("an inverted span yields %v", batches)
	}
	if batches := sweepBatches(1, 3); len(batches) != 1 || len(batches[0]) != 3 {
		t.Errorf("small span = %v, want one batch of three", batches)
	}
}

// TestCandidatesLadderPutsExactTiersFirst pins the ladder's order: what the
// book confirmed, then label-scan statement hits, then fused retrieval —
// the exact tiers retrieval kept burying for label-only questions.
func TestCandidatesLadderPutsExactTiersFirst(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()
	book := seedFakeBook(t, e, "ladder0001", "Ladder", store.KindDigital, 9)
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.InsertPages(ctx, book.ID, []store.Page{
		{Number: 1, Text: "3 kettles and 36 bells"},
		{Number: 2, Text: "3.36 Use mesh analysis to obtain the currents."},
		{Number: 3, Text: "filler words about circuits again"},
		{Number: 4, Text: "more filler text about theorems"},
		{Number: 5, Text: "see 13.36 and (3.36) for why the mesh wins"},
		{Number: 6, Text: "exercise six text"},
		{Number: 7, Text: "3.36 answer-key value"},
		{Number: 8, Text: "padding words here"},
		{Number: 9, Text: "closing words"},
	}); err != nil {
		t.Fatal(err)
	}

	run := &hwRunContext{eng: e, s: s, book: book, hwID: book.ID,
		client: llm.New("http://127.0.0.1:9", "k", "", ""), embedModelName: "none"}
	q := &store.HomeworkQuestion{Transcription: "3.36"}

	cands, hint := run.candidates(ctx, q, hwGuideCandidates, false)
	if hint != "" {
		t.Errorf("hint = %q, want none without a hint line", hint)
	}
	if len(cands) < 2 || cands[0] != 2 || cands[1] != 7 {
		t.Fatalf("candidates = %v, want the two statement pages [2 7 …] ahead of fusion", cands)
	}
	if len(cands) > hwGuideCandidates+hwFtsInsurance {
		t.Errorf("candidates = %v, want at most %d", cands, hwGuideCandidates+hwFtsInsurance)
	}

	// What the book confirmed goes ahead of everything.
	if err := s.LearnFact(ctx, store.BookFact{BookID: book.ID,
		Key: store.FactConfirmed, Value: "3.36→p9", Source: store.FactMeasured}); err != nil {
		t.Fatal(err)
	}
	cands, _ = run.candidates(ctx, q, hwGuideCandidates, false)
	if len(cands) == 0 || cands[0] != 9 {
		t.Fatalf("candidates with a confirmed fact = %v, want 9 first", cands)
	}

	// A worded question never takes the label path; fusion alone answers.
	worded := &store.HomeworkQuestion{Transcription: "Use mesh analysis to obtain the currents"}
	cands, _ = run.candidates(ctx, worded, hwGuideCandidates, false)
	if len(cands) == 0 || cands[0] != 2 {
		t.Fatalf("worded candidates = %v, want the mesh-analysis page from fusion", cands)
	}
}

// TestLocateStageSweepsWhenTheTextTiersMiss drives the full ladder over the
// ingested sample with a label the book's text can never match: fusion and
// the scan come up empty, so the sweep reads the chapter's pages as images
// and pins from pixels alone.
func TestLocateStageSweepsWhenTheTextTiersMiss(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()
	_ = r
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.CreateSections(ctx, book.ID, []store.Section{
		{Title: "Chapter 8 Kettle Array", Level: 1, StartPage: 2, EndPage: 3},
	}); err != nil {
		t.Fatal(err)
	}

	chat := startHwChat(t,
		`{"page": 2, "question_rect": {"x": 0.1, "y": 0.2, "w": 0.8, "h": 0.3}, "diagrams": []}`)
	run := &hwRunContext{eng: e, s: s, book: book, hwID: "hw-sweep",
		client: llm.New(chat.srv.URL, "k", "", ""), embedModelName: "none"}
	q := &store.HomeworkQuestion{Position: 1, Transcription: "8.8"}
	if err := run.locateStage(ctx, q); err != nil {
		t.Fatalf("locate: %v", err)
	}

	// One call only: the sweep locate over the section's two pages. The pin
	// lands without any retrieval ever scoring.
	if chat.count() != 1 {
		t.Fatalf("%d model calls, want just the sweep locate", chat.count())
	}
	locate := chat.request(0)
	text := locate.Messages[1].Content.Parts()[0].Text
	for _, want := range []string{"Page 2 text:", "Page 3 text:"} {
		if !strings.Contains(text, want) {
			t.Errorf("sweep locate lost %s:\n%.200s", want, text)
		}
	}
	images := 0
	for _, part := range locate.Messages[1].Content.Parts() {
		if part.Type == "image_url" {
			images++
		}
	}
	if images != 2 {
		t.Errorf("sweep locate carried %d page images, want 2", images)
	}
	if q.Page == nil || *q.Page != 2 || q.QuestionRect == nil || q.Status != store.QuestionWriting {
		t.Errorf("pin = page %v rect %v status %s", q.Page, q.QuestionRect, q.Status)
	}
}

// TestLocateStageSweepsByHintAfterRefusals covers the last-resort rule end
// to end: a worded question with a chapter hint whose vision rounds refuse
// (page 0 twice, the only failure shape left) hands the question to the
// hint's chapter sweep, which pins from the images alone.
func TestLocateStageSweepsByHintAfterRefusals(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()
	_ = r
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.CreateSections(ctx, book.ID, []store.Section{
		{Title: "Chapter 9 Safety and Ethics", Level: 1, StartPage: 4, EndPage: 6},
	}); err != nil {
		t.Fatal(err)
	}

	chat := startHwChat(t,
		`{"page": 0}`,
		`{"page": 0}`,
		`{"page": 5, "question_rect": {"x": 0.1, "y": 0.2, "w": 0.8, "h": 0.3}, "diagrams": []}`)
	run := &hwRunContext{eng: e, s: s, book: book, hwID: "hw-sweep2",
		client: llm.New(chat.srv.URL, "k", "", ""), embedModelName: "none"}
	q := &store.HomeworkQuestion{Position: 2,
		Transcription: "the register gavel\n(hint: Chapter 9)"}
	if err := run.locateStage(ctx, q); err != nil {
		t.Fatalf("locate: %v", err)
	}

	if chat.count() != 3 {
		t.Fatalf("%d model calls, want refuse, refuse, sweep locate", chat.count())
	}
	// The sweep's locate call carries the chapter's whole span as images.
	sweep := chat.request(2)
	text := sweep.Messages[1].Content.Parts()[0].Text
	for _, want := range []string{"Page 4 text:", "Page 5 text:", "Page 6 text:"} {
		if !strings.Contains(text, want) {
			t.Errorf("sweep locate lost %s:\n%.200s", want, text)
		}
	}
	if q.Page == nil || *q.Page != 5 || q.Status != store.QuestionWriting {
		t.Errorf("pin = page %v status %s, want the sweep's page 5 writing", q.Page, q.Status)
	}
}

// TestLocateStagePinnedPageNeverSweeps pins the boundary: a student-named
// page turns locating into region-finding. When both rounds refuse, the
// run fails honestly instead of paging through chapters the student
// already ruled out.
func TestLocateStagePinnedPageNeverSweeps(t *testing.T) {
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()
	_ = r
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	chat := startHwChat(t, `{"page": 0}`, `{"page": 0}`)
	pinned := 2
	run := &hwRunContext{eng: e, s: s, book: book, hwID: "hw-pinned",
		client: llm.New(chat.srv.URL, "k", "", ""), embedModelName: "none",
		pinnedPage: &pinned}
	q := &store.HomeworkQuestion{Position: 3, Transcription: "the register gavel"}
	err = run.locateStage(ctx, q)
	if err == nil || !strings.Contains(err.Error(), "couldn't find question 3") {
		t.Fatalf("err = %v, want the honest couldn't-find error", err)
	}
	if chat.count() != 2 {
		t.Fatalf("%d model calls, want two locate rounds and no sweep", chat.count())
	}
	if q.Page != nil || q.Status != store.QuestionLocating {
		t.Errorf("pin = page %v status %s, want nothing pinned", q.Page, q.Status)
	}
}
