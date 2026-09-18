package engine

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
)

// seedChatHomework builds a ready two-question assignment with the scripted
// generation chat, then repoints the engine at a streaming fake the chat
// tests script themselves. It returns the assignment, its questions, and the
// streaming fake.
func seedChatHomework(t *testing.T) (*Engine, *Runner, *store.Homework, []store.HomeworkQuestion, *fakeChat) {
	t.Helper()
	e, r, book := seedHomeworkEnv(t)
	ctx := context.Background()

	gen := startHwChat(t,
		`{"questions":[{"text":"What is a gavel?","hint":"Chapter 2"},{"text":"call sign","hint":""}]}`,
		hwLocateReply, hwGuideReply("a = 5.9 m/s²"),
		hwLocateReply, hwGuideReply("d = 5.6 m"))
	hwChatConfig(t, e, gen)

	hw, _, err := e.SubmitHomework(ctx, HomeworkCreate{
		BookSHA256: book.SHA256, Title: "Problem Set 4", SourceText: hwSource,
	})
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	runPendingTasks(t, r)
	if got := hwByID(t, e, hw.ID); got.Status != store.HomeworkReady {
		t.Fatalf("homework = %s, want ready", got.Status)
	}
	questions := hwQuestions(t, e, hw.ID)

	chat := startFakeChat(t)
	setChatConfig(t, e, chat.url(), "k")
	return e, r, hw, questions, chat
}

// chatTypes flattens a stream to its event kinds, naming the ask arm by its
// own type so a sequence reads like the wire.
func chatTypes(events []ChatEvent) []string {
	out := make([]string, 0, len(events))
	for _, ev := range events {
		if ev.Type == ChatAsk {
			out = append(out, string(ev.Ask.Type))
			continue
		}
		out = append(out, string(ev.Type))
	}
	return out
}

// TestHomeworkChatToolRoundTrip: the model asks for a number, the engine
// computes it, and the result goes back into the next round. The transcript
// keeps the card in stream order.
func TestHomeworkChatToolRoundTrip(t *testing.T) {
	e, _, hw, questions, chat := seedChatHomework(t)
	ctx := context.Background()

	chat.scriptStream(
		toolReply(call("c1", "calc", `{"expression":"(24∠0)/(4+j6)"}`)),
		proseReply("The current is 3.33∠-56.3 A (p. 3).\n"),
	)

	var events []ChatEvent
	ans, err := e.HomeworkChat(ctx, hw.ID, questions[0].ID, "what is the current?",
		func(ev ChatEvent) error { events = append(events, ev); return nil })
	if err != nil {
		t.Fatalf("chat: %v", err)
	}
	if got := strings.Join(chatTypes(events), ","); got != "meta,tool-start,tool-result,delta" {
		t.Fatalf("events = %s", got)
	}
	if events[0].ConversationID == "" || events[0].QuestionID != questions[0].ID {
		t.Errorf("meta = %+v", events[0])
	}
	result := events[2].Tool
	if !result.OK || result.Tool != "calc" || !strings.Contains(result.Result, "∠") {
		t.Fatalf("calc card = %+v, want a polar form", result)
	}

	// Two model rounds: the second one carries the assistant's call and the
	// tool's answer, which is the whole point of the loop.
	if chat.streamCalls() != 2 {
		t.Fatalf("%d model rounds, want 2", chat.streamCalls())
	}
	second := chat.request(chat.count() - 1)
	var sawCall, sawResult bool
	for _, m := range second.Messages {
		if m.Role == "assistant" && len(m.ToolCalls) == 1 && m.ToolCalls[0].Function.Name == "calc" {
			sawCall = true
		}
		if m.Role == "tool" && m.ToolCallID == "c1" && strings.Contains(m.Content.Text(), "∠") {
			sawResult = true
		}
	}
	if !sawCall || !sawResult {
		t.Fatalf("second round messages = %+v, want the call and its result", second.Messages)
	}

	// The first round offered the tools, including the homework-only one.
	first := chat.request(0)
	names := make([]string, 0, len(first.Tools))
	for _, tool := range first.Tools {
		names = append(names, tool.Function.Name)
	}
	for _, want := range []string{"calc", "solve_linear", "search_book", "read_page", "add_understanding_note"} {
		if !contains(names, want) {
			t.Errorf("tools = %v, missing %q", names, want)
		}
	}

	// Persisted: the card sits before the prose it explains.
	messages := chatMessages(t, e, ans.ConversationID)
	if len(messages) != 2 {
		t.Fatalf("%d messages, want the turn's two", len(messages))
	}
	segs := messages[1].Segments
	if len(segs) != 2 || segs[0].Type != store.SegmentTool || segs[0].Kind != "calc" ||
		segs[1].Type != store.SegmentProse {
		t.Fatalf("segments = %+v, want the card then the prose", segs)
	}
	var card store.ToolPayload
	if err := json.Unmarshal(segs[0].Payload, &card); err != nil {
		t.Fatalf("decode card: %v", err)
	}
	if card.ID != "c1" || !card.OK {
		t.Errorf("stored card = %+v", card)
	}
}

