package main

import (
	"bytes"
	"fmt"
)

// Minimal, deterministic PDF writer for the scanned book: an image-only
// document (one full-page JPEG XObject per page, no text operators, no
// fonts). fpdf is not used here because it assigns image object numbers by
// iterating a Go map, which breaks byte-level reproducibility.
//
// Object layout, for n pages:
//
//	1      catalog
//	2      pages tree
//	3+3i   page i, 4+3i its content stream, 5+3i its image XObject
//	3+3n   info dictionary (pinned dates)
func buildScannedPDF(jpegs [][]byte) []byte {
	n := len(jpegs)
	infoObj := 3 + 3*n
	total := infoObj + 1

	var buf bytes.Buffer
	buf.WriteString("%PDF-1.4\n")
	offsets := make([]int, total+1)
	obj := func(num int, body string) {
		offsets[num] = buf.Len()
		fmt.Fprintf(&buf, "%d 0 obj\n%s\nendobj\n", num, body)
	}

	obj(1, "<< /Type /Catalog /Pages 2 0 R >>")

	kids := make([]byte, 0, n*8)
	for i := 0; i < n; i++ {
		if i > 0 {
			kids = append(kids, ' ')
		}
		kids = append(kids, []byte(fmt.Sprintf("%d 0 R", 3+3*i))...)
	}
	obj(2, fmt.Sprintf("<< /Type /Pages /Kids [%s] /Count %d >>", kids, n))

	const mediaBox = "[0 0 595.28 841.89]"
	for i, jpeg := range jpegs {
		pageObj, contObj, imgObj := 3+3*i, 4+3*i, 5+3*i
		obj(pageObj, fmt.Sprintf(
			"<< /Type /Page /Parent 2 0 R /MediaBox %s /Contents %d 0 R "+
				"/Resources << /XObject << /Im0 %d 0 R >> >> >>", mediaBox, contObj, imgObj))

		const stream = "q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ"
		obj(contObj, fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(stream), stream))

		offsets[imgObj] = buf.Len()
		fmt.Fprintf(&buf, "%d 0 obj\n<< /Type /XObject /Subtype /Image /Width %d /Height %d "+
			"/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>\nstream\n",
			imgObj, scanW, scanH, len(jpeg))
		buf.Write(jpeg)
		buf.WriteString("\nendstream\nendobj\n")
	}

	stamp := pinnedDate.Format("20060102150405")
	obj(infoObj, fmt.Sprintf("<< /Creator (pset samplegen) /Producer (pset samplegen) "+
		"/CreationDate (D:%s) /ModDate (D:%s) >>", stamp, stamp))

	xrefOff := buf.Len()
	fmt.Fprintf(&buf, "xref\n0 %d\n", total)
	buf.WriteString("0000000000 65535 f \n")
	for i := 1; i <= infoObj; i++ {
		fmt.Fprintf(&buf, "%010d 00000 n \n", offsets[i])
	}
	fmt.Fprintf(&buf, "trailer\n<< /Size %d /Root 1 0 R /Info %d 0 R >>\n"+
		"startxref\n%d\n%%%%EOF\n", total, infoObj, xrefOff)
	return buf.Bytes()
}
