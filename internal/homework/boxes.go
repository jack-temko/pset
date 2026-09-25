package homework

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/pdf"
)

// Boxing: the student shows where a problem is by drawing boxes on the
// scan, around its words and its figures, over as many pages and columns
// as it runs. A boxed question skips the search: its find step reads the
// boxes instead. Spec: ideas/boxing-on-the-page.md.

// maxBoxes caps the boxes one problem is drawn with.
const maxBoxes = 12

// checkBoxes is a question's boxes, checked: at least one around its
// words, every one inside the book and the page.
func checkBoxes(boxes []Box, pageCount int) error {
	if len(boxes) == 0 {
		return httpx.Invalid("boxes", "Draw a box around the problem first.")
	}
	if len(boxes) > maxBoxes {
		return httpx.Invalid("boxes", "That's more than %d boxes for one problem.", maxBoxes)
	}
	words := false
	for _, b := range boxes {
		if b.Page < 1 || b.Page > pageCount {
			return httpx.Invalid("boxes", "A box is on a page the book doesn't have.")
		}
		if !(pdf.Rect{X: b.X, Y: b.Y, W: b.W, H: b.H}).Valid() {
			return httpx.Invalid("boxes", "A box runs off its page.")
		}
		switch b.Kind {
		case BoxKindText:
			words = true
		case BoxKindFigure:
		default:
			return httpx.Invalid("boxes", "A box is either the problem's words or a figure.")
		}
	}
	if !words {
		return httpx.Invalid("boxes", "Box the problem's words too, not only its figure.")
	}
	return nil
}

// firstText is the first box around the problem's words: its page is the
// question's page.
func firstText(boxes []Box) Box {
	for _, b := range boxes {
		if b.Kind == BoxKindText {
			return b
		}
	}
	return boxes[0]
}

// AddBoxed adds a question to a set from boxes drawn on the scan, and
// queues reading it.
func (s *Service) AddBoxed(ctx context.Context, homeworkID string, boxes []Box) (Question, error) {
	h, err := getSummary(ctx, s.c.DB, homeworkID)
	if errors.Is(err, errNotFound) {
		return Question{}, httpx.NotFound("homework set")
	} else if err != nil {
		return Question{}, err
	}
	book, err := s.c.Library.Book(ctx, h.BookID)
	if err != nil {
		return Question{}, err
	}
	if err := checkBoxes(boxes, book.PageCount); err != nil {
		return Question{}, err
	}
	// Until its boxes are read, it's named for where it is.
	label := "Boxed on " + book.Pages.Name(firstText(boxes).Page)
	id := uuid.NewString()
	var out Question
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		var last int
		if err := tx.QueryRowContext(ctx, `SELECT coalesce(max(position), 0) FROM questions WHERE homework_id = ?`, homeworkID).Scan(&last); err != nil {
			return err
		}
		now := db.Now()
		if _, err := tx.ExecContext(ctx, `INSERT INTO questions (id, homework_id, position, text, in_book, label, boxes, state, created_at, updated_at)
			VALUES (?, ?, ?, '', 1, ?, ?, 'pending', ?, ?)`,
			id, homeworkID, last+1, label, mustJSON(boxes), now, now); err != nil {
			return err
		}
		if _, err := s.c.Queue.Enqueue(ctx, tx, nextStep(id, true)); err != nil {
			return err
		}
		q, err := getQuestion(ctx, tx, id)
		out = q.Question
		return err
	})
	if err != nil {
		return Question{}, err
	}
	s.c.Events.Publish(EventQuestionChanged, QuestionChanged{Question: out})
	s.c.Queue.Wake()
	s.publishSet(ctx, homeworkID)
	return out, nil
}

