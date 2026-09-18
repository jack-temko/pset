package pdf

import (
	"bytes"
	"fmt"
	"image/jpeg"
	"strings"
)

// Letter page size in points.
const (
	letterW = 612.0
	letterH = 792.0
)

// sheetFont regular/sans is Helvetica; bold is Helvetica-Bold. Both are PDF
// base fonts with WinAnsiEncoding — no embedding, fully deterministic bytes.
const (
	fontRegular = "F1"
	fontBold    = "F2"
)

type sheetImage struct {
	name       string
	x, y, w, h float64 // points, PDF coordinates (origin bottom-left)
	jpeg       []byte
}

// Sheet is one page under composition. Callers work in top-down coordinates;
// the writer converts on output.
type Sheet struct {
	ops    []string
	images []sheetImage
}

// SheetDoc collects Letter sheets and serializes them as one PDF.
type SheetDoc struct {
	sheets []*Sheet
}

// NewSheetDoc returns an empty document.
func NewSheetDoc() *SheetDoc { return &SheetDoc{} }

// AddSheet starts a fresh page.
func (d *SheetDoc) AddSheet() *Sheet {
	s := &Sheet{}
	d.sheets = append(d.sheets, s)
	return s
}

// Text draws one line with its baseline at yTop+size*0.75 (so a call at the
// top of a text block reads naturally top-down). gray 0 = black, 1 = white.
func (s *Sheet) Text(x, yTop, size float64, bold bool, gray float64, text string) {
	font := fontRegular
	if bold {
		font = fontBold
	}
	s.ops = append(s.ops, fmt.Sprintf("BT /%s %.2f Tf %.3f g 1 0 0 1 %.2f %.2f Tm (%s) Tj ET",
		font, size, gray, x, letterH-yTop-size*0.75, escapePDFText(text)))
}

// Rule draws a thin horizontal line.
func (s *Sheet) Rule(x, yTop, w, thickness, gray float64) {
	s.ops = append(s.ops, fmt.Sprintf("%.3f g %.2f %.2f %.2f %.2f re f",
		gray, x, letterH-yTop, w, thickness))
}

// ImageFit places a JPEG with its top edge at yTop, scaled to fit maxW ×
// maxH, and reports the height it used. Aspect is preserved; the image is
// never upscaled past its natural size at 72 dpi equivalents.
func (s *Sheet) ImageFit(x, yTop, maxW, maxH float64, jpegData []byte) (float64, error) {
	cfg, err := jpeg.DecodeConfig(bytes.NewReader(jpegData))
	if err != nil {
		return 0, fmt.Errorf("read image dimensions: %w", err)
	}
	if cfg.Width == 0 || cfg.Height == 0 {
		return 0, fmt.Errorf("image has no pixels")
	}
	scale := min(maxW/float64(cfg.Width), maxH/float64(cfg.Height))
	w := float64(cfg.Width) * scale
	h := float64(cfg.Height) * scale
	name := fmt.Sprintf("Im%d", len(s.images))
	s.images = append(s.images, sheetImage{
		name: name, x: x, y: letterH - yTop - h, w: w, h: h, jpeg: jpegData,
	})
	s.ops = append(s.ops, fmt.Sprintf("q %.2f 0 0 %.2f %.2f %.2f cm /%s Do Q", w, h, x, letterH-yTop-h, name))
	return h, nil
}

// Bytes serializes the document. Output is deterministic: same sheets, same
// bytes — there is no timestamp, no id, no map ordering anywhere.
func (d *SheetDoc) Bytes() ([]byte, error) {
	type object struct {
		data []byte
	}
	var objects []*object
	add := func(data []byte) int {
		objects = append(objects, &object{data: data})
		return len(objects) // 1-based object number
	}

	catalogNum := add(nil) // placeholder: catalog references the pages tree
	fontRegularNum := add([]byte("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"))
	fontBoldNum := add([]byte("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"))

	type pageRef struct {
		pageNum, contentNum int
		resources           string
	}
	var pages []pageRef
	for _, s := range d.sheets {
		var xobjs strings.Builder
		for _, img := range s.images {
			var head bytes.Buffer
			fmt.Fprintf(&head, "<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n",
				dimOf(img.jpeg), dimHeightOf(img.jpeg), len(img.jpeg))
			stream := append(head.Bytes(), img.jpeg...)
			stream = append(stream, []byte("\nendstream")...)
			num := add(stream)
			fmt.Fprintf(&xobjs, "/%s %d 0 R ", img.name, num)
		}
		xobjDict := ""
		if xobjs.Len() > 0 {
			xobjDict = " /XObject << " + xobjs.String() + ">>"
		}
		resources := fmt.Sprintf("<< /Font << /%s %d 0 R /%s %d 0 R >>%s >>",
			fontRegular, fontRegularNum, fontBold, fontBoldNum, xobjDict)

		var content bytes.Buffer
		for _, op := range s.ops {
			content.WriteString(op)
			content.WriteByte('\n')
		}
		stream := append([]byte(fmt.Sprintf("<< /Length %d >>\nstream\n", content.Len())),
			content.Bytes()...)
		stream = append(stream, []byte("\nendstream")...)
		contentNum := add(stream)
		pages = append(pages, pageRef{pageNum: add(nil), contentNum: contentNum, resources: resources})
	}

	kids := make([]string, len(pages))
	for i, p := range pages {
		kids[i] = fmt.Sprintf("%d 0 R", p.pageNum)
	}
	pagesNum := add([]byte(fmt.Sprintf("<< /Type /Pages /Kids [%s] /Count %d >>",
		strings.Join(kids, " "), len(pages))))
	objects[catalogNum-1].data = []byte(fmt.Sprintf("<< /Type /Catalog /Pages %d 0 R >>", pagesNum))
	for _, p := range pages {
		objects[p.pageNum-1].data = []byte(fmt.Sprintf(
			"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.0f %.0f] /Contents %d 0 R /Resources %s >>",
			letterW, letterH, p.contentNum, p.resources))
	}
	var out bytes.Buffer
	out.WriteString("%PDF-1.4\n%âãÏÓ\n")
	offsets := make([]int, len(objects))
	for i, obj := range objects {
		offsets[i] = out.Len()
		fmt.Fprintf(&out, "%d 0 obj\n%s\nendobj\n", i+1, obj.data)
	}
	xref := out.Len()
	fmt.Fprintf(&out, "xref\n0 %d\n0000000000 65535 f \n", len(objects)+1)
	for _, off := range offsets {
		fmt.Fprintf(&out, "%010d 00000 n \n", off)
	}
	fmt.Fprintf(&out, "trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n",
		len(objects)+1, catalogNum, xref)
	return out.Bytes(), nil
}

