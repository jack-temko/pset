// Package memory is what the tutor knows about a book from working in it:
// where things are, how the book is laid out, and how the student wants
// answers. It stores and serves; it knows nothing of the model or of
// homework, which reach it through adapters. Spec: design/memory.md.
package memory

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/events"
	"github.com/jackt/pset/internal/httpx"
)

func Migrations() []db.Migration {
	return []db.Migration{{Name: "memory/1", SQL: `
CREATE TABLE memories (
	id         TEXT PRIMARY KEY,
	book_id    TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	kind       TEXT NOT NULL,
	text       TEXT NOT NULL,
	norm       TEXT NOT NULL,
	page       INTEGER,
	source     TEXT NOT NULL,
	key        TEXT NOT NULL DEFAULT '',
	detail     TEXT NOT NULL DEFAULT 'null',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX memories_book ON memories (book_id, created_at);
CREATE UNIQUE INDEX memories_key ON memories (book_id, key) WHERE key != '';`}}
}

type Service struct {
	db     *sql.DB
	events events.Publisher
}

func New(d *sql.DB, ev events.Publisher) *Service { return &Service{db: d, events: ev} }

// MaxText bounds one memory: a sentence, not a page of notes.
const MaxText = 300

var errNotFound = errors.New("not found")

const cols = `id, book_id, kind, text, page, source, created_at`

func scan(s interface{ Scan(...any) error }) (Memory, error) {
	var m Memory
	var page sql.NullInt64
	err := s.Scan(&m.ID, &m.BookID, &m.Kind, &m.Text, &page, &m.Source, &m.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return m, errNotFound
	}
	if page.Valid {
		p := int(page.Int64)
		m.Page = &p
	}
	return m, err
}

// List is a book's memories, newest first.
func (s *Service) List(ctx context.Context, bookID string) ([]Memory, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT `+cols+` FROM memories WHERE book_id = ? ORDER BY created_at DESC, rowid DESC`, bookID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Memory{}
	for rows.Next() {
		m, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Service) get(ctx context.Context, id string) (Memory, error) {
	return scan(s.db.QueryRowContext(ctx, `SELECT `+cols+` FROM memories WHERE id = ?`, id))
}

// Add is one the student writes in the memory menu.
func (s *Service) Add(ctx context.Context, bookID string, n NewMemory) (Memory, error) {
	m, _, err := s.Save(ctx, bookID, Save{Kind: n.Kind, Text: n.Text, Page: n.Page, Source: SourceYou})
	return m, err
}

// Save is a memory from anyone. Replaces, when set, is the id (or the
// start of it) of a memory to overwrite.
type Save struct {
	Kind     Kind
	Text     string
	Page     *int
	Source   Source
	Replaces string
}

// Outcome is what a save did.
type Outcome string

const (
	OutcomeSaved     Outcome = "saved"
	OutcomeDuplicate Outcome = "duplicate"
	OutcomeReplaced  Outcome = "replaced"
)

// Refusals the model reads, in words it can act on.
var (
	ErrNoSuchMemory = errors.New("there's no memory with that id")
	ErrAmbiguous    = errors.New("that id matches more than one memory: give more of it")
	ErrStudentsOwn  = errors.New("that memory is the student's own and only they can change it: save a new one instead")
)

// Save validates and stores a memory. A sentence matching one the book
// already has (case, spacing and punctuation aside) is already
// remembered: that one comes back, as a Duplicate.
func (s *Service) Save(ctx context.Context, bookID string, in Save) (Memory, Outcome, error) {
	text := strings.Join(strings.Fields(in.Text), " ")
	switch {
	case in.Kind != KindBook && in.Kind != KindPreference:
		return Memory{}, "", httpx.Invalid("kind", "A memory is about the book or a preference.")
	case text == "":
		return Memory{}, "", httpx.Invalid("text", "Write what to remember.")
	case utf8.RuneCountInString(text) > MaxText:
		return Memory{}, "", httpx.Invalid("text", "Keep it to a sentence or two (%d characters at most).", MaxText)
	case in.Page != nil && *in.Page < 1:
		return Memory{}, "", httpx.Invalid("page", "That isn't a page.")
	case in.Page != nil && in.Kind != KindBook:
		return Memory{}, "", httpx.Invalid("page", "Only a memory about the book has a page.")
	}
	norm := normalize(text)

	var old *Memory
	if in.Replaces != "" {
		m, err := s.resolve(ctx, bookID, in.Replaces)
		if err != nil {
			return Memory{}, "", err
		}
		if m.Source == SourceYou && in.Source != SourceYou {
			return Memory{}, "", ErrStudentsOwn
		}
		old = &m
	}
	var dupID string
	err := s.db.QueryRowContext(ctx, `SELECT id FROM memories WHERE book_id = ? AND norm = ? LIMIT 1`, bookID, norm).Scan(&dupID)
	if err == nil && (old == nil || dupID != old.ID) {
		m, err := s.get(ctx, dupID)
		return m, OutcomeDuplicate, err
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return Memory{}, "", err
	}

	now := db.Now()
	if old != nil {
		// A replacement keeps its place in time as the newest thing known.
		if _, err := s.db.ExecContext(ctx, `UPDATE memories SET kind = ?, text = ?, norm = ?, page = ?, source = ?, key = '', detail = 'null', created_at = ?, updated_at = ? WHERE id = ?`,
			in.Kind, text, norm, in.Page, in.Source, now, now, old.ID); err != nil {
			return Memory{}, "", err
		}
		m, err := s.get(ctx, old.ID)
		if err == nil {
			s.events.Publish(EventSaved, Saved{Memory: m})
		}
		return m, OutcomeReplaced, err
	}
	id := uuid.NewString()
	if _, err := s.db.ExecContext(ctx, `INSERT INTO memories (id, book_id, kind, text, norm, page, source, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, bookID, in.Kind, text, norm, in.Page, in.Source, now, now); err != nil {
		// The one constraint an insert can break is the book.
		return Memory{}, "", httpx.NotFound("book")
	}
	m, err := s.get(ctx, id)
	if err == nil {
		s.events.Publish(EventSaved, Saved{Memory: m})
	}
	return m, OutcomeSaved, err
}

