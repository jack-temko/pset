package engine

import (
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/jackt/pset/internal/pdf"
	"github.com/jackt/pset/internal/store"
)

// Sheet geometry in points: Letter with 54pt (¾") margins.
const (
	sheetW        = 612.0
	sheetH        = 792.0
	sheetMargin   = 54.0
	sheetContentW = sheetW - 2*sheetMargin
	// sheetMinWork keeps at least this much blank working space under a
	// question block; larger screenshots scale down to respect it.
	sheetMinWork = 144.0
	// diagramBaseH is the diagram row's designed height at figure scale
	// 100%; the scale moves this baseline.
	diagramBaseH = 130.0
	// diagramGap is the space between diagrams in a row, and the extra
	// space between wrapped diagram rows.
	diagramGap = 12.0
	// hwMaxDiagrams caps how many figures one question may print.
	hwMaxDiagrams = 3
)

// HomeworkQuestionImage renders one question's screenshot (variant
// "question") or one of its diagram crops (variant "diagram", index n) as
// JPEG bytes.
func (e *Engine) HomeworkQuestionImage(ctx context.Context, homeworkID, questionID, variant string, n int) ([]byte, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	hw, err := s.HomeworkByID(ctx, homeworkID)
	if err != nil {
		return nil, err
	}
	book, err := s.BookByID(ctx, hw.BookID)
	if err != nil {
		return nil, err
	}
	q, err := s.QuestionByID(ctx, questionID)
	if err != nil {
		return nil, err
	}
	if q.HomeworkID != homeworkID {
		return nil, store.ErrNotFound
	}

	var rect *store.HomeworkRect
	switch variant {
	case "question":
		rect = q.QuestionRect
	case "diagram":
		if n < 0 || n >= len(q.Diagrams) {
			return nil, ErrNoPage
		}
		rect = &q.Diagrams[n].Rect
	default:
		return nil, &UserError{Message: fmt.Sprintf("unknown image variant %q", variant)}
	}
	if q.Page == nil || rect == nil {
		return nil, &UserError{Message: fmt.Sprintf("question %d has no located page yet", q.Position)}
	}
	return hwCrop(ctx, book.FilePath, *q.Page, *rect)
}

// hwCrop renders one page and cuts a normalized rect out of it. The rect
// gets a hairline of breathing room, then every edge snaps to the page's
// nearest whitespace gutter: model-returned boxes drift, and an unsnapped
// edge slices a neighbouring caption line mid-glyph.
func hwCrop(ctx context.Context, pdfPath string, page int, rect store.HomeworkRect) ([]byte, error) {
	pageJPEG, err := pdf.PageImage(ctx, pdfPath, page, hwImageDPI)
	if err != nil {
		return nil, userf(err, "could not render page %d", page)
	}
	crop, err := pdf.CropJPEG(pageJPEG, pdf.SnapRect(pageJPEG, pdf.Rect(padRect(rect))))
	if err != nil {
		return nil, userf(err, "could not crop page %d", page)
	}
	return crop, nil
}

// padRect grows a rect by a small normalized margin, clamped to the page.
// The margins are asymmetric because the failure modes are: captions start
// left of a figure's box and figure drawings overrun their right edge, so
// the sides get room; a tall top margin catches the previous problem's
// caption and a tall bottom one catches the next problem's first line, so
// those stay hairline.
func padRect(r store.HomeworkRect) store.HomeworkRect {
	const (
		padX   = 0.03
		padTop = 0.005
		padBot = 0.015
	)
	x := math.Max(0, r.X-padX)
	w := math.Min(1-x, r.W+2*padX)
	y := math.Max(0, r.Y-padTop)
	h := math.Min(1-y, r.H+padTop+padBot)
	return store.HomeworkRect{X: x, Y: y, W: w, H: h}
}

// HomeworkPDF renders the downloadable template deterministically from the
// outline: a header band (title, due date, question list) shared with Q1 on
// sheet 1, one question per sheet after, working space filling each sheet.
func (e *Engine) HomeworkPDF(ctx context.Context, homeworkID string) ([]byte, error) {
	s, err := e.openStore(ctx)
	if err != nil {
		return nil, err
	}
	defer s.Close()

	hw, err := s.HomeworkByID(ctx, homeworkID)
	if err != nil {
		return nil, err
	}
	book, err := s.BookByID(ctx, hw.BookID)
	if err != nil {
		return nil, err
	}
	questions, err := s.Questions(ctx, homeworkID)
	if err != nil {
		return nil, userf(err, "could not read the questions")
	}
	if len(questions) == 0 {
		return nil, &UserError{Message: "this homework has no questions to print"}
	}
	doc := pdf.NewSheetDoc()
	for i := range questions {
		q := questions[i]
		sheet := doc.AddSheet()
		yTop := sheetMargin
		if i == 0 {
			var err error
			yTop, err = hwHeaderBand(sheet, hw, questions)
			if err != nil {
				return nil, err
			}
		}
		if err := hwQuestionBlock(ctx, sheet, e, book, hw, &q, yTop); err != nil {
			return nil, err
		}
		hwFooter(sheet, i+1, len(questions))
	}

	data, err := doc.Bytes()
	if err != nil {
		return nil, userf(err, "could not render the template PDF")
	}
	return data, nil
}

