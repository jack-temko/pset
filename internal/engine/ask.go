package engine

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/store"
)

// askImageDPI is the rasterization resolution of pages attached to a request.
const askImageDPI = 150

// askHistoryMessages is how many prior conversation turns a request carries.
const askHistoryMessages = 6

// titleMaxChars caps a conversation title.
const titleMaxChars = 60

// systemPrompt carries the honesty contract and the response format for
// every ask; the engine validates the JSON envelopes it asks for.
var systemPrompt = systemPromptHead +
	fenceExample("equation", `{"title":"Bayes' theorem", "equations":["P(A\mid B) = \frac{P(B\mid A)\,P(A)}{P(B)}"], "note":"posterior is proportional to likelihood times prior"}`) +
	fenceExample("steps", `{"title":"Solving 2x + 3 = 11", "steps":["Subtract 3 from both sides: $2x = 8$.","Divide both sides by 2: $x = 4$. (p. 12)"]}`) +
	fenceExample("theorem", `{"title":"Pythagorean theorem", "statement":"In a right triangle with legs $a$ and $b$ and hypotenuse $c$, $a^2 + b^2 = c^2$. (p. 40)"}`) +
	fenceExample("definition", `{"title":"Derivative", "statement":"The derivative of $f$ at $x$ is the limit of the difference quotient $\frac{f(x+h)-f(x)}{h}$ as $h$ approaches 0. (p. 95)"}`) +
	fenceExample("note", `{"title":"Common mistake", "body":["Do not cancel the $\sin$ out of $\frac{\sin x}{x}$."]}`) +
	systemPromptTail

const systemPromptHead = `You answer questions about one textbook, using only the pages provided.

The pages come to you twice: as extracted text and as page images. The
extracted text is often garbled for equations and figures. For anything
mathematical or visual, read the attached page image and transcribe
formulas exactly.

Format every reply as compact Markdown:
- Lead with the direct answer in one or two sentences.
- After that, at most a few short sections; use ### headings only when the
  answer truly has parts.
- Write inline math in LaTeX as $...$. There are no $$ delimiters anywhere
  in your reply: math longer than inline goes in an equation envelope, and
  an envelope's "equations" entries are bare LaTeX with no wrapping.
- Keep the whole answer under about 150 words unless the question
  explicitly asks for depth or steps. Never restate the question and never
  open with pleasantries.
- Cite each claim inline immediately after the sentence it supports, as
  (p. N) for a single page or (pp. N-M) for a run of pages, plain
  parentheses with no brackets. Citations live only in text fields (your
  prose, or a text field such as title, statement, steps, body, or note),
  never inside an "equations" entry.
- If the provided pages do not contain the answer, say so plainly and cite
  the closest page you used.
- Use plain punctuation: no em-dashes in your prose.

Envelopes render as structured elements. An envelope is a fenced code block
whose language tag names the kind and whose contents are exactly one JSON
object of that kind's shape — nothing else inside the fence. The five
kinds, one worked example each:

`

// fenceExample renders one worked envelope example in the model-facing form.
func fenceExample(kind, body string) string {
	return "```" + kind + "\n" + body + "\n```\n\n"
}

const systemPromptTail = `- equation: {"title", "equations", "note"?} — one or more display
  equations as bare LaTeX strings. Use it for any math longer than inline.
- steps: {"title", "steps", "note"?} — a worked solution, one short
  sentence per step.
- theorem or definition: {"title", "statement", "note"?} — when the book
  states one; the statement cites its page.
- note: {"title", "body"} — a short caution or aside, one sentence per
  body line.

One element per envelope: the fence contains only the JSON object, with no
commentary, no nested fences, and never triple backticks inside. Do not
invent other tags; anything but the five kinds above renders as an ordinary
code block. Keep envelopes for what deserves the treatment; ordinary
sentences stay as plain Markdown.

You may call tools, and the reader sees each call as a card:
- calc evaluates one arithmetic expression exactly (fractions stay
  fractions, j is the imaginary unit, 24∠0 is a phasor in degrees).
  Verify every number you assert with it before asserting it.
- solve_linear solves A·x = b whose entries are calc expressions like
  "4+j6" — prefer it to eliminating systems by hand.
- search_book finds more pages of this book by topic when the attached
  ones do not cover the question; read_page reads one page's text.
Never describe a page you have neither been given nor read.`

// AllConversations lists every thread across all books with the identity
// of the book each one belongs to.
func (e *Engine) AllConversations(ctx context.Context) ([]store.ConversationRef, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()
	return s.AllConversations(ctx)
}

