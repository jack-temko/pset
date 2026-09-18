package engine

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
)

// collect emits into a slice.
func collect(events *[]AskEvent) func(AskEvent) error {
	return func(ev AskEvent) error {
		*events = append(*events, ev)
		return nil
	}
}

// collectAsk collects the prose and envelope arm of a unified chat stream,
// so a splitter test and a whole-Ask test compare the same event lists.
func collectAsk(events *[]AskEvent) func(ChatEvent) error {
	return func(ev ChatEvent) error {
		if ev.Type == ChatAsk {
			*events = append(*events, ev.Ask)
		}
		return nil
	}
}

// feed runs text through a splitter whose client points nowhere (no repair
// is triggered when every payload is valid).
func feed(t *testing.T, text string) (events []AskEvent, segments []store.Segment) {
	t.Helper()
	sp := newEnvelopeSplitter(context.Background(), llm.New("http://127.0.0.1:1", "k", "", ""), discardLogger(), collect(&events))
	if err := sp.Feed(text); err != nil {
		t.Fatalf("feed: %v", err)
	}
	if err := sp.Finish(); err != nil {
		t.Fatalf("finish: %v", err)
	}
	return events, sp.Segments()
}

func TestSplitterProsePassesThrough(t *testing.T) {
	events, segments := feed(t, "Plain answer [p. 3].")
	if len(events) != 1 || events[0].Type != AskDelta || events[0].Text != "Plain answer [p. 3]." {
		t.Fatalf("events = %+v, want one prose delta without a trailing newline", events)
	}
	if len(segments) != 1 || segments[0].Type != store.SegmentProse ||
		segments[0].Text != "Plain answer [p. 3]." {
		t.Fatalf("segments = %+v", segments)
	}
}

func TestSplitterEnvelopeOrdering(t *testing.T) {
	payload := `{"title":"Bayes","equations":["P(A\\mid B) = 1"], "note":"shown [p. 12]"}`
	text := "Before [p. 3].\n```equation\n" + payload + "\n```\nAfter [p. 4].\n"
	events, segments := feed(t, text)

	types := make([]AskEventType, len(events))
	for i, ev := range events {
		types[i] = ev.Type
	}
	want := []AskEventType{AskDelta, AskEnvelopeStart, AskEnvelope, AskDelta}
	if len(types) != len(want) {
		t.Fatalf("events = %v, want %v", types, want)
	}
	for i := range want {
		if types[i] != want[i] {
			t.Fatalf("events = %v, want %v", types, want)
		}
	}
	if events[0].Text != "Before [p. 3].\n" {
		t.Errorf("first delta = %q", events[0].Text)
	}
	if events[1].Kind != "equation" {
		t.Errorf("envelope-start kind = %q", events[1].Kind)
	}
	var decoded map[string]any
	if err := json.Unmarshal(events[2].Payload, &decoded); err != nil {
		t.Fatalf("envelope payload = %s: %v", events[2].Payload, err)
	}
	if decoded["title"] != "Bayes" {
		t.Errorf("envelope payload = %s", events[2].Payload)
	}
	if events[3].Text != "After [p. 4].\n" {
		t.Errorf("last delta = %q", events[3].Text)
	}

	if len(segments) != 3 ||
		segments[0].Type != store.SegmentProse || segments[0].Text != "Before [p. 3].\n" ||
		segments[1].Type != store.SegmentEnvelope || segments[1].Kind != "equation" ||
		string(segments[1].Payload) != `{"title":"Bayes","equations":["P(A\\mid B) = 1"],"note":"shown [p. 12]"}` ||
		segments[2].Type != store.SegmentProse || segments[2].Text != "After [p. 4].\n" {
		t.Fatalf("segments = %+v", segments)
	}
}

func TestSplitterUnknownTagAndPlainFencesPassThrough(t *testing.T) {
	text := "```yaml\nkey: value\n```\n" +
		"```\nplain code\n```\n" +
		"```formula\nold alias must not shape up\n```\n"
	events, segments := feed(t, text)
	var joined strings.Builder
	for _, ev := range events {
		if ev.Type != AskDelta {
			t.Fatalf("event = %+v, want deltas only for unknown tags", ev)
		}
		joined.WriteString(ev.Text)
	}
	if joined.String() != text {
		t.Errorf("deltas = %q, want the input verbatim", joined.String())
	}
	if len(segments) != 1 || segments[0].Type != store.SegmentProse || segments[0].Text != text {
		t.Errorf("segments = %+v, want one prose segment", segments)
	}
}

