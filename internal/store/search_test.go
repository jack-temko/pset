package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"
)

func TestSchemaOnFreshDB(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if v, err := s.Version(ctx); err != nil || v != LatestVersion() {
		t.Fatalf("version = %d/%v, want %d", v, err, LatestVersion())
	}
	for _, table := range []string{"pages_fts", "embeddings", "conversations", "messages"} {
		if _, err := s.db.ExecContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", table)); err != nil {
			t.Errorf("table %s missing: %v", table, err)
		}
	}
	b := &Book{SHA256: "v2", FilePath: "/v2.pdf", FileSize: 1}
	if err := s.CreateBook(ctx, b); err != nil {
		t.Fatal(err)
	}
	got, err := s.BookBySHA256(ctx, "v2")
	if err != nil {
		t.Fatal(err)
	}
	if got.Ready {
		t.Error("a freshly created book must not claim to be ready")
	}
}

func TestFTSTriggerConsistency(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}

	b := &Book{SHA256: "fts1", FilePath: "/fts.pdf", FileSize: 1}
	if err := s.CreateBookWithPages(ctx, b, []Page{
		{Number: 1, Text: "The mitochondrial enzyme converts ATP"},
		{Number: 2, Text: "Brontolith weathering patterns"},
	}); err != nil {
		t.Fatal(err)
	}

	hits, err := s.SearchFTS(ctx, b.ID, "mitochondrial enzyme", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 1 || hits[0] != 1 {
		t.Fatalf("hits = %v, want [1]", hits)
	}

	// Every writer path stays consistent: a single page insert (the OCR path).
	if err := s.SavePage(ctx, b.ID, Page{Number: 3, Text: "The enzyme reappears here"}); err != nil {
		t.Fatal(err)
	}
	hits, err = s.SearchFTS(ctx, b.ID, "enzyme reappears", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 1 || hits[0] != 3 {
		t.Fatalf("hits after InsertPage = %v, want [3]", hits)
	}

	// Ranking: bm25 favours the denser match — a page repeating the term
	// outranks single occurrences.
	if err := s.SavePage(ctx, b.ID, Page{Number: 4, Text: "enzyme enzyme enzyme"}); err != nil {
		t.Fatal(err)
	}
	hits, err = s.SearchFTS(ctx, b.ID, "enzyme", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 3 || hits[0] != 4 {
		t.Fatalf("ranked hits = %v, want page 4 (term frequency 3) first", hits)
	}

	// Deleting the book cascades the pages and clears the index.
	if _, err := s.db.ExecContext(ctx, `DELETE FROM books WHERE id = ?`, b.ID); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM pages_fts`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("%d fts rows left after the book was deleted, want 0", n)
	}
}

func TestFTSResetClearsIndex(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateBookWithPages(ctx,
		&Book{SHA256: "r1", FilePath: "/r.pdf", FileSize: 1},
		[]Page{{Number: 1, Text: "quantum tunneling basics"}}); err != nil {
		t.Fatal(err)
	}
	if _, _, _, err := s.Reset(ctx); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM pages_fts`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("%d fts rows left after reset, want 0", n)
	}
}

func TestFTSQueryEscaping(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := &Book{SHA256: "esc", FilePath: "/e.pdf", FileSize: 1}
	if err := s.CreateBookWithPages(ctx, b, []Page{
		{Number: 1, Text: "NOT OR AND (nested) \"quoted\" plus neuron"},
	}); err != nil {
		t.Fatal(err)
	}
	// Operators and syntax characters must be inert, not fts5 syntax.
	for _, q := range []string{"neuron", `"quoted"`, "NOT OR AND", "(nested)", "bogus"} {
		if _, err := s.SearchFTS(ctx, b.ID, q, 10); err != nil {
			t.Errorf("SearchFTS(%q) failed: %v", q, err)
		}
	}
	hits, err := s.SearchFTS(ctx, b.ID, "neuron", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 1 {
		t.Fatalf("hits = %v, want [1]", hits)
	}
}

func TestTextlessPages(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := &Book{SHA256: "textless1", FilePath: "/tl.pdf", FileSize: 1}
	if err := s.CreateBookWithPages(ctx, b, []Page{
		{Number: 1, Text: "Chapter 3 Methods of Analysis"},
		{Number: 2, Text: ""},
		{Number: 3, Text: "   \n\t  "},
		{Number: 4, Text: "3.36 Use mesh analysis"},
	}); err != nil {
		t.Fatal(err)
	}
	got, err := s.TextlessPages(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || !got[2] || !got[3] {
		t.Errorf("textless = %v, want pages 2 and 3 only", got)
	}
}

func TestEmbeddingsCRUD(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := &Book{SHA256: "emb", FilePath: "/emb.pdf", FileSize: 1, PageCount: 3}
	if err := s.CreateBook(ctx, b); err != nil {
		t.Fatal(err)
	}

	save := func(n int, model string, v []float32) {
		if err := s.SaveEmbedding(ctx, b.ID, n, model, v); err != nil {
			t.Fatalf("save embedding page %d: %v", n, err)
		}
	}
	save(1, "m1", []float32{1, 0, 0})
	save(2, "m1", []float32{0, 1, 0})
	save(3, "m2", []float32{0, 0, 1})

	all, err := s.Embeddings(ctx, b.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 3 {
		t.Fatalf("%d embeddings, want 3", len(all))
	}
	m1, err := s.Embeddings(ctx, b.ID, "m1")
	if err != nil {
		t.Fatal(err)
	}
	if len(m1) != 2 {
		t.Fatalf("%d embeddings for model m1, want 2", len(m1))
	}
	for _, emb := range m1 {
		if emb.Model != "m1" {
			t.Errorf("page %d carries model %q", emb.PageNumber, emb.Model)
		}
	}
	if v := m1[0].Vector; len(v) != 3 || v[0]+v[1]+v[2] != 1 {
		t.Errorf("vector roundtrip = %v, want a unit basis vector", v)
	}

	models, err := s.EmbeddingModels(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(models) != 2 || models[0] != "m1" || models[1] != "m2" {
		t.Fatalf("models = %v, want [m1 m2]", models)
	}

	// A page holds one vector per model: saving page 1 under m2 opens a
	// second space rather than touching its m1 vector.
	save(1, "m2", []float32{9, 9, 9})
	all, err = s.Embeddings(ctx, b.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 4 {
		t.Fatalf("%d embeddings after saving page 1 under m2, want 4", len(all))
	}
	vectorOf := func(page int, model string) *Embedding {
		for i := range all {
			if all[i].PageNumber == page && all[i].Model == model {
				return &all[i]
			}
		}
		return nil
	}
	if e := vectorOf(1, "m2"); e == nil || e.Vector[0] != 9 {
		t.Errorf("page 1 under m2 = %+v, want the new vector", e)
	}
	if e := vectorOf(1, "m1"); e == nil || e.Vector[0] != 1 {
		t.Errorf("page 1 under m1 = %+v, want the original vector untouched", e)
	}

	// Re-saving under a model the page already has replaces that vector,
	// never a duplicate row.
	save(1, "m2", []float32{8, 8, 8})
	all, err = s.Embeddings(ctx, b.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 4 {
		t.Fatalf("%d embeddings after re-saving page 1 under m2, want 4", len(all))
	}
	if e := vectorOf(1, "m2"); e == nil || e.Vector[0] != 8 {
		t.Errorf("page 1 under m2 = %+v, want the replaced vector", e)
	}

	if err := s.ClearEmbeddings(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	all, err = s.Embeddings(ctx, b.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 0 {
		t.Fatalf("%d embeddings after clear, want 0", len(all))
	}
}

func TestConversationCRUDAndCascade(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := &Book{SHA256: "conv", FilePath: "/c.pdf", FileSize: 1}
	if err := s.CreateBook(ctx, b); err != nil {
		t.Fatal(err)
	}

	conv := &Conversation{BookID: b.ID, Title: "What is brontolith?"}
	if err := s.CreateConversation(ctx, conv); err != nil {
		t.Fatal(err)
	}
	if conv.ID == "" || conv.UpdatedAt.IsZero() {
		t.Fatalf("conversation = %+v, want id and timestamps set", conv)
	}

	first := &Message{Role: RoleUser, Content: "What is brontolith?"}
	if err := s.AppendMessage(ctx, conv.ID, first); err != nil {
		t.Fatal(err)
	}
	second := &Message{Role: RoleAssistant, Content: "See [p. 3].", Citations: []int{3, 1, 3}}
	if err := s.AppendMessage(ctx, conv.ID, second); err != nil {
		t.Fatal(err)
	}

	got, err := s.ConversationByID(ctx, conv.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.MessageCount != 2 || got.Title != "What is brontolith?" {
		t.Fatalf("conversation = %+v, want 2 messages", got)
	}

	messages, err := s.Messages(ctx, conv.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 2 || messages[0].Role != RoleUser || messages[1].Role != RoleAssistant {
		t.Fatalf("messages = %+v, want user then assistant", messages)
	}
	wantCitations := []int{1, 3, 3}
	if got := messages[1].Citations; len(got) != len(wantCitations) {
		t.Fatalf("citations = %v, want %v", got, wantCitations)
	}
	if messages[0].Citations != nil {
		t.Errorf("user message citations = %v, want none", messages[0].Citations)
	}

	list, err := s.Conversations(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != conv.ID || list[0].MessageCount != 2 {
		t.Fatalf("conversations = %+v, want the one thread with 2 messages", list)
	}

	if err := s.DeleteConversation(ctx, conv.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.ConversationByID(ctx, conv.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
	if messages, err := s.Messages(ctx, conv.ID); err != nil || len(messages) != 0 {
		t.Fatalf("messages after delete = %v/%v, want none (cascade)", messages, err)
	}

	other := &Book{SHA256: "conv2", FilePath: "/c2.pdf", FileSize: 1}
	if err := s.CreateBook(ctx, other); err != nil {
		t.Fatal(err)
	}
	c2 := &Conversation{BookID: other.ID}
	if err := s.CreateConversation(ctx, c2); err != nil {
		t.Fatal(err)
	}
	list, err = s.Conversations(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 0 {
		t.Fatalf("conversations of book 1 = %v, want none", list)
	}
}

// TestConversationPinnedAndUpdate covers the rename/pin patch and that
// updated_at means last activity: the patch never moves it, an appended
// message does. The conversation is seeded with an hour-old CreatedAt so
// the second-granular timestamps cannot tie.
func TestConversationPinnedAndUpdate(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := &Book{SHA256: "pin", FilePath: "/p.pdf", FileSize: 1}
	if err := s.CreateBook(ctx, b); err != nil {
		t.Fatal(err)
	}
	old := time.Now().UTC().Add(-time.Hour).Truncate(time.Second)
	conv := &Conversation{BookID: b.ID, Title: "What is brontolith?", CreatedAt: old}
	if err := s.CreateConversation(ctx, conv); err != nil {
		t.Fatal(err)
	}

	got, err := s.ConversationByID(ctx, conv.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Pinned {
		t.Errorf("pinned = true, want the column default false")
	}

	pin := true
	got, err = s.UpdateConversation(ctx, conv.ID, nil, &pin)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Pinned || got.Title != "What is brontolith?" {
		t.Errorf("conversation = %+v, want pinned with the title kept", got)
	}
	if !got.UpdatedAt.Equal(old) {
		t.Errorf("updated_at = %v after pin, want it untouched (%v)", got.UpdatedAt, old)
	}

	rename := "Brontolith weathering"
	got, err = s.UpdateConversation(ctx, conv.ID, &rename, nil)
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Brontolith weathering" || !got.Pinned {
		t.Errorf("conversation = %+v, want the rename with the pin kept", got)
	}
	if !got.UpdatedAt.Equal(old) {
		t.Errorf("updated_at = %v after rename, want it untouched (%v)", got.UpdatedAt, old)
	}

	if err := s.AppendMessage(ctx, conv.ID, &Message{Role: RoleUser, Content: "More?"}); err != nil {
		t.Fatal(err)
	}
	got, err = s.ConversationByID(ctx, conv.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !got.UpdatedAt.After(old) {
		t.Errorf("updated_at = %v after an append, want it advanced past %v", got.UpdatedAt, old)
	}

	if _, err := s.UpdateConversation(ctx, "00000000-0000-0000-0000-000000000000", &rename, nil); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestDeleteMissingConversation(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteConversation(ctx, "00000000-0000-0000-0000-000000000000"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

// TestFTSBigramRanking pins the failure mode of a real textbook: a question
// like "State Theorem 2.3 exactly" must reach the one page where those
// tokens are adjacent, even though "theorem", "2" and "3" each appear on
// hundreds of pages and bm25 of the single tokens is clamped to zero.
func TestFTSBigramRanking(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	scatter := []string{
		"the theorem of the chapter, see 2 and 3 for details",
		"theorem references 2 later and 3 elsewhere",
		"2 examples follow; 3 more theorems await",
		"a theorem about counting, parts 2 and 3",
	}
	pages := []Page{{Number: 1, Text: "State Theorem 2.3 of counting: the number of ways to choose k objects out of n"}}
	for i, txt := range scatter {
		pages = append(pages, Page{Number: i + 2, Text: txt})
	}
	b := &Book{SHA256: "big", FilePath: "/big.pdf", FileSize: 1}
	if err := s.CreateBookWithPages(ctx, b, pages); err != nil {
		t.Fatal(err)
	}

	hits, err := s.SearchFTS(ctx, b.ID, "State Theorem 2.3 exactly and explain each part", 6)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) == 0 || hits[0] != 1 {
		t.Fatalf("hits = %v, want the adjacent 'Theorem 2.3' page first", hits)
	}
}

func TestHomeworkConversationIsUniqueAndHiddenFromAskLists(t *testing.T) {
	ctx := context.Background()
	s := testStore(t)
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := &Book{SHA256: "hwchat", FilePath: "/h.pdf", FileSize: 1}
	if err := s.CreateBook(ctx, b); err != nil {
		t.Fatal(err)
	}

	hw := &Homework{BookID: b.ID, Title: "circuits"}
	if err := s.CreateHomework(ctx, hw); err != nil {
		t.Fatal(err)
	}
	ask := &Conversation{BookID: b.ID, Title: "ask thread"}
	if err := s.CreateConversation(ctx, ask); err != nil {
		t.Fatal(err)
	}
	chat := &Conversation{BookID: b.ID, HomeworkID: hw.ID, Title: "homework chat"}
	if err := s.CreateConversation(ctx, chat); err != nil {
		t.Fatal(err)
	}

	got, err := s.ConversationForHomework(ctx, hw.ID)
	if err != nil || got == nil || got.ID != chat.ID {
		t.Fatalf("ConversationForHomework = %v, %v", got, err)
	}
	if none, err := s.ConversationForHomework(ctx, "hw-that-does-not-exist"); err != nil || none != nil {
		t.Fatalf("a homework without a chat should read as nil, got %v, %v", none, err)
	}

	dup := &Conversation{BookID: b.ID, HomeworkID: hw.ID}
	if err := s.CreateConversation(ctx, dup); err == nil {
		t.Fatal("a second conversation for one homework must be refused")
	}

	list, err := s.Conversations(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != ask.ID {
		t.Fatalf("ask list = %+v; the homework chat must stay out of it", list)
	}
	all, err := s.AllConversations(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range all {
		if r.ID == chat.ID {
			t.Fatal("the homework chat leaked into AllConversations")
		}
	}
}

func TestMessageQuestionIDRoundTrip(t *testing.T) {
	ctx := context.Background()
	s := testStore(t)
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	b := &Book{SHA256: "hwchat-msg", FilePath: "/h2.pdf", FileSize: 1}
	if err := s.CreateBook(ctx, b); err != nil {
		t.Fatal(err)
	}
	conv := &Conversation{BookID: b.ID}
	if err := s.CreateConversation(ctx, conv); err != nil {
		t.Fatal(err)
	}
	tool, err := json.Marshal(ToolPayload{ID: "c1", Tool: "calc", Args: json.RawMessage(`{"expr":"1+1"}`), Result: "2", OK: true})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.AppendMessage(ctx, conv.ID, &Message{
		Role: RoleAssistant, QuestionID: "q-3",
		Segments: []Segment{
			{Type: SegmentTool, Kind: "calc", Payload: tool},
			{Type: SegmentProse, Text: "It checks out."},
		},
	}); err != nil {
		t.Fatal(err)
	}
	msgs, err := s.Messages(ctx, conv.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(msgs) != 1 {
		t.Fatalf("messages = %d", len(msgs))
	}
	m := msgs[0]
	if m.QuestionID != "q-3" {
		t.Errorf("question id = %q", m.QuestionID)
	}
	if len(m.Segments) != 2 || m.Segments[0].Type != SegmentTool || m.Segments[0].Kind != "calc" {
		t.Fatalf("segments = %+v", m.Segments)
	}
	var payload ToolPayload
	if err := json.Unmarshal(m.Segments[0].Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Tool != "calc" || payload.Result != "2" || !payload.OK {
		t.Errorf("tool payload = %+v", payload)
	}
}
