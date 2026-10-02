package pagenum

import (
	"reflect"
	"testing"
)

// Boyce's Differential Equations as scanned: printed page 85 is lost, so
// the offset is 12 up to PDF 96 and 11 after.
var boyce = New([]Run{{From: 1, Offset: 12}, {From: 97, Offset: 11}})

func TestPrintedAndBack(t *testing.T) {
	for _, c := range []struct{ pdf, printed int }{{13, 1}, {44, 32}, {45, 33}, {96, 84}, {97, 86}, {123, 112}} {
		if n, ok := boyce.Printed(c.pdf); !ok || n != c.printed {
			t.Errorf("Printed(%d) = %d %v, want %d", c.pdf, n, ok, c.printed)
		}
		if p, ok := boyce.PDF(c.printed); !ok || p != c.pdf {
			t.Errorf("PDF(%d) = %d %v, want %d", c.printed, p, ok, c.pdf)
		}
	}
	if _, ok := boyce.Printed(12); ok {
		t.Error("PDF 12 is front matter")
	}
	if p, ok := boyce.PDF(85); ok {
		t.Errorf("printed 85 is lost, got PDF %d", p)
	}
	if p := boyce.Nearest(85); p != 97 {
		t.Errorf("Nearest(85) = %d, want 97, the page after the gap", p)
	}
	if boyce.Name(123) != "p. 112" || boyce.Name(3) != "a front-matter page (PDF page 3)" {
		t.Errorf("names %q, %q", boyce.Name(123), boyce.Name(3))
	}
}

func TestGaps(t *testing.T) {
	g := boyce.Gaps()
	if len(g) != 1 || g[0].At != 97 || !reflect.DeepEqual(g[0].Missing, []int{85}) {
		t.Fatalf("gaps %+v", g)
	}
	// Four unnumbered plates after printed 185 (PDF 195): the run after
	// them starts where detection puts it, on the first plate.
	plates := New([]Run{{From: 1, Offset: 10}, {From: 196, Offset: 14}})
	if g := plates.Gaps(); len(g) != 1 || g[0].Extra != 4 || g[0].Missing != nil {
		t.Fatalf("plates %+v", g)
	}
	if p, _ := plates.PDF(186); p != 200 {
		t.Fatalf("PDF(186) = %d, want 200, past the plates", p)
	}
	if p, _ := plates.PDF(185); p != 195 {
		t.Fatalf("PDF(185) = %d, want 195", p)
	}
}

func TestNewTidies(t *testing.T) {
	m := New([]Run{{From: 50, Offset: 3}, {From: 5, Offset: 3}, {From: 90, Offset: 2}, {From: 90, Offset: 4}})
	want := []Run{{1, 3}, {90, 4}}
	if !reflect.DeepEqual(m.Runs(), want) {
		t.Fatalf("runs %+v, want %+v", m.Runs(), want)
	}
	var zero Map
	if n, ok := zero.Printed(7); !ok || n != 7 || !reflect.DeepEqual(zero.Runs(), []Run{{1, 0}}) {
		t.Fatalf("zero map: %d %v %+v", n, ok, zero.Runs())
	}
}

// numbersFor is a book's head and foot numbers: front matter unnumbered,
// every page's printed number, some pages without one, and figure numbers
// scattered about.
func numbersFor(pages int, m Map, frontEnd int) [][]int {
	out := make([][]int, pages)
	for p := 1; p <= pages; p++ {
		out[p-1] = []int{}
		if p <= frontEnd {
			continue
		}
		if p%9 == 0 {
			continue // a chapter opener without a number
		}
		n, _ := m.Printed(p)
		out[p-1] = append(out[p-1], n)
		if p%7 == 0 {
			out[p-1] = append(out[p-1], (p*37)%500) // a figure or equation number
		}
	}
	return out
}

func TestDetectFindsALostPage(t *testing.T) {
	nums := numbersFor(640, boyce, 12)
	nums[96] = []int{} // PDF 97 carries only "CHAPTER 2"
	runs, ok := Detect(nums)
	want := []Run{{1, 12}, {97, 11}}
	if !ok || !reflect.DeepEqual(runs, want) {
		t.Fatalf("runs %+v %v, want %+v", runs, ok, want)
	}
}

func TestDetectOneRun(t *testing.T) {
	runs, ok := Detect(numbersFor(300, Single(16), 16))
	if !ok || !reflect.DeepEqual(runs, []Run{{1, 16}}) {
		t.Fatalf("runs %+v %v", runs, ok)
	}
}

func TestDetectIgnoresStrays(t *testing.T) {
	nums := numbersFor(300, Single(16), 16)
	// Two pages in a row whose numbers read one off (an OCR slip) are not
	// a run.
	nums[120] = []int{120 + 1 - 15}
	nums[121] = []int{121 + 1 - 15}
	runs, ok := Detect(nums)
	if !ok || !reflect.DeepEqual(runs, []Run{{1, 16}}) {
		t.Fatalf("runs %+v %v", runs, ok)
	}
}

func TestDetectNeedsAPattern(t *testing.T) {
	nums := make([][]int, 200)
	for i := range nums {
		nums[i] = []int{(i * 53) % 97}
	}
	if runs, ok := Detect(nums); ok {
		t.Fatalf("found %+v in noise", runs)
	}
}
