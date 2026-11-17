package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

// Everything the generator emits is pinned: fixed dates, a seeded rand, no
// map-order iteration, no time.Now — repeated runs must be byte-identical.
var pinnedDate = time.Date(2026, 1, 15, 8, 0, 0, 0, time.UTC)

type Fact struct {
	ID   string `json:"id"`
	Text string `json:"text"`
	Page int    `json:"page"`
}

// Heading records one structural entry: a PDF bookmark (digital book) or a
// planted oversized heading (flat book). Level is 1-based, matching what the
// engine stores in the sections table.
type Heading struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Page  int    `json:"page"`
	Level int    `json:"level"`
}

// BookManifest describes one generated sample PDF. Title/Author/Subject are
// set only for the digital book (a fake scan carries no document metadata).
type BookManifest struct {
	File     string    `json:"file"`
	SHA256   string    `json:"sha256"`
	Pages    int       `json:"pages"`
	Title    string    `json:"title,omitempty"`
	Author   string    `json:"author,omitempty"`
	Subject  string    `json:"subject,omitempty"`
	Facts    []Fact    `json:"facts"`
	Outline  []Heading `json:"outline,omitempty"`
	Headings []Heading `json:"headings,omitempty"`
}

type Manifest struct {
	Digital BookManifest `json:"digital"`
	Scanned BookManifest `json:"scanned"`
	Flat    BookManifest `json:"flat"`
}

// Generate writes sample-digital.pdf, sample-scanned.pdf, sample-flat.pdf,
// then manifest.json (last, so it records the hashes of the files just
// written) into outDir, which is created if missing.
func Generate(outDir string) (*Manifest, error) {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return nil, fmt.Errorf("create out dir %s: %w", outDir, err)
	}

	digital, err := writeDigitalBook(outDir)
	if err != nil {
		return nil, err
	}
	scanned, err := writeScannedBook(outDir)
	if err != nil {
		return nil, err
	}
	flat, err := writeFlatBook(outDir)
	if err != nil {
		return nil, err
	}

	m := &Manifest{Digital: digital, Scanned: scanned, Flat: flat}
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("encode manifest: %w", err)
	}
	data = append(data, '\n')
	if err := os.WriteFile(filepath.Join(outDir, "manifest.json"), data, 0o644); err != nil {
		return nil, fmt.Errorf("write manifest.json: %w", err)
	}
	return m, nil
}

func writeDigitalBook(dir string) (BookManifest, error) {
	spec := digitalSpec
	buf := new(bytes.Buffer)
	if err := newDigitalPDF(spec).Output(buf); err != nil {
		return BookManifest{}, fmt.Errorf("render digital pdf: %w", err)
	}
	m := BookManifest{
		File:    "sample-digital.pdf",
		Pages:   2 + len(spec.chapters),
		Title:   spec.title,
		Author:  spec.author,
		Subject: spec.subject,
		Facts:   digitalFacts(spec),
		Outline: digitalOutlineFacts(),
	}
	return writeBook(dir, m, buf.Bytes())
}

func writeScannedBook(dir string) (BookManifest, error) {
	spec := scannedSpec
	ts, pages, err := scannedPages(spec)
	if err != nil {
		return BookManifest{}, err
	}
	jpegs := make([][]byte, 0, len(pages))
	for i, page := range pages {
		jpeg, err := renderScanJPEG(page, ts, rand.New(rand.NewSource(int64(scanRandSeed+i))))
		if err != nil {
			return BookManifest{}, fmt.Errorf("rasterise scanned page %d: %w", i+1, err)
		}
		jpegs = append(jpegs, jpeg)
	}
	m := BookManifest{
		File:  "sample-scanned.pdf",
		Pages: 2 + len(spec.chapters),
		Facts: scannedFacts(spec),
	}
	return writeBook(dir, m, buildScannedPDF(jpegs))
}

