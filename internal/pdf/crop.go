package pdf

import (
	"bytes"
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"
)

// Rect is a region of a rendered page, normalized to the page: x and w are
// fractions of the page width, y and h of the page height, y from the top.
// All values must land in [0, 1].
type Rect struct {
	X, Y, W, H float64
}

// Valid reports whether the rect lies inside the page with positive size.
func (r Rect) Valid() bool {
	const eps = 1e-6
	return r.W > eps && r.H > eps &&
		r.X >= -eps && r.Y >= -eps &&
		r.X+r.W <= 1+eps && r.Y+r.H <= 1+eps
}

// CropJPEG decodes a page rendering, cuts the normalized rect out of it, and
// re-encodes the crop as JPEG.
func CropJPEG(pageJPEG []byte, r Rect) ([]byte, error) {
	if !r.Valid() {
		return nil, fmt.Errorf("crop rect %+v is out of bounds", r)
	}
	img, err := jpeg.Decode(bytes.NewReader(pageJPEG))
	if err != nil {
		return nil, fmt.Errorf("decode page image: %w", err)
	}
	b := img.Bounds()
	px := func(f float64, max int) int {
		v := int(f*float64(max) + 0.5)
		if v < 0 {
			return 0
		}
		if v > max {
			return max
		}
		return v
	}
	x0, y0 := px(r.X, b.Dx()), px(r.Y, b.Dy())
	x1, y1 := px(r.X+r.W, b.Dx()), px(r.Y+r.H, b.Dy())
	crop := img.(interface {
		SubImage(r image.Rectangle) image.Image
	}).SubImage(image.Rect(x0, y0, x1, y1))

	var out bytes.Buffer
	if err := jpeg.Encode(&out, crop, &jpeg.Options{Quality: 85}); err != nil {
		return nil, fmt.Errorf("encode crop: %w", err)
	}
	return out.Bytes(), nil
}

// SnapRect moves the rect's edges to the nearest whitespace gutters of the
// rendered page, so a model-returned box that lands mid-line crops whole
// lines instead of slicing glyphs. Each edge searches ±2.5% of the page
// dimension for a run of blank rows (or columns) and moves to its outer
// side, keeping the whitespace inside the crop; an edge with no run in
// range stays put. Edges never cross, and an undecodable page returns the
// rect unchanged.
func SnapRect(pageJPEG []byte, r Rect) Rect {
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

	// Ink counts: anything darker than warm paper counts, so colored
	// figure strokes register too. A row (or column) is blank when almost
	// none of its pixels carry ink.
	rowInk := make([]int, h)
	colInk := make([]int, w)
	for y := 0; y < h; y++ {
		row := gray.Pix[y*gray.Stride : y*gray.Stride+w]
		for x, v := range row {
			if v < 200 {
				rowInk[y]++
				colInk[x]++
			}
		}
	}
	blankRow := func(y int) bool { return rowInk[y]*100 < w }
	blankCol := func(x int) bool { return colInk[x]*100 < h }

	pix := func(f float64, max int) int {
		v := int(f*float64(max) + 0.5)
		if v < 0 {
			return 0
		}
		if v >= max {
			return max - 1
		}
		return v
	}
	norm := func(v, max int) float64 { return float64(v) / float64(max) }

	// nearestGutter returns the outer side of the blank run whose centre
	// sits closest to edge within ±2.5% of the dimension. Blank runs shorter
	// than 3 pixels are noise, not gutters.
	nearestGutter := func(blank func(int) bool, max, edge int) (int, bool) {
		window := max / 40
		lo, hi := edge-window, edge+window
		if lo < 0 {
			lo = 0
		}
		if hi > max-1 {
			hi = max - 1
		}
		best, bestDist, found := 0, 0, false
		run := -1
		for i := lo; i <= hi+1; i++ {
			if i <= hi && blank(i) {
				if run < 0 {
					run = i
				}
				continue
			}
			if run >= 0 && i-run >= 2 {
				centre := (run + i - 1) / 2
				dist := centre - edge
				if dist < 0 {
					dist = -dist
				}
				if !found || dist < bestDist {
					best, bestDist, found = run, dist, true
				}
			}
			run = -1
		}
		return best, found
	}

	// Top and left snap to a gutter's first pixel, bottom and right to one
	// past its last: the whitespace ends up inside the crop on every side.
	top, okT := nearestGutter(blankRow, h, pix(r.Y, h))
	bottom, okB := nearestGutter(blankRow, h, pix(r.Y+r.H, h))
	left, okL := nearestGutter(blankCol, w, pix(r.X, w))
	right, okR := nearestGutter(blankCol, w, pix(r.X+r.W, w))
	if okB && okT && bottom < top+3 {
		if r.Y+r.H <= float64(h)/2 {
			okB = false
		} else {
			okT = false
		}
	}
	if okR && okL && right < left+3 {
		if r.X+r.W <= float64(w)/2 {
			okR = false
		} else {
			okL = false
		}
	}
	out := r
	if okT {
		out.Y, out.H = norm(top, h), out.H+out.Y-norm(top, h)
	}
	if okB {
		out.H = norm(bottom+1, h) - out.Y
	}
	if okL {
		out.X, out.W = norm(left, w), out.W+out.X-norm(left, w)
	}
	if okR {
		out.W = norm(right+1, w) - out.X
	}
	return out
}
