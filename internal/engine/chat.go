package engine

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
)

// The unified chat: one streaming turn loop shared by the ask page and the
// homework workspace. Prose and envelopes flow through the same splitter
// as before; between model rounds the model may call tools, which run here
// and land as cards in the transcript. The homework chat is one persistent
// conversation per assignment that follows the selected question around.

// chatToolBudget bounds one turn's tool round trips.
const chatToolBudget = 8

// ChatEventType names the unified stream's event kinds. The ask variants
// ride inside Ask; these strings are the SSE wire names.
type ChatEventType string

const (
	// ChatMeta fires once, before any prose: the conversation the turn
	// landed on and the question it is anchored to.
	ChatMeta ChatEventType = "meta"
	// ChatAsk wraps a prose delta or envelope lifecycle event.
	ChatAsk ChatEventType = "ask"
	// ChatToolStart fires before a tool runs (no result yet).
	ChatToolStart ChatEventType = "tool-start"
	// ChatToolResult fires with the completed card.
	ChatToolResult ChatEventType = "tool-result"
	// ChatQuestion fires when a tool changed the outline (a note landed).
	ChatQuestion ChatEventType = "question"
)

// ChatEvent is one typed unit of a unified chat stream.
type ChatEvent struct {
	Type           ChatEventType
	ConversationID string                  // set for ChatMeta
	QuestionID     string                  // set for ChatMeta
	Ask            AskEvent                // set for Type ChatAsk
	Tool           *store.ToolPayload      // set for the tool kinds
	Question       *store.HomeworkQuestion // set for ChatQuestion
}

// runToolLoop streams one chat turn, running tool calls between model
// rounds until the model answers in plain prose. The splitter spans every
// round so segments keep stream order; tool cards are appended to it at
// the round boundary that produced them, keeping the transcript aligned.
// messages is extended in place with the assistant tool turns and tool
// results the model must see.
func runToolLoop(
	ctx context.Context,
	client *llm.Client,
	emit func(ChatEvent) error,
	messages []llm.Message,
	defs []llm.Tool,
	execute func(ctx context.Context, call llm.ToolCall, emit func(ChatEvent) error) (string, store.ToolPayload, error),
	splitter *envelopeSplitter,
) error {
	calls := 0
	for {
		req := llm.ChatRequest{Model: llm.ChatModel, Messages: messages}
		if len(defs) > 0 {
			req.Tools = defs
		}
		reply, err := client.ChatStreamFull(ctx, req, splitter.Feed)
		if err != nil {
			return err
		}
		if len(reply.ToolCalls) == 0 {
			return nil
		}
		// Flush the prose buffered before the calls so the cards land in
		// the right place in the ordered segments.
		if err := splitter.Boundary(); err != nil {
			return err
		}
		messages = append(messages, llm.AssistantToolMessage(reply.Content, reply.ToolCalls))
		for _, call := range reply.ToolCalls {
			calls++
			if calls > chatToolBudget {
				return &UserError{Message: "the chat ran too many tool calls in one turn — ask something narrower"}
			}
			start := store.ToolPayload{ID: call.ID, Tool: call.Function.Name, Args: json.RawMessage(call.Function.Arguments)}
			if err := emit(ChatEvent{Type: ChatToolStart, Tool: &start}); err != nil {
				return err
			}
			content, payload, err := execute(ctx, call, emit)
			if err != nil {
				return err
			}
			if err := emit(ChatEvent{Type: ChatToolResult, Tool: &payload}); err != nil {
				return err
			}
			card, err := json.Marshal(payload)
			if err != nil {
				return err
			}
			splitter.AppendSegment(store.Segment{Type: store.SegmentTool, Kind: payload.Tool, Payload: card})
			messages = append(messages, llm.ToolMessage(call.ID, content))
		}
	}
}

// chatEmitter makes an optional sink safe to call: a caller that wants no
// events (a test, an internal rewrite) passes nil.
func chatEmitter(emit func(ChatEvent) error) func(ChatEvent) error {
	if emit != nil {
		return emit
	}
	return func(ChatEvent) error { return nil }
}