func writeBook(dir string, m BookManifest, data []byte) (BookManifest, error) {
	path := filepath.Join(dir, m.File)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return BookManifest{}, fmt.Errorf("write %s: %w", m.File, err)
	}
	sum := sha256.Sum256(data)
	m.SHA256 = hex.EncodeToString(sum[:])
	return m, nil
}

// ---- digital book: real text layer via fpdf core fonts ----

func newDigitalPDF(spec digitalSpecT) *fpdf.Fpdf {
	f := fpdf.New("P", "pt", "A4", "")
	f.SetCatalogSort(true)
	f.SetCompression(false)
	f.SetMargins(64, 60, 64)
	f.SetAutoPageBreak(true, 56)
	f.SetTitle(spec.title, false)
	f.SetAuthor(spec.author, false)
	f.SetSubject(spec.subject, false)
	f.SetCreator("pset samplegen", false)
	f.SetCreationDate(pinnedDate)
	f.SetModificationDate(pinnedDate)
	f.SetFooterFunc(func() {
		f.SetY(-40)
		f.SetFont("Helvetica", "", 9)
		f.CellFormat(0, 12, fmt.Sprintf("Page %d", f.PageNo()), "", 0, "C", false, 0, "")
	})

	f.AddPage()
	f.SetY(230)
	f.SetFont("Helvetica", "B", 26)
	f.CellFormat(0, 34, spec.title, "", 1, "C", false, 0, "")
	f.SetFont("Helvetica", "I", 13)
	f.CellFormat(0, 22, spec.subtitle, "", 1, "C", false, 0, "")
	f.Ln(28)
	f.SetFont("Helvetica", "", 12)
	f.CellFormat(0, 18, spec.author, "", 1, "C", false, 0, "")

	f.AddPage()
	f.SetFont("Helvetica", "B", 18)
	f.CellFormat(0, 26, "Contents", "", 1, "L", false, 0, "")
	f.Ln(10)
	f.SetFont("Helvetica", "", 11)
	for i, ch := range spec.chapters {
		f.CellFormat(0, 18,
			fmt.Sprintf("%d. %s  ........  %d", i+1, ch.title, chapterPage(i)),
			"", 1, "L", false, 0, "")
	}

	for i, ch := range spec.chapters {
		f.AddPage()
		f.SetFont("Helvetica", "B", 15)
		f.CellFormat(0, 22, fmt.Sprintf("Chapter %d. %s", i+1, ch.title), "", 1, "L", false, 0, "")
		f.Ln(8)
		f.SetFont("Helvetica", "", 11)
		for _, p := range ch.paras {
			f.MultiCell(0, 16, p.text, "", "L", false)
			f.Ln(6)
		}
		for _, en := range digitalOutline {
			if en.chapter == i {
				f.Bookmark(en.title, en.level, 0)
			}
		}
	}
	return f
}

// ---- flat book: real text layer, no bookmarks, planted oversized headings ----

// flatBodyPt and flatHeadingPt are the only two font sizes in the book; the
// heading is far enough above the body for the engine's 1.25x median rule,
// and no other line in the book can be mistaken for a heading.
const (
	flatBodyPt    = 11
	flatHeadingPt = 16
)

func writeFlatBook(dir string) (BookManifest, error) {
	spec := flatSpec
	buf := new(bytes.Buffer)
	if err := newFlatPDF(spec).Output(buf); err != nil {
		return BookManifest{}, fmt.Errorf("render flat pdf: %w", err)
	}
	m := BookManifest{
		File:     "sample-flat.pdf",
		Pages:    len(spec.pages),
		Title:    spec.title,
		Author:   spec.author,
		Facts:    flatFacts(spec),
		Headings: flatHeadings(spec),
	}
	return writeBook(dir, m, buf.Bytes())
}