// hwHeaderBand draws the sheet-1 header and returns the y where questions
// start.
func hwHeaderBand(sheet *pdf.Sheet, hw *store.Homework, questions []store.HomeworkQuestion) (float64, error) {
	y := sheetMargin
	sheet.Text(sheetMargin, y, 15, true, 0, hw.Title)
	y += 24

	noun := "questions"
	if len(questions) == 1 {
		noun = "question"
	}
	meta := fmt.Sprintf("%d %s", len(questions), noun)
	if hw.DueDate != nil && *hw.DueDate != "" {
		meta = fmt.Sprintf("Due %s · %d %s", *hw.DueDate, len(questions), noun)
	}
	sheet.Text(sheetMargin, y, 9, false, 0.45, meta)
	y += 16

	var entries []string
	for i := range questions {
		q := &questions[i]
		e := fmt.Sprintf("Q%d", q.Position)
		if q.Page != nil {
			e += fmt.Sprintf(" p. %d", *q.Page)
		}
		entries = append(entries, e)
	}
	y = wrapEntries(sheet, y, 8.5, entries)
	y += 6
	sheet.Rule(sheetMargin, y, sheetContentW, 0.7, 0.78)
	return y + 14, nil
}

// wrapEntries lays "Q1 p. 143 · Q2 p. 144 …" out one line at a time,
// breaking only between entries so a question and its page reference never
// split across lines, and returns the new y.
func wrapEntries(sheet *pdf.Sheet, y, size float64, entries []string) float64 {
	const sep = "  ·  "
	maxChars := int(sheetContentW / (size * 0.5))
	line := ""
	flush := func() {
		sheet.Text(sheetMargin, y, size, false, 0.45, line)
		y += size * 1.35
		line = ""
	}
	for _, e := range entries {
		next := e
		if line != "" {
			if len(line)+len(sep)+len(e) > maxChars {
				flush()
			} else {
				next = line + sep + e
			}
		}
		line = next
	}
	if line != "" {
		flush()
	}
	return y
}

// wrapText lays a paragraph out at ~0.5×size average glyph width, wrapping
// to the content width, and returns the new y.
func wrapText(sheet *pdf.Sheet, y, size, gray float64, text string) float64 {
	const avgChar = 0.5
	maxChars := int(sheetContentW / (size * avgChar))
	words := strings.Fields(text)
	if len(words) == 0 {
		return y
	}
	line := words[0]
	flush := func() {
		sheet.Text(sheetMargin, y, size, false, gray, line)
		y += size * 1.35
		line = ""
	}
	for _, w := range words[1:] {
		if len(line)+1+len(w) > maxChars {
			flush()
		}
		if line != "" {
			line += " "
		}
		line += w
	}
	if line != "" {
		flush()
	}
	return y
}

// wrapSmallText is wrapText at the header band's small gray size.
func wrapSmallText(sheet *pdf.Sheet, y, size float64, text string) float64 {
	return wrapText(sheet, y, size, 0.45, text)
}

