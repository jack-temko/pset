package ocr

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

var ErrNotInstalled = errors.New("OCR utility not on PATH")

// DefaultDPI is the rasterization resolution; 300 is the OCR sweet spot
// between accuracy and speed.
const DefaultDPI = 300

// Page rasterizes page n of pdfPath and OCRs it to text with tesseract.
func Page(ctx context.Context, pdfPath string, n int, lang string) (string, error) {
	dir, err := os.MkdirTemp("", "pset-ocr-*")
	if err != nil {
		return "", fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(dir)

	prefix := filepath.Join(dir, "page")
	cmd := exec.CommandContext(ctx, "pdftoppm",
		"-f", strconv.Itoa(n), "-l", strconv.Itoa(n),
		"-r", strconv.Itoa(DefaultDPI), "-png", pdfPath, prefix)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("rasterize page %d: %w: %s", n, err, strings.TrimSpace(stderr.String()))
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", fmt.Errorf("read rasterized page: %w", err)
	}
	var img string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".png") {
			img = filepath.Join(dir, entry.Name())
			break
		}
	}
	if img == "" {
		return "", fmt.Errorf("rasterize page %d: pdftoppm produced no image", n)
	}

	text, err := run(ctx, "tesseract", img, "stdout", "-l", lang)
	if err != nil {
		return "", fmt.Errorf("tesseract page %d: %w", n, err)
	}
	return text, nil
}

func run(ctx context.Context, name string, args ...string) (string, error) {
	if _, err := exec.LookPath(name); err != nil {
		return "", fmt.Errorf("%w: %s", ErrNotInstalled, name)
	}
	var stdout, stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			return "", fmt.Errorf("run %s %s: %w", name, strings.Join(args, " "), err)
		}
		return "", fmt.Errorf("run %s %s: %w: %s", name, strings.Join(args, " "), err, msg)
	}
	return stdout.String(), nil
}
