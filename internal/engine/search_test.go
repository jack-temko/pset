package engine

import (
	"context"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
)

func TestRRFMerge(t *testing.T) {
	t.Run("overlapping lists", func(t *testing.T) {
		got := rrfMerge([]int{3, 1, 7}, []int{1, 3}, 5)
		// 1: 1/62 + 1/61, 3: 1/61 + 1/63, 7: 1/63 — pages 1 and 3 lead.
		if len(got) != 3 {
			t.Fatalf("got %v, want 3 pages", got)
		}
		if got[0] != 1 || got[1] != 3 {
			t.Errorf("order = %v, want [1 3 …] (both lists agree)", got)
		}
	})
	t.Run("missing list", func(t *testing.T) {
		got := rrfMerge([]int{5, 2}, nil, 5)
		if len(got) != 2 || got[0] != 5 || got[1] != 2 {
			t.Errorf("got %v, want the fts order preserved", got)
		}
		got = rrfMerge(nil, []int{9}, 5)
		if len(got) != 1 || got[0] != 9 {
			t.Errorf("got %v, want the vec list alone", got)
		}
	})
	t.Run("both empty", func(t *testing.T) {
		if got := rrfMerge(nil, nil, 5); len(got) != 0 {
			t.Errorf("got %v, want empty", got)
		}
	})
	t.Run("cut to k", func(t *testing.T) {
		got := rrfMerge([]int{10, 20, 30, 40}, nil, 2)
		if len(got) != 2 || got[0] != 10 || got[1] != 20 {
			t.Errorf("got %v, want the top 2", got)
		}
	})
	t.Run("two lists beat one", func(t *testing.T) {
		// A page first in one list loses to a page present in both lists at
		// moderate rank.
		got := rrfMerge([]int{1, 2}, []int{2}, 2)
		if got[0] != 2 {
			t.Errorf("got %v, want page 2 first", got)
		}
	})
	t.Run("ties are deterministic", func(t *testing.T) {
		// Equal scores (one rank in one list each) resolve by page number
		// ascending regardless of input order.
		a := rrfMerge([]int{20}, []int{30}, 5)
		b := rrfMerge([]int{30}, []int{20}, 5)
		if !equalInts(a, []int{20, 30}) || !equalInts(b, []int{20, 30}) {
			t.Errorf("tie order = %v / %v, want [20 30] in both", a, b)
		}
	})
}

func TestVectorSearchSkipsTextlessPages(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()
	book := seedFakeBook(t, e, "vecsearch01", "Rank Me", store.KindDigital, 2)
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.InsertPages(ctx, book.ID, []store.Page{
		{Number: 1, Text: "3.36 Use mesh analysis to obtain i1, i2, and i3"},
		{Number: 2, Text: ""},
	}); err != nil {
		t.Fatal(err)
	}

	srv := startFakeEmbed(t, &fakeEmbed{})
	client := llm.New(srv.URL, "k", srv.URL, "test-embed-model")
	query := "3.36"
	vectors, err := client.Embed(ctx, []string{query})
	if err != nil {
		t.Fatal(err)
	}
	// Page 2 is blank and so embeds closest to a bare number query; give it
	// the perfect score, page 1 a poor one. The blank page must still never
	// rank — short queries would otherwise crowd real content out of the
	// fused top-k.
	if err := s.SaveEmbedding(ctx, book.ID, 2, "test-embed-model", vectors[0]); err != nil {
		t.Fatal(err)
	}
	poor := make([]float32, len(vectors[0]))
	for i, v := range vectors[0] {
		poor[len(poor)-1-i] = v
	}
	if err := s.SaveEmbedding(ctx, book.ID, 1, "test-embed-model", poor); err != nil {
		t.Fatal(err)
	}

	ranks, err := e.vectorSearch(ctx, s, book.ID, client, query, "test-embed-model")
	if err != nil {
		t.Fatal(err)
	}
	if !equalInts(ranks, []int{1}) {
		t.Errorf("ranks = %v, want [1] with the blank page excluded", ranks)
	}
}

func TestCosine(t *testing.T) {
	if got := cosine([]float32{1, 0}, []float32{1, 0}); got < 0.999 {
		t.Errorf("identical vectors cosine = %f", got)
	}
	if got := cosine([]float32{1, 0}, []float32{0, 1}); got > 0.001 {
		t.Errorf("orthogonal vectors cosine = %f", got)
	}
	if got := cosine([]float32{1, 0}, []float32{2, 0}); got < 0.999 {
		t.Errorf("scaled vectors cosine = %f, want 1", got)
	}
	if got := cosine([]float32{1}, []float32{1, 2}); got != 0 {
		t.Errorf("mismatched lengths cosine = %f, want 0", got)
	}
	if got := cosine(nil, nil); got != 0 {
		t.Errorf("empty vectors cosine = %f, want 0", got)
	}
}

