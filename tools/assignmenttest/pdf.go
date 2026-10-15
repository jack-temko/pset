package main

import (
	"bytes"
	"strings"

	"github.com/go-pdf/fpdf"
)

// sheet builds a lookalike PDF the way professors' sheets are laid out:
// centered heading lines, paragraphs, tables, numbered problems with
// lettered parts, and a footer on every page. Text goes through the
// core fonts' code page, so dashes and curly quotes come out as they do
// in a real PDF's text layer.
type sheet struct {
	pdf *fpdf.Fpdf
	tr  func(string) string
}

func newSheet(footer string) *sheet {
	p := fpdf.New("P", "mm", "Letter", "")
	p.SetMargins(22, 20, 22)
	p.SetAutoPageBreak(true, 22)
	s := &sheet{pdf: p, tr: p.UnicodeTranslatorFromDescriptor("")}
	if footer != "" {
		// "left|middle|right", like "Prof. Petr|Copyright 2026|Fall 2026".
		parts := append(strings.Split(footer, "|"), "", "")
		p.SetFooterFunc(func() {
			p.SetY(-16)
			p.SetFont("Times", "", 9)
			w := (216.0 - 44) / 3
			p.CellFormat(w, 5, s.tr(parts[0]), "", 0, "L", false, 0, "")
			p.CellFormat(w, 5, s.tr(parts[1]), "", 0, "C", false, 0, "")
			p.CellFormat(w, 5, s.tr(parts[2]), "", 0, "R", false, 0, "")
			p.SetFont("Times", "", 11)
		})
	}
	p.AddPage()
	p.SetFont("Times", "", 11)
	return s
}

func (s *sheet) center(text string, bold bool) *sheet {
	style := ""
	if bold {
		style = "B"
	}
	s.pdf.SetFont("Times", style, 12)
	s.pdf.CellFormat(0, 6, s.tr(text), "", 1, "C", false, 0, "")
	s.pdf.SetFont("Times", "", 11)
	return s
}

func (s *sheet) para(text string) *sheet {
	s.pdf.Ln(2)
	s.pdf.MultiCell(0, 5, s.tr(text), "", "L", false)
	s.pdf.Ln(1)
	return s
}

func (s *sheet) gap(mm float64) *sheet {
	s.pdf.Ln(mm)
	return s
}

// item is a numbered problem, its text wrapped under its number, and its
// lettered parts indented under that.
func (s *sheet) item(n, text string, parts ...string) *sheet {
	p := s.pdf
	x := p.GetX()
	p.SetX(x + 4)
	p.CellFormat(8, 5, n+".", "", 0, "L", false, 0, "")
	p.SetLeftMargin(x + 12)
	p.MultiCell(0, 5, s.tr(text), "", "L", false)
	for i, part := range parts {
		p.SetLeftMargin(x + 20)
		p.SetX(x + 20)
		p.CellFormat(7, 5, string(rune('a'+i))+".", "", 0, "L", false, 0, "")
		p.SetLeftMargin(x + 27)
		p.MultiCell(0, 5, s.tr(part), "", "L", false)
	}
	p.SetLeftMargin(x)
	p.SetX(x)
	p.Ln(1)
	return s
}

// table draws ruled rows, the first a heading; widths are in mm, and a
// cell's lines are split on "\n".
func (s *sheet) table(widths []float64, rows [][]string) *sheet {
	p := s.pdf
	for r, row := range rows {
		lines := 1
		for _, c := range row {
			lines = max(lines, strings.Count(c, "\n")+1)
		}
		h := float64(lines)*5 + 2
		if p.GetY()+h > 279-24 {
			p.AddPage()
		}
		x, y := p.GetX(), p.GetY()
		if r == 0 {
			p.SetFont("Times", "B", 11)
		}
		for i, c := range row {
			p.Rect(x, y, widths[i], h, "D")
			for j, l := range strings.Split(c, "\n") {
				p.SetXY(x+1.5, y+1+float64(j)*5)
				p.CellFormat(widths[i]-3, 5, s.tr(l), "", 0, "L", false, 0, "")
			}
			x += widths[i]
		}
		p.SetFont("Times", "", 11)
		p.SetXY(22, y+h)
	}
	p.Ln(3)
	return s
}

// columns sets two blocks of text side by side, the way a sheet with two
// assignments on it runs them, so the text layer interleaves them line
// by line.
func (s *sheet) columns(left, right []string) *sheet {
	p := s.pdf
	y := p.GetY()
	w := (216.0 - 44 - 8) / 2
	p.SetLeftMargin(22)
	p.SetXY(22, y)
	for _, l := range left {
		p.MultiCell(w, 5, s.tr(l), "", "L", false)
	}
	endLeft := p.GetY()
	p.SetLeftMargin(22 + w + 8)
	p.SetXY(22+w+8, y)
	for _, l := range right {
		p.MultiCell(w, 5, s.tr(l), "", "L", false)
	}
	endRight := p.GetY()
	p.SetLeftMargin(22)
	p.SetXY(22, max(endLeft, endRight)+2)
	return s
}

func (s *sheet) page() *sheet {
	s.pdf.AddPage()
	return s
}

func (s *sheet) bytes() ([]byte, error) {
	var b bytes.Buffer
	err := s.pdf.Output(&b)
	return b.Bytes(), err
}
