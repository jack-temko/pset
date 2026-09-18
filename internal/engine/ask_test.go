package engine

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
)

// ingestDigitalSample runs the full ingest of the digital sample and returns
// the book — a real ingested book with FTS-indexed pages.
func ingestDigitalSample(t *testing.T, e *Engine, r *Runner) *store.Book {
	t.Helper()
	requirePoppler(t)
	m := loadManifest(t)
	v := prepare(t, e, r, filepath.Join(sampleDir, m.Digital.File))
	if v.Status != store.TaskDone {
		t.Fatalf("ingest = %q/%q, want completed", v.Status, v.Error)
	}
	return taskBook(t, e, v)
}

func TestAskEndToEndWithFakeChat(t *testing.T) {
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	ctx := context.Background()

	book := ingestDigitalSample(t, e, r)
	chat := startFakeChat(t, "A gavel is a manufactured clap, as the register shows ", "[p. 3].")
	setChatConfig(t, e, chat.url(), "k")

	var events []ChatEvent
	var update AskUpdate
	var started bool
	ans, err := e.Ask(ctx, book.SHA256, "", "What is a gavel?", 0,
		func(u AskUpdate) error { update = u; started = true; return nil },
		func(ev ChatEvent) error { events = append(events, ev); return nil })
	if err != nil {
		t.Fatalf("ask: %v", err)
	}
	if !started {
		t.Fatal("onStart never fired")
	}
	if update.ConversationID == "" || len(update.Pages) == 0 {
		t.Fatalf("meta = %+v, want a conversation id and context pages", update)
	}
	if !slices.Contains(update.Pages, 3) {
		t.Errorf("context pages = %v, want 3 (the gavel fact) among them", update.Pages)
	}
	if len(update.Pages) > topKPages {
		t.Errorf("%d context pages, want at most %d", len(update.Pages), topKPages)
	}
	if update.Warnings != nil {
		t.Errorf("warnings = %v, want none on a clean fused retrieval", update.Warnings)
	}
	var text strings.Builder
	for _, ev := range events {
		if ev.Type != ChatAsk || ev.Ask.Type != AskDelta {
			t.Errorf("event = %+v, want prose deltas only", ev)
			continue
		}
		text.WriteString(ev.Ask.Text)
	}
	if text.String() != "A gavel is a manufactured clap, as the register shows [p. 3]." {
		t.Errorf("deltas = %q", text.String())
	}
	if ans.ConversationID != update.ConversationID {
		t.Errorf("conversation id mismatch: %s vs %s", ans.ConversationID, update.ConversationID)
	}

	// The model request carried the honesty contract, page texts, and images.
	if chat.count() != 1 {
		t.Fatalf("%d chat requests, want 1", chat.count())
	}
	req := chat.request(0)
	if req.Model != llm.ChatModel {
		t.Errorf("model = %q, want the hardcoded %q", req.Model, llm.ChatModel)
	}
	last := req.Messages[len(req.Messages)-1]
	imageParts := 0
	for _, part := range last.Content.Parts() {
		if part.Type == "image_url" && part.ImageURL != nil &&
			strings.HasPrefix(part.ImageURL.URL, "data:image/jpeg;base64,") {
			imageParts++
		}
	}
	if imageParts != len(update.Pages) {
		t.Errorf("%d image parts, want one per context page (%d)", imageParts, len(update.Pages))
	}
	if !strings.Contains(last.Content.Parts()[0].Text, "Question: What is a gavel?") {
		t.Errorf("user text missing the question: %.80s", last.Content.Parts()[0].Text)
	}
	sys := req.Messages[0].Content.Text()
	if req.Messages[0].Role != "system" || !strings.Contains(sys, "(p. N)") || !strings.Contains(sys, "(pp. N-M)") {
		t.Error("system prompt missing the honesty contract")
	}

	// Persistence: a titled conversation with both messages, citations stored.
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	conv, err := s.ConversationByID(ctx, ans.ConversationID)
	if err != nil {
		t.Fatal(err)
	}
	if conv.Title != "What is a gavel?" || conv.MessageCount != 2 {
		t.Fatalf("conversation = %+v, want the question as title and 2 messages", conv)
	}
	messages, err := s.Messages(ctx, conv.ID)
	if err != nil {
		t.Fatal(err)
	}
	if messages[0].Role != store.RoleUser || messages[0].Content != "What is a gavel?" {
		t.Errorf("user message = %+v", messages[0])
	}
	if messages[1].Role != store.RoleAssistant {
		t.Errorf("assistant message = %+v", messages[1])
	}
	if messages[1].Content != "" || len(messages[1].Segments) != 1 ||
		messages[1].Segments[0].Type != store.SegmentProse ||
		messages[1].Segments[0].Text != "A gavel is a manufactured clap, as the register shows [p. 3]." {
		t.Errorf("assistant segments = %+v, want the single prose segment", messages[1].Segments)
	}
	if messages[1].ID != ans.MessageID {
		t.Errorf("message id = %s, want %s", messages[1].ID, ans.MessageID)
	}
}