// askSplitterEmitter wraps the prose and envelope events the splitter
// produces as the ChatAsk arm of the unified stream.
func askSplitterEmitter(emit func(ChatEvent) error) func(AskEvent) error {
	return func(ev AskEvent) error { return emit(ChatEvent{Type: ChatAsk, Ask: ev}) }
}

// HomeworkChatAnswer reports a completed homework chat turn.
type HomeworkChatAnswer struct {
	ConversationID string
	MessageID      string
}

// homeworkChatSystemPrompt is the tutor contract for the homework chat.
const homeworkChatSystemPrompt = `You are the tutor chat of one homework assignment: you help a student
work through its questions, check their reasoning, and keep the
understanding of each problem straight.

The context names the assignment, its outline, and the question currently
being discussed, with its transcription, its understanding notes, and its
current walkthrough. The question's screenshot and figure crops are
attached as images when it has them; read figures from the images, not from
guesswork.

Replies follow the same conventions as the study chat: compact Markdown,
the direct answer first, inline math in $...$ (no $$ anywhere), no
pleasantries, no em-dashes. Structured elements go in envelopes: fenced
blocks tagged equation, steps, theorem, definition, or note, each holding
exactly one JSON object of that kind.

You have tools, and you should lean on them:
- calc evaluates arithmetic exactly (fractions stay fractions, j is the
  imaginary unit, 24∠0 is a phasor in degrees). Verify every number you
  assert with it before asserting it.
- solve_linear solves A·x = b with entries like "4+j6" — use it for mesh
  and nodal systems rather than eliminating by hand.
- search_book finds pages of this textbook by topic; read_page reads one
  page's text. Never describe a page you have not been given or read.
- When the student corrects how a problem should be understood ("the 2A
  source is the other way"), call add_understanding_note with one crisp
  sentence. Then say plainly that the walkthrough is out of date and needs
  a rewrite — never present the old walkthrough as already corrected.
Cite book pages in prose as (p. N) or (pp. N-M).`

// HomeworkChat sends one message on the assignment's persistent chat, with
// the given question as context (empty means none is selected). Events
// stream through emit; the turn persists as a user and an assistant
// message on the conversation, which is created on first use.
func (e *Engine) HomeworkChat(ctx context.Context, homeworkID, questionID, message string, emit func(ChatEvent) error) (*HomeworkChatAnswer, error) {
	emit = chatEmitter(emit)
	message = strings.TrimSpace(message)
	if message == "" {
		return nil, &UserError{Message: "the message is empty"}
	}
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	hw, err := s.HomeworkByID(ctx, homeworkID)
	if err != nil {
		return nil, err
	}
	if hw.Status == store.HomeworkGenerating {
		return nil, &UserError{Message: "this homework is still generating — wait for it to finish"}
	}
	book, err := s.BookByID(ctx, hw.BookID)
	if err != nil {
		return nil, err
	}
	settings, err := e.Config(ctx)
	if err != nil {
		return nil, err
	}
	if !settings.ChatConfigured() {
		return nil, &LLMUnconfiguredError{}
	}
	client := e.llmClient(settings)

	conv, err := s.ConversationForHomework(ctx, hw.ID)
	if err != nil {
		return nil, err
	}
	if conv == nil {
		conv = &store.Conversation{BookID: book.ID, HomeworkID: hw.ID, Title: hw.Title}
		if err := s.CreateConversation(ctx, conv); err != nil {
			return nil, userf(err, "could not open the chat")
		}
	}

	var question *store.HomeworkQuestion
	if questionID != "" {
		question, err = s.QuestionByID(ctx, questionID)
		if err != nil {
			return nil, err
		}
		if question.HomeworkID != hw.ID {
			return nil, store.ErrNotFound
		}
	}

	if err := emit(ChatEvent{Type: ChatMeta, ConversationID: conv.ID, QuestionID: questionID}); err != nil {
		return nil, err
	}

	if err := s.AppendMessage(ctx, conv.ID, &store.Message{
		Role: store.RoleUser, Content: message, QuestionID: questionID,
	}); err != nil {
		return nil, userf(err, "could not store the message")
	}

	questions, err := s.Questions(ctx, hw.ID)
	if err != nil {
		return nil, userf(err, "could not read the outline")
	}
	history, err := e.homeworkChatHistory(ctx, s, conv.ID, questions)
	if err != nil {
		return nil, err
	}

	messages := make([]llm.Message, 0, len(history)+2)
	messages = append(messages, llm.TextMessage("system", homeworkChatSystemPrompt))
	messages = append(messages, history...)
	messages = append(messages, homeworkChatUserMessage(ctx, e, book, hw, question, questions, message))

	executor := &chatToolExecutor{
		eng: e, s: s, book: book, hw: hw, question: question,
		client: client, embedModel: settings.EmbedModel,
	}

	splitter := newEnvelopeSplitter(ctx, client, e.logger, askSplitterEmitter(emit))
	err = runToolLoop(ctx, client, emit, messages, executor.defs(), executor.execute, splitter)
	if err == nil {
		err = splitter.Finish()
	}
	if err != nil {
		if ferr := splitter.Finish(); ferr != nil {
			e.logger.Debug("degrading the interrupted envelope failed", "err", ferr)
		}
		return nil, llmFail(err)
	}

	msg := &store.Message{Role: store.RoleAssistant, Segments: splitter.Segments()}
	if err := s.AppendMessage(ctx, conv.ID, msg); err != nil {
		return nil, userf(err, "could not store the answer")
	}
	return &HomeworkChatAnswer{ConversationID: conv.ID, MessageID: msg.ID}, nil
}