func equalInts(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestTruncateTitle(t *testing.T) {
	if got := truncateTitle("short", 60); got != "short" {
		t.Errorf("got %q", got)
	}
	long := strings.Repeat("word ", 30)
	got := truncateTitle(long, 60)
	runes := []rune(got)
	if len(runes) > 61 || runes[len(runes)-1] != '…' {
		t.Errorf("truncated title = %d runes (%q), want at most 60 chars plus ellipsis", len(runes), got)
	}
	if got := truncateTitle("  spaced   out  ", 60); got != "spaced out" {
		t.Errorf("whitespace collapsed to %q", got)
	}
}

func TestCandidatesKeepsExactMatches(t *testing.T) {
	e := testEngine(t, discardLogger())
	ctx := context.Background()
	book := seedFakeBook(t, e, "cands0001", "Find Me", store.KindDigital, 6)
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.InsertPages(ctx, book.ID, []store.Page{
		{Number: 1, Text: "chapter opener words"},
		{Number: 2, Text: "use matlab to check"},
		{Number: 3, Text: "see 3 24 in the problems"},
		{Number: 4, Text: "filler words about circuits"},
		{Number: 5, Text: "3.24 use nodal analysis and matlab to find vo in fig"},
		{Number: 6, Text: "more filler text about theorems"},
	}); err != nil {
		t.Fatal(err)
	}

	srv := startFakeEmbed(t, &fakeEmbed{})
	client := llm.New(srv.URL, "k", srv.URL, "test-embed-model")
	query := "3.24 use matlab"
	// A bare exercise number embeds near-noise: pages 2-4 carry the exact
	// query vector, so the vector half loves them and the true page 5 gets
	// nothing. Fusion must not let that hide the exact-text match.
	vec := embedVector(query)
	other := make([]float32, len(vec))
	for i, v := range vec {
		other[len(vec)-1-i] = v
	}
	for _, n := range []int{2, 3, 4} {
		if err := s.SaveEmbedding(ctx, book.ID, n, "test-embed-model", vec); err != nil {
			t.Fatal(err)
		}
	}
	for _, n := range []int{1, 5, 6} {
		if err := s.SaveEmbedding(ctx, book.ID, n, "test-embed-model", other); err != nil {
			t.Fatal(err)
		}
	}

	run := &hwRunContext{eng: e, s: s, book: book, hwID: book.ID,
		client: client, embedModelName: "test-embed-model"}
	cands, hint := run.candidates(ctx, &store.HomeworkQuestion{Transcription: query},
		hwGuideCandidates, false)
	if hint != "" {
		t.Errorf("hint = %q, want none without a hint line", hint)
	}
	found := false
	for _, p := range cands {
		if p == 5 {
			found = true
		}
	}
	if !found {
		t.Errorf("candidates = %v, want page 5 (the best exact match) in the pool", cands)
	}
	if len(cands) > hwGuideCandidates+hwFtsInsurance {
		t.Errorf("candidates = %v, want at most %d pages", cands, hwGuideCandidates+hwFtsInsurance)
	}
}

func TestBuildAskMessages(t *testing.T) {
	history := []store.Message{
		{Role: store.RoleUser, Content: "earlier question"},
		{Role: store.RoleAssistant, Content: "earlier answer [p. 2]"},
	}
	sections := []store.Section{
		{Title: "The Voss Register", StartPage: 3, EndPage: 4},
	}
	pages := []store.Page{
		{Number: 3, Text: "page three text"},
		{Number: 4, Text: "page four text"},
	}
	images := map[int]string{3: "data:image/png;base64,AAA", 4: "data:image/png;base64,BBB"}

	msgs := buildAskMessages("what is a gavel?", 0, history, sections, pages, images)
	if len(msgs) != 4 {
		t.Fatalf("%d messages, want system + 2 history + user", len(msgs))
	}
	if msgs[0].Role != "system" || msgs[0].Content.Text() != systemPrompt {
		t.Errorf("first message role/content = %q / %.40q", msgs[0].Role, msgs[0].Content.Text())
	}
	if msgs[1].Role != "user" || msgs[1].Content.Text() != "earlier question" {
		t.Errorf("history message = %+v", msgs[1])
	}
	user := msgs[3]
	if user.Role != "user" {
		t.Fatalf("user role = %q", user.Role)
	}
	if len(user.Content.Parts()) != 3 {
		t.Fatalf("%d content parts, want 1 text + 2 images", len(user.Content.Parts()))
	}
	text := user.Content.Parts()[0].Text
	for _, want := range []string{
		"Question: what is a gavel?",
		"Table of contents:",
		"- The Voss Register — pages 3–4",
		"Page 3:\npage three text",
		"Page 4:\npage four text",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("user text missing %q", want)
		}
	}
	if user.Content.Parts()[1].ImageURL == nil || user.Content.Parts()[1].ImageURL.URL != images[3] {
		t.Errorf("image part 1 = %+v", user.Content.Parts()[1])
	}
	if user.Content.Parts()[2].ImageURL == nil || user.Content.Parts()[2].ImageURL.URL != images[4] {
		t.Errorf("image part 2 = %+v", user.Content.Parts()[2])
	}

	// A page without a rendered image still appears as text, without an
	// image block.
	msgs = buildAskMessages("q", 0, nil, nil, pages, map[int]string{})
	user = msgs[1]
	if len(user.Content.Parts()) != 1 {
		t.Errorf("%d parts, want text only when no image rendered", len(user.Content.Parts()))
	}
}