// Remove deletes a memory.
func (s *Service) Remove(ctx context.Context, id string) (Memory, error) {
	m, err := s.get(ctx, id)
	if errors.Is(err, errNotFound) {
		return Memory{}, httpx.NotFound("memory")
	}
	if err != nil {
		return Memory{}, err
	}
	if _, err := s.db.ExecContext(ctx, `DELETE FROM memories WHERE id = ?`, id); err != nil {
		return Memory{}, err
	}
	s.events.Publish(EventRemoved, Removed{ID: m.ID, BookID: m.BookID})
	return m, nil
}

// Forget removes a memory by the short id the model saw.
func (s *Service) Forget(ctx context.Context, bookID, ref string) (Memory, error) {
	m, err := s.resolve(ctx, bookID, ref)
	if err != nil {
		return Memory{}, err
	}
	return s.Remove(ctx, m.ID)
}

// ShortID is how the model sees a memory's id: enough of it to name one
// memory among a book's few dozen.
func ShortID(id string) string { return id[:min(len(id), 6)] }

// resolve finds a book's memory by its id or the start of it.
func (s *Service) resolve(ctx context.Context, bookID, ref string) (Memory, error) {
	ref = strings.ToLower(strings.Trim(strings.TrimSpace(ref), "[]"))
	if ref == "" || strings.ContainsAny(ref, "%_") {
		return Memory{}, ErrNoSuchMemory
	}
	rows, err := s.db.QueryContext(ctx, `SELECT `+cols+` FROM memories WHERE book_id = ? AND id LIKE ? || '%' LIMIT 2`, bookID, ref)
	if err != nil {
		return Memory{}, err
	}
	defer rows.Close()
	var found []Memory
	for rows.Next() {
		m, err := scan(rows)
		if err != nil {
			return Memory{}, err
		}
		found = append(found, m)
	}
	switch len(found) {
	case 0:
		return Memory{}, ErrNoSuchMemory
	case 1:
		return found[0], nil
	}
	return Memory{}, ErrAmbiguous
}

// normalize is a sentence as duplicates are compared: lower case, letters
// and digits, single spaces.
func normalize(s string) string {
	var b strings.Builder
	space := false
	for _, r := range strings.ToLower(s) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if space && b.Len() > 0 {
				b.WriteByte(' ')
			}
			b.WriteRune(r)
			space = false
		} else {
			space = true
		}
	}
	return b.String()
}

// ---------------------------------------------------------------- prompt

// Prompt caps: every memory of yours goes in, then the rest newest first,
// until one of these is reached.
const (
	promptMax      = 60
	promptMaxChars = 4000
)

// ForPrompt is what fits in the prompt, in the order it's shown: the
// student's first, then the rest newest first.
func (s *Service) ForPrompt(ctx context.Context, bookID string) ([]Memory, error) {
	all, err := s.List(ctx, bookID)
	if err != nil {
		return nil, err
	}
	return pick(all), nil
}