// PointOut is where a question is, shown by the student: a find that
// failed, or one that landed on the wrong problem. Whatever it had is
// set aside, and it's read from the boxes, then written again.
func (s *Service) PointOut(ctx context.Context, id string, boxes []Box) (Question, error) {
	q, err := getQuestion(ctx, s.c.DB, id)
	if errors.Is(err, errNotFound) {
		return Question{}, httpx.NotFound("question")
	}
	if err != nil {
		return Question{}, err
	}
	book, err := s.c.Library.Book(ctx, q.BookID)
	if err != nil {
		return Question{}, err
	}
	if err := checkBoxes(boxes, book.PageCount); err != nil {
		return Question{}, err
	}
	s.c.Queue.StopSubject(ctx, id)
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET boxes = ?, in_book = 1, page = NULL, pinned_page = NULL, rect = 'null', figures = '[]',
			hint = '[]', walkthrough = '[]', rounds = '[]', reading = '[]', reading_edited = 0, memory = '[]',
			state = 'pending', failure = '', reason = '', activity = '', updated_at = ? WHERE id = ?`,
			mustJSON(boxes), db.Now(), id); err != nil {
			return err
		}
		_, err := s.c.Queue.Enqueue(ctx, tx, nextStep(id, true))
		return err
	})
	if err != nil {
		return Question{}, err
	}
	s.c.Queue.Wake()
	return s.publishQuestion(ctx, id)
}

// fromBoxes is a boxed question's location: its words read off the text
// boxes, its figures the figure boxes, its page the first text box's.
func (s *Service) fromBoxes(ctx context.Context, m model, book Book, q row) (location, error) {
	s.setActivity(ctx, q.ID, "Reading what you boxed…")
	first := firstText(q.Boxes)
	content := llm.PartsContent(llm.TextPart("The problem's words, in order:"))
	for _, b := range q.Boxes {
		if b.Kind != BoxKindText {
			continue
		}
		img, err := s.crop(ctx, book.ID, b.Page, pdf.Rect{X: b.X, Y: b.Y, W: b.W, H: b.H}, modelCropWidth)
		if err != nil {
			return location{}, err
		}
		content.AppendPart(llm.TextPart(book.Pages.Name(b.Page) + ":"))
		content.AppendPart(llm.ImagePart("data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(img)))
	}
	reply, err := m.client.ChatOnce(ctx, llm.ChatRequest{Model: m.name, Messages: []llm.Message{
		llm.TextMessage("system", boxedPrompt),
		{Role: "user", Content: content},
	}})
	if err != nil {
		if ctx.Err() != nil {
			return location{}, ctx.Err()
		}
		return location{}, modelDown(err, q)
	}
	var read struct {
		Label     string `json:"label"`
		Statement string `json:"statement"`
	}
	if err := json.Unmarshal([]byte(llm.Unfence(reply)), &read); err != nil || strings.TrimSpace(read.Statement) == "" {
		return location{}, fail(FailureGeneration, err, "Couldn't read the words in the boxes. Box the problem's text again, a little larger.")
	}
	rect := pdf.Rect{X: first.X, Y: first.Y, W: first.W, H: first.H}
	loc := location{Page: first.Page, Statement: strings.TrimSpace(read.Statement), Rect: &rect,
		Label: boxedLabel(book, q, first.Page, strings.TrimSpace(read.Label))}
	n := 0
	for _, b := range q.Boxes {
		if b.Kind != BoxKindFigure {
			continue
		}
		n++
		loc.Figures = append(loc.Figures, figure{Label: fmt.Sprintf("Figure %d", n), Rect: pdf.Rect{X: b.X, Y: b.Y, W: b.W, H: b.H}, Page: b.Page})
	}
	return loc, nil
}

// boxedLabel names a boxed problem the book's way: the reference the
// student typed, when they did; else the number the model read, with the
// section it's in where the book numbers problems within sections.
func boxedLabel(book Book, q row, page int, read string) string {
	if ref, ok := questionRef(book, q); ok {
		return ref.Label(book.Problems)
	}
	read = strings.TrimSuffix(read, ".")
	if read == "" {
		return q.Label
	}
	if part, ok := book.partOf(page); ok && book.Problems.Form == "local" && strings.Count(part.Number, ".") == 1 && !strings.Contains(read, ".") {
		return part.Number + " #" + read
	}
	return read
}