func newFlatPDF(spec flatSpecT) *fpdf.Fpdf {
	f := fpdf.New("P", "pt", "A4", "")
	f.SetCatalogSort(true)
	f.SetCompression(false)
	f.SetMargins(64, 60, 64)
	f.SetAutoPageBreak(true, 56)
	f.SetTitle(spec.title, false)
	f.SetAuthor(spec.author, false)
	f.SetCreator("pset samplegen", false)
	f.SetCreationDate(pinnedDate)
	f.SetModificationDate(pinnedDate)

	for _, page := range spec.pages {
		f.AddPage()
		f.SetFont("Helvetica", "", flatBodyPt)
		if page.heading != "" {
			f.SetFont("Helvetica", "B", flatHeadingPt)
			f.CellFormat(0, 24, page.heading, "", 1, "L", false, 0, "")
			f.Ln(10)
			f.SetFont("Helvetica", "", flatBodyPt)
		}
		for _, p := range page.paras {
			f.MultiCell(0, 16, p.text, "", "L", false)
			f.Ln(6)
		}
	}
	return f
}

// ---- scanned book: pages rasterised to one full-page JPEG each, so the PDF
// contains no text operators at all ----

const (
	scanW, scanH = 850, 1100 // rendered page pixels
	scanMarginX  = 90
	scanJPEG     = 58 // quality: readable text, small files
	scanRandSeed = 20260115
	paperGray    = 242
	textGray     = 60

	titleSizePx    = 40
	subtitleSizePx = 24
	authorSizePx   = 22
	headingSizePx  = 28
	tocSizePx      = 22
	bodySizePx     = 20
	bodyLineStep   = 32
	footerSizePx   = 16
)

// scanPage is one rasterised page: text lines with baseline origins, plus the
// footer page number (also rasterised — a scan has no text layer).
type scanPage struct {
	lines []scanLine
}

type scanLine struct {
	text string
	x, y int // baseline origin
	size float64
}

type typeSetter struct {
	faces map[float64]font.Face
}

func newTypeSetter() (*typeSetter, error) {
	ttf, err := opentype.Parse(goregular.TTF)
	if err != nil {
		return nil, fmt.Errorf("parse embedded font: %w", err)
	}
	ts := &typeSetter{faces: map[float64]font.Face{}}
	for _, size := range []float64{
		titleSizePx, subtitleSizePx, authorSizePx,
		headingSizePx, tocSizePx, bodySizePx, footerSizePx,
	} {
		ts.faces[size] = mustFace(ttf, size)
	}
	return ts, nil
}

func mustFace(ttf *opentype.Font, size float64) font.Face {
	f, err := opentype.NewFace(ttf, &opentype.FaceOptions{
		Size: size, DPI: 72, Hinting: font.HintingFull})
	if err != nil {
		panic(err) // sizes are constants; failure is a programming error
	}
	return f
}

func (ts *typeSetter) face(size float64) font.Face { return ts.faces[size] }

func (ts *typeSetter) width(text string, size float64) int {
	return font.MeasureString(ts.face(size), text).Ceil()
}

// (ts *typeSetter) centered appends a horizontally centered line.
func (ts *typeSetter) centered(p *scanPage, text string, y int, size float64) {
	p.lines = append(p.lines, scanLine{
		text: text, x: (scanW - ts.width(text, size)) / 2, y: y, size: size})
}

func (ts *typeSetter) footer(p *scanPage, page string) {
	p.lines = append(p.lines, scanLine{
		text: page, x: (scanW - ts.width(page, footerSizePx)) / 2,
		y: scanH - 56, size: footerSizePx})
}