// ConversationByRef resolves a conversation by id alone and returns it with
// its book identity and messages — the read side for book-less links.
func (e *Engine) ConversationByRef(ctx context.Context, conversationID string) (*store.ConversationRef, []store.Message, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer s.Close()

	ref, err := s.ConversationRefByID(ctx, conversationID)
	if err != nil {
		return nil, nil, err
	}
	messages, err := s.Messages(ctx, conversationID)
	if err != nil {
		return nil, nil, err
	}
	return ref, messages, nil
}

// UpdateConversation renames a thread and/or flips its pin by id alone — the
// write side for book-less links. The fresh row comes back with its book
// identity.
func (e *Engine) UpdateConversation(ctx context.Context, conversationID string, title *string, pinned *bool) (*store.ConversationRef, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	if _, err := s.UpdateConversation(ctx, conversationID, title, pinned); err != nil {
		return nil, err
	}
	return s.ConversationRefByID(ctx, conversationID)
}

// AskUpdate is handed to the onStart callback the moment streaming is about
// to begin: everything an adapter needs before the first delta.
type AskUpdate struct {
	ConversationID string
	Pages          []int
	Warnings       []string
}

// Answer reports the completed ask: which conversation gained the exchange,
// the assistant message id, and the pages sent as context.
type Answer struct {
	ConversationID string
	MessageID      string
	Pages          []int
}

// Ask answers a question about a book and streams the reply through emit as
// typed events: prose deltas and the envelope lifecycle (start, optional
// repairing round, validated envelope or the envelope-failed degrade), plus
// the tool cards of any tools the model reached for. The
// conversation is created (titled with the question) or continued; the user
// message is stored before streaming. onStart fires once the context pages
// are retrieved and the model request is about to stream — the SSE meta
// moment. Retrieval is FTS + vector search fused by reciprocal rank; both
// halves are required, so a broken or unconfigured embeddings endpoint
// fails the ask instead of degrading it. A positive page anchors the ask:
// that page leads the context and is named to the model as the primary one.
func (e *Engine) Ask(ctx context.Context, target string, conversationID string, question string, page int, onStart func(AskUpdate) error, emit func(ChatEvent) error) (*Answer, error) {
	emit = chatEmitter(emit)
	question = strings.TrimSpace(question)
	if question == "" {
		return nil, &UserError{Message: "the question is empty"}
	}

	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	book, err := e.resolveBook(ctx, s, target)
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
	if !settings.EmbedConfigured() {
		return nil, &EmbedUnconfiguredError{}
	}
	client := e.llmClient(settings)

	// Retrieval fuses text search with vector search, so a book without a
	// complete search index would silently answer from half the evidence.
	// Readiness is checked here rather than assumed from a flag.
	ready, err := s.Readiness(ctx, book.ID, settings.EmbedModel)
	if err != nil {
		return nil, err
	}
	if !ready.Ready() {
		return nil, &UserError{Message: fmt.Sprintf(
			"%q isn't ready yet. Finish preparing it before asking about it", book.Title)}
	}

	conv, err := e.askConversation(ctx, s, book, conversationID, question)
	if err != nil {
		return nil, err
	}

	if err := s.AppendMessage(ctx, conv.ID, &store.Message{Role: store.RoleUser, Content: question}); err != nil {
		return nil, userf(err, "could not store the question")
	}

	pages, err := e.retrievePages(ctx, s, book, client, settings.EmbedModel, question)
	if err != nil {
		return nil, err
	}
	if page > 0 {
		pages = anchorPage(pages, page, topKPages)
	}

	sections, err := s.Sections(ctx, book.ID)
	if err != nil {
		return nil, userf(err, "could not read the sections of %q", book.Title)
	}
	history, err := e.askHistory(ctx, s, conv.ID)
	if err != nil {
		return nil, err
	}

	ctxPages, warnings, err := e.askContextPages(ctx, s, book, pages, nil)
	if err != nil {
		return nil, err
	}
	images, warnings := e.attachImages(ctx, book, pages, warnings)

	messages := buildAskMessages(question, page, history, sections, ctxPages, images)

	if onStart != nil {
		if err := onStart(AskUpdate{ConversationID: conv.ID, Pages: pages, Warnings: warnings}); err != nil {
			return nil, err
		}
	}

	executor := &chatToolExecutor{eng: e, s: s, book: book, client: client, embedModel: settings.EmbedModel}
	splitter := newEnvelopeSplitter(ctx, client, e.logger, askSplitterEmitter(emit))
	if err := runToolLoop(ctx, client, emit, messages, executor.defs(), executor.execute, splitter); err != nil {
		if ferr := splitter.Finish(); ferr != nil {
			e.logger.Debug("degrading the interrupted envelope failed", "err", ferr)
		}
		return nil, llmFail(err)
	}
	if err := splitter.Finish(); err != nil {
		return nil, err
	}

	segments := splitter.Segments()
	msg := &store.Message{Role: store.RoleAssistant, Segments: segments}
	if err := s.AppendMessage(ctx, conv.ID, msg); err != nil {
		return nil, userf(err, "could not store the answer")
	}

	e.logger.Debug("ask complete", "book", book.Title, "pages", pages, "segments", len(segments))
	return &Answer{
		ConversationID: conv.ID,
		MessageID:      msg.ID,
		Pages:          pages,
	}, nil
}

