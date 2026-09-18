package pdf

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// PageImage rasterizes page n (1-based) of pdfPath to JPEG bytes at the
// given DPI via a single-page pdftoppm run into a temp directory.
func PageImage(ctx context.Context, pdfPath string, n int, dpi int) ([]byte, error) {
	if _, err := exec.LookPath("pdftoppm"); err != nil {
		return nil, fmt.Errorf("%w: pdftoppm", ErrNotInstalled)
	}
	dir, err := os.MkdirTemp("", "pset-page-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(dir)

	prefix := filepath.Join(dir, "page")
	cmd := exec.CommandContext(ctx, "pdftoppm",
		"-f", strconv.Itoa(n), "-l", strconv.Itoa(n),
		"-r", strconv.Itoa(dpi), "-jpeg", "-jpegopt", "quality=85", pdfPath, prefix)
	var stderr strings.Builder
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("rasterize page %d: %w: %s", n, err, strings.TrimSpace(stderr.String()))
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read rasterized page: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".jpg") {
			return os.ReadFile(filepath.Join(dir, entry.Name()))
		}
	}
	return nil, fmt.Errorf("rasterize page %d: pdftoppm produced no image", n)
}