// TestHomeworkChatNoteStalesQuestion is the correction loop: the student
// says the diagram was read wrong, the note lands on the question, the
// walkthrough goes stale, and the next rewrite is written with the note in
// front of it.
func TestHomeworkChatNoteStalesQuestion(t *testing.T) {
	e, r, hw, questions, chat := seedChatHomework(t)
	ctx := context.Background()
	target := questions[0]
	if target.Status != store.QuestionReady {
		t.Fatalf("question = %s, want a ready one to stale", target.Status)
	}

	chat.scriptStream(
		toolReply(call("n1", "add_understanding_note", `{"note":"the 2A source arrow points up"}`)),
		proseReply("Noted. The walkthrough is out of date; rewrite it.\n"),
	)
	var events []ChatEvent
	if _, err := e.HomeworkChat(ctx, hw.ID, target.ID, "the 2A source points up, not down",
		func(ev ChatEvent) error { events = append(events, ev); return nil }); err != nil {
		t.Fatalf("chat: %v", err)
	}
	if got := strings.Join(chatTypes(events), ","); got != "meta,tool-start,question,tool-result,delta" {
		t.Fatalf("events = %s, want the question row to ride out with the card", got)
	}
	changed := events[2].Question
	if changed == nil || changed.ID != target.ID || changed.Status != store.QuestionStale {
		t.Fatalf("question event = %+v, want %s stale", changed, target.ID)
	}

	after := hwQuestions(t, e, hw.ID)
	if after[0].Status != store.QuestionStale || len(after[0].UnderstandingNotes) != 1 ||
		after[0].UnderstandingNotes[0].Note != "the 2A source arrow points up" {
		t.Fatalf("stored question = %+v", after[0])
	}
	if after[0].Guide == nil {
		t.Error("staling a question must not drop its walkthrough — it is what gets corrected")
	}
	if after[1].Status != store.QuestionReady {
		t.Errorf("Q2 was disturbed: %+v", after[1])
	}

	// The rewrite consumes the note: it is in the prompt, and the question
	// comes back ready. It is a task, so it survives the page that asked for
	// it — and it skips locating, because the question is in the right place.
	rewrite := startHwChat(t, hwGuideReply("a = 4.2 m/s²"))
	hwChatConfig(t, e, rewrite)
	task, err := e.RewriteQuestion(ctx, target.ID, "")
	if err != nil {
		t.Fatalf("rewrite: %v", err)
	}
	if task.Kind != store.TaskQuestion || task.QuestionID == nil || *task.QuestionID != target.ID {
		t.Fatalf("task = %+v, want a question task for %s", task, target.ID)
	}
	runPendingTasks(t, r)

	view, err := e.TaskView(ctx, task.ID)
	if err != nil {
		t.Fatal(err)
	}
	if view.Status != store.TaskDone {
		t.Fatalf("rewrite task = %s/%s, want done", view.Status, view.Error)
	}
	keys := make([]string, 0, len(view.Phases))
	for _, ph := range view.Phases {
		keys = append(keys, ph.Key)
	}
	if strings.Join(keys, ",") != "guide" {
		t.Fatalf("rewrite phases = %v, want the guide alone — it is already located", keys)
	}
	fixed := hwQuestions(t, e, hw.ID)[0]
	if fixed.Status != store.QuestionReady {
		t.Fatalf("rewritten question = %s, want ready", fixed.Status)
	}
	prompt := rewrite.request(0).Messages
	text := prompt[len(prompt)-1].Content.Text()
	if len(prompt[len(prompt)-1].Content.Parts()) > 0 {
		text = prompt[len(prompt)-1].Content.Parts()[0].Text
	}
	if !strings.Contains(text, "the 2A source arrow points up") {
		t.Fatalf("the rewrite prompt never carried the note: %.400s", text)
	}
	// The note is durable: a rewrite consumes it but does not erase it.
	if notes := hwQuestions(t, e, hw.ID)[0].UnderstandingNotes; len(notes) != 1 {
		t.Errorf("notes after the rewrite = %+v, want the note kept", notes)
	}
}