// HomeworkChatHistory loads the assignment's chat for the workspace: the
// conversation (nil before the first message) and its turns.
func (e *Engine) HomeworkChatHistory(ctx context.Context, homeworkID string) (*store.Conversation, []store.Message, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer s.Close()

	hw, err := s.HomeworkByID(ctx, homeworkID)
	if err != nil {
		return nil, nil, err
	}
	conv, err := s.ConversationForHomework(ctx, hw.ID)
	if err != nil || conv == nil {
		return nil, nil, err
	}
	messages, err := s.Messages(ctx, conv.ID)
	if err != nil {
		return nil, nil, userf(err, "could not read the chat")
	}
	return conv, messages, nil
}

// homeworkChatHistory renders the recent turns for the model, naming which
// question each user message was about.
func (e *Engine) homeworkChatHistory(ctx context.Context, s *store.Store, conversationID string, questions []store.HomeworkQuestion) ([]llm.Message, error) {
	messages, err := s.Messages(ctx, conversationID)
	if err != nil {
		return nil, userf(err, "could not read the chat")
	}
	// The just-appended message is the last one; history is everything
	// before it.
	if n := len(messages); n > 0 {
		messages = messages[:n-1]
	}
	if len(messages) > askHistoryMessages {
		messages = messages[len(messages)-askHistoryMessages:]
	}
	positions := make(map[string]int, len(questions))
	for i := range questions {
		positions[questions[i].ID] = questions[i].Position
	}
	out := make([]llm.Message, 0, len(messages))
	for _, m := range messages {
		if m.Role == store.RoleUser {
			text := m.Content
			if pos, ok := positions[m.QuestionID]; ok {
				text = fmt.Sprintf("About Q%d: %s", pos, text)
			}
			out = append(out, llm.TextMessage(store.RoleUser, text))
			continue
		}
		out = append(out, llm.TextMessage(store.RoleAssistant, messageText(m)))
	}
	return out, nil
}

