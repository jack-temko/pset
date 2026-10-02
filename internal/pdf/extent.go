package pdf

import (
	"bytes"
	"image"
	"image/draw"
	"image/jpeg"
)

// TextExtent is a whole problem from where it starts. A model finds
// where each problem on a page starts, its number and first line, far
// more surely than where it ends: boxed whole, a long problem with parts
// and equations came back cut after a line or two. So the extent comes
// from the page: from the first line's top, down its column, through
// every row of ink until the next thing that isn't this problem: another
// problem's start, one of this problem's figures (stops), or a gap of
// white wider than any inside a problem. On the circuits book and the
// differential equations book this boxed 160 problems of 168 whole.
//
// ok is false for an undecodable page or a start on blank paper.
func TextExtent(pageJPEG []byte, start Rect, stops []Rect) (Rect, bool) {
	img, err := jpeg.Decode(bytes.NewReader(pageJPEG))
	if err != nil {
		return Rect{}, false
	}
	gray, ok := img.(*image.Gray)
	if !ok {
		gray = image.NewGray(img.Bounds())
		draw.Draw(gray, gray.Bounds(), img, img.Bounds().Min, draw.Src)
	}
	w, h := gray.Bounds().Dx(), gray.Bounds().Dy()
	if w == 0 || h == 0 {
		return Rect{}, false
	}
	ink := func(x, y int) bool { return gray.Pix[y*gray.Stride+x] < inkLevel }

	sx0 := int(start.X * float64(w))
	sy0, sy1 := int(start.Y*float64(h)), int((start.Y+start.H)*float64(h))
	cx0, cx1 := column(gray, w, h, ink, sx0)
	rowInk := func(y int) (int, int, bool) {
		for x := cx0; x < cx1; x++ {
			if ink(x, y) {
				last := x
				for x2 := cx1 - 1; x2 > x; x2-- {
					if ink(x2, y) {
						last = x2
						break
					}
				}
				return x, last, true
			}
		}
		return 0, 0, false
	}

	// The first line: up to where its ink begins, or down to it.
	y0 := max(0, min(sy0, h-1))
	for y0 > 0 {
		if _, _, ok := rowInk(y0 - 1); !ok {
			break
		}
		y0--
	}
	for y0 < h {
		if _, _, ok := rowInk(y0); ok {
			break
		}
		y0++
	}
	if y0 >= h {
		return Rect{}, false
	}

	// Where it has to stop: the nearest stop below in the same column.
	stop := h
	for _, s := range stops {
		top := int(s.Y * float64(h))
		left, right := int(s.X*float64(w)), int((s.X+s.W)*float64(w))
		if top > sy1-2 && top > y0 && right > cx0 && left < cx1 {
			stop = min(stop, top-1)
		}
	}
	gap := max(8, textGap*h/pageHeight)
	lx0, lx1 := w, 0
	last, blank := y0, 0
	for y := y0; y < stop; y++ {
		a, b, ok := rowInk(y)
		if !ok {
			blank++
			continue
		}
		if blank >= gap && y > sy1 {
			break
		}
		blank, last = 0, y
		lx0, lx1 = min(lx0, a), max(lx1, b+1)
	}
	if lx1 <= lx0 {
		return Rect{}, false
	}
	return Rect{X: float64(lx0) / float64(w), Y: float64(y0) / float64(h),
		W: float64(lx1-lx0) / float64(w), H: float64(last+1-y0) / float64(h)}, true
}

// textGap is the white, on a page pageHeight tall, that ends a problem:
// wider than a problem leaves around a displayed equation or between its
// parts, narrower than it leaves before a figure or the next section.
const (
	textGap    = 30
	pageHeight = 1409
)

// column is the span of the column x is in: the page split at its gutter,
// the widest run of empty columns near the middle, when it has one.
func column(gray *image.Gray, w, h int, ink func(x, y int) bool, x int) (int, int) {
	lo, hi := w*2/5, w*3/5
	counts := make([]int, hi-lo)
	least := h
	for i := range counts {
		for y := 0; y < h; y += 2 {
			if ink(lo+i, y) {
				counts[i]++
			}
		}
		least = min(least, counts[i])
	}
	// A rule across the page crosses the gutter; running text across the
	// middle means one column.
	if least > h/200 {
		return 0, w
	}
	bestA, bestB := 0, 0
	for i := 0; i < len(counts); {
		if counts[i] > least+2 {
			i++
			continue
		}
		j := i
		for j < len(counts) && counts[j] <= least+2 {
			j++
		}
		if j-i > bestB-bestA {
			bestA, bestB = i, j
		}
		i = j
	}
	gutter := lo + (bestA+bestB)/2
	if x < gutter {
		return 0, gutter
	}
	return gutter, w
}
