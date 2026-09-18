package store

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"strings"
	"unicode"
)

// SearchFTS matches a query against a book's pages through the pages_fts
// full-text index and returns the page numbers ranked best-first. Match
// expressions run best-first (see ftsMatches) and each fills only the slots
// the previous ones left open. A query matching nothing is an empty slice,
// not an error.
func (s *Store) SearchFTS(ctx context.Context, bookID string, query string, limit int) ([]int, error) {
	if limit <= 0 {
		return []int{}, nil
	}
	out := []int{}
	seen := map[int]bool{}
	for _, match := range ftsMatches(query) {
		if len(out) >= limit || match == "" {
			continue
		}
		rows, err := s.ro().QueryContext(ctx,
			`SELECT page_number FROM pages_fts
			 WHERE pages_fts MATCH ? AND book_id = ?
			 ORDER BY rank LIMIT ?`, match, bookID, limit)
		if err != nil {
			return nil, fmt.Errorf("search pages of book %s: %w", bookID, err)
		}
		for rows.Next() {
			var n int
			if err := rows.Scan(&n); err != nil {
				rows.Close()
				return nil, fmt.Errorf("search pages of book %s: %w", bookID, err)
			}
			if !seen[n] {
				seen[n] = true
				out = append(out, n)
			}
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, fmt.Errorf("search pages of book %s: %w", bookID, err)
		}
		rows.Close()
	}
	return out, nil
}

// ftsMatches turns free text into safe fts5 MATCH expressions, best first:
// the whole token sequence as one adjacency-sensitive phrase (labels like
// "Theorem 2.3" must not degenerate into AND-ing two ubiquitous digits),
// then every consecutive token pair as a phrase (selective enough for bm25
// to produce real scores on large corpora), then the single tokens as an
// implicit AND for recall. Everything is phrase-quoted, so user input never
// reaches the matcher as fts5 syntax.
// stopword reports whether a token is too common to give a token-pair
// phrase any selectivity ("what is", "of the"). Single tokens are never
// filtered; this only keeps pair phrases out of the noise.
func stopword(t string) bool {
	return stopwords[t]
}

var stopwords = map[string]bool{
	"a": true, "an": true, "the": true, "is": true, "are": true, "was": true,
	"were": true, "be": true, "been": true, "of": true, "to": true, "in": true,
	"on": true, "and": true, "or": true, "for": true, "with": true, "as": true,
	"at": true, "by": true, "from": true, "it": true, "its": true, "this": true,
	"that": true, "these": true, "those": true, "what": true, "when": true,
	"where": true, "how": true, "why": true, "which": true, "who": true,
	"does": true, "do": true, "did": true, "can": true, "if": true,
}

