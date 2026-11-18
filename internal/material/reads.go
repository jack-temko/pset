package material

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/errs"
	"github.com/jackt/pset/internal/library"
)

// Contents is a material's contents as a tree of headings.
func (s *Service) Contents(ctx context.Context, id string) (Contents, error) {
	if _, err := s.get(ctx, id); err != nil {
		return Contents{}, err
	}
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT id, parent_id, title, page FROM sections WHERE material_id = ? AND position >= 0 ORDER BY position`, id)
	if err != nil {
		return Contents{}, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	type node struct {
		entry  ContentsEntry
		parent string
	}
	var order []string
	nodes := map[string]*node{}
	for rows.Next() {
		n := &node{}
		n.entry.Children = []ContentsEntry{}
		if err := rows.Scan(&n.entry.ID, &n.parent, &n.entry.Title, &n.entry.Page); err != nil {
			return Contents{}, errs.Database.Wrap(err)
		}
		nodes[n.entry.ID] = n
		order = append(order, n.entry.ID)
	}
	if err := rows.Err(); err != nil {
		return Contents{}, errs.Database.Wrap(err)
	}
	// Children are filled from the deepest up, so each carries its own.
	for i := len(order) - 1; i >= 0; i-- {
		n := nodes[order[i]]
		if p, ok := nodes[n.parent]; ok {
			p.entry.Children = append([]ContentsEntry{n.entry}, p.entry.Children...)
		}
	}
	out := Contents{MaterialID: id, Entries: []ContentsEntry{}}
	for _, sid := range order {
		if n := nodes[sid]; nodes[n.parent] == nil {
			out.Entries = append(out.Entries, n.entry)
		}
	}
	return out, nil
}

// PageImage is one page rendered as a JPEG about width pixels across.
func (s *Service) PageImage(ctx context.Context, id string, page, width int) ([]byte, error) {
	m, err := s.get(ctx, id)
	if err != nil {
		return nil, err
	}
	data, err := s.images(m)(ctx, page, width)
	if err != nil && !errors.Is(err, context.Canceled) {
		if page < 1 || page > m.PageCount {
			return nil, errs.Gone.New("thing", "page")
		}
		return nil, errs.Disk.Wrap(err)
	}
	return data, err
}

// PageText is one page's text, "" for a page not read yet.
func (s *Service) PageText(ctx context.Context, id string, page int) (string, error) {
	if _, err := s.get(ctx, id); err != nil {
		return "", err
	}
	var t string
	err := s.c.Store.DB.QueryRowContext(ctx, `SELECT text FROM pages WHERE material_id = ? AND number = ?`, id, page).Scan(&t)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return t, errs.Database.Of(err)
}

// Search is a material's pages ranked for a query, best first, k at most:
// full-text and vector rankings merged, as the old library searched. When
// the embedder can't answer, the words alone rank.
func (s *Service) Search(ctx context.Context, id, query string, k int) ([]int, error) {
	fts, err := s.searchWords(ctx, id, query, library.SearchDepth)
	if err != nil {
		return nil, err
	}
	var vec []int
	if s.c.Embed != nil {
		q, err := s.c.Embed(ctx, []string{query})
		switch {
		case ctx.Err() != nil:
			return nil, fmt.Errorf("stopped: %w", ctx.Err())
		case err != nil || len(q) != 1:
			slog.Warn("search: embedding the query failed; ranking by text alone", "material", id, "err", err)
		default:
			rows, err := s.vectors(ctx, id)
			if err != nil {
				return nil, err
			}
			vec = library.RankByVector(q[0], rows, library.SearchDepth)
		}
	}
	return library.RRFMerge(fts, vec, k), nil
}

// searchWords ranks pages by full-text match, best first, running the match
// expressions from most to least exact, each confined to the material.
func (s *Service) searchWords(ctx context.Context, id, query string, limit int) ([]int, error) {
	out := []int{}
	mat := library.FTSWords(id)
	if mat == "" {
		return out, nil
	}
	seen := map[int]bool{}
	for _, m := range library.FTSMatches(query) {
		if len(out) >= limit {
			break
		}
		rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT number FROM pages_fts WHERE pages_fts MATCH ? ORDER BY bm25(pages_fts, 0.0, 0.0, 1.0) LIMIT ?`,
			`material_id : `+mat+` AND text : (`+m+`)`, limit)
		if err != nil {
			return nil, errs.Database.Wrap(err)
		}
		for rows.Next() {
			var n int
			if err := rows.Scan(&n); err != nil {
				cleanup.Close(rows)
				return nil, errs.Database.Wrap(err)
			}
			if !seen[n] {
				seen[n] = true
				out = append(out, n)
			}
		}
		err = rows.Err()
		cleanup.Close(rows)
		if err != nil {
			return nil, errs.Database.Wrap(err)
		}
	}
	return out, nil
}

// vectors is a material's vectors in the embedder's space, for pages with
// text: a blank page's vector describes nothing and crowds out real hits.
func (s *Service) vectors(ctx context.Context, id string) ([]library.VectorRow, error) {
	rows, err := s.c.Store.DB.QueryContext(ctx, `SELECT e.number, e.vector FROM embeddings e
		JOIN pages p ON p.material_id = e.material_id AND p.number = e.number
		WHERE e.material_id = ? AND e.model = ? AND p.status = 'text'`, id, s.c.EmbedModel)
	if err != nil {
		return nil, errs.Database.Wrap(err)
	}
	defer cleanup.Close(rows)
	var out []library.VectorRow
	for rows.Next() {
		var r library.VectorRow
		var blob []byte
		if err := rows.Scan(&r.Number, &blob); err != nil {
			return nil, errs.Database.Wrap(err)
		}
		r.Vector = library.DecodeVector(blob)
		out = append(out, r)
	}
	return out, errs.Database.Of(rows.Err())
}
