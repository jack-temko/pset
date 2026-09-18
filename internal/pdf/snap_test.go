package pdf

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"
)

// snapFixture renders a white page with dark "text lines" and a figure
// block, encodes it as JPEG, and returns the bytes.
func snapFixture(t *testing.T, w, h int, ink func(x, y int) bool) []byte {
	t.Helper()
	img := image.NewGray(image.Rect(0, 0, w, h))
	for i := range img.Pix {
		img.Pix[i] = 255
	}
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			if ink(x, y) {
				img.SetGray(x, y, color.Gray{Y: 40})
			}
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestSnapRectSnapsEdgesToGutters(t *testing.T) {
	const w, h = 400, 600
	// Lines of text at 40-60 and 520-540, a figure block at 200-400, and
	// whitespace elsewhere.
	ink := func(x, y int) bool {
		line := (y >= 40 && y < 60) || (y >= 200 && y < 400) || (y >= 520 && y < 540)
		return line && x >= 50 && x < 350
	}
	page := snapFixture(t, w, h, ink)

	// A box whose top edge lands mid-line (y=50/600) and bottom edge mid
	// the lower line (y=530/600). Snapping must move both edges into the
	// adjacent whitespace, so no row of the crop slices a glyph: every row
	// the crop gains is blank, every partially-covered line is dropped.
	got := SnapRect(page, Rect{X: 0.05, Y: 50.0 / 600, W: 0.8, H: 480.0 / 600})
	topPix := int(got.Y*600 + 0.5)
	bottomPix := int((got.Y + got.H) * 600)
	if topPix > 40 && topPix < 60 {
		t.Fatalf("snapped top %d still sits inside the text line", topPix)
	}
	for y := topPix; y < topPix+3 && y < 200; y++ {
		if ink(0, y) {
			t.Errorf("rows right below the snapped top (%d) carry ink", y)
		}
	}
	// The lower line must be fully in or fully out — never sliced.
	if bottomPix < 400 || (bottomPix > 520 && bottomPix < 540) {
		t.Fatalf("snapped bottom %d slices the lower line or the figure", bottomPix)
	}
	// The figure must survive whole.
	if got.Y+got.H < 400.0/600 {
		t.Errorf("crop %v cuts the figure block short", got)
	}
}

func TestSnapRectLeavesEdgesWithoutGutters(t *testing.T) {
	const w, h = 400, 600
	// Solid ink band with no blank run anywhere near the edges.
	ink := func(x, y int) bool { return y >= 100 && y < 500 }
	page := snapFixture(t, w, h, ink)

	rect := Rect{X: 0.1, Y: 150.0 / 600, W: 0.6, H: 200.0 / 600}
	if got := SnapRect(page, rect); got != rect {
		t.Errorf("SnapRect moved %+v to %+v with no gutter in range", rect, got)
	}
}
