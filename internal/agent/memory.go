package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/llm"
)

// Note is one memory as the loop sees it. Page is a PDF page, 0 for none.
type Note struct {
	ID     string
	Kind   string // "book" or "preference"
	Text   string
	Page   int
	Source string // "you", "tutor" or "pset"
}

// NewNote is what remember asks to save. Page is a PDF page, 0 for none.
type NewNote struct {
	Kind        string
	Text        string
	Page        int
	FromStudent bool
	Replaces    string
}

// What a remember did.
const (
	Saved     = "saved"
	Duplicate = "duplicate"
	Replaced  = "replaced"
)

// Memory is the book's memory, as the loop reads and writes it.
type Memory interface {
	// Notes is what goes in the prompt, in the order it's shown.
	Notes(ctx context.Context, bookID string) ([]Note, error)
	// Remember saves a note and says what it did.
	Remember(ctx context.Context, bookID string, n NewNote) (Note, string, error)
	// Forget removes a note by the short id the model saw.
	Forget(ctx context.Context, bookID, ref string) (Note, error)
}

// shortID is how the model names a memory.
func shortID(id string) string { return id[:min(len(id), 6)] }

func rememberTool(student bool) llm.Tool {
	props := `"kind":{"type":"string","enum":["book","preference"],"description":"book: where something is in the book, or how it's laid out. preference: how the student wants answers."},` +
		`"text":{"type":"string","description":"One plain sentence. The page goes in page, not here."},` +
		`"page":{"type":"integer","description":"The printed page it's on, for a book memory about a place."},` +
		`"replaces":{"type":"string","description":"The id of a memory this corrects, to overwrite it instead of adding another."}`
	if student {
		props += `,"from_student":{"type":"boolean","description":"True when the student asked you to remember this."}`
	}
	return llm.NewTool("remember", "Save one fact about this book for every later answer and walkthrough. Be strict: see the rules on memory.",
		json.RawMessage(`{"type":"object","properties":{`+props+`},"required":["kind","text"]}`))
}

var forgetTool = llm.NewTool("forget", "Remove a memory, only when the student asks you to.",
	json.RawMessage(`{"type":"object","properties":{"id":{"type":"string","description":"The memory's id."}},"required":["id"]}`))

// system is the system prompt for one round: the caller's, then memory's
// rules and everything remembered, read fresh so a save from another
// loop on the same book arrives within a round.
func (l *Loop) system(ctx context.Context) string {
	if l.Memory == nil {
		return l.System
	}
	notes, err := l.Memory.Notes(ctx, l.Book.ID)
	if err != nil {
		return l.System
	}
	var b strings.Builder
	b.WriteString(l.System)
	b.WriteString("\n\n")
	b.WriteString(memoryRules)
	if l.Student {
		b.WriteString(memoryRulesStudent)
	}
	b.WriteString(memoryNever)
	b.WriteString("\n\n")
	if len(notes) == 0 {
		b.WriteString("You don't remember anything about this book yet.")
		return b.String()
	}
	b.WriteString("What you remember about this book, from earlier work in it. Trust it: go straight to a page it names instead of searching again, and follow the student's preferences in everything you write.\n")
	for _, n := range notes {
		who := "Book"
		if n.Kind == "preference" {
			who = "Preference"
		}
		if n.Source == "you" {
			who += ", the student's"
		}
		fmt.Fprintf(&b, "- [%s] %s: %s", shortID(n.ID), who, n.Text)
		if n.Page > 0 && !strings.Contains(n.Text, "p. ") {
			fmt.Fprintf(&b, " (%s)", pageName(n.Page, l.Book.Pages))
		}
		b.WriteByte('\n')
	}
	return strings.TrimRight(b.String(), "\n")
}

const memoryRules = `Memory. remember saves one fact about this book for every later answer and walkthrough.
Clutter costs more than a missed save, so be strict. Save only:
- where a named result (a theorem, definition, equation, table or figure) lives, when the work
  relied on it and you had to look for it;
- a rule about how this book is laid out or writes things that helps find or read it: where
  its problems sit, its notation, its conventions.`

const memoryRulesStudent = `
- something the student asks you to remember, with from_student.
Use forget only when the student asks you to forget something.`

// memoryNever closes the rules, after the student's line or without it.
const memoryNever = `
Never save a problem's solution or answer, general math, anything you haven't checked on the
page, or what memory already says. One fact per memory, in one plain sentence. If a memory is
wrong or incomplete, fix it with replaces rather than adding another.`

// remember runs the remember tool.
func (l *Loop) remember(ctx context.Context, raw string) string {
	var args struct {
		Kind        string `json:"kind"`
		Text        string `json:"text"`
		Page        int    `json:"page"`
		Replaces    string `json:"replaces"`
		FromStudent bool   `json:"from_student"`
	}
	if err := json.Unmarshal([]byte(raw), &args); err != nil {
		return "Error: the arguments weren't valid JSON."
	}
	l.step("Remembering…", true)
	n := NewNote{Kind: args.Kind, Text: args.Text, Replaces: args.Replaces, FromStudent: args.FromStudent && l.Student}
	if n.Kind == "" {
		// Small models drop the kind: a page or the book's own voice makes
		// it about the book, the student asking with no page a preference.
		n.Kind = "book"
		if n.FromStudent && args.Page == 0 {
			n.Kind = "preference"
		}
	}
	if args.Page != 0 {
		pdf, bad := l.Book.pdf(args.Page)
		if bad != "" {
			l.step("Didn't remember · no such page", false)
			return "Error: " + bad
		}
		n.Page = pdf
	}
	note, outcome, err := l.Memory.Remember(ctx, l.Book.ID, n)
	if err != nil {
		l.step("Didn't remember · "+clip(err.Error(), 60), false)
		return "Not saved: " + err.Error()
	}
	label := clip(note.Text, 80)
	if note.Page > 0 && !strings.Contains(note.Text, "p. ") {
		label = strings.TrimRight(label, ".") + " · " + pageName(note.Page, l.Book.Pages)
	}
	switch outcome {
	case Duplicate:
		l.step("Already remembered · "+label, false)
		return fmt.Sprintf("Already remembered, as [%s].", shortID(note.ID))
	case Replaced:
		l.step("Updated a memory · "+label, false)
	default:
		l.step("Remembered · "+label, false)
	}
	if l.Remembered != nil {
		l.Remembered(note, outcome)
	}
	return fmt.Sprintf("Saved, as [%s].", shortID(note.ID))
}

// forget runs the forget tool.
func (l *Loop) forget(ctx context.Context, raw string) string {
	var args struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(raw), &args); err != nil {
		return "Error: the arguments weren't valid JSON."
	}
	l.step("Forgetting…", true)
	note, err := l.Memory.Forget(ctx, l.Book.ID, args.ID)
	if err != nil {
		l.step("Didn't forget · "+clip(err.Error(), 60), false)
		return "Not removed: " + err.Error()
	}
	l.step("Forgot · "+clip(note.Text, 80), false)
	return "Removed."
}