func pick(newestFirst []Memory) []Memory {
	var out []Memory
	chars := 0
	for _, m := range newestFirst {
		if m.Source == SourceYou {
			out = append(out, m)
			chars += len(m.Text)
		}
	}
	for _, m := range newestFirst {
		if m.Source == SourceYou {
			continue
		}
		if len(out) >= promptMax || chars+len(m.Text) > promptMaxChars {
			break
		}
		out = append(out, m)
		chars += len(m.Text)
	}
	return out
}

// ---------------------------------------------------------------- problems

// Seen is one problem locate found: its label and PDF page.
type Seen struct {
	Label string `json:"label"`
	Page  int    `json:"page"`
}

func problemsKey(chapter int) string { return fmt.Sprintf("problems/%d", chapter) }

// Problems is where locate has found a chapter's problems, and the
// memory that says so.
type Problems struct {
	MemoryID string
	Text     string
	Seen     []Seen
}

// ProblemsSeen is a chapter's Problems; none seen yet is the zero value.
func (s *Service) ProblemsSeen(ctx context.Context, bookID string, chapter int) (Problems, error) {
	var p Problems
	var detail string
	err := s.db.QueryRowContext(ctx, `SELECT id, text, detail FROM memories WHERE book_id = ? AND key = ?`, bookID, problemsKey(chapter)).
		Scan(&p.MemoryID, &p.Text, &detail)
	if errors.Is(err, sql.ErrNoRows) {
		return Problems{}, nil
	}
	if err != nil {
		return Problems{}, err
	}
	json.Unmarshal([]byte(detail), &p.Seen)
	return p, nil
}

// SawProblem records where a problem is, in the chapter's one PSet
// memory, and rewrites its sentence to the range seen so far. offset
// turns PDF pages into the printed ones the sentence names.
func (s *Service) SawProblem(ctx context.Context, bookID string, offset, chapter int, label string, page int) error {
	if chapter < 1 || label == "" || page < 1 {
		return nil
	}
	key := problemsKey(chapter)
	p, err := s.ProblemsSeen(ctx, bookID, chapter)
	if err != nil {
		return err
	}
	seen := p.Seen
	found := false
	for i, p := range seen {
		if p.Label == label {
			if p.Page == page {
				return nil
			}
			seen[i].Page, found = page, true
		}
	}
	if !found {
		seen = append(seen, Seen{Label: label, Page: page})
	}
	lo, hi := seen[0].Page, seen[0].Page
	for _, p := range seen {
		lo, hi = min(lo, p.Page), max(hi, p.Page)
	}
	text := fmt.Sprintf("Chapter %d's problems are on %s.", chapter, printedRange(lo, hi, offset))
	if lo == hi {
		text = fmt.Sprintf("Chapter %d's problems include one on %s.", chapter, printedRange(lo, hi, offset))
	}
	detail, _ := json.Marshal(seen)
	now := db.Now()
	// The range is PSet's, so a matching sentence of the tutor's doesn't
	// stop it; its norm is keyed apart from theirs.
	_, err = s.db.ExecContext(ctx, `INSERT INTO memories (id, book_id, kind, text, norm, page, source, key, detail, created_at, updated_at)
		VALUES (?, ?, 'book', ?, ?, ?, 'pset', ?, ?, ?, ?)
		ON CONFLICT (book_id, key) WHERE key != '' DO UPDATE SET text = excluded.text, norm = excluded.norm, page = excluded.page, detail = excluded.detail, updated_at = excluded.updated_at`,
		uuid.NewString(), bookID, text, key+" "+normalize(text), lo, key, string(detail), now, now)
	if err != nil {
		return err
	}
	var id string
	if err := s.db.QueryRowContext(ctx, `SELECT id FROM memories WHERE book_id = ? AND key = ?`, bookID, key).Scan(&id); err != nil {
		return err
	}
	if m, err := s.get(ctx, id); err == nil {
		s.events.Publish(EventSaved, Saved{Memory: m})
	}
	return nil
}

func printedRange(lo, hi, offset int) string {
	name := func(p int) string {
		if n := p - offset; n >= 1 {
			return fmt.Sprint(n)
		}
		return fmt.Sprintf("PDF page %d", p)
	}
	if lo == hi {
		return "p. " + name(lo)
	}
	return fmt.Sprintf("p. %s–%s", name(lo), name(hi))
}