func TestSplitterAbortMidEnvelope(t *testing.T) {
	events := []AskEvent(nil)
	sp := newEnvelopeSplitter(context.Background(), llm.New("http://127.0.0.1:1", "k", "", ""), discardLogger(), collect(&events))
	if err := sp.Feed("Started.\n```theorem\n" + `{"title":"Only"}`); err != nil {
		t.Fatal(err)
	}
	if err := sp.Finish(); err != nil {
		t.Fatal(err)
	}
	last := events[len(events)-1]
	if last.Type != AskEnvelopeFailed || last.Kind != "theorem" || last.Text != `{"title":"Only"}` {
		t.Fatalf("last event = %+v, want envelope-failed with the arrived payload", last)
	}
	segments := sp.Segments()
	if len(segments) != 2 || segments[0].Type != store.SegmentProse ||
		segments[1].Type != store.SegmentCode || segments[1].Text != `{"title":"Only"}` {
		t.Fatalf("segments = %+v, want prose plus the degraded code segment", segments)
	}
}

// splitterWithChat drives the repair paths through a scripted chat endpoint.
func splitterWithChat(t *testing.T, chat *fakeChat, chunks ...string) (events []AskEvent, segments []store.Segment, err error) {
	t.Helper()
	client := llm.New(chat.url(), "k", "", "")
	sp := newEnvelopeSplitter(context.Background(), client, discardLogger(), collect(&events))
	for _, chunk := range chunks {
		if err := sp.Feed(chunk); err != nil {
			return events, sp.Segments(), err
		}
	}
	return events, sp.Segments(), sp.Finish()
}

func TestSplitterRepairRound(t *testing.T) {
	chat := startFakeChat(t,
		"```steps\n",
		`{"title":"Solve","steps":["Add 2 [p. 5]"]`+"\n", // missing closing brace
		"```\n")
	chat.replyOnce(`{"title":"Solve","steps":["Add 2 [p. 5]"],"note":""}`)

	events, segments, err := splitterWithChat(t, chat,
		"```steps\n",
		`{"title":"Solve","steps":["Add 2 [p. 5]"]`+"\n",
		"```\n")
	if err != nil {
		t.Fatalf("splitter: %v", err)
	}
	if chat.count() != 1 {
		t.Fatalf("%d chat requests, want the single repair round", chat.count())
	}
	if req := chat.request(0); req.Stream || req.Model != llm.ChatModel {
		t.Errorf("repair request = %+v, want non-streaming on the ask model", req)
	}

	types := make([]AskEventType, len(events))
	for i, ev := range events {
		types[i] = ev.Type
	}
	want := []AskEventType{AskEnvelopeStart, AskEnvelopeRepairing, AskEnvelope}
	if len(types) != len(want) {
		t.Fatalf("events = %v, want %v", types, want)
	}
	for i := range want {
		if types[i] != want[i] {
			t.Fatalf("events = %v, want %v", types, want)
		}
	}
	if len(segments) != 1 || segments[0].Type != store.SegmentEnvelope {
		t.Fatalf("segments = %+v, want the repaired envelope", segments)
	}

	// The repair prompt carries kind, payload, errors, and the schema.
	req := chat.request(0)
	if len(req.Messages) != 2 {
		t.Fatalf("repair messages = %d, want system + user", len(req.Messages))
	}
	user := req.Messages[1].Content.Text()
	for _, fragment := range []string{`"steps"`, `{"title":"Solve","steps":["Add 2 [p. 5]"]`, "maxItems", `"required"`} {
		if !strings.Contains(user, fragment) {
			t.Errorf("repair prompt lacks %q:\n%s", fragment, user)
		}
	}
}

