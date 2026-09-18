package store

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
)

func createSegmentBook(t *testing.T, s *Store, ctx context.Context) *Book {
	t.Helper()
	b := &Book{SHA256: "segments", FilePath: "/segments.pdf", FileSize: 1}
	if err := s.CreateBook(ctx, b); err != nil {
		t.Fatalf("create book: %v", err)
	}
	return b
}

func TestMessageSegmentsRoundTrip(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	book := createSegmentBook(t, s, ctx)
	conv := &Conversation{BookID: book.ID, Title: "Thread"}
	if err := s.CreateConversation(ctx, conv); err != nil {
		t.Fatal(err)
	}

	if err := s.AppendMessage(ctx, conv.ID, &Message{Role: RoleUser, Content: "What is it?"}); err != nil {
		t.Fatal(err)
	}
	segments := []Segment{
		{Type: SegmentProse, Text: "It is this [p. 3].\n"},
		{Type: SegmentEnvelope, Kind: "equation", Payload: json.RawMessage(`{"title":"T","equations":["x = 1"]}`)},
		{Type: SegmentCode, Text: "the raw arrived text"},
	}
	ans := &Message{Role: RoleAssistant, Segments: segments, Citations: []int{3}}
	if err := s.AppendMessage(ctx, conv.ID, ans); err != nil {
		t.Fatal(err)
	}

	messages, err := s.Messages(ctx, conv.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 2 {
		t.Fatalf("%d messages, want 2", len(messages))
	}
	user := messages[0]
	if user.Content != "What is it?" || user.Segments != nil {
		t.Errorf("user message = %+v %+v, want plain content and no segments", user.Content, user.Segments)
	}
	got := messages[1]
	if got.Content != "" {
		t.Errorf("assistant content = %q, want empty", got.Content)
	}
	if len(got.Segments) != len(segments) {
		t.Fatalf("%d segments, want %d", len(got.Segments), len(segments))
	}
	for i, want := range segments {
		have := got.Segments[i]
		if have.Type != want.Type || have.Text != want.Text || have.Kind != want.Kind ||
			string(have.Payload) != string(want.Payload) {
			t.Errorf("segment %d = %+v, want %+v", i, have, want)
		}
	}
	if !equalInts(got.Citations, []int{3}) {
		t.Errorf("citations = %v, want [3]", got.Citations)
	}
}

// TestSegmentsRoundTrip pins the segment message format on the fresh
// schema: an envelope segment survives a store and a read unchanged.
func TestSegmentsRoundTrip(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx := context.Background()

	if err := s.Migrate(ctx); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	book := createSegmentBook(t, s, ctx)
	conv := &Conversation{BookID: book.ID, Title: "Fresh"}
	if err := s.CreateConversation(ctx, conv); err != nil {
		t.Fatal(err)
	}
	if err := s.AppendMessage(ctx, conv.ID, &Message{
		Role:     RoleAssistant,
		Segments: []Segment{{Type: SegmentEnvelope, Kind: "note", Payload: json.RawMessage(`{"title":"T","body":["b"]}`)}},
	}); err != nil {
		t.Fatalf("append: %v", err)
	}
	messages, err := s.Messages(ctx, conv.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 1 || len(messages[0].Segments) != 1 || messages[0].Segments[0].Kind != "note" {
		t.Errorf("messages = %+v, want the segment round-trip", messages)
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