// dimOf reads a JPEG SOF0/SOF2 marker for the pixel width without a full
// decode — image dims travel in the XObject dict.
func dimOf(data []byte) int {
	w, _ := jpegDims(data)
	return w
}

func dimHeightOf(data []byte) int {
	_, h := jpegDims(data)
	return h
}

// jpegDims parses the frame header of a baseline or progressive JPEG.
func jpegDims(data []byte) (int, int) {
	i := 2
	for i+9 < len(data) {
		if data[i] != 0xFF {
			i++
			continue
		}
		marker := data[i+1]
		if marker == 0xC0 || marker == 0xC1 || marker == 0xC2 {
			h := int(data[i+5])<<8 | int(data[i+6])
			w := int(data[i+7])<<8 | int(data[i+8])
			return w, h
		}
		if seg := (int(data[i+2])<<8 | int(data[i+3])); seg > 1 {
			i += 2 + seg
		} else {
			i++
		}
	}
	return 0, 0
}

// escapePDFText escapes the PDF string specials and encodes the text as
// WinAnsi (CP-1252), which the two base fonts declare.
func escapePDFText(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch r {
		case '\\', '(', ')':
			b.WriteByte('\\')
			b.WriteRune(r)
			continue
		}
		if r < 0x80 {
			b.WriteRune(r)
			continue
		}
		if code, ok := winAnsi[r]; ok {
			b.WriteByte(code) // a raw CP-1252 byte, not a UTF-8 rune
		} else {
			b.WriteByte('?')
		}
	}
	return b.String()
}

// winAnsi maps the common non-ASCII runes of textbook prose to their CP-1252
// bytes; anything else degrades to '?'.
var winAnsi = map[rune]byte{
	'‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
	'˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F,
	'¡': 0xA1, '¢': 0xA2, '£': 0xA3, '¤': 0xA4, '¥': 0xA5, '¦': 0xA6, '§': 0xA7,
	'¨': 0xA8, '©': 0xA9, 'ª': 0xAA, '«': 0xAB, '¬': 0xAC, '®': 0xAE, '¯': 0xAF,
	'°': 0xB0, '±': 0xB1, '²': 0xB2, '³': 0xB3, '´': 0xB4, 'µ': 0xB5, '¶': 0xB6,
	'·': 0xB7, '¸': 0xB8, '¹': 0xB9, 'º': 0xBA, '»': 0xBB, '¼': 0xBC, '½': 0xBD,
	'¾': 0xBE, '¿': 0xBF, 'À': 0xC0, 'Á': 0xC1, 'Â': 0xC2, 'Ã': 0xC3, 'Ä': 0xC4,
	'Å': 0xC5, 'Æ': 0xC6, 'Ç': 0xC7, 'È': 0xC8, 'É': 0xC9, 'Ê': 0xCA, 'Ë': 0xCB,
	'Ì': 0xCC, 'Í': 0xCD, 'Î': 0xCE, 'Ï': 0xCF, 'Ð': 0xD0, 'Ñ': 0xD1, 'Ò': 0xD2,
	'Ó': 0xD3, 'Ô': 0xD4, 'Õ': 0xD5, 'Ö': 0xD6, '×': 0xD7, 'Ø': 0xD8, 'Ù': 0xD9,
	'Ú': 0xDA, 'Û': 0xDB, 'Ü': 0xDC, 'Ý': 0xDD, 'Þ': 0xDE, 'ß': 0xDF, 'à': 0xE0,
	'á': 0xE1, 'â': 0xE2, 'ã': 0xE3, 'ä': 0xE4, 'å': 0xE5, 'æ': 0xE6, 'ç': 0xE7,
	'è': 0xE8, 'é': 0xE9, 'ê': 0xEA, 'ë': 0xEB, 'ì': 0xEC, 'í': 0xED, 'î': 0xEE,
	'ï': 0xEF, 'ð': 0xF0, 'ñ': 0xF1, 'ò': 0xF2, 'ó': 0xF3, 'ô': 0xF4, 'õ': 0xF5,
	'ö': 0xF6, '÷': 0xF7, 'ø': 0xF8, 'ù': 0xF9, 'ú': 0xFA, 'û': 0xFB, 'ü': 0xFC,
	'ý': 0xFD, 'þ': 0xFE, 'ÿ': 0xFF, '…': 0x85, '€': 0x80, '‚': 0x82, '„': 0x84,
	'†': 0x86, '‡': 0x87, '‰': 0x89, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
}
