package pdf

import (
	"math"
	"testing"
)

func TestTextExtent(t *testing.T) {
	const w, h = 1100, 1409
	in := func(x, y, x0, y0, x1, y1 int) bool { return x >= x0 && x < x1 && y >= y0 && y < y1 }
	// Two columns. Left: problem 5, three lines, a displayed equation 14px
	// below, two more lines, then its figure 26px below; problem 6 starts
	// under the figure. Right: problem 12, two lines, then 40px of white
	// and a section heading.
	page := snapFixture(t, w, h, func(x, y int) bool {
		switch {
		case in(x, y, 100, 400, 540, 416), in(x, y, 100, 420, 540, 436), in(x, y, 100, 440, 500, 456):
			return true
		case in(x, y, 250, 470, 400, 490): // the equation
			return true
		case in(x, y, 100, 504, 540, 520), in(x, y, 100, 524, 300, 540):
			return true
		case in(x, y, 120, 566, 480, 760): // its figure
			return true
		case in(x, y, 100, 780, 540, 796): // problem 6
			return true
		case in(x, y, 590, 200, 1030, 216), in(x, y, 590, 220, 900, 236):
			return true
		case in(x, y, 590, 276, 900, 300): // heading
			return true
		}
		return false
	})
	frac := func(x0, y0, x1, y1 int) Rect {
		return Rect{X: float64(x0) / w, Y: float64(y0) / h, W: float64(x1-x0) / w, H: float64(y1-y0) / h}
	}
	px := func(r Rect) [4]int {
		return [4]int{int(math.Round(r.X * w)), int(math.Round(r.Y * h)), int(math.Round((r.X + r.W) * w)), int(math.Round((r.Y + r.H) * h))}
	}
	figure, next := frac(120, 566, 480, 760), frac(100, 780, 540, 796)
	for _, c := range []struct {
		name  string
		start Rect
		stops []Rect
		want  [4]int
	}{
		// From its first line, through the equation, stopping at its figure.
		{"to the figure", frac(98, 402, 540, 414), []Rect{figure, next}, [4]int{100, 400, 540, 540}},
		// The right column's problem ends at the white before the heading,
		// and takes nothing from the left column.
		{"right column", frac(588, 198, 1030, 214), nil, [4]int{590, 200, 1030, 236}},
	} {
		got, ok := TextExtent(page, c.start, c.stops)
		if !ok || px(got) != c.want {
			t.Errorf("%s: %v %v, want %v", c.name, ok, px(got), c.want)
		}
	}
}