func TestSplitterRepairUnrepairable(t *testing.T) {
	chat := startFakeChat(t, "```note\n", `{"title":"X","body":[]}`+"\n", "```\n")
	chat.replyOnce("this is not json at all")

	events, segments, err := splitterWithChat(t, chat,
		"```note\n", `{"title":"X","body":[]}`+"\n", "```\n")
	if err != nil {
		t.Fatalf("splitter: %v", err)
	}
	if chat.count() != 1 {
		t.Fatalf("%d chat requests, want exactly one repair round", chat.count())
	}
	last := events[len(events)-1]
	if last.Type != AskEnvelopeFailed || last.Kind != "note" || last.Text != `{"title":"X","body":[]}` {
		t.Fatalf("last event = %+v, want envelope-failed with the raw payload", last)
	}
	if len(segments) != 1 || segments[0].Type != store.SegmentCode || segments[0].Text != `{"title":"X","body":[]}` {
		t.Fatalf("segments = %+v, want the degraded code segment", segments)
	}
}

func TestSplitterRepairCallErrors(t *testing.T) {
	chat := startFakeChat(t, "```equation\n", `{"title":"X","equations":[]}`+"\n", "```\n")
	chat.failOnceReplies()

	events, segments, err := splitterWithChat(t, chat,
		"```equation\n", `{"title":"X","equations":[]}`+"\n", "```\n")
	if err != nil {
		t.Fatalf("a failing repair call must degrade, not fail: %v", err)
	}
	last := events[len(events)-1]
	if last.Type != AskEnvelopeFailed || last.Kind != "equation" {
		t.Fatalf("last event = %+v, want envelope-failed", last)
	}
	if len(segments) != 1 || segments[0].Type != store.SegmentCode {
		t.Fatalf("segments = %+v, want the degraded code segment", segments)
	}
}

func TestSplitterToleratesFencedRepairReply(t *testing.T) {
	chat := startFakeChat(t, "```equation\n", "not json\n", "```\n")
	chat.replyOnce("```json\n{\"title\":\"X\",\"equations\":[\"y = mx + b\"]}\n```")

	events, segments, err := splitterWithChat(t, chat, "```equation\n", "not json\n", "```\n")
	if err != nil {
		t.Fatalf("splitter: %v", err)
	}
	if last := events[len(events)-1]; last.Type != AskEnvelope {
		t.Fatalf("last event = %+v, want the repaired envelope", last)
	}
	if len(segments) != 1 || segments[0].Type != store.SegmentEnvelope ||
		string(segments[0].Payload) != `{"title":"X","equations":["y = mx + b"]}` {
		t.Fatalf("segments = %+v", segments)
	}
}

func TestCheckEnvelopeValidationMatrix(t *testing.T) {
	cases := []struct {
		name    string
		kind    string
		payload string
		ok      bool
	}{
		{"equation ok", "equation", `{"title":"T","equations":["x = 1"],"note":"n"}`, true},
		{"equation without note", "equation", `{"title":"T","equations":["x = 1"]}`, true},
		{"equation empty array", "equation", `{"title":"T","equations":[]}`, false},
		{"equation empty entry", "equation", `{"title":"T","equations":[""]}`, false},
		{"equation missing title", "equation", `{"equations":["x = 1"]}`, false},
		{"equation extra key", "equation", `{"title":"T","equations":["x"],"body":"nope"}`, false},
		{"equation wrong type", "equation", `{"title":"T","equations":"x = 1"}`, false},
		{"equation not json", "equation", `{title:T}`, false},
		{"steps ok", "steps", `{"title":"T","steps":["one"]}`, true},
		{"steps empty", "steps", `{"title":"T","steps":[]}`, false},
		{"theorem ok", "theorem", `{"title":"T","statement":"S"}`, true},
		{"theorem missing statement", "theorem", `{"title":"T"}`, false},
		{"definition ok", "definition", `{"title":"T","statement":"S","note":"N"}`, true},
		{"definition extra key", "definition", `{"title":"T","statement":"S","steps":[]}`, false},
		{"note ok", "note", `{"title":"T","body":["b"]}`, true},
		{"note empty body", "note", `{"title":"T","body":[]}`, false},
		{"note has no note field", "note", `{"title":"T","body":["b"],"note":"x"}`, false},
		{"unknown kind", "graph", `{"title":"T"}`, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := checkEnvelope(tc.kind, tc.payload)
			if tc.ok != (err == nil) {
				t.Fatalf("checkEnvelope(%s, %s) = %v, want ok=%v", tc.kind, tc.payload, err, tc.ok)
			}
		})
	}
}

