package engine

import (
	"context"
	"math"
	"sort"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
)

// rrfK is the reciprocal-rank-fusion smoothing constant.
const rrfK = 60

// topKPages is how many pages an ask retrieves as context.
const topKPages = 6

// searchDepth is how deep each ranking list feeds the fusion.
const searchDepth = 20

// rrfMerge fuses two page-number rankings (each best-first, either may be
// empty) with reciprocal-rank fusion: score(page) = Σ 1/(rrfK + rank) over
// the lists containing it. Returns the top k page numbers, best first; equal
// scores order by page number ascending, so the result is deterministic.
func rrfMerge(ftsRanks, vecRanks []int, k int) []int {
	scores := map[int]float64{}
	add := func(ranks []int) {
		for i, page := range ranks {
			scores[page] += 1.0 / float64(rrfK+i+1)
		}
	}
	add(ftsRanks)
	add(vecRanks)

	pages := make([]int, 0, len(scores))
	for page := range scores {
		pages = append(pages, page)
	}
	sort.Slice(pages, func(i, j int) bool {
		if scores[pages[i]] != scores[pages[j]] {
			return scores[pages[i]] > scores[pages[j]]
		}
		return pages[i] < pages[j]
	})
	if len(pages) > k {
		pages = pages[:k]
	}
	return pages
}

// searchPages is the one fused retrieval entry: FTS and vector ranks merged
// by reciprocal rank, best pages first. Callers are the ask flow, the
// search_book tool, and anything that wants "the pages about X" without the
// locate ladder's exact tiers. The vector half stays empty when embeddings
// are unconfigured — a tool may degrade to text search; the ask flow
// refuses earlier instead.
func (e *Engine) searchPages(ctx context.Context, s *store.Store, book *store.Book, client *llm.Client, embedModel, query string, limit int) ([]int, error) {
	ftsRanks, err := s.SearchFTS(ctx, book.ID, query, searchDepth)
	if err != nil {
		return nil, userf(err, "could not search %q", book.Title)
	}
	var vecRanks []int
	if client.EmbedConfigured() {
		if vecRanks, err = e.vectorSearch(ctx, s, book.ID, client, query, embedModel); err != nil {
			return nil, llmFail(err)
		}
	}
	return rrfMerge(ftsRanks, vecRanks, limit), nil
}

// cosine similarity of two vectors; 0 for mismatched or empty inputs.
func cosine(a, b []float32) float64 {
	if len(a) == 0 || len(a) != len(b) {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
		na += float64(a[i]) * float64(a[i])
		nb += float64(b[i]) * float64(b[i])
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / math.Sqrt(na*nb)
}

// vectorSearch ranks a book's stored pages by cosine similarity to the
// question embedding, best page first. model selects which embedding space
// is compared. Pages with no stored text never rank: short queries embed
// close to the empty string, which lets blank art pages crowd out real
// content.
func (e *Engine) vectorSearch(ctx context.Context, s *store.Store, bookID string, client *llm.Client, question string, model string) ([]int, error) {
	vectors, err := client.Embed(ctx, []string{question})
	if err != nil {
		return nil, err
	}
	questionVec := vectors[0]

	textless, err := s.TextlessPages(ctx, bookID)
	if err != nil {
		return nil, err
	}
	embeddings, err := s.Embeddings(ctx, bookID, model)
	if err != nil {
		return nil, err
	}
	type scored struct {
		page  int
		score float64
	}
	pages := make([]scored, 0, len(embeddings))
	for _, emb := range embeddings {
		if textless[emb.PageNumber] {
			continue
		}
		pages = append(pages, scored{emb.PageNumber, cosine(questionVec, emb.Vector)})
	}
	sort.Slice(pages, func(i, j int) bool {
		if pages[i].score != pages[j].score {
			return pages[i].score > pages[j].score
		}
		return pages[i].page < pages[j].page
	})
	out := make([]int, 0, len(pages))
	for _, p := range pages {
		out = append(out, p.page)
	}
	if len(out) > searchDepth {
		out = out[:searchDepth]
	}
	return out, nil
}
