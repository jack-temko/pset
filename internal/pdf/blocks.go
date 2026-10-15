package pdf

import (
	"bytes"
	"image"
	"image/draw"
	"image/jpeg"
)

// SnapToBlocks fits a model's box to what's printed on the page. The page
// splits into blocks at its white gaps, over and over (an XY cut): a
// paragraph, a figure, a caption. The box becomes the bounds of every
// block at least half inside it. So a box that runs over onto the next
// problem sheds the block it only grazes, and one that clips a figure's
// edge takes the whole figure. On three pages of circuits this took every
// model's figure boxes from about two in three to all or nearly all right.
// A block only partly inside the box is taken row band by row band: on
// the differential equations book's dense pages one block held the end
// of one problem and the start of the next, or a problem's last line and
// the top of a figure (2026-09-29).
//
// A box that holds no block half inside it stays as it is, and so does an
// undecodable page.
func SnapToBlocks(pageJPEG []byte, r Rect) Rect {
	img, err := jpeg.Decode(bytes.NewReader(pageJPEG))
	if err != nil {
		return r
	}
	gray, ok := img.(*image.Gray)
	if !ok {
		gray = image.NewGray(img.Bounds())
		draw.Draw(gray, gray.Bounds(), img, img.Bounds().Min, draw.Src)
	}
	w, h := gray.Bounds().Dx(), gray.Bounds().Dy()
	if w == 0 || h == 0 {
		return r
	}
	// A gap is 12 blank pixels on a page 1100 wide: more than the space
	// between lines, less than the space between problems.
	gap := max(2, 12*w/1100)
	ink := func(x, y int) bool { return gray.Pix[y*gray.Stride+x] < inkLevel }

	type block struct{ x0, y0, x1, y1 int }
	var blocks []block
	var cut func(x0, y0, x1, y1 int)
	cut = func(x0, y0, x1, y1 int) {
		rows := make([]bool, y1-y0)
		for y := y0; y < y1; y++ {
			for x := x0; x < x1; x++ {
				if ink(x, y) {
					rows[y-y0] = true
					break
				}
			}
		}
		hs := inkRuns(rows, gap)
		if len(hs) > 1 {
			for _, s := range hs {
				cut(x0, y0+s[0], x1, y0+s[1])
			}
			return
		}
		if len(hs) == 0 {
			return
		}
		y0, y1 = y0+hs[0][0], y0+hs[0][1]
		cols := make([]bool, x1-x0)
		for x := x0; x < x1; x++ {
			for y := y0; y < y1; y++ {
				if ink(x, y) {
					cols[x-x0] = true
					break
				}
			}
		}
		vs := inkRuns(cols, gap)
		if len(vs) > 1 {
			for _, s := range vs {
				cut(x0+s[0], y0, x0+s[1], y1)
			}
			return
		}
		if len(vs) == 1 {
			blocks = append(blocks, block{x0 + vs[0][0], y0, x0 + vs[0][1], y1})
		}
	}
	cut(0, 0, w, h)

	bx0, by0 := r.X*float64(w), r.Y*float64(h)
	bx1, by1 := bx0+r.W*float64(w), by0+r.H*float64(h)
	// inside is how much of a block the box holds, from 0 to 1.
	inside := func(b block) float64 {
		iw := min(bx1, float64(b.x1)) - max(bx0, float64(b.x0))
		ih := min(by1, float64(b.y1)) - max(by0, float64(b.y0))
		if iw <= 0 || ih <= 0 {
			return 0
		}
		return iw * ih / float64((b.x1-b.x0)*(b.y1-b.y0))
	}
	found := false
	var sx0, sy0, sx1, sy1 int
	take := func(b block) {
		if !found {
			sx0, sy0, sx1, sy1, found = b.x0, b.y0, b.x1, b.y1, true
			return
		}
		sx0, sy0, sx1, sy1 = min(sx0, b.x0), min(sy0, b.y0), max(sx1, b.x1), max(sy1, b.y1)
	}
	for _, b := range blocks {
		switch f := inside(b); {
		case f >= 0.5:
			take(b)
		case f > 0:
			// A block the box only partly holds can be two things printed
			// close: a problem's last line and the figure under it, or
			// the tail of one problem and the start of the next. Its rows,
			// split where even a line's worth of white falls, count one
			// by one.
			rows := make([]bool, b.y1-b.y0)
			for y := b.y0; y < b.y1; y++ {
				for x := b.x0; x < b.x1; x++ {
					if ink(x, y) {
						rows[y-b.y0] = true
						break
					}
				}
			}
			for _, band := range inkRuns(rows, rowGap) {
				part := block{b.x1, b.y0 + band[0], b.x0, b.y0 + band[1]}
				for y := part.y0; y < part.y1; y++ {
					for x := b.x0; x < b.x1; x++ {
						if ink(x, y) {
							part.x0, part.x1 = min(part.x0, x), max(part.x1, x+1)
						}
					}
				}
				if part.x0 < part.x1 && inside(part) >= 0.5 {
					take(part)
				}
			}
		}
	}
	if !found {
		return r
	}
	return Rect{X: float64(sx0) / float64(w), Y: float64(sy0) / float64(h),
		W: float64(sx1-sx0) / float64(w), H: float64(sy1-sy0) / float64(h)}
}

// inkLevel: anything darker than warm paper is ink, so colored figure
// strokes count too.
const inkLevel = 200

// rowGap is the white between rows of a block that splits it into bands:
// less than lines of text leave between them.
const rowGap = 3

// inkRuns is the stretches of ink along a line of flags, split wherever
// gap or more blank ones in a row fall between them, as [start, end).
func inkRuns(flags []bool, gap int) [][2]int {
	var out [][2]int
	start, blank, end := -1, 0, 0
	for i, f := range flags {
		if f {
			if start < 0 {
				start = i
			}
			blank, end = 0, i
			continue
		}
		if start >= 0 {
			blank++
			if blank >= gap {
				out = append(out, [2]int{start, end + 1})
				start = -1
			}
		}
	}
	if start >= 0 {
		out = append(out, [2]int{start, end + 1})
	}
	return out
}
