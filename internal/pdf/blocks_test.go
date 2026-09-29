package pdf

import (
	"math"
	"testing"
)

func TestSnapToBlocks(t *testing.T) {
	const w, h = 1100, 1400
	// A problem's two lines of text (the gap between them is a line's,
	// not a block's), its figure below, and the next problem's text.
	inBox := func(x, y, x0, y0, x1, y1 int) bool { return x >= x0 && x < x1 && y >= y0 && y < y1 }
	ink := func(x, y int) bool {
		return inBox(x, y, 100, 100, 500, 116) || inBox(x, y, 100, 120, 460, 136) || // problem text
			inBox(x, y, 120, 180, 440, 400) || // figure
			inBox(x, y, 100, 460, 500, 476) // next problem
	}
	page := snapFixture(t, w, h, ink)
	px := func(r Rect) [4]int {
		return [4]int{int(math.Round(r.X * w)), int(math.Round(r.Y * h)), int(math.Round((r.X + r.W) * w)), int(math.Round((r.Y + r.H) * h))}
	}
	rect := func(x0, y0, x1, y1 int) Rect {
		return Rect{X: float64(x0) / w, Y: float64(y0) / h, W: float64(x1-x0) / w, H: float64(y1-y0) / h}
	}
	near := func(got, want [4]int) bool {
		for i := range got {
			if math.Abs(float64(got[i]-want[i])) > 3 {
				return false
			}
		}
		return true
	}
	for _, c := range []struct {
		name string
		box  Rect
		want [4]int
	}{
		// Clipped on the right: the whole figure comes back.
		{"clipped", rect(110, 170, 380, 410), [4]int{120, 180, 440, 400}},
		// Roomy, and grazing the next problem: trimmed to the figure.
		{"roomy", rect(60, 150, 600, 464), [4]int{120, 180, 440, 400}},
		// Most of the text boxed: the text is one block, so all of it.
		{"most of the text", rect(90, 95, 510, 126), [4]int{100, 100, 500, 136}},
	} {
		if got := px(SnapToBlocks(page, c.box)); !near(got, c.want) {
			t.Errorf("%s: snapped to %v, want %v", c.name, got, c.want)
		}
	}
	// A box over blank paper stays as it was.
	blank := rect(700, 700, 900, 900)
	if got := SnapToBlocks(page, blank); got != blank {
		t.Errorf("blank: %+v", got)
	}
}
