package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/mathx"
	"github.com/jackt/pset/internal/store"
)

// The chat tools: one executor per turn, bound to the book (and, for a
// homework chat, the active question) its tools read and mutate. Tool-level
// failures are results, not errors — the model sees the complaint and can
// fix its call; only systemic failures (store, connection) abort the turn.

// chatMaxNoteChars and chatMaxNotes bound the understanding notes a chat
// can pin on one question.
const (
	chatMaxNoteChars = 500
	chatMaxNotes     = 40
)

// chatToolExecutor executes one turn's tool calls.
type chatToolExecutor struct {
	eng        *Engine
	s          *store.Store
	book       *store.Book
	hw         *store.Homework         // nil on the ask page
	question   *store.HomeworkQuestion // the active question; may be nil
	client     *llm.Client
	embedModel string
}

// defs returns the OpenAI tool declarations for this turn.
func (x *chatToolExecutor) defs() []llm.Tool {
	calc := llm.NewTool("calc", `Evaluate one arithmetic expression, exactly. Fractions stay fractions (7/3 returns 7/3), j is the imaginary unit (j6, 6j, 6*j all work), r∠45 builds a phasor with the angle in degrees, juxtaposition multiplies. Functions: sqrt cbrt exp ln log log2 abs arg (degrees) conj re im sin cos tan asin acos atan sinh cosh tanh atan2(y,x) (degrees) floor ceil round min max radians degrees. Trigonometry takes radians: sin(30°) or sin(radians(30)). Use it for every number you assert.`,
		json.RawMessage(`{"type":"object","properties":{"expression":{"type":"string","description":"the expression, e.g. (24∠0)/(4+j6)"}},"required":["expression"],"additionalProperties":false}`))

	solve := llm.NewTool("solve_linear", `Solve the linear system a·x = b exactly. Entries are calc expressions, so complex impedances are fine: a row like ["4+j6", "-j2"]. Returns each unknown in rectangular and polar form. Use it for mesh and nodal systems instead of eliminating by hand.`,
		json.RawMessage(`{"type":"object","properties":{"a":{"type":"array","items":{"type":"array","items":{"type":"string"}},"description":"square coefficient matrix, one row per equation"},"b":{"type":"array","items":{"type":"string"},"description":"right-hand side, one entry per equation"}},"required":["a","b"],"additionalProperties":false}`))

	search := llm.NewTool("search_book", `Search this book's pages by topic: full-text and vector search fused. Returns ranked page numbers with a snippet of each. Use it when the attached pages do not cover what was asked.`,
		json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"what to look for, in the book's own vocabulary"},"limit":{"type":"integer","minimum":1,"maximum":10,"description":"how many pages, default 6"}},"required":["query"],"additionalProperties":false}`))

	read := llm.NewTool("read_page", `Read one page of the book: its extracted text. Use it after search_book picks a page, or when a claim depends on a page you have not seen.`,
		json.RawMessage(`{"type":"object","properties":{"page":{"type":"integer","minimum":1,"description":"the page number"}},"required":["page"],"additionalProperties":false}`))

	tools := []llm.Tool{calc, solve, search, read}
	if x.hw != nil {
		tools = append(tools, llm.NewTool("add_understanding_note",
			`Pin one durable correction on the question being discussed — how the problem should be read, in the student's own discovery ("the 2A source arrow points up, not down"). The note lands on the question, the walkthrough is marked out of date, and the next rewrite must respect it. Call this the moment the student corrects how a diagram or statement should be read; do not call it for opinions or side questions.`,
			json.RawMessage(`{"type":"object","properties":{"note":{"type":"string","description":"one crisp sentence stating how the problem should be read"},"question_id":{"type":"string","description":"defaults to the question being discussed"}},"required":["note"],"additionalProperties":false}`)))
	}
	return tools
}

// execute runs one call. The returned string is the tool-role message the
// model sees next round; the payload is what the transcript card stores.
// An error aborts the turn (systemic); a tool-level failure comes back as
// a payload with OK false.
func (x *chatToolExecutor) execute(ctx context.Context, call llm.ToolCall, emit func(ChatEvent) error) (string, store.ToolPayload, error) {
	payload := store.ToolPayload{ID: call.ID, Tool: call.Function.Name, Args: json.RawMessage(call.Function.Arguments)}
	switch call.Function.Name {
	case "calc":
		return x.runCalc(&payload)
	case "solve_linear":
		return x.runSolve(&payload)
	case "search_book":
		return x.runSearch(ctx, &payload)
	case "read_page":
		return x.runRead(ctx, &payload)
	case "add_understanding_note":
		return x.runNote(ctx, &payload, emit)
	default:
		payload.OK = false
		payload.Result = fmt.Sprintf("there is no %q tool", call.Function.Name)
		return payload.Result, payload, nil
	}
}

func (x *chatToolExecutor) runCalc(p *store.ToolPayload) (string, store.ToolPayload, error) {
	var args struct {
		Expression string `json:"expression"`
	}
	if err := json.Unmarshal(p.Args, &args); err != nil || strings.TrimSpace(args.Expression) == "" {
		return toolFailure(p, "the arguments must be {\"expression\": \"...\"}"), *p, nil
	}
	v, err := mathx.Eval(args.Expression)
	if err != nil {
		return toolFailure(p, err.Error()), *p, nil
	}
	p.OK = true
	p.Result = v.String()
	return p.Result, *p, nil
}