// hwQuestionBlock draws the Qn heading with its page chip, the question
// screenshot, and its diagram crops, scaled to keep working space. The
// settings' scales shrink the fit boxes themselves, so the knobs move even
// when a crop is height- or width-bound.
func hwQuestionBlock(ctx context.Context, sheet *pdf.Sheet, e *Engine, book *store.Book, hw *store.Homework, q *store.HomeworkQuestion, yTop float64) error {
	head := fmt.Sprintf("Q%d", q.Position)
	pageLabel := ""
	if q.Page != nil {
		pageLabel = fmt.Sprintf("p. %d", *q.Page)
	}
	sheet.Text(sheetMargin, yTop, 11, true, 0, head)
	if pageLabel != "" {
		sheet.Text(sheetMargin+26, yTop+1.5, 8, false, 0.45, pageLabel)
	}
	yTop += 18

	if q.Page == nil || q.QuestionRect == nil {
		if q.Standalone {
			// Self-contained question: the statement itself prints on the
			// sheet, since there is no book region to screenshot.
			wrapText(sheet, yTop, 10, 0, q.Transcription)
			return nil
		}
		sheet.Text(sheetMargin, yTop+4, 9, false, 0.45,
			fmt.Sprintf("Question %d has no located page%s.",
				q.Position, retryHint(q.Status, q.Error)))
		return nil
	}

	crop, err := hwCrop(ctx, book.FilePath, *q.Page, *q.QuestionRect)
	if err != nil {
		return err
	}
	// The diagram block draws below the screenshot, so its height is part
	// of the question's footprint: both together shrink to keep
	// sheetMinWork blank underneath.
	diagrams := q.Diagrams
	if len(diagrams) > hwMaxDiagrams {
		diagrams = diagrams[:hwMaxDiagrams]
	}
	questionScale := float64(clampScalePercent(hw.QuestionScale, 40, 100)) / 100
	figureScale := float64(clampScalePercent(hw.FigureScale, 50, 200)) / 100
	boxW, boxH, diagramFootprint, perRow := figureLayout(len(diagrams), figureScale)
	available := (sheetH - sheetMargin - yTop - sheetMinWork) * questionScale
	available -= diagramFootprint
	if available < 40 {
		available = 40
	}
	used, err := sheet.ImageFit(sheetMargin, yTop, sheetContentW*questionScale, available, crop)
	if err != nil {
		return userf(err, "could not place question %d", q.Position)
	}
	yTop += used + 10

	if len(diagrams) > 0 {
		// The figures keep the working-space promise: if the scaled block
		// outruns the space left on the sheet, the whole block shrinks to
		// fit rather than running off the bottom.
		if budget := sheetH - sheetMinWork - yTop; diagramFootprint > budget {
			fit := budget / diagramFootprint
			boxW *= fit
			boxH *= fit
			perRow = figuresPerRow(len(diagrams), boxW)
		}
		x, placed := sheetMargin, 0
		for i := range diagrams {
			if placed > 0 && placed%perRow == 0 {
				x = sheetMargin
				yTop += boxH + diagramGap
			}
			crop, err := hwCrop(ctx, book.FilePath, *q.Page, diagrams[i].Rect)
			if err != nil {
				return err
			}
			if _, err := sheet.ImageFit(x, yTop, boxW, boxH, crop); err != nil {
				return userf(err, "could not place a diagram of question %d", q.Position)
			}
			x += boxW + diagramGap
			placed++
		}
	}
	return nil
}

// figureLayout plans a question's diagram block at a figure scale. Each
// figure's box is its column share and the baseline height multiplied by
// the scale — width and height together, so wide figures actually grow —
// and figures that no longer fit side by side wrap onto extra rows. The
// footprint is the vertical space the whole block needs, gaps included.
func figureLayout(n int, scale float64) (boxW, boxH, footprint float64, perRow int) {
	if n <= 0 {
		return 0, 0, 0, 1
	}
	boxW = math.Min(((sheetContentW-diagramGap*float64(n-1))/float64(n))*scale, sheetContentW)
	boxH = diagramBaseH * scale
	perRow = figuresPerRow(n, boxW)
	rows := (n + perRow - 1) / perRow
	footprint = float64(rows)*boxH + float64(rows-1)*diagramGap
	return boxW, boxH, footprint, perRow
}

// figuresPerRow reports how many boxes of the given width fit across the
// content width with a gap between them, at least one.
func figuresPerRow(n int, boxW float64) int {
	k := int(math.Max(1, math.Floor((sheetContentW+diagramGap)/(boxW+diagramGap))))
	if k > n {
		k = n
	}
	return k
}

// clampScalePercent reads one print-scale knob. Unset or non-positive
// means the designed default, and out-of-range values clamp so a stray
// number can never break the sheet layout.
func clampScalePercent(v, lo, hi int) int {
	if v <= 0 {
		v = 100
	}
	if v < lo {
		v = lo
	}
	if v > hi {
		v = hi
	}
	return v
}

// retryHint explains a missing screenshot in the printed sheet's own terms.
func retryHint(status, errText string) string {
	if errText != "" {
		return " It failed to locate: " + errText
	}
	if status == store.QuestionPending {
		return " It never finished locating."
	}
	return ""
}

// hwFooter stamps the running foot: PSET at the left, sheet n of total at
// the right.
func hwFooter(sheet *pdf.Sheet, n, total int) {
	y := sheetH - sheetMargin + 12
	sheet.Text(sheetMargin, y, 7, false, 0.55, "P S E T")
	label := fmt.Sprintf("%d / %d", n, total)
	sheet.Text(sheetW-sheetMargin-20, y, 8, false, 0.55, label)
}

// HomeworkPDFReady guards the download endpoint: a generating homework has
// no stable outline to print yet.
func (e *Engine) HomeworkPDFReady(ctx context.Context, homeworkID string) error {
	s, err := e.openStore(ctx)
	if err != nil {
		return err
	}
	defer s.Close()
	hw, err := s.HomeworkByID(ctx, homeworkID)
	if err != nil {
		return err
	}
	if hw.Status == store.HomeworkGenerating {
		return &UserError{Message: "this homework is still generating"}
	}
	return nil
}
