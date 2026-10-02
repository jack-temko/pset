package ocr

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/jackt/pset/internal/execx"
	"github.com/jackt/pset/internal/pdf"
)

// ErrNotInstalled is wrapped by the error of a missing tesseract or
// pdftoppm.
var ErrNotInstalled = execx.ErrNotInstalled

// DefaultDPI is the rasterization resolution; 300 is the OCR sweet spot
// between accuracy and speed.
const DefaultDPI = 300

// Page rasterizes page n of pdfPath and OCRs it to text with tesseract.
func Page(ctx context.Context, pdfPath string, n int, lang string) (string, error) {
	img, err := pdf.PagePNG(ctx, pdfPath, n, DefaultDPI)
	if err != nil {
		return "", err
	}
	dir, err := os.MkdirTemp("", "pset-ocr-*")
	if err != nil {
		return "", fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "page.png")
	if err := os.WriteFile(path, img, 0o600); err != nil {
		return "", fmt.Errorf("write rasterized page: %w", err)
	}
	text, err := execx.Run(ctx, "tesseract", path, "stdout", "-l", lang)
	if err != nil {
		return "", fmt.Errorf("tesseract page %d: %w", n, err)
	}
	return text, nil
}