// scannedPages lays out every page of the scanned book, in physical order:
// page 1 title, page 2 contents, then one page per chapter.
func scannedPages(spec scannedSpecT) (*typeSetter, []scanPage, error) {
	ts, err := newTypeSetter()
	if err != nil {
		return nil, nil, err
	}

	var pages []scanPage

	title := scanPage{}
	ts.centered(&title, spec.title, 340, titleSizePx)
	ts.centered(&title, spec.subtitle, 410, subtitleSizePx)
	ts.centered(&title, spec.author, 560, authorSizePx)
	ts.centered(&title, "Primer Series, Volume 2", 620, footerSizePx)
	ts.footer(&title, "1")
	pages = append(pages, title)

	contents := scanPage{}
	contents.lines = append(contents.lines, scanLine{
		text: "Contents", x: scanMarginX, y: 150, size: headingSizePx})
	for i, ch := range spec.chapters {
		y := 230 + i*56
		num := fmt.Sprintf("%d", chapterPage(i))
		contents.lines = append(contents.lines, scanLine{
			text: fmt.Sprintf("%d. %s", i+1, ch.title), x: scanMarginX, y: y, size: tocSizePx})
		contents.lines = append(contents.lines, scanLine{
			text: num, x: scanW - scanMarginX - ts.width(num, tocSizePx), y: y, size: tocSizePx})
	}
	ts.footer(&contents, "2")
	pages = append(pages, contents)

	for i, ch := range spec.chapters {
		page := scanPage{}
		page.lines = append(page.lines, scanLine{
			text: fmt.Sprintf("Chapter %d. %s", i+1, ch.title),
			x:    scanMarginX, y: 150, size: headingSizePx})
		y := 210
		for _, para := range ch.paras {
			for _, line := range ts.wrap(para.text, scanW-2*scanMarginX, bodySizePx) {
				page.lines = append(page.lines, scanLine{
					text: line, x: scanMarginX, y: y, size: bodySizePx})
				y += bodyLineStep
			}
			y += 10
		}
		ts.footer(&page, fmt.Sprintf("%d", chapterPage(i)))
		pages = append(pages, page)
	}
	return ts, pages, nil
}

// wrap breaks text into drawn lines no wider than maxWidth pixels.
func (ts *typeSetter) wrap(text string, maxWidth int, size float64) []string {
	words := strings.Fields(text)
	var out []string
	line := ""
	for _, w := range words {
		candidate := w
		if line != "" {
			candidate = line + " " + w
		}
		if ts.width(candidate, size) <= maxWidth {
			line = candidate
			continue
		}
		if line != "" {
			out = append(out, line)
		}
		line = w
	}
	if line != "" {
		out = append(out, line)
	}
	return out
}

// renderScanJPEG draws the page onto a fake scan — off-white paper with a
// smooth illumination gradient, per-line horizontal jitter, and mild
// per-pixel noise — then encodes it as JPEG. Deterministic for a given seed.
func renderScanJPEG(page scanPage, ts *typeSetter, rng *rand.Rand) ([]byte, error) {
	img := image.NewGray(image.Rect(0, 0, scanW, scanH))
	fillIllumination(img)

	for _, ln := range page.lines {
		if ln.text == "" {
			continue
		}
		d := &font.Drawer{
			Dst:  img,
			Src:  image.NewUniform(color.Gray{Y: textGray}),
			Face: ts.face(ln.size),
		}
		jitter := rng.Intn(5) - 2
		d.Dot = fixed.P(ln.x+jitter, ln.y)
		d.DrawString(ln.text)
	}

	applyNoise(img, rng)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: scanJPEG}); err != nil {
		return nil, fmt.Errorf("encode page jpeg: %w", err)
	}
	return buf.Bytes(), nil
}

// fillIllumination paints the paper with a smooth, deterministic gradient:
// darker toward the edges, slightly brighter toward the top-left.
func fillIllumination(img *image.Gray) {
	b := img.Bounds()
	cx, cy := float64(b.Dx())/2, float64(b.Dy())/2
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			dx := (float64(x) - cx + 0.5) / cx
			dy := (float64(y) - cy + 0.5) / cy
			m := 1 - 0.055*(dx*dx+dy*dy) - 0.02*(dx-dy)
			img.SetGray(x, y, color.Gray{Y: uint8(clamp8(int(float64(paperGray)*m + 0.5)))})
		}
	}
}

func applyNoise(img *image.Gray, rng *rand.Rand) {
	b := img.Bounds()
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			i := img.PixOffset(x, y)
			img.Pix[i] = uint8(clamp8(int(img.Pix[i]) + rng.Intn(7) - 3))
		}
	}
}

func clamp8(v int) int {
	if v < 0 {
		return 0
	}
	if v > 255 {
		return 255
	}
	return v
}