// askConversation loads the referenced thread (it must exist and belong to
// the book) or opens a new one titled with the question.
func (e *Engine) askConversation(ctx context.Context, s *store.Store, book *store.Book, conversationID, question string) (*store.Conversation, error) {
	if conversationID == "" {
		conv := &store.Conversation{BookID: book.ID, Title: truncateTitle(question, titleMaxChars)}
		if err := s.CreateConversation(ctx, conv); err != nil {
			return nil, userf(err, "could not open the conversation")
		}
		return conv, nil
	}
	conv, err := s.ConversationByID(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	if conv.BookID != book.ID {
		return nil, &UserError{Message: "that conversation belongs to a different book"}
	}
	return conv, nil
}

// askHistory loads the prior turns (everything except the just-appended
// question), limited to the most recent ones.
func (e *Engine) askHistory(ctx context.Context, s *store.Store, conversationID string) ([]store.Message, error) {
	messages, err := s.Messages(ctx, conversationID)
	if err != nil {
		return nil, userf(err, "could not read the conversation")
	}
	if n := len(messages); n > 0 {
		messages = messages[:n-1]
	}
	if len(messages) > askHistoryMessages {
		messages = messages[len(messages)-askHistoryMessages:]
	}
	return messages, nil
}

// retrievePages picks the context pages: text search fused with vector
// search. Both halves are required — a failing embeddings endpoint fails
// the ask rather than degrading it.
func (e *Engine) retrievePages(ctx context.Context, s *store.Store, book *store.Book, client *llm.Client, embedModel, question string) ([]int, error) {
	return e.searchPages(ctx, s, book, client, embedModel, question, topKPages)
}

// anchorPage pins a question's page to the front of the context: the ask
// came from the reader looking at that page, so it leads even where fusion
// would rank it low, and it enters the context even if retrieval missed it.
// Pure.
func anchorPage(pages []int, page, limit int) []int {
	out := make([]int, 0, len(pages)+1)
	out = append(out, page)
	for _, n := range pages {
		if n != page {
			out = append(out, n)
		}
	}
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

// askContextPages loads the stored text of the retrieved pages, keeping the
// retrieval order.
func (e *Engine) askContextPages(ctx context.Context, s *store.Store, book *store.Book, pages []int, warnings []string) ([]store.Page, []string, error) {
	out := make([]store.Page, 0, len(pages))
	for _, n := range pages {
		p, err := s.Page(ctx, book.ID, n)
		if errors.Is(err, store.ErrNotFound) {
			continue
		}
		if err != nil {
			return nil, nil, userf(err, "could not read page %d of %q", n, book.Title)
		}
		out = append(out, p)
	}
	return out, warnings, nil
}

// attachImages rasterizes the context pages and returns data URLs keyed by
// page number. A page that fails to render is skipped with a warning — the
// answer continues from the text alone.
func (e *Engine) attachImages(ctx context.Context, book *store.Book, pages []int, warnings []string) (map[int]string, []string) {
	images := make(map[int]string, len(pages))
	for _, n := range pages {
		png, err := pdf.PageImage(ctx, book.FilePath, n, askImageDPI)
		if err != nil {
			if ctx.Err() != nil {
				return nil, warnings
			}
			msg := fmt.Sprintf("page %d could not be rendered as an image", n)
			e.notify(EventWarning, "%s", msg)
			e.logger.Debug("page image failed", "page", n, "err", err)
			warnings = append(warnings, msg)
			continue
		}
		images[n] = "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(png)
	}
	return images, warnings
}

// buildAskMessages assembles the model request: the honesty contract, the
// recent conversation turns, then one multimodal user message carrying the
// question (plus its anchored page, when one was given), the table of
// contents, and every retrieved page as a labelled text block plus an image
// block (when the page rendered). Pure: adapters and tests can inspect the
// exact request shape.
func buildAskMessages(question string, page int, history []store.Message, sections []store.Section, pages []store.Page, images map[int]string) []llm.Message {
	out := make([]llm.Message, 0, len(history)+2)
	out = append(out, llm.TextMessage("system", systemPrompt))
	for _, m := range history {
		out = append(out, llm.TextMessage(m.Role, messageText(m)))
	}

	var b strings.Builder
	b.WriteString("Question: ")
	b.WriteString(question)
	if page > 0 {
		fmt.Fprintf(&b, "\n\nThe question is about page %d; treat that page as the primary context.", page)
	}
	if toc := tocLines(sections); toc != "" {
		b.WriteString("\n\n")
		b.WriteString(toc)
	}
	for _, p := range pages {
		fmt.Fprintf(&b, "\n\nPage %d:\n%s", p.Number, p.Text)
	}

	content := llm.PartsContent(llm.TextPart(b.String()))
	for _, p := range pages {
		if url := images[p.Number]; url != "" {
			content.AppendPart(llm.ImagePart(url))
		}
	}
	out = append(out, llm.Message{Role: "user", Content: content})
	return out
}

// tocLines renders the book's sections as "Title — pages a–b" lines.
func tocLines(sections []store.Section) string {
	if len(sections) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("Table of contents:\n")
	for _, sec := range sections {
		fmt.Fprintf(&b, "- %s — pages %d–%d\n", sec.Title, sec.StartPage, sec.EndPage)
	}
	return strings.TrimRight(b.String(), "\n")
}

// truncateTitle shortens a conversation title, breaking on a rune boundary.
func truncateTitle(s string, n int) string {
	s = strings.Join(strings.Fields(s), " ")
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return strings.TrimRight(string(runes[:n]), " ") + "…"
}

// llmFail turns a model call failure into a user-facing error; the typed
// LLMError stays reachable through the chain for verbose output.
func llmFail(err error) error {
	// A refusal the engine itself raised mid-stream (the tool budget, say)
	// already says the right thing; calling it a model failure would send
	// the student to the Settings page over our own bound.
	var userErr *UserError
	if errors.As(err, &userErr) {
		return err
	}
	var llmErr *llm.LLMError
	if errors.As(err, &llmErr) {
		return userf(err, "the model request failed. Check the connection under Settings")
	}
	return userf(err, "the model request failed")
}

// llmFailMessage renders a model failure as its clean user-facing sentence.
func llmFailMessage(err error) string {
	return llmFail(err).Error()
}

// Conversations lists a book's threads, most recently active first, with
// message counts.
func (e *Engine) Conversations(ctx context.Context, target string) ([]store.Conversation, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	book, err := e.resolveBook(ctx, s, target)
	if err != nil {
		return nil, err
	}
	convos, err := s.Conversations(ctx, book.ID)
	if err != nil {
		return nil, userf(err, "could not list the conversations of %q", book.Title)
	}
	return convos, nil
}

// Conversation returns one thread of a book with its messages. A thread of
// another book is not found.
func (e *Engine) Conversation(ctx context.Context, target, conversationID string) (*store.Conversation, []store.Message, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer s.Close()

	book, err := e.resolveBook(ctx, s, target)
	if err != nil {
		return nil, nil, err
	}
	conv, err := s.ConversationByID(ctx, conversationID)
	if err != nil {
		return nil, nil, err
	}
	if conv.BookID != book.ID {
		return nil, nil, store.ErrNotFound
	}
	messages, err := s.Messages(ctx, conv.ID)
	if err != nil {
		return nil, nil, userf(err, "could not read the messages")
	}
	return conv, messages, nil
}

// DeleteConversation removes a thread of a book; its messages go with it.
func (e *Engine) DeleteConversation(ctx context.Context, target, conversationID string) error {
	s, err := e.openStore(ctx)
	if err != nil {
		return err
	}
	defer s.Close()

	book, err := e.resolveBook(ctx, s, target)
	if err != nil {
		return err
	}
	conv, err := s.ConversationByID(ctx, conversationID)
	if err != nil {
		return err
	}
	if conv.BookID != book.ID {
		return store.ErrNotFound
	}
	if err := s.DeleteConversation(ctx, conversationID); err != nil {
		return userf(err, "could not delete the conversation")
	}
	return nil
}

// PageImage renders stored page n of a book as PNG bytes. Like PageText, a
// page with no stored row is ErrNoPage.
func (e *Engine) PageImage(ctx context.Context, target string, n int) ([]byte, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	book, err := e.resolveBook(ctx, s, target)
	if err != nil {
		return nil, err
	}
	if _, err := s.Page(ctx, book.ID, n); errors.Is(err, store.ErrNotFound) {
		return nil, ErrNoPage
	} else if err != nil {
		return nil, userf(err, "could not read page %d of %q", n, book.Title)
	}
	png, err := pdf.PageImage(ctx, book.FilePath, n, askImageDPI)
	if err != nil {
		return nil, userf(err, "could not render page %d of %q", n, book.Title)
	}
	return png, nil
}
