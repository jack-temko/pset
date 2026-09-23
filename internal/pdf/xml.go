package pdf

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"strconv"
	"strings"
)

// XMLDoc is the structure-relevant content of a PDF: its outline (bookmarks)
// and its text lines with font sizes, as pdftohtml reports them.
type XMLDoc struct {
	Outline []XMLOutlineEntry
	Lines   []XMLLine
}

// XMLOutlineEntry is one outline entry; Level 0 is the top level, each level
// of nesting adds one.
type XMLOutlineEntry struct {
	Title string
	Page  int
	Level int
}

// XMLLine is one visual text line: adjacent <text> elements on the same page
// whose top coordinates sit within 2px are merged, so a line split across
// font runs is measured as one.
type XMLLine struct {
	Page int
	Top  int
	Size float64
	Text string
}

// XML runs `pdftohtml -xml -stdout -i <path>` and parses its output. One
// invocation serves both the outline and the font/position data.
func XML(ctx context.Context, path string) (*XMLDoc, error) {
	out, err := run(ctx, "pdftohtml", "-xml", "-stdout", "-i", path)
	if err != nil {
		return nil, err
	}
	return ParseXML([]byte(out))
}

type pdfPage struct {
	Number    int           `xml:"number,attr"`
	Fontspecs []pdfFontspec `xml:"fontspec"`
	Texts     []pdfText     `xml:"text"`
}

type pdfFontspec struct {
	ID   int `xml:"id,attr"`
	Size int `xml:"size,attr"`
}

type pdfText struct {
	Top  int
	Font int
	Body string
}

type pdfOutlineItem struct {
	Page int
	Text string
}

// collectChars gathers character data across nested elements until the
// element's matching end tag; pdftohtml wraps bold/italic runs in child
// elements whose text still belongs to the line.
func collectChars(d *xml.Decoder, sb *strings.Builder) error {
	depth := 0
	for {
		tok, err := d.Token()
		if err != nil {
			return err
		}
		switch t := tok.(type) {
		case xml.CharData:
			sb.Write(t)
		case xml.StartElement:
			depth++
		case xml.EndElement:
			if depth == 0 {
				return nil
			}
			depth--
		}
	}
}

func (t *pdfText) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	for _, a := range start.Attr {
		switch a.Name.Local {
		case "top":
			n, err := strconv.Atoi(a.Value)
			if err != nil {
				return fmt.Errorf("parse pdftohtml text top %q: %w", a.Value, err)
			}
			t.Top = n
		case "font":
			n, err := strconv.Atoi(a.Value)
			if err != nil {
				return fmt.Errorf("parse pdftohtml text font %q: %w", a.Value, err)
			}
			t.Font = n
		}
	}
	var sb strings.Builder
	if err := collectChars(d, &sb); err != nil {
		return err
	}
	t.Body = sb.String()
	return nil
}

func (it *pdfOutlineItem) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	for _, a := range start.Attr {
		if a.Name.Local != "page" {
			continue
		}
		n, err := strconv.Atoi(a.Value)
		if err != nil {
			return fmt.Errorf("parse pdftohtml outline page %q: %w", a.Value, err)
		}
		it.Page = n
	}
	var sb strings.Builder
	if err := collectChars(d, &sb); err != nil {
		return err
	}
	it.Text = sb.String()
	return nil
}

// ParseXML decodes pdftohtml XML output. Pages decode through a plain
// Unmarshal; the outline decodes token by token, because pdftohtml
// interleaves items and nested <outline> elements and a struct unmarshal
// would regroup them, losing the document order. Fontspec declarations are
// document-global in that format (later pages reuse earlier ids without
// redeclaring them), so sizes resolve across the whole document.
func ParseXML(data []byte) (*XMLDoc, error) {
	out := &XMLDoc{}
	if err := parseOutline(data, &out.Outline); err != nil {
		return nil, err
	}

	var doc struct {
		Pages []pdfPage `xml:"page"`
	}
	if err := xml.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("parse pdftohtml xml: %w", err)
	}

	sizes := map[int]float64{}
	for _, page := range doc.Pages {
		for _, fs := range page.Fontspecs {
			sizes[fs.ID] = float64(fs.Size)
		}
		for _, t := range page.Texts {
			text := strings.Join(strings.Fields(t.Body), " ")
			if text == "" {
				continue
			}
			if n := len(out.Lines); n > 0 && sameLine(out.Lines[n-1], page.Number, t.Top) {
				if size := sizes[t.Font]; size > out.Lines[n-1].Size {
					out.Lines[n-1].Size = size
				}
				out.Lines[n-1].Text += " " + text
				continue
			}
			out.Lines = append(out.Lines, XMLLine{
				Page: page.Number,
				Top:  t.Top,
				Size: sizes[t.Font],
				Text: text,
			})
		}
	}
	return out, nil
}

// parseOutline walks the token stream to the top-level <outline> element and
// records its items in document order, nesting via recursion.
func parseOutline(data []byte, out *[]XMLOutlineEntry) error {
	dec := xml.NewDecoder(bytes.NewReader(data))
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("parse pdftohtml xml: %w", err)
		}
		if start, ok := tok.(xml.StartElement); ok && start.Name.Local == "outline" {
			if err := readOutline(dec, 0, out); err != nil {
				return err
			}
			return nil
		}
	}
}

func readOutline(dec *xml.Decoder, depth int, out *[]XMLOutlineEntry) error {
	for {
		tok, err := dec.Token()
		if err != nil {
			return fmt.Errorf("parse pdftohtml outline: %w", err)
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "item":
				var item pdfOutlineItem
				if err := dec.DecodeElement(&item, &t); err != nil {
					return fmt.Errorf("parse pdftohtml outline item: %w", err)
				}
				*out = append(*out, XMLOutlineEntry{
					Title: strings.Join(strings.Fields(item.Text), " "),
					Page:  item.Page,
					Level: depth,
				})
			case "outline":
				if err := readOutline(dec, depth+1, out); err != nil {
					return err
				}
			}
		case xml.EndElement:
			return nil
		}
	}
}

func sameLine(prev XMLLine, page, top int) bool {
	if prev.Page != page {
		return false
	}
	d := prev.Top - top
	if d < 0 {
		d = -d
	}
	return d <= 2
}
