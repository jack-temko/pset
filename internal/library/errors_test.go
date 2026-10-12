package library

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/db"
)

// Books that failed before the catalog get the entries their sentence
// named, with their title, so an old failed row still says why.
func TestOldFailedBooksGetTheirEntries(t *testing.T) {
	ctx := context.Background()
	d, err := db.Open(filepath.Join(t.TempDir(), "pset.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup.Close(d)
	migs := Migrations()
	if err := db.Migrate(ctx, d, migs[:5]); err != nil {
		t.Fatal(err)
	}
	for id, reason := range map[string]string{
		"stopped":   "Stopped.",
		"cancelled": "Cancelled before it started.",
		"key":       "There's no OpenRouter key yet. Add yours in Settings, under Connections, then try again.",
		"credit":    "Your OpenRouter account is out of credit. Top it up at openrouter.ai, then try again.",
		"refused":   "OpenRouter turned the request down (HTTP 401): the API key in Settings may be wrong or expired. Check the key in Settings, then try again.",
		"busy":      "OpenRouter didn't answer while PSet read the book's contents. Try again in a minute.",
		"pdf":       "This PDF can't be read. PSet couldn't open it.",
		"pages":     "3 pages couldn't be read (p. 3, p. 4, p. 9). Try again, or check that Tesseract works in Settings.",
		"search":    "Ollama stopped answering while PSet built the book's search. Settings, under Health, says how to check it, then try again.",
		"other":     "Something went wrong preparing this book. The details are in the log.",
	} {
		if _, err := d.ExecContext(ctx, `INSERT INTO books (id, sha256, title, state, reason, created_at, updated_at) VALUES (?, ?, 'Calculus', 'failed', ?, '', '')`, id, id, reason); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Migrate(ctx, d, migs); err != nil {
		t.Fatal(err)
	}
	for id, want := range map[string]string{
		"stopped": "import.stopped", "cancelled": "import.cancelled", "key": "key.missing", "credit": "key.out_of_credit",
		"refused": "key.refused", "busy": "model.busy", "pdf": "import.pdf_unreadable", "pages": "import.pages_unread",
		"search": "embed.failed", "other": "import.failed",
	} {
		b, err := getBook(ctx, d, id)
		e := b.State.Error
		if err != nil || e == nil || e.Chain[len(e.Chain)-1] != want {
			t.Errorf("%s: %+v (%v), want %s", id, e, err, want)
		}
	}
	b, _ := getBook(ctx, d, "pages")
	if got := b.State.Error.Why; got != "PSet's text reader, Tesseract, failed on 3 pages (p. 3, p. 4, p. 9)." {
		t.Errorf("pages: %q", got)
	}
	b, _ = getBook(ctx, d, "stopped")
	if got := b.State.Error.What; got != "Calculus was stopped." {
		t.Errorf("stopped: %q", got)
	}
}
