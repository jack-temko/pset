package pdf

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"os/exec"
	"strings"
	"testing"
)

func testJPEG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x * 255 / w), uint8(y * 255 / h), 128, 255})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 85}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestSheetDocDeterministic(t *testing.T) {
	build := func() []byte {
		d := NewSheetDoc()
		s := d.AddSheet()
		s.Text(54, 60, 15, true, 0, "Problem Set 4 — “quotes” (parens) 100%")
		s.Text(54, 90, 9, false, 0.4, "Due Oct 3 · 2 questions ✓→?")
		s.Rule(54, 105, 504, 0.7, 0.75)
		if _, err := s.ImageFit(54, 130, 300, 200, testJPEG(t, 400, 200)); err != nil {
			t.Fatal(err)
		}
		d.AddSheet().Text(54, 60, 11, true, 0, "Q2 on the second sheet")
		return mustBytes(t, d)
	}
	a, b := build(), build()
	if !bytes.Equal(a, b) {
		t.Fatal("two builds of the same document differ — output must be deterministic")
	}
	for _, want := range []string{"%PDF-1.4", "/Type /Catalog", "/Type /Pages", "/Filter /DCTDecode", "/WinAnsiEncoding", "startxref", "%%EOF"} {
		if !bytes.Contains(a, []byte(want)) {
			t.Errorf("output lacks %q", want)
		}
	}
}

func mustBytes(t *testing.T, d *SheetDoc) []byte {
	t.Helper()
	data, err := d.Bytes()
	if err != nil {
		t.Fatal(err)
	}
	return data
}

// pdftotext extracts the text layer of in-memory PDF bytes.
func pdftotext(t *testing.T, data []byte) (string, error) {
	t.Helper()
	out := new(bytes.Buffer)
	cmd := exec.Command("pdftotext", "-layout", "-", "-")
	cmd.Stdin = bytes.NewReader(data)
	cmd.Stdout = out
	cmd.Stderr = new(bytes.Buffer)
	if err := cmd.Run(); err != nil {
		return "", err
	}
	return out.String(), nil
}

func TestCropJPEG(t *testing.T) {
	src := testJPEG(t, 200, 100)
	crop, err := CropJPEG(src, Rect{X: 0.25, Y: 0.5, W: 0.5, H: 0.5})
	if err != nil {
		t.Fatal(err)
	}
	cfg, err := jpeg.DecodeConfig(bytes.NewReader(crop))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Width != 100 || cfg.Height != 50 {
		t.Fatalf("crop = %dx%d, want 100x50", cfg.Width, cfg.Height)
	}
	if _, err := CropJPEG(src, Rect{X: 0.5, Y: 0, W: 0.9, H: 0.5}); err == nil {
		t.Error("out-of-bounds rect accepted")
	}
}

func TestSheetDocOpensInPoppler(t *testing.T) {
	if _, err := exec.LookPath("pdftotext"); err != nil {
		t.Skip("pdftotext not installed")
	}
	d := NewSheetDoc()
	s := d.AddSheet()
	s.Text(54, 60, 15, true, 0, "Problem Set 4 — random walks")
	s.Text(54, 90, 9, false, 0.4, "Due Oct 3 · 2 questions")
	s.Rule(54, 105, 504, 0.7, 0.75)
	if _, err := s.ImageFit(54, 130, 300, 200, testJPEG(t, 320, 160)); err != nil {
		t.Fatal(err)
	}
	data := mustBytes(t, d)

	out, err := pdftotext(t, data)
	if err != nil {
		t.Fatalf("pdftotext: %v", err)
	}
	for _, want := range []string{"Problem Set 4", "random walks", "Due Oct 3"} {
		if !strings.Contains(out, want) {
			t.Errorf("extracted text lacks %q:\n%s", want, out)
		}
	}
}
