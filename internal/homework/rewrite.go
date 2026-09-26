package homework

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"unicode"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/llm"
)

// A reference the parser can't read ("the 7th one in section three",
// "3.1 seven and nine") is rewritten by the model in the book's own form
// before it's looked for, and the parser reads the rewrite: the model
// proposes, the parser decides, so nothing it makes up becomes a
// question. A rewrite naming several problems becomes several
// questions, in its place. Spec: design/workspace.md, "A row is read in
// the book's numbering".

// rewriteLimit is the longest text worth asking about: longer, it's a
// problem written out, which is looked for by its words.
const rewriteLimit = 200

// wantsRewrite says whether a question's text is worth the model's
// reading: from the book, not boxed, unread by the parser, short, and
// naming a number (in digits or words).
func wantsRewrite(q row, book Book) bool {
	if !q.InBook || len(q.Boxes) > 0 || len(q.Text) > rewriteLimit {
		return false
	}
	if _, ok := ParseRefs(q.Text, book.Problems); ok {
		return false
	}
	if strings.IndexFunc(q.Text, unicode.IsDigit) >= 0 {
		return true
	}
	for _, w := range strings.FieldsFunc(strings.ToLower(q.Text), func(r rune) bool { return !unicode.IsLetter(r) }) {
		if numberWords[w] != "" || strings.HasSuffix(w, "th") && numberWords[strings.TrimSuffix(w, "th")] != "" {
			return true
		}
	}
	return false
}

// rewriteReference asks the model to rewrite a question's reference and,
// when the parser reads the rewrite, makes the question the first
// problem it names and adds the rest after it. It returns the question
// as it now is, or nil when it's unchanged (not rewritable: it's looked
// for by its words, as before).
func (s *Service) rewriteReference(ctx context.Context, m model, book Book, q row) (*row, error) {
	if !wantsRewrite(q, book) {
		return nil, nil
	}
	reply, err := m.client.ChatOnce(ctx, llm.ChatRequest{Model: m.name, Messages: []llm.Message{
		llm.TextMessage("system", fmt.Sprintf(referencePrompt, book.Title, styleSentence(book.Problems), styleExample(book.Problems))),
		llm.TextMessage("user", q.Text),
	}})
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		// Only a help: without it the question is looked for by its words.
		slog.Warn("reference: rewrite failed", "question", q.ID, "err", err)
		return nil, nil
	}
	var out struct {
		Lines []string `json:"lines"`
	}
	if err := json.Unmarshal([]byte(llm.Unfence(reply)), &out); err != nil {
		return nil, nil
	}
	var rows []splitRow
	for _, l := range out.Lines {
		if _, ok := ParseRefs(l, book.Problems); !ok {
			continue
		}
		for _, sp := range splitDraft(Draft{Text: l, InBook: true}, book.Problems) {
			// The notes the student gave stay with every problem.
			sp.notes = mergeNotes(q.Notes, sp.notes)
			rows = append(rows, sp)
		}
		if len(rows) >= maxDrafts {
			rows = rows[:maxDrafts]
			break
		}
	}
	if len(rows) == 0 {
		return nil, nil
	}
	first, rest := rows[0], rows[1:]
	var added []Question
	err = db.Tx(ctx, s.c.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE questions SET text = ?, label = ?, notes = ?, updated_at = ? WHERE id = ?`,
			first.Text, first.label, mustJSON(orEmpty(first.notes)), db.Now(), q.ID); err != nil {
			return err
		}
		added, err = s.insertQuestions(ctx, tx, q.HomeworkID, q.Position, rest)
		return err
	})
	if err != nil {
		return nil, err
	}
	// The questions after it moved down: say where everything is.
	if len(added) > 0 {
		s.publishSetQuestions(ctx, q.HomeworkID)
		s.publishSet(ctx, q.HomeworkID)
		s.c.Queue.Wake()
	}
	next, err := getQuestion(ctx, s.c.DB, q.ID)
	if err != nil {
		return nil, err
	}
	s.publishQuestion(ctx, q.ID)
	return &next, nil
}

// mergeNotes is a's notes, then b's not already there.
func mergeNotes(a, b []string) []string {
	out := append([]string{}, a...)
	for _, n := range b {
		if !slices.Contains(out, n) {
			out = append(out, n)
		}
	}
	return out
}

// publishSetQuestions says where every question in a set now is, after
// some moved.
func (s *Service) publishSetQuestions(ctx context.Context, setID string) {
	rows, err := s.c.DB.QueryContext(ctx, `SELECT id FROM questions WHERE homework_id = ?`, setID)
	if err != nil {
		return
	}
	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	for _, id := range ids {
		s.publishQuestion(ctx, id)
	}
}
