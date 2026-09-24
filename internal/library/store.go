package library

import (
	"context"
	"database/sql"
	"encoding/binary"
	"errors"
	"math"

	"github.com/jackt/pset/internal/db"
)

// Migrations: books and everything read out of them. Every child row
// cascades from its book, so removing a book is one DELETE.
func Migrations() []db.Migration {
	return []db.Migration{{Name: "library/1", SQL: `
CREATE TABLE books (
	id          TEXT PRIMARY KEY,
	sha256      TEXT NOT NULL UNIQUE,
	title       TEXT NOT NULL,
	author      TEXT NOT NULL DEFAULT '',
	page_count  INTEGER NOT NULL DEFAULT 0,
	page_width  REAL NOT NULL DEFAULT 0,
	page_height REAL NOT NULL DEFAULT 0,
	page_offset INTEGER NOT NULL DEFAULT 0,
	kind        TEXT NOT NULL DEFAULT '',
	-- Set once the student edits title, author or offset: a retried
	-- import never writes over what they typed.
	edited      INTEGER NOT NULL DEFAULT 0,
	state       TEXT NOT NULL,
	phase       TEXT NOT NULL DEFAULT '',
	done        INTEGER,
	total       INTEGER,
	reason      TEXT NOT NULL DEFAULT '',
	created_at  TEXT NOT NULL,
	updated_at  TEXT NOT NULL
);

CREATE TABLE pages (
	book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	number  INTEGER NOT NULL,
	text    TEXT NOT NULL,
	status  TEXT NOT NULL, -- text | blank | failed
	PRIMARY KEY (book_id, number)
);
CREATE VIRTUAL TABLE pages_fts USING fts5(book_id UNINDEXED, number UNINDEXED, text);
CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN
	INSERT INTO pages_fts (book_id, number, text) VALUES (new.book_id, new.number, new.text);
END;
CREATE TRIGGER pages_au AFTER UPDATE OF text ON pages BEGIN
	DELETE FROM pages_fts WHERE book_id = old.book_id AND number = old.number;
	INSERT INTO pages_fts (book_id, number, text) VALUES (new.book_id, new.number, new.text);
END;
CREATE TRIGGER pages_ad AFTER DELETE ON pages BEGIN
	DELETE FROM pages_fts WHERE book_id = old.book_id AND number = old.number;
END;

CREATE TABLE sections (
	book_id    TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	ord        INTEGER NOT NULL,
	level      INTEGER NOT NULL,
	title      TEXT NOT NULL,
	start_page INTEGER NOT NULL,
	end_page   INTEGER NOT NULL,
	PRIMARY KEY (book_id, ord)
);

CREATE TABLE embeddings (
	book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
	number  INTEGER NOT NULL,
	model   TEXT NOT NULL,
	vector  BLOB NOT NULL,
	PRIMARY KEY (book_id, number)
);`}}
}

var errNotFound = errors.New("not found")

// row is a book as stored, with the columns the wire doesn't carry.
type row struct {
	Book
	Width  float64
	Height float64
	Edited bool
}

const bookCols = `id, sha256, title, author, page_count, page_width, page_height, page_offset, kind, edited, state, phase, done, total, reason, created_at, updated_at`

func scanBook(s interface{ Scan(...any) error }) (row, error) {
	var r row
	var done, total sql.NullInt64
	err := s.Scan(&r.ID, &r.SHA256, &r.Title, &r.Author, &r.PageCount, &r.Width, &r.Height,
		&r.PageOffset, &r.Kind, &r.Edited, &r.State.Kind, &r.State.Phase, &done, &total, &r.State.Reason, &r.AddedAt, &r.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return r, errNotFound
	}
	if done.Valid {
		n := int(done.Int64)
		r.State.Done = &n
	}
	if total.Valid {
		n := int(total.Int64)
		r.State.Total = &n
	}
	if r.Width > 0 {
		r.Aspect = r.Height / r.Width
	}
	return r, err
}

func getBook(ctx context.Context, q queryer, id string) (row, error) {
	return scanBook(q.QueryRowContext(ctx, `SELECT `+bookCols+` FROM books WHERE id = ?`, id))
}

func bookBySHA(ctx context.Context, q queryer, sha string) (row, error) {
	return scanBook(q.QueryRowContext(ctx, `SELECT `+bookCols+` FROM books WHERE sha256 = ?`, sha))
}

