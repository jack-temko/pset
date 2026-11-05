package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/llm"
)

// Note is one preference as the loop sees it.
type Note struct {
	ID     string
	Text   string
	Source string // "you" or "tutor"
}

// NewNote is what remember asks to save: a preference the student stated.
type NewNote struct {
	Text     string
	Replaces string
}

// What a remember did.
const (
	Saved     = "saved"
	Duplicate = "duplicate"
	Replaced  = "replaced"
)

// Memory is the book's preferences, as the loop reads and writes them.
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

var rememberTool = llm.NewTool("remember", "Save one preference the student stated or asked you to remember, for every later answer and walkthrough. See the rules on memory.",
	json.RawMessage(`{"type":"object","properties":{"text":{"type":"string","description":"One plain sentence: how the student wants answers."},"replaces":{"type":"string","description":"The id of a preference this corrects, to overwrite it instead of adding another."}},"required":["text"]}`))

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
	if l.Student {
		b.WriteString(memoryRules)
		b.WriteString("\n\n")
	}
	if len(notes) == 0 {
		b.WriteString("You don't know the student's preferences for this book yet.")
		return b.String()
	}
	b.WriteString("The student's preferences for this book, from earlier work in it. Follow them in everything you write.\n")
	for _, n := range notes {
		fmt.Fprintf(&b, "- [%s] %s\n", shortID(n.ID), n.Text)
	}
	return strings.TrimRight(b.String(), "\n")
}

// memoryRules is what Ask is told about saving: only what the student
// says, never what it found out for itself.
const memoryRules = `Memory. remember saves one preference for every later answer and walkthrough: how the student
wants answers, such as units, notation or how much working to show.
Save only what the student states or asks you to remember about how they want answers, one
plain sentence at a time. Never save anything about the book, a problem's solution or answer,
general math, or what memory already says. If a preference is wrong or has changed, fix it
with replaces rather than adding another. Use forget only when the student asks you to forget
something.`

// remember runs the remember tool.
func (l *Loop) remember(ctx context.Context, raw string) string {
	var args struct {
		Text     string `json:"text"`
		Replaces string `json:"replaces"`
	}
	if err := json.Unmarshal([]byte(raw), &args); err != nil {
		return "Error: the arguments weren't valid JSON."
	}
	l.step("Remembering…", true)
	n := NewNote{Text: args.Text, Replaces: args.Replaces}
	note, outcome, err := l.Memory.Remember(ctx, l.Book.ID, n)
	if err != nil {
		l.step("Didn't remember · "+clip(err.Error(), 60), false)
		return "Not saved: " + err.Error()
	}
	label := clip(note.Text, 80)
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