func TestAskContinuesConversation(t *testing.T) {
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	ctx := context.Background()

	book := ingestDigitalSample(t, e, r)
	chat := startFakeChat(t, "second answer [p. 4]")
	setChatConfig(t, e, chat.url(), "k")

	first, err := e.Ask(ctx, book.SHA256, "", "What is a gavel?", 0, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	second, err := e.Ask(ctx, book.SHA256, first.ConversationID, "And the call sign?", 0, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if second.ConversationID != first.ConversationID {
		t.Fatalf("conversation ids differ: %s vs %s", first.ConversationID, second.ConversationID)
	}

	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	messages, err := s.Messages(ctx, first.ConversationID)
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 4 {
		t.Fatalf("%d messages, want 4", len(messages))
	}
	// The request carried the two prior turns as history, not the question.
	req := chat.request(1)
	if len(req.Messages) != 4 {
		t.Fatalf("%d request messages, want system + 2 history + user", len(req.Messages))
	}
	if req.Messages[1].Content.Text() != "What is a gavel?" ||
		req.Messages[2].Content.Text() != "second answer [p. 4]" {
		t.Errorf("history = %q / %q", req.Messages[1].Content.Text(), req.Messages[2].Content.Text())
	}
}

// TestAskPageAnchor pins the reader's "ask about this page": the anchored
// page leads the context and is named to the model even where fused
// retrieval would rank it low, and the stored question stays as asked.
func TestAskPageAnchor(t *testing.T) {
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	ctx := context.Background()

	book := ingestDigitalSample(t, e, r)
	chat := startFakeChat(t, "Answer [p. 6].")
	setChatConfig(t, e, chat.url(), "k")

	var update AskUpdate
	if _, err := e.Ask(ctx, book.SHA256, "", "What is a gavel?", book.PageCount,
		func(u AskUpdate) error { update = u; return nil }, nil); err != nil {
		t.Fatalf("ask: %v", err)
	}
	if len(update.Pages) == 0 || update.Pages[0] != book.PageCount {
		t.Fatalf("context pages = %v, want page %d (the anchor) first", update.Pages, book.PageCount)
	}
	if len(update.Pages) > topKPages {
		t.Errorf("%d context pages, want at most %d", len(update.Pages), topKPages)
	}
	req := chat.request(0)
	last := req.Messages[len(req.Messages)-1]
	if want := fmt.Sprintf("The question is about page %d", book.PageCount); !strings.Contains(last.Content.Parts()[0].Text, want) {
		t.Errorf("model text never names the anchored page: %.120s", last.Content.Parts()[0].Text)
	}

	// The stored question carries the anchor in no way at all.
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	messages, err := s.Messages(ctx, update.ConversationID)
	if err != nil {
		t.Fatal(err)
	}
	if messages[0].Role != store.RoleUser || messages[0].Content != "What is a gavel?" {
		t.Errorf("user message = %+v, want the clean question", messages[0])
	}
}

func TestAskFailsWhenEmbedFails(t *testing.T) {
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	ctx := context.Background()

	book := ingestDigitalSample(t, e, r)
	chat := startFakeChat(t, "should never stream [p. 3]")
	embedSrv := startFakeEmbed(t, &fakeEmbed{failFrom: 1}) // every request fails
	cfg, err := e.Config(ctx)
	if err != nil {
		t.Fatal(err)
	}
	cfg.APIBaseURL, cfg.APIKey = chat.url(), "k"
	cfg.EmbedBaseURL = embedSrv.URL
	if err := e.SaveConfig(ctx, cfg); err != nil {
		t.Fatal(err)
	}

	// Retrieval needs both halves; a dead embeddings endpoint fails the ask
	// instead of degrading it.
	_, err = e.Ask(ctx, book.SHA256, "", "What is a gavel?", 0, nil, nil)
	if err == nil {
		t.Fatal("ask must fail when the embeddings endpoint is down")
	}
	if !strings.Contains(err.Error(), "model request failed") {
		t.Errorf("err = %v, want the model-request failure", err)
	}
}

func TestAskGuards(t *testing.T) {
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	ctx := context.Background()

	book := ingestDigitalSample(t, e, r)

	// No key configured.
	setChatConfig(t, e, "http://x", "")
	_, err := e.Ask(ctx, book.SHA256, "", "hello", 0, nil, nil)
	var unconf *LLMUnconfiguredError
	if !errors.As(err, &unconf) {
		t.Fatalf("err = %v, want LLMUnconfiguredError", err)
	}

	setChatConfig(t, e, "http://x", "k")

	// Unknown book.
	_, err = e.Ask(ctx, "nosuch", "", "hello", 0, nil, nil)
	var nm *NoMatchError
	if !errors.As(err, &nm) {
		t.Fatalf("err = %v, want NoMatchError", err)
	}

	// Empty question.
	if _, err := e.Ask(ctx, book.SHA256, "", "   ", 0, nil, nil); err == nil {
		t.Fatal("an empty question must be refused")
	}

	// A book that isn't ready is refused rather than quietly answered from
	// half its evidence: retrieval fuses text search with vector search, and
	// an unprepared book has neither.
	bare := seedFakeBook(t, e, "nopages0", "Bare", store.KindScanned, 2)
	_, err = e.Ask(ctx, bare.SHA256, "", "hello", 0, nil, nil)
	if err == nil {
		t.Fatal("asking about a book that isn't ready must be refused")
	}
	if !strings.Contains(err.Error(), "isn't ready") {
		t.Errorf("error = %q, want the not-ready refusal", err)
	}

	// A conversation of another book is refused, and an unknown conversation
	// id is a not-found.
	other := seedFakeBook(t, e, "otherbook", "Other Book", store.KindDigital, 2)
	seedBookPages(t, e, other.ID, 2)
	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	foreign := &store.Conversation{BookID: other.ID}
	if err := s.CreateConversation(ctx, foreign); err != nil {
		t.Fatal(err)
	}
	if _, err := e.Ask(ctx, book.SHA256, foreign.ID, "hello", 0, nil, nil); err == nil ||
		!strings.Contains(err.Error(), "different book") {
		t.Fatalf("err = %v, want the foreign-conversation refusal", err)
	}
	if _, err := e.Ask(ctx, book.SHA256, "00000000-0000-0000-0000-000000000000", "hello", 0, nil, nil); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("err = %v, want not-found for the unknown conversation", err)
	}
}
