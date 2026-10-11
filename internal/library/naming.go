package library

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"strings"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/llm"
)

// Naming: the book's title and authors as its first pages print them,
// read by the model and checked against those pages' text. Spec:
// design/contents.md. The metadata (or the filename) stays when the model
// fails or its answer isn't on the pages, and a title or author the
// student edited is never replaced.

const (
	namePages      = 6   // front pages shown at most, fewer when the contents start sooner
	nameImageWidth = 900 // a title page's print is large
	nameMaxAuthors = 3   // more is "Surname et al."
	nameMaxRunes   = 200
)

const namePrompt = `You read a textbook's title and authors from images of its first pages (cover, title page) and return them as JSON.

Answer with {"title":"Elementary Differential Equations and Boundary Value Problems","authors":["Boyce","DiPrima","Meade"]} and nothing else.

- title: the book's title as its title page prints it, in title case even where it's printed in capitals. Where the cover and the title page differ, the title page wins. Leave out any subtitle, the edition, the series, the publisher, and store or format labels such as "eBook" or "International Student Edition".
- authors: the authors' surnames, in the order printed. Leave out series editors, translators and illustrators.
- The name the file came with is given as a hint; it is often wrong.
- Answer "" and [] for what the pages don't show.`

// nameBook names the book from its first pages. Only a stopped import is
// an error: a failed call or an answer that doesn't check out leaves the
// name as it was.
func (s *Service) nameBook(ctx context.Context, m model, b row, path string, pages []string, printed []int) error {
	title, author, err := s.readName(ctx, m, b, path, pages, printed)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		slog.Warn("naming: no name read", "book", b.ID, "err", err)
		return nil
	}
	// Never over the student's own name for the book.
	if title != "" {
		if _, err := s.c.DB.ExecContext(ctx, `UPDATE books SET title = ?, updated_at = ? WHERE id = ? AND edited = 0`, title, db.Now(), b.ID); err != nil {
			return err
		}
	}
	if author != "" {
		if _, err := s.c.DB.ExecContext(ctx, `UPDATE books SET author = ?, updated_at = ? WHERE id = ? AND edited = 0`, author, db.Now(), b.ID); err != nil {
			return err
		}
	}
	if title != "" || author != "" {
		if _, err := s.publish(ctx, b.ID); err != nil && !isNotFound(err) {
			return err
		}
	}
	return nil
}

// readName shows the model the pages before the contents (at most
// namePages) and returns the title and author line that check out, empty
// where nothing did.
func (s *Service) readName(ctx context.Context, m model, b row, path string, pages []string, printed []int) (string, string, error) {
	n := min(namePages, len(pages))
	if len(printed) > 0 && printed[0] > 1 {
		n = min(n, printed[0]-1)
	}
	content := llm.PartsContent(llm.TextPart(fmt.Sprintf("The file came named %q, by %q. Its first %d pages follow as images.", b.Title, b.Author, n)))
	for p := 1; p <= n; p++ {
		data, err := s.scans.get(ctx, b, path, p, nameImageWidth)
		if err != nil {
			return "", "", err
		}
		content.AppendPart(llm.TextPart(fmt.Sprintf("Page %d:", p)))
		content.AppendPart(llm.ImagePart("data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(data)))
	}
	var reply struct {
		Title   string   `json:"title"`
		Authors []string `json:"authors"`
	}
	if err := m.askJSON(ctx, namePrompt, content, &reply); err != nil {
		return "", "", err
	}
	title, author := checkName(reply.Title, reply.Authors, pages[:n])
	slog.Info("naming", "book", b.ID, "read", reply.Title, "authors", reply.Authors, "kept", title, "author", author)
	return title, author, nil
}

// checkName keeps what the model read only where the pages' text shows
// it: the title, and the authors as one line when every surname is
// there. Empty means keep what the book has.
func checkName(title string, surnames []string, pages []string) (string, string) {
	text := foldKey(strings.Join(pages, "\n"))
	on := func(s string) bool {
		key := clip(foldKey(s))
		return key != "" && fuzzyContains(text, key, len(key)/placeSlip)
	}
	title = collapseSpaces(title)
	if !on(title) || runeLen(title) > nameMaxRunes {
		title = ""
	}
	var names []string
	for _, s := range surnames {
		if s = collapseSpaces(s); s == "" {
			continue
		}
		if !on(s) {
			return title, ""
		}
		names = append(names, s)
	}
	return title, authorLine(names)
}

// authorLine is the authors as the shelf shows them: "Axler", "Alexander
// & Sadiku", "Boyce, DiPrima & Meade", "Griffiths et al.".
func authorLine(surnames []string) string {
	switch n := len(surnames); {
	case n == 0:
		return ""
	case n == 1:
		return surnames[0]
	case n > nameMaxAuthors:
		return surnames[0] + " et al."
	default:
		return strings.Join(surnames[:n-1], ", ") + " & " + surnames[n-1]
	}
}
