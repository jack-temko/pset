package homework

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackt/pset/internal/httpx"
	"github.com/jackt/pset/internal/pdf"
)

// cropWidth is the render a crop is cut from: sharp in print, and a
// figure still reads at the size the walkthrough shows it.
const cropWidth = 1800

// modelCropWidth is the render a figure the model reads is cut from.
// Wider than print: at 1800 the 2 A source in Fig. 4.93 (4.25) came out
// as pointing left eleven times in eleven, and at 2400 right every time.
// A circuit's arrows and signs are a few pixels, and the model reads them
// only when there are enough.
const modelCropWidth = 2400

// crop renders a page at width and cuts a rect out of it. The rect gets a
// little room, then each edge snaps to the nearest whitespace: a model's
// boxes drift, and an unsnapped edge slices a neighbouring line
// mid-glyph.
func (s *Service) crop(ctx context.Context, bookID string, page int, r pdf.Rect, width int) ([]byte, error) {
	img, err := s.c.Library.PageJPEG(ctx, bookID, page, width)
	if err != nil {
		return nil, err
	}
	return pdf.CropJPEG(img, pdf.SnapRect(img, padRect(r)))
}

// padRect grows a rect, more at the sides than above and below: captions
// start left of a figure and drawings overrun their box, while the lines
// above and below belong to other problems.
func padRect(r pdf.Rect) pdf.Rect {
	const padX, padTop, padBot = 0.03, 0.005, 0.015
	x := math.Max(0, r.X-padX)
	y := math.Max(0, r.Y-padTop)
	return pdf.Rect{X: x, Y: y, W: math.Min(1-x, r.W+2*padX), H: math.Min(1-y, r.H+padTop+padBot)}
}

// Figure is one of a question's figures as a JPEG.
func (s *Service) Figure(ctx context.Context, questionID string, n int) ([]byte, error) {
	q, err := getQuestion(ctx, s.c.DB, questionID)
	if errors.Is(err, errNotFound) {
		return nil, httpx.NotFound("question")
	}
	if err != nil {
		return nil, err
	}
	if q.Page == nil || n < 0 || n >= len(q.FigRect) {
		return nil, httpx.NotFound("figure")
	}
	return s.crop(ctx, q.BookID, *q.Page, q.FigRect[n].Rect, cropWidth)
}

// Sheet geometry in points: Letter, with ¾-inch margins.
const (
	sheetW       = 612.0
	sheetH       = 792.0
	margin       = 54.0
	contentW     = sheetW - 2*margin
	minWorkSpace = 180.0 // blank space kept under every question
	figureH      = 130.0
	figureGap    = 12.0
)

// Worksheet is the set as a PDF to print: each question's statement and
// figures, one to a sheet, with room to work. Nothing revealed: no hints,
// no walkthroughs.
func (s *Service) Worksheet(ctx context.Context, homeworkID string) ([]byte, error) {
	d, err := s.Get(ctx, homeworkID)
	if err != nil {
		return nil, err
	}
	if len(d.Questions) == 0 {
		return nil, httpx.Errorf(httpx.CodeInvalid, "Add a question before printing the worksheet.")
	}
	book, err := s.c.Library.Book(ctx, d.Homework.BookID)
	if err != nil {
		return nil, err
	}
	doc := pdf.NewSheetDoc()
	for i, q := range d.Questions {
		sheet := doc.AddSheet()
		y := margin
		if i == 0 {
			y = header(sheet, d.Homework, len(d.Questions))
		}
		r, err := getQuestion(ctx, s.c.DB, q.ID)
		if err != nil {
			return nil, err
		}
		if err := s.questionBlock(ctx, sheet, book, r, y); err != nil {
			return nil, err
		}
		footer(sheet, i+1, len(d.Questions))
	}
	return doc.Bytes()
}

func header(sheet *pdf.Sheet, h Summary, n int) float64 {
	y := margin
	sheet.Text(margin, y, 15, true, 0, h.Title)
	y += 24
	meta := plural(n, "question")
	if h.DueDate != "" {
		if t, err := time.Parse("2006-01-02", h.DueDate); err == nil {
			meta = "Due " + t.Format("Monday, January 2") + " · " + meta
		}
	}
	sheet.Text(margin, y, 9, false, 0.45, meta)
	y += 16
	sheet.Rule(margin, y, contentW, 0.7, 0.78)
	return y + 16
}

func plural(n int, word string) string {
	if n == 1 {
		return "1 " + word
	}
	return fmt.Sprintf("%d %ss", n, word)
}

// questionBlock draws one question: its label and page, then the crop of
// its statement from the book (or its own text, for one that isn't in
// the book), then its figures, all scaled to leave room to work.
func (s *Service) questionBlock(ctx context.Context, sheet *pdf.Sheet, book Book, q row, y float64) error {
	head := fmt.Sprintf("%d.  %s", q.Position, q.Label)
	sheet.Text(margin, y, 11, true, 0, head)
	if q.Page != nil {
		sheet.Text(sheetW-margin-60, y+1.5, 8, false, 0.45, book.Pages.Name(*q.Page))
	}
	y += 20

	if q.Page == nil || q.Rect == nil {
		wrap(sheet, y, 10.5, plainMath(q.Statement))
		return nil
	}
	figs := q.FigRect
	figBlock := 0.0
	if len(figs) > 0 {
		figBlock = figureH + figureGap
	}
	img, err := s.crop(ctx, q.BookID, *q.Page, *q.Rect, cropWidth)
	if err != nil {
		return err
	}
	room := math.Max(sheetH-margin-y-minWorkSpace-figBlock, 60)
	used, err := sheet.ImageFit(margin, y, contentW, room, img)
	if err != nil {
		return err
	}
	y += used + 10
	if len(figs) == 0 {
		return nil
	}
	w := (contentW - figureGap*float64(len(figs)-1)) / float64(len(figs))
	x := margin
	for _, f := range figs {
		img, err := s.crop(ctx, q.BookID, *q.Page, f.Rect, cropWidth)
		if err != nil {
			return err
		}
		if _, err := sheet.ImageFit(x, y, w, figureH, img); err != nil {
			return err
		}
		x += w + figureGap
	}
	return nil
}

// plainMath prints a statement's math as it's written, without the $
// signs: the sheet has no TeX, and "x^2" reads better than "$x^2$".
func plainMath(s string) string { return strings.ReplaceAll(s, "$", "") }

// wrap lays a paragraph out at about half the font size per character.
func wrap(sheet *pdf.Sheet, y, size float64, text string) float64 {
	maxChars := int(contentW / (size * 0.5))
	for _, para := range strings.Split(text, "\n") {
		line := ""
		for _, w := range strings.Fields(para) {
			if line != "" && len(line)+1+len(w) > maxChars {
				sheet.Text(margin, y, size, false, 0, line)
				y += size * 1.4
				line = ""
			}
			if line != "" {
				line += " "
			}
			line += w
		}
		if line != "" {
			sheet.Text(margin, y, size, false, 0, line)
			y += size * 1.4
		}
		y += size * 0.4
	}
	return y
}

func footer(sheet *pdf.Sheet, n, total int) {
	y := sheetH - margin + 12
	sheet.Text(margin, y, 7, false, 0.55, "P S E T")
	sheet.Text(sheetW-margin-20, y, 8, false, 0.55, fmt.Sprintf("%d / %d", n, total))
}
