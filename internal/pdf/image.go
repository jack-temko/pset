package pdf

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/execx"
)

// PageImage rasterizes page n (1-based) of pdfPath to JPEG bytes at the
// given DPI, for looking at.
func PageImage(ctx context.Context, pdfPath string, n int, dpi int) ([]byte, error) {
	return rasterize(ctx, pdfPath, n, dpi, "jpg", "-jpeg", "-jpegopt", "quality=85")
}

// PagePNG rasterizes page n (1-based) of pdfPath to PNG bytes at the given
// DPI: lossless, for reading text off a scan.
func PagePNG(ctx context.Context, pdfPath string, n int, dpi int) ([]byte, error) {
	return rasterize(ctx, pdfPath, n, dpi, "png", "-png")
}

// rasterize runs a single-page pdftoppm into a temp directory and returns
// the one file it wrote, of extension ext.
func rasterize(ctx context.Context, pdfPath string, n, dpi int, ext string, format ...string) ([]byte, error) {
	dir, err := os.MkdirTemp("", "pset-page-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer cleanup.RemoveAll(dir)

	args := append([]string{"-f", strconv.Itoa(n), "-l", strconv.Itoa(n), "-r", strconv.Itoa(dpi)}, format...)
	if _, err := execx.Run(ctx, "pdftoppm", append(args, pdfPath, filepath.Join(dir, "page"))...); err != nil {
		return nil, fmt.Errorf("rasterize page %d: %w", n, err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read rasterized page: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), "."+ext) {
			return os.ReadFile(filepath.Join(dir, entry.Name()))
		}
	}
	return nil, fmt.Errorf("rasterize page %d: pdftoppm produced no image", n)
}