// TestChatSearchToolFusesLikeRetrieval pins the consolidation: the tool and
// the ask's own retrieval are the same fusion, so the pages the model can
// reach for are the pages it would have been given.
func TestChatSearchToolFusesLikeRetrieval(t *testing.T) {
	e := testEngine(t, discardLogger())
	r := newTestRunner(t, e)
	ctx := context.Background()
	book := ingestDigitalSample(t, e, r)
	chat := startFakeChat(t)
	setChatConfig(t, e, chat.url(), "k")

	s, err := e.openStore(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	settings, err := e.Config(ctx)
	if err != nil {
		t.Fatal(err)
	}
	client := e.llmClient(settings)

	want, err := e.retrievePages(ctx, s, book, client, settings.EmbedModel, "gavel")
	if err != nil {
		t.Fatalf("retrieve: %v", err)
	}
	x := &chatToolExecutor{eng: e, s: s, book: book, client: client, embedModel: settings.EmbedModel}
	_, payload, err := x.execute(ctx, llm.ToolCall{
		ID: "s1", Function: llm.ToolCallFunc{Name: "search_book", Arguments: `{"query":"gavel","limit":` + strconv.Itoa(len(want)) + `}`},
	}, func(ChatEvent) error { return nil })
	if err != nil {
		t.Fatalf("search tool: %v", err)
	}
	if !payload.OK || !equalInts(payload.Pages, want) {
		t.Fatalf("search pages = %v, want the fused %v", payload.Pages, want)
	}
	if !strings.Contains(payload.Result, "p. ") {
		t.Errorf("search result = %q, want page-numbered snippets", payload.Result)
	}
}

// TestChatToolBudget: a model that will not stop calling tools fails the
// turn with something a student can read, rather than looping forever.
func TestChatToolBudget(t *testing.T) {
	e, _, hw, questions, chat := seedChatHomework(t)
	chat.scriptStream(toolReply(call("c", "calc", `{"expression":"1+1"}`)))

	_, err := e.HomeworkChat(context.Background(), hw.ID, questions[0].ID, "loop forever", nil)
	if err == nil {
		t.Fatal("an unbounded tool loop must fail the turn")
	}
	if !strings.Contains(err.Error(), "too many tool calls") {
		t.Fatalf("err = %v, want the bound's own message", err)
	}
	if rounds := chat.streamCalls(); rounds > chatToolBudget+1 {
		t.Errorf("%d model rounds, want the loop stopped at the %d-call bound", rounds, chatToolBudget)
	}
}

// TestHomeworkChatPersistsOneThread: one conversation per assignment, the
// active question remembered per message, history fed back to the model.
func TestHomeworkChatPersistsOneThread(t *testing.T) {
	e, _, hw, questions, chat := seedChatHomework(t)
	ctx := context.Background()

	chat.scriptStream(proseReply("First answer.\n"))
	first, err := e.HomeworkChat(ctx, hw.ID, questions[0].ID, "about Q1", nil)
	if err != nil {
		t.Fatalf("first turn: %v", err)
	}
	chat.scriptStream(proseReply("Second answer.\n"))
	second, err := e.HomeworkChat(ctx, hw.ID, questions[1].ID, "now about Q2", nil)
	if err != nil {
		t.Fatalf("second turn: %v", err)
	}
	if second.ConversationID != first.ConversationID {
		t.Fatalf("conversations differ: %s vs %s — one thread per assignment",
			first.ConversationID, second.ConversationID)
	}

	conv, messages, err := e.HomeworkChatHistory(ctx, hw.ID)
	if err != nil {
		t.Fatalf("history: %v", err)
	}
	if conv == nil || conv.HomeworkID != hw.ID || len(messages) != 4 {
		t.Fatalf("history = %+v with %d messages, want the assignment's thread with 4", conv, len(messages))
	}
	if messages[0].QuestionID != questions[0].ID || messages[2].QuestionID != questions[1].ID {
		t.Errorf("messages lost their question anchors: %q / %q", messages[0].QuestionID, messages[2].QuestionID)
	}

	// The second turn's request carried the first as history, and named the
	// question each user turn was about.
	req := chat.request(chat.count() - 1)
	var history strings.Builder
	for _, m := range req.Messages {
		history.WriteString(m.Role + ":" + m.Content.Text() + "\n")
		for _, part := range m.Content.Parts() {
			history.WriteString(part.Text)
		}
	}
	if !strings.Contains(history.String(), "About Q1: about Q1") {
		t.Errorf("history did not name the earlier question: %.400s", history.String())
	}
	if !strings.Contains(history.String(), "First answer.") {
		t.Errorf("history dropped the earlier answer: %.400s", history.String())
	}

	// The assignment's chat is not an ask thread and never shows in the rail.
	for _, ref := range allConversations(t, e) {
		if ref.ID == conv.ID {
			t.Fatalf("the homework chat is listed as an ask thread")
		}
	}
}

// TestHomeworkChatCarriesTheReading: the box the student checks first is in
// the model's context, so a correction lands against what it actually said.
func TestHomeworkChatCarriesTheReading(t *testing.T) {
	e, _, hw, questions, chat := seedChatHomework(t)
	chat.scriptStream(proseReply("Answer.\n"))
	if _, err := e.HomeworkChat(context.Background(), hw.ID, questions[0].ID, "is that right?", nil); err != nil {
		t.Fatalf("chat: %v", err)
	}
	req := chat.request(chat.count() - 1)
	last := req.Messages[len(req.Messages)-1]
	text := last.Content.Text()
	if parts := last.Content.Parts(); len(parts) > 0 {
		text = parts[0].Text
	}
	for _, want := range []string{"How it read the problem", "- find: the acceleration of the blocks"} {
		if !strings.Contains(text, want) {
			t.Errorf("chat context missing %q:\n%.800s", want, text)
		}
	}
}

// --- helpers -------------------------------------------------------------------

func chatMessages(t *testing.T, e *Engine, conversationID string) []store.Message {
	t.Helper()
	s, err := e.openStore(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	messages, err := s.Messages(context.Background(), conversationID)
	if err != nil {
		t.Fatal(err)
	}
	return messages
}

func allConversations(t *testing.T, e *Engine) []store.ConversationRef {
	t.Helper()
	refs, err := e.AllConversations(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return refs
}

func contains(list []string, want string) bool {
	for _, s := range list {
		if s == want {
			return true
		}
	}
	return false
}
