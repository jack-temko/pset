package engine

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/jackt/pset/internal/store"
)

// maxConfirmedExamples is how many worked locations the preamble carries.
const maxConfirmedExamples = 8

// factsPreamble renders what a book has taught pset, for the locate prompt.
// It is distilled durable knowledge rather than a running conversation: it
// survives restarts, can be inspected, and does not decay as it grows.
func (e *Engine) factsPreamble(ctx context.Context, s *store.Store, book *store.Book) string {
	facts, err := s.BookFacts(ctx, book.ID)
	if err != nil || len(facts) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("What is already known about this book:\n")
	for _, f := range facts {
		switch f.Key {
		case store.FactPageOffset:
			b.WriteString(fmt.Sprintf(
				"- Printed page numbers are offset by %s from PDF page numbers: PDF page = printed page + %s. (confirmed %d times)\n",
				f.Value, f.Value, f.Hits))
		case store.FactConventions:
			b.WriteString("- " + f.Value + "\n")
		case store.FactConfirmed:
			b.WriteString("- Locations confirmed earlier: " + f.Value + "\n")
		}
	}
	return b.String()
}

// learnFromLocation records what a corrected or verified location taught.
// The page offset is arithmetic, not a model call: if the question names a
// printed page or a numbered item whose printed page is known, the
// difference between that and the PDF page is the offset for the whole book.
func (e *Engine) learnFromLocation(ctx context.Context, s *store.Store, book *store.Book, q *store.HomeworkQuestion) {
	if q.Page == nil {
		return
	}
	if printed, ok := printedPageOf(q.Transcription); ok {
		offset := *q.Page - printed
		if err := s.LearnFact(ctx, store.BookFact{
			BookID: book.ID,
			Key:    store.FactPageOffset,
			Value:  strconv.Itoa(offset),
			Source: store.FactMeasured,
		}); err != nil {
			e.logger.Error("learn page offset", "book", book.ID, "err", err)
		}
	}
	if label, ok := itemLabelOf(q.Transcription); ok {
		e.rememberConfirmed(ctx, s, book, label, *q.Page)
	}
}

// rememberConfirmed appends one worked example to the book's confirmed list,
// keeping the newest handful.
func (e *Engine) rememberConfirmed(ctx context.Context, s *store.Store, book *store.Book, label string, page int) {
	entry := fmt.Sprintf("%s→p%d", label, page)
	existing, err := s.BookFact(ctx, book.ID, store.FactConfirmed)
	list := []string{}
	if err == nil && existing.Value != "" {
		list = strings.Split(existing.Value, ", ")
	}
	for _, e := range list {
		if e == entry {
			return
		}
	}
	list = append(list, entry)
	if len(list) > maxConfirmedExamples {
		list = list[len(list)-maxConfirmedExamples:]
	}
	sort.Strings(list)
	if err := s.LearnFact(ctx, store.BookFact{
		BookID: book.ID,
		Key:    store.FactConfirmed,
		Value:  strings.Join(list, ", "),
		Source: store.FactMeasured,
	}); err != nil {
		e.logger.Error("remember confirmed location", "book", book.ID, "err", err)
	}
}

// pageOffset reports the learned printed-to-PDF page offset, if the book has
// one. Given it, a question naming a printed page needs no retrieval at all.
func (e *Engine) pageOffset(ctx context.Context, s *store.Store, bookID string) (int, bool) {
	f, err := s.BookFact(ctx, bookID, store.FactPageOffset)
	if err != nil {
		return 0, false
	}
	n, err := strconv.Atoi(f.Value)
	if err != nil {
		return 0, false
	}
	return n, true
}

var (
	printedPagePattern = regexp.MustCompile(`(?i)\bp(?:age|g)?\.?\s*(\d{1,4})\b`)
	itemLabelPattern   = regexp.MustCompile(`\b(\d{1,2}\.\d{1,3})\b`)
)

// printedPageOf finds a printed page number a question names, if any.
func printedPageOf(text string) (int, bool) {
	m := printedPagePattern.FindStringSubmatch(text)
	if m == nil {
		return 0, false
	}
	n, err := strconv.Atoi(m[1])
	if err != nil || n <= 0 {
		return 0, false
	}
	return n, true
}

// itemLabelOf finds the section-and-item label a question carries ("3.4"),
// which is what makes one confirmed location useful for the next question.
func itemLabelOf(text string) (string, bool) {
	m := itemLabelPattern.FindStringSubmatch(text)
	if m == nil {
		return "", false
	}
	return m[1], true
}