func listBooks(ctx context.Context, q queryer) ([]Book, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+bookCols+` FROM books ORDER BY created_at, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Book{}
	for rows.Next() {
		r, err := scanBook(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r.Book)
	}
	return out, rows.Err()
}

type queryer interface {
	QueryContext(ctx context.Context, q string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, q string, args ...any) *sql.Row
	ExecContext(ctx context.Context, q string, args ...any) (sql.Result, error)
}

func setState(ctx context.Context, q queryer, id string, st BookState) error {
	var done, total any
	if st.Done != nil {
		done = *st.Done
	}
	if st.Total != nil {
		total = *st.Total
	}
	_, err := q.ExecContext(ctx, `UPDATE books SET state = ?, phase = ?, done = ?, total = ?, reason = ?, updated_at = ? WHERE id = ?`,
		st.Kind, st.Phase, done, total, st.Reason, db.Now(), id)
	return err
}

// storedPage is one page's text.
type storedPage struct {
	Number int
	Text   string
	Status string
}

func savePage(ctx context.Context, q queryer, bookID string, p storedPage) error {
	_, err := q.ExecContext(ctx, `INSERT INTO pages (book_id, number, text, status) VALUES (?, ?, ?, ?)
		ON CONFLICT (book_id, number) DO UPDATE SET text = excluded.text, status = excluded.status`,
		bookID, p.Number, p.Text, p.Status)
	return err
}

func loadPages(ctx context.Context, q queryer, bookID string) ([]storedPage, error) {
	rows, err := q.QueryContext(ctx, `SELECT number, text, status FROM pages WHERE book_id = ? ORDER BY number`, bookID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []storedPage
	for rows.Next() {
		var p storedPage
		if err := rows.Scan(&p.Number, &p.Text, &p.Status); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// settledPages are the pages already read successfully: a resumed read
// skips them.
func settledPages(ctx context.Context, q queryer, bookID string) (map[int]bool, error) {
	rows, err := q.QueryContext(ctx, `SELECT number FROM pages WHERE book_id = ? AND status != 'failed'`, bookID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int]bool{}
	for rows.Next() {
		var n int
		rows.Scan(&n)
		out[n] = true
	}
	return out, rows.Err()
}

// section is one stored contents entry.
type section struct {
	Level     int
	Title     string
	StartPage int
	EndPage   int
}

func saveSections(ctx context.Context, d *sql.DB, bookID string, secs []section) error {
	return db.Tx(ctx, d, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM sections WHERE book_id = ?`, bookID); err != nil {
			return err
		}
		for i, s := range secs {
			if _, err := tx.ExecContext(ctx, `INSERT INTO sections (book_id, ord, level, title, start_page, end_page) VALUES (?, ?, ?, ?, ?, ?)`,
				bookID, i, s.Level, s.Title, s.StartPage, s.EndPage); err != nil {
				return err
			}
		}
		return nil
	})
}

func loadSections(ctx context.Context, q queryer, bookID string) ([]section, error) {
	rows, err := q.QueryContext(ctx, `SELECT level, title, start_page, end_page FROM sections WHERE book_id = ? ORDER BY ord`, bookID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []section
	for rows.Next() {
		var s section
		if err := rows.Scan(&s.Level, &s.Title, &s.StartPage, &s.EndPage); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func saveEmbedding(ctx context.Context, q queryer, bookID string, n int, model string, v []float32) error {
	_, err := q.ExecContext(ctx, `INSERT INTO embeddings (book_id, number, model, vector) VALUES (?, ?, ?, ?)
		ON CONFLICT (book_id, number) DO UPDATE SET model = excluded.model, vector = excluded.vector`,
		bookID, n, model, encodeVector(v))
	return err
}

// embeddedPages are the pages with a vector in model's space. Vectors
// from another model are useless for comparison and are dropped first.
func embeddedPages(ctx context.Context, q queryer, bookID, model string) (map[int]bool, error) {
	if _, err := q.ExecContext(ctx, `DELETE FROM embeddings WHERE book_id = ? AND model != ?`, bookID, model); err != nil {
		return nil, err
	}
	rows, err := q.QueryContext(ctx, `SELECT number FROM embeddings WHERE book_id = ?`, bookID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int]bool{}
	for rows.Next() {
		var n int
		rows.Scan(&n)
		out[n] = true
	}
	return out, rows.Err()
}

type vectorRow struct {
	Number int
	Vector []float32
}

// vectors loads a book's vectors in model's space, skipping pages with no
// text: a blank page's vector describes nothing and crowds out real hits.
func vectors(ctx context.Context, q queryer, bookID, model string) ([]vectorRow, error) {
	rows, err := q.QueryContext(ctx, `SELECT e.number, e.vector FROM embeddings e
		JOIN pages p ON p.book_id = e.book_id AND p.number = e.number
		WHERE e.book_id = ? AND e.model = ? AND p.status = 'text'`, bookID, model)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []vectorRow
	for rows.Next() {
		var r vectorRow
		var blob []byte
		if err := rows.Scan(&r.Number, &blob); err != nil {
			return nil, err
		}
		r.Vector = decodeVector(blob)
		out = append(out, r)
	}
	return out, rows.Err()
}

func encodeVector(v []float32) []byte {
	out := make([]byte, 4*len(v))
	for i, f := range v {
		binary.LittleEndian.PutUint32(out[i*4:], math.Float32bits(f))
	}
	return out
}

func decodeVector(b []byte) []float32 {
	if len(b)%4 != 0 {
		return nil
	}
	out := make([]float32, len(b)/4)
	for i := range out {
		out[i] = math.Float32frombits(binary.LittleEndian.Uint32(b[i*4:]))
	}
	return out
}

// searchFTS ranks pages by full-text match, best first, running the match
// expressions from most to least exact.
func searchFTS(ctx context.Context, q queryer, bookID, query string, limit int) ([]int, error) {
	out := []int{}
	seen := map[int]bool{}
	for _, m := range ftsMatches(query) {
		if len(out) >= limit {
			break
		}
		rows, err := q.QueryContext(ctx, `SELECT number FROM pages_fts WHERE pages_fts MATCH ? AND book_id = ? ORDER BY rank LIMIT ?`,
			m, bookID, limit)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var n int
			rows.Scan(&n)
			if !seen[n] {
				seen[n] = true
				out = append(out, n)
			}
		}
		rows.Close()
	}
	return out, nil
}

// pageText is one page's text; empty for a page never read.
func pageText(ctx context.Context, q queryer, bookID string, n int) (string, error) {
	var t string
	err := q.QueryRowContext(ctx, `SELECT text FROM pages WHERE book_id = ? AND number = ?`, bookID, n).Scan(&t)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return t, err
}
