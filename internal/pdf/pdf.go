package pdf

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

var ErrNotInstalled = errors.New("poppler utility not on PATH")

type Info struct {
	Title      string
	Author     string
	Subject    string
	PageCount  int
	PageWidth  float64
	PageHeight float64
	PDFVersion string
}

// Available reports whether every poppler utility the pipeline needs is on PATH.
func Available() error {
	for _, tool := range []string{"pdfinfo", "pdftotext"} {
		if _, err := exec.LookPath(tool); err != nil {
			return fmt.Errorf("%w: %s", ErrNotInstalled, tool)
		}
	}
	return nil
}

// Metadata runs `pdfinfo <path>` and parses its stdout. Document metadata
// (including the "PDF version:" line) goes to stdout; only `pdfinfo -v`, the
// utility's own version, prints to stderr — do not confuse the two.
func Metadata(ctx context.Context, path string) (Info, error) {
	out, err := run(ctx, "pdfinfo", path)
	if err != nil {
		return Info{}, err
	}

	var m Info
	for _, line := range strings.Split(out, "\n") {
		key, value, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		key, value = strings.TrimSpace(key), strings.TrimSpace(value)
		switch key {
		case "Title":
			m.Title = value
		case "Author":
			m.Author = value
		case "Subject":
			m.Subject = value
		case "Pages":
			n, err := strconv.Atoi(value)
			if err != nil {
				return Info{}, fmt.Errorf("parse pdfinfo %q: %w", line, err)
			}
			m.PageCount = n
		case "Page size":
			w, h, err := parsePageSize(value)
			if err != nil {
				return Info{}, fmt.Errorf("parse pdfinfo %q: %w", line, err)
			}
			m.PageWidth, m.PageHeight = w, h
		case "PDF version":
			m.PDFVersion = value
		}
	}
	return m, nil
}

// Text runs `pdftotext <path> -` and returns the extracted text. A PDF with
// no text layer (a pure image scan) yields only page-break form feeds.
func Text(ctx context.Context, path string) (string, error) {
	return run(ctx, "pdftotext", path, "-")
}

func parsePageSize(value string) (float64, float64, error) {
	var w, h float64
	if _, err := fmt.Sscanf(value, "%f x %f", &w, &h); err != nil {
		return 0, 0, err
	}
	return w, h, nil
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
