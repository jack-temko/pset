package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Conversation message roles.
const (
	RoleUser      = "user"
	RoleAssistant = "assistant"
)

// Assistant message segment types: an ordered answer is prose passages,
// typed envelope payloads, tool-call cards, and degraded envelopes kept as
// their raw text.
const (
	SegmentProse    = "prose"
	SegmentEnvelope = "envelope"
	SegmentTool     = "tool"
	SegmentCode     = "code"
)

// ToolPayload is the stored form of one tool exchange: what ran, with which
// arguments, and what came back. Pages records the book pages a search or
// read touched, feeding the consulted strip on replay.
type ToolPayload struct {
	ID     string          `json:"id"`
	Tool   string          `json:"tool"`
	Args   json.RawMessage `json:"args,omitempty"`
	Result string          `json:"result,omitempty"`
	OK     bool            `json:"ok"`
	Pages  []int           `json:"pages,omitempty"`
}

// Segment is one ordered block of an assistant message. Prose and code
// segments carry Text; envelope segments carry Kind plus the validated JSON
// Payload exactly as it was shown.
type Segment struct {
	Type    string          `json:"type"`
	Text    string          `json:"text,omitempty"`
	Kind    string          `json:"kind,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// Conversation is one question-and-answer thread on a book. A homework
// chat is the same row with HomeworkID set (at most one per homework);
// ask threads leave it empty. MessageCount is only filled by Conversations
// and ConversationByID; a bare lookup leaves it zero.
type Conversation struct {
	ID           string
	BookID       string
	HomeworkID   string // empty for ask threads
	Title        string
	Pinned       bool
	MessageCount int
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Message is one turn in a conversation. A user turn carries its text in
// Content; an assistant turn carries its ordered Segments (Content stays
// empty). QuestionID remembers the homework question a turn was about, for
// transcript dividers. Citations holds page numbers extracted by the old
// pill pipeline; it is read back for legacy threads but never written.
type Message struct {
	ID             string
	ConversationID string
	Role           string
	Content        string
	Segments       []Segment
	Citations      []int
	QuestionID     string
	CreatedAt      time.Time
}

// CreateConversation inserts c, setting its ID and timestamps.
func (s *Store) CreateConversation(ctx context.Context, c *Conversation) error {
	c.ID = newID()
	if c.CreatedAt.IsZero() {
		c.CreatedAt = time.Now().UTC()
	}
	c.UpdatedAt = c.CreatedAt
	var homework any
	if c.HomeworkID != "" {
		homework = c.HomeworkID
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO conversations (id, book_id, homework_id, title, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		c.ID, c.BookID, homework, c.Title, formatTime(c.CreatedAt), formatTime(c.UpdatedAt))
	if err != nil {
		return fmt.Errorf("create conversation: %w", err)
	}
	return nil
}

// Conversations lists a book's ask threads (homework chats stay with their
// assignment), most recently active first, with message counts.
func (s *Store) Conversations(ctx context.Context, bookID string) ([]Conversation, error) {
	rows, err := s.ro().QueryContext(ctx, `SELECT c.id, c.book_id, c.homework_id, c.title, c.pinned, c.created_at, c.updated_at,
			(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id)
		 FROM conversations c
		 WHERE c.book_id = ? AND c.homework_id IS NULL
		 ORDER BY c.updated_at DESC, c.id DESC`, bookID)
	if err != nil {
		return nil, fmt.Errorf("list conversations of book %s: %w", bookID, err)
	}
	defer rows.Close()

	var out []Conversation
	for rows.Next() {
		c, err := scanConversation(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("list conversations of book %s: %w", bookID, err)
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

// ConversationByID returns one thread; ErrNotFound when absent.
func (s *Store) ConversationByID(ctx context.Context, id string) (*Conversation, error) {
	row := s.ro().QueryRowContext(ctx, `SELECT c.id, c.book_id, c.homework_id, c.title, c.pinned, c.created_at, c.updated_at,
			(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id)
		 FROM conversations c WHERE c.id = ?`, id)
	c, err := scanConversation(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("conversation %s: %w", id, err)
	}
	return c, nil
}

// ConversationForHomework resolves the assignment's one chat, empty
// (not ErrNotFound) when the homework has never chatted.
func (s *Store) ConversationForHomework(ctx context.Context, homeworkID string) (*Conversation, error) {
	row := s.ro().QueryRowContext(ctx, `SELECT c.id, c.book_id, c.homework_id, c.title, c.pinned, c.created_at, c.updated_at,
			(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id)
		 FROM conversations c WHERE c.homework_id = ?`, homeworkID)
	c, err := scanConversation(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("homework conversation %s: %w", homeworkID, err)
	}
	return c, nil
}

// ConversationRef is a conversation joined with the identity of its book,
// for global (book-less) listings and lookups.
type ConversationRef struct {
	Conversation
	BookSHA256 string
	BookTitle  string
}

// AllConversations lists every ask thread across all books (homework chats
// stay with their assignment), most recently active first, with message
// counts and book identity.
func (s *Store) AllConversations(ctx context.Context) ([]ConversationRef, error) {
	rows, err := s.ro().QueryContext(ctx, `SELECT c.id, c.book_id, c.homework_id, c.title, c.pinned, c.created_at, c.updated_at,
			(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id),
			b.sha256, b.title
		 FROM conversations c JOIN books b ON b.id = c.book_id
		 WHERE c.homework_id IS NULL
		 ORDER BY c.updated_at DESC, c.id DESC`)
	if err != nil {
		return nil, fmt.Errorf("list conversations: %w", err)
	}
	defer rows.Close()

	var out []ConversationRef
	for rows.Next() {
		r, err := scanConversationRef(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("list conversations: %w", err)
		}
		out = append(out, *r)
	}
	return out, rows.Err()
}

// ConversationRefByID resolves one thread with its book identity; ErrNotFound
// when absent.
func (s *Store) ConversationRefByID(ctx context.Context, id string) (*ConversationRef, error) {
	row := s.ro().QueryRowContext(ctx, `SELECT c.id, c.book_id, c.homework_id, c.title, c.pinned, c.created_at, c.updated_at,
			(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id),
			b.sha256, b.title
		 FROM conversations c JOIN books b ON b.id = c.book_id WHERE c.id = ?`, id)
	r, err := scanConversationRef(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("conversation %s: %w", id, err)
	}
	return r, nil
}

func scanConversationRef(scan func(dest ...any) error) (*ConversationRef, error) {
	var r ConversationRef
	var homework sql.NullString
	var createdAt, updatedAt string
	if err := scan(&r.ID, &r.BookID, &homework, &r.Title, &r.Pinned, &createdAt, &updatedAt,
		&r.MessageCount, &r.BookSHA256, &r.BookTitle); err != nil {
		return nil, err
	}
	r.HomeworkID = homework.String
	var err error
	if r.CreatedAt, err = parseTime(createdAt); err != nil {
		return nil, fmt.Errorf("parse created_at: %w", err)
	}
	if r.UpdatedAt, err = parseTime(updatedAt); err != nil {
		return nil, fmt.Errorf("parse updated_at: %w", err)
	}
	return &r, nil
}

// Messages returns a conversation's turns in order.
func (s *Store) Messages(ctx context.Context, conversationID string) ([]Message, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT id, conversation_id, role, content, segments, citations, question_id, created_at
		 FROM messages WHERE conversation_id = ? ORDER BY id`, conversationID)
	if err != nil {
		return nil, fmt.Errorf("list messages of conversation %s: %w", conversationID, err)
	}
	defer rows.Close()

	var out []Message
	for rows.Next() {
		m, err := scanMessage(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("list messages of conversation %s: %w", conversationID, err)
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

// AppendMessage stores one turn and bumps the conversation's updated_at.
// It sets m's ID and CreatedAt.
func (s *Store) AppendMessage(ctx context.Context, conversationID string, m *Message) error {
	m.ID = newID()
	if m.CreatedAt.IsZero() {
		m.CreatedAt = time.Now().UTC()
	}
	citations, err := marshalCitations(m.Citations)
	if err != nil {
		return err
	}
	segments, err := marshalSegments(m.Segments)
	if err != nil {
		return err
	}
	var question any
	if m.QuestionID != "" {
		question = m.QuestionID
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("append message: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `INSERT INTO messages (id, conversation_id, role, content, segments, citations, question_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ID, conversationID, m.Role, m.Content, segments, citations, question, formatTime(m.CreatedAt)); err != nil {
		return fmt.Errorf("append message: %w", err)
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE conversations SET updated_at = ? WHERE id = ?`,
		formatTime(time.Now().UTC()), conversationID); err != nil {
		return fmt.Errorf("append message: %w", err)
	}
	m.ConversationID = conversationID
	return tx.Commit()
}

// UpdateConversation renames a thread and/or flips its pin; nil pointers
// keep their column. updated_at is not touched — a rename or pin is not
// activity. The fresh row comes back via ConversationByID; ErrNotFound when
// absent.
func (s *Store) UpdateConversation(ctx context.Context, id string, title *string, pinned *bool) (*Conversation, error) {
	var sets []string
	var args []any
	if title != nil {
		sets = append(sets, "title = ?")
		args = append(args, *title)
	}
	if pinned != nil {
		sets = append(sets, "pinned = ?")
		args = append(args, *pinned)
	}
	if len(sets) > 0 {
		if _, err := s.db.ExecContext(ctx,
			"UPDATE conversations SET "+strings.Join(sets, ", ")+" WHERE id = ?",
			append(args, id)...); err != nil {
			return nil, fmt.Errorf("update conversation %s: %w", id, err)
		}
	}
	return s.ConversationByID(ctx, id)
}

// DeleteConversation removes a thread; its messages go with it via cascade.
func (s *Store) DeleteConversation(ctx context.Context, id string) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM conversations WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete conversation %s: %w", id, err)
	}
	if n, err := res.RowsAffected(); err == nil && n == 0 {
		return ErrNotFound
	}
	return nil
}

func scanConversation(scan func(dest ...any) error) (*Conversation, error) {
	var c Conversation
	var homework sql.NullString
	var createdAt, updatedAt string
	if err := scan(&c.ID, &c.BookID, &homework, &c.Title, &c.Pinned, &createdAt, &updatedAt, &c.MessageCount); err != nil {
		return nil, err
	}
	c.HomeworkID = homework.String
	var err error
	if c.CreatedAt, err = parseTime(createdAt); err != nil {
		return nil, fmt.Errorf("parse created_at: %w", err)
	}
	if c.UpdatedAt, err = parseTime(updatedAt); err != nil {
		return nil, fmt.Errorf("parse updated_at: %w", err)
	}
	return &c, nil
}

func scanMessage(scan func(dest ...any) error) (*Message, error) {
	var m Message
	var citations, segments, question sql.NullString
	var createdAt string
	if err := scan(&m.ID, &m.ConversationID, &m.Role, &m.Content, &segments, &citations, &question, &createdAt); err != nil {
		return nil, err
	}
	if citations.Valid {
		var err error
		if m.Citations, err = unmarshalCitations(citations.String); err != nil {
			return nil, err
		}
	}
	if segments.Valid {
		var err error
		if m.Segments, err = unmarshalSegments(segments.String); err != nil {
			return nil, err
		}
	}
	m.QuestionID = question.String
	var err error
	if m.CreatedAt, err = parseTime(createdAt); err != nil {
		return nil, fmt.Errorf("parse created_at: %w", err)
	}
	return &m, nil
}

// Segments are stored as one JSON array column, NULL when the message has
// none (every user message).
func marshalSegments(segments []Segment) (any, error) {
	if len(segments) == 0 {
		return nil, nil
	}
	data, err := json.Marshal(segments)
	if err != nil {
		return nil, fmt.Errorf("encode segments: %w", err)
	}
	return string(data), nil
}

func unmarshalSegments(data string) ([]Segment, error) {
	var out []Segment
	if err := json.Unmarshal([]byte(data), &out); err != nil {
		return nil, fmt.Errorf("decode segments: %w", err)
	}
	return out, nil
}

// Citations are stored as a JSON array of page numbers, NULL when empty.
func marshalCitations(citations []int) (any, error) {
	if len(citations) == 0 {
		return nil, nil
	}
	data, err := json.Marshal(citations)
	if err != nil {
		return nil, fmt.Errorf("encode citations: %w", err)
	}
	return string(data), nil
}

func unmarshalCitations(data string) ([]int, error) {
	var out []int
	if err := json.Unmarshal([]byte(data), &out); err != nil {
		return nil, fmt.Errorf("decode citations: %w", err)
	}
	return out, nil
}