// homeworkChatUserMessage builds the multimodal turn: the message, the
// outline, the active question with its notes and walkthrough, and the
// question's images.
func homeworkChatUserMessage(ctx context.Context, e *Engine, book *store.Book, hw *store.Homework, question *store.HomeworkQuestion, questions []store.HomeworkQuestion, message string) llm.Message {
	var b strings.Builder
	fmt.Fprintf(&b, "Message: %s\n", message)
	fmt.Fprintf(&b, "\nAssignment: %s, from %q, %d questions.\n", hw.Title, book.Title, len(questions))
	b.WriteString("Outline:\n")
	for i := range questions {
		q := &questions[i]
		where := "standalone"
		if q.Page != nil {
			where = fmt.Sprintf("p. %d", *q.Page)
		}
		fmt.Fprintf(&b, "- Q%d (%s): %s\n", q.Position, where, oneLine(q.Transcription))
	}

	if question == nil {
		b.WriteString("\nNo question is selected. Answer generally, or ask the student to pick one before pinning corrections.")
		return llm.TextMessage("user", b.String())
	}

	fmt.Fprintf(&b, "\nThe student is discussing Q%d:\n\n%s\n", question.Position, question.Transcription)
	if question.Standalone {
		b.WriteString("\nIt is standalone: it does not come from the book.\n")
	} else if question.Page != nil {
		fmt.Fprintf(&b, "\nIt lives on page %d; its screenshot and figure crops are attached as images.\n", *question.Page)
	}
	if len(question.UnderstandingNotes) > 0 {
		b.WriteString("\nUnderstanding notes (the student's corrections; authoritative over the walkthrough):\n")
		for _, n := range question.UnderstandingNotes {
			fmt.Fprintf(&b, "- %s\n", n.Note)
		}
	}
	switch {
	case question.Guide != nil:
		g := question.Guide
		fmt.Fprintf(&b, "\nCurrent walkthrough (status: %s):\n", question.Status)
		if r := g.Reading; r != nil {
			b.WriteString("How it read the problem (the box the student checks first):\n")
			for _, given := range r.Given {
				fmt.Fprintf(&b, "- given: %s\n", given)
			}
			fmt.Fprintf(&b, "- find: %s\n", r.Find)
			if r.Figure != "" {
				fmt.Fprintf(&b, "- figure: %s\n", r.Figure)
			}
		}
		fmt.Fprintf(&b, "Setup: %s\n", g.Setup)
		if len(g.Hints) > 0 {
			b.WriteString("Hints:\n")
			for _, h := range g.Hints {
				fmt.Fprintf(&b, "- %s\n", h)
			}
		}
		if len(g.Steps) > 0 {
			b.WriteString("Steps:\n")
			for _, st := range g.Steps {
				fmt.Fprintf(&b, "- %s\n", st)
			}
		}
		for _, eq := range g.Equations {
			fmt.Fprintf(&b, "Equation %s: %s\n", eq.Title, eq.Tex)
		}
		fmt.Fprintf(&b, "Answer: %s\n", g.Answer)
	case question.Error != "":
		fmt.Fprintf(&b, "\nIt has no walkthrough — locating failed: %s\n", question.Error)
	default:
		b.WriteString("\nIt has no walkthrough yet.\n")
	}

	if question.Page == nil {
		return llm.TextMessage("user", b.String())
	}
	content := llm.PartsContent(llm.TextPart(b.String()))
	attach := func(label string, rect store.HomeworkRect) {
		jpeg, err := hwCrop(ctx, book.FilePath, *question.Page, rect)
		if err != nil {
			if ctx.Err() == nil {
				e.logger.Debug("chat crop failed", "page", *question.Page, "err", err)
			}
			return
		}
		content.AppendPart(llm.TextPart(label))
		content.AppendPart(llm.ImagePart("data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(jpeg)))
	}
	if question.QuestionRect != nil {
		attach(fmt.Sprintf("Q%d as printed on page %d:", question.Position, *question.Page), *question.QuestionRect)
	}
	for i, d := range question.Diagrams {
		if i >= hwMaxDiagrams {
			break
		}
		attach(fmt.Sprintf("Figure %s:", d.Label), d.Rect)
	}
	if len(content.Parts()) == 0 {
		return llm.TextMessage("user", b.String())
	}
	return llm.Message{Role: "user", Content: content}
}
