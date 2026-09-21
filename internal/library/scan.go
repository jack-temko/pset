package library

import (
	"context"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"sync"
)

// Scans render on demand, per width bucket, and are cached on disk: a
// book's pages never change, so a render is kept for good. Zooming in
// asks for a bigger bucket.
var widthBuckets = []int{600, 900, 1200, 1800, 2400}

// bucket is the smallest bucket at least w wide, or the largest.
func bucket(w int) int {
	for _, b := range widthBuckets {
		if w <= b {
			return b
		}
	}
	return widthBuckets[len(widthBuckets)-1]
}

// maxRenders bounds pdftoppm processes: scrolling fast through a book asks
// for a dozen pages at once.
const maxRenders = 3

type scanCache struct {
	dir    string
	render func(ctx context.Context, path string, page, dpi int) ([]byte, error)
	sem    chan struct{}

	mu       sync.Mutex
	inflight map[string]*flight
}

type flight struct {
	done chan struct{}
	data []byte
	err  error
}

func newScanCache(dir string, render func(context.Context, string, int, int) ([]byte, error)) *scanCache {
	return &scanCache{dir: dir, render: render, sem: make(chan struct{}, maxRenders), inflight: map[string]*flight{}}
}

func (c *scanCache) get(ctx context.Context, b row, path string, page, width int) ([]byte, error) {
	if page < 1 || page > b.PageCount {
		return nil, fmt.Errorf("page %d: %w", page, errNotFound)
	}
	w := bucket(width)
	file := filepath.Join(c.dir, b.ID, strconv.Itoa(page)+"-"+strconv.Itoa(w)+".jpg")
	if data, err := os.ReadFile(file); err == nil {
		return data, nil
	}

	// One render per page and size, however many requests want it.
	c.mu.Lock()
	if f, ok := c.inflight[file]; ok {
		c.mu.Unlock()
		select {
		case <-f.done:
			return f.data, f.err
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	f := &flight{done: make(chan struct{})}
	c.inflight[file] = f
	c.mu.Unlock()

	f.data, f.err = c.renderTo(context.WithoutCancel(ctx), b, path, page, w, file)
	close(f.done)
	c.mu.Lock()
	delete(c.inflight, file)
	c.mu.Unlock()
	return f.data, f.err
}

func (c *scanCache) renderTo(ctx context.Context, b row, path string, page, w int, file string) ([]byte, error) {
	c.sem <- struct{}{}
	defer func() { <-c.sem }()
	// DPI for w pixels across a page b.Width points wide (72 points an
	// inch); Letter width when the size is unknown.
	widthPts := b.Width
	if widthPts <= 0 {
		widthPts = 612
	}
	dpi := int(math.Ceil(float64(w) / (widthPts / 72)))
	data, err := c.render(ctx, path, page, dpi)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(file), 0o700); err == nil {
		tmp := file + ".tmp"
		if os.WriteFile(tmp, data, 0o600) == nil {
			os.Rename(tmp, file)
		}
	}
	return data, nil
}

// drop forgets a removed book's renders.
func (c *scanCache) drop(bookID string) { os.RemoveAll(filepath.Join(c.dir, bookID)) }