func ftsMatches(query string) []string {
	fields := strings.FieldsFunc(query, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
	if len(fields) == 0 {
		return nil
	}
	quoteAll := func(toks []string) string {
		quoted := make([]string, len(toks))
		for i, f := range toks {
			quoted[i] = `"` + f + `"`
		}
		return strings.Join(quoted, " ")
	}
	matches := []string{`"` + strings.Join(fields, " ") + `"`}
	if len(fields) > 2 {
		bigrams := make([]string, 0, len(fields)-1)
		for i := 0; i+1 < len(fields); i++ {
			if stopword(fields[i]) && stopword(fields[i+1]) {
				continue
			}
			bigrams = append(bigrams, `"`+fields[i]+" "+fields[i+1]+`"`)
		}
		if len(bigrams) > 0 {
			matches = append(matches, strings.Join(bigrams, " OR "))
		}
	}
	if len(fields) > 1 {
		matches = append(matches, quoteAll(fields))
	}
	return matches
}

// TextlessPages lists a book's page numbers whose stored text is empty or
// whitespace — covers and art dividers. Retrieval must skip them: nothing can
// match or be cited from a page with no text, and their embedding vectors
// describe nothing.
func (s *Store) TextlessPages(ctx context.Context, bookID string) (map[int]bool, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT page_number FROM pages
		 WHERE book_id = ? AND trim(text, char(9) || char(10) || char(13) || ' ') = ''`,
		bookID)
	if err != nil {
		return nil, fmt.Errorf("list textless pages of book %s: %w", bookID, err)
	}
	defer rows.Close()
	out := map[int]bool{}
	for rows.Next() {
		var n int
		if err := rows.Scan(&n); err != nil {
			return nil, fmt.Errorf("list textless pages of book %s: %w", bookID, err)
		}
		out[n] = true
	}
	return out, rows.Err()
}

// Embedding is one stored page vector. Vector holds float32 values in the
// order the embedding model produced them.
type Embedding struct {
	PageNumber int
	Model      string
	Vector     []float32
}

// SaveEmbedding stores or replaces a page's vector under one embedding
// model. Models coexist per page: each names its own space, and readers
// compare vectors within a single model.
func (s *Store) SaveEmbedding(ctx context.Context, bookID string, pageNumber int, model string, vector []float32) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO embeddings (id, book_id, page_number, model, vector)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(book_id, page_number, model) DO UPDATE SET vector = excluded.vector`,
		newID(), bookID, pageNumber, model, encodeVector(vector))
	if err != nil {
		return fmt.Errorf("save embedding of page %d: %w", pageNumber, err)
	}
	return nil
}

// Embeddings returns a book's stored vectors, newest page first not
// guaranteed — order is unspecified. A non-empty model filters to that
// embedding model only.
func (s *Store) Embeddings(ctx context.Context, bookID string, model string) ([]Embedding, error) {
	query := `SELECT page_number, model, vector FROM embeddings WHERE book_id = ?`
	args := []any{bookID}
	if model != "" {
		query += ` AND model = ?`
		args = append(args, model)
	}
	rows, err := s.ro().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list embeddings of book %s: %w", bookID, err)
	}
	defer rows.Close()

	var out []Embedding
	for rows.Next() {
		var e Embedding
		var blob []byte
		if err := rows.Scan(&e.PageNumber, &e.Model, &blob); err != nil {
			return nil, fmt.Errorf("list embeddings of book %s: %w", bookID, err)
		}
		e.Vector = decodeVector(blob)
		out = append(out, e)
	}
	return out, rows.Err()
}

// EmbeddingModels lists the distinct embedding models a book has vectors for.
func (s *Store) EmbeddingModels(ctx context.Context, bookID string) ([]string, error) {
	rows, err := s.ro().QueryContext(ctx,
		`SELECT DISTINCT model FROM embeddings WHERE book_id = ? ORDER BY model`, bookID)
	if err != nil {
		return nil, fmt.Errorf("list embedding models of book %s: %w", bookID, err)
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var m string
		if err := rows.Scan(&m); err != nil {
			return nil, fmt.Errorf("list embedding models of book %s: %w", bookID, err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// ClearEmbeddings deletes every stored vector of a book.
func (s *Store) ClearEmbeddings(ctx context.Context, bookID string) error {
	if _, err := s.db.ExecContext(ctx, `DELETE FROM embeddings WHERE book_id = ?`, bookID); err != nil {
		return fmt.Errorf("clear embeddings of book %s: %w", bookID, err)
	}
	return nil
}

// encodeVector packs a float vector into a BLOB: little-endian float32 words.
func encodeVector(v []float32) []byte {
	out := make([]byte, 4*len(v))
	for i, f := range v {
		binary.LittleEndian.PutUint32(out[i*4:], math.Float32bits(f))
	}
	return out
}

func decodeVector(blob []byte) []float32 {
	if len(blob)%4 != 0 {
		return nil
	}
	out := make([]float32, len(blob)/4)
	for i := range out {
		out[i] = math.Float32frombits(binary.LittleEndian.Uint32(blob[i*4:]))
	}
	return out
}