func TestCheckEnvelopeCaps(t *testing.T) {
	longTitle := `{"title":"` + strings.Repeat("x", 201) + `","equations":["x"]}`
	if _, err := checkEnvelope("equation", longTitle); err == nil {
		t.Error("a 201-char title must fail the cap")
	}
	many := `{"title":"T","equations":[`
	for i := 0; i < 13; i++ {
		if i > 0 {
			many += ","
		}
		many += `"x = 1"`
	}
	if _, err := checkEnvelope("equation", many+`]}`); err == nil {
		t.Error("13 equations must fail the maxItems cap")
	}
	longEquation := `{"title":"T","equations":["` + strings.Repeat("x", 2001) + `"]}`
	if _, err := checkEnvelope("equation", longEquation); err == nil {
		t.Error("a 2001-char equation must fail the cap")
	}
}

func TestMessageTextRendersSegmentsForHistory(t *testing.T) {
	m := store.Message{
		Role: store.RoleAssistant,
		Segments: []store.Segment{
			{Type: store.SegmentProse, Text: "Here [p. 3].\n"},
			{Type: store.SegmentEnvelope, Kind: "equation", Payload: json.RawMessage(`{"title":"T","equations":["x"]}`)},
			{Type: store.SegmentCode, Text: "broken"},
		},
	}
	want := "Here [p. 3].\n```equation\n{\"title\":\"T\",\"equations\":[\"x\"]}\n```\n```\nbroken\n```"
	if got := messageText(m); got != want {
		t.Errorf("messageText = %q, want %q", got, want)
	}
	if got := messageText(store.Message{Role: store.RoleUser, Content: "plain"}); got != "plain" {
		t.Errorf("user messageText = %q", got)
	}
}

// TestAskEndToEndEnvelopes pins the whole pipeline through Ask: typed events,
// segment persistence, citations over prose and envelope text fields, and the
// re-fenced history a follow-up ask carries.
func TestAskEndToEndEnvelopes(t *testing.T) {
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	ctx := context.Background()

	book := ingestDigitalSample(t, e, r)
	chat := startFakeChat(t,
		"Bayes' theorem, from the register [p. 3].\n",
		"```equation\n",
		`{"title":"Bayes","equations":["P(A\\\\mid B) \\\\times [p. 9] = 1"],"note":"see [p. 12]"}`+"\n",
		"```\n",
		"That is the shape of it [pp. 3-4].",
	)
	setChatConfig(t, e, chat.url(), "k")

	var events []AskEvent
	ans, err := e.Ask(ctx, book.SHA256, "", "State Bayes' theorem.", 0,
		nil, collectAsk(&events))
	if err != nil {
		t.Fatalf("ask: %v", err)
	}

	types := make([]AskEventType, len(events))
	for i, ev := range events {
		types[i] = ev.Type
	}
	want := []AskEventType{AskDelta, AskEnvelopeStart, AskEnvelope, AskDelta}
	if len(types) != len(want) {
		t.Fatalf("events = %v, want %v", types, want)
	}
	for i := range want {
		if types[i] != want[i] {
			t.Fatalf("events = %v, want %v", types, want)
		}
	}

	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	messages, err := s.Messages(ctx, ans.ConversationID)
	if err != nil {
		t.Fatal(err)
	}
	if len(messages) != 2 {
		t.Fatalf("%d messages, want 2", len(messages))
	}
	segs := messages[1].Segments
	if len(segs) != 3 || segs[0].Type != store.SegmentProse ||
		segs[1].Type != store.SegmentEnvelope || segs[1].Kind != "equation" ||
		segs[2].Type != store.SegmentProse {
		t.Fatalf("segments = %+v", segs)
	}
	// The follow-up history re-fences the envelope for the model.
	if _, err := e.Ask(ctx, book.SHA256, ans.ConversationID, "And why?", 0, nil, nil); err != nil {
		t.Fatalf("follow-up ask: %v", err)
	}
	req := chat.request(1)
	if len(req.Messages) != 4 {
		t.Fatalf("%d request messages, want system + 2 history + user", len(req.Messages))
	}
	history := req.Messages[2].Content.Text()
	if !strings.Contains(history, "```equation") || !strings.Contains(history, `"title":"Bayes"`) {
		t.Errorf("history lost the envelope:\n%s", history)
	}
}