func (x *chatToolExecutor) runSolve(p *store.ToolPayload) (string, store.ToolPayload, error) {
	var args struct {
		A [][]string `json:"a"`
		B []string   `json:"b"`
	}
	if err := json.Unmarshal(p.Args, &args); err != nil || len(args.A) == 0 || len(args.B) == 0 {
		return toolFailure(p, "the arguments must be {\"a\": [[...]], \"b\": [...]}"), *p, nil
	}
	xs, err := mathx.SolveLinear(args.A, args.B)
	if err != nil {
		return toolFailure(p, err.Error()), *p, nil
	}
	var b strings.Builder
	for i, v := range xs {
		fmt.Fprintf(&b, "x%d = %s\n", i+1, v)
	}
	p.OK = true
	p.Result = strings.TrimRight(b.String(), "\n")
	return p.Result, *p, nil
}

func (x *chatToolExecutor) runSearch(ctx context.Context, p *store.ToolPayload) (string, store.ToolPayload, error) {
	var args struct {
		Query string `json:"query"`
		Limit int    `json:"limit"`
	}
	if err := json.Unmarshal(p.Args, &args); err != nil || strings.TrimSpace(args.Query) == "" {
		return toolFailure(p, "the arguments must be {\"query\": \"...\"}"), *p, nil
	}
	limit := args.Limit
	if limit <= 0 {
		limit = 6
	}
	pages, err := x.eng.searchPages(ctx, x.s, x.book, x.client, x.embedModel, args.Query, limit)
	if err != nil {
		return "", *p, err
	}
	if len(pages) == 0 {
		p.OK = true
		p.Result = fmt.Sprintf("no page of %q matched %q", x.book.Title, args.Query)
		p.Pages = []int{}
		return p.Result, *p, nil
	}
	p.Pages = pages
	var b strings.Builder
	for _, n := range pages {
		page, err := x.s.Page(ctx, x.book.ID, n)
		if err != nil {
			continue
		}
		fmt.Fprintf(&b, "p. %d — %s\n", n, snippet(page.Text, 240))
	}
	p.OK = true
	p.Result = strings.TrimRight(b.String(), "\n")
	return p.Result, *p, nil
}

func (x *chatToolExecutor) runRead(ctx context.Context, p *store.ToolPayload) (string, store.ToolPayload, error) {
	var args struct {
		Page int `json:"page"`
	}
	if err := json.Unmarshal(p.Args, &args); err != nil || args.Page < 1 {
		return toolFailure(p, "the arguments must be {\"page\": N}"), *p, nil
	}
	if args.Page > x.book.PageCount {
		return toolFailure(p, fmt.Sprintf("%q has %d pages, so there is no page %d", x.book.Title, x.book.PageCount, args.Page)), *p, nil
	}
	page, err := x.s.Page(ctx, x.book.ID, args.Page)
	if err != nil {
		return "", *p, err
	}
	p.OK = true
	p.Pages = []int{args.Page}
	p.Result = fmt.Sprintf("Page %d of %q:\n\n%s", args.Page, x.book.Title, snippet(page.Text, 8000))
	return p.Result, *p, nil
}

func (x *chatToolExecutor) runNote(ctx context.Context, p *store.ToolPayload, emit func(ChatEvent) error) (string, store.ToolPayload, error) {
	var args struct {
		Note       string `json:"note"`
		QuestionID string `json:"question_id"`
	}
	if err := json.Unmarshal(p.Args, &args); err != nil || strings.TrimSpace(args.Note) == "" {
		return toolFailure(p, "the arguments must be {\"note\": \"...\"}"), *p, nil
	}
	q := x.question
	if args.QuestionID != "" {
		loaded, err := x.s.QuestionByID(ctx, args.QuestionID)
		if err != nil {
			return "", *p, err
		}
		if loaded.HomeworkID != x.hw.ID {
			return toolFailure(p, "that question is from a different assignment"), *p, nil
		}
		q = loaded
	}
	if q == nil {
		return toolFailure(p, "no question is selected in this chat; pass question_id"), *p, nil
	}
	if len(q.UnderstandingNotes) >= chatMaxNotes {
		return toolFailure(p, fmt.Sprintf("Q%d already has %d notes; rewrite the walkthrough so it consumes them", q.Position, chatMaxNotes)), *p, nil
	}
	updated, err := x.eng.AddUnderstandingNote(ctx, q.ID, args.Note)
	if err != nil {
		return "", *p, err
	}
	if err := emit(ChatEvent{Type: ChatQuestion, Question: updated}); err != nil {
		return "", *p, err
	}
	p.OK = true
	p.Result = fmt.Sprintf("Noted on Q%d: %s. The walkthrough is now out of date; offer the rewrite.", updated.Position, strings.TrimSpace(args.Note))
	return p.Result, *p, nil
}

// toolFailure records a tool-level failure on the payload and returns its
// message for the model.
func toolFailure(p *store.ToolPayload, msg string) string {
	p.OK = false
	p.Result = msg
	return msg
}

// snippet collapses whitespace and truncates to n characters on a word
// boundary.
func snippet(text string, n int) string {
	text = strings.Join(strings.Fields(text), " ")
	if len(text) <= n {
		return text
	}
	cut := text[:n]
	if i := strings.LastIndexAny(cut, " ,.;"); i > n/2 {
		cut = cut[:i]
	}
	return cut + "…"
}
