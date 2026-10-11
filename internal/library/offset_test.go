package library

import (
	"fmt"
	"testing"
)

// book builds page texts: front pages with no numbers, then body pages
// whose foot (or head) carries printed numbers from 1.
func book(front, body int, page func(printed int) string) []string {
	var out []string
	for i := range front {
		out = append(out, fmt.Sprintf("Preface\nSome words on page %d of the front matter.", i))
	}
	for p := 1; p <= body; p++ {
		out = append(out, page(p))
	}
	return out
}

const prose = "The span of a list of vectors is the set of all linear combinations.\nWe prove this in two steps.\nIt follows that the list is independent.\nHence the dimension is finite."

func TestDetectOffset(t *testing.T) {
	cases := []struct {
		name   string
		pages  []string
		want   int
		wantOK bool
	}{
		{"footer numbers", book(16, 40, func(p int) string { return prose + "\n" + fmt.Sprint(p) }), 16, true},
		{"running head", book(9, 40, func(p int) string {
			if p%2 == 0 {
				return fmt.Sprintf("%d  CHAPTER 1. VECTOR SPACES\n%s", p, prose)
			}
			return fmt.Sprintf("1.2 Subspaces  %d\n%s", p, prose)
		}), 9, true},
		{"no front matter", book(0, 30, func(p int) string { return fmt.Sprintf("– %d –\n%s", p, prose) }), 0, true},
		{"years and equation numbers scatter", book(4, 40, func(p int) string {
			return fmt.Sprintf("%s\n(3.%d)\nIn %d Hilbert showed it.\n%d", prose, p%7, 1890+p%13, p)
		}), 4, true},
		{"no numbers at all", book(3, 40, func(int) string { return prose }), 0, false},
		{"too few pages agree", book(2, 4, func(p int) string { return prose + "\n" + fmt.Sprint(p) }), 0, false},
		{"numbers mid-page are ignored", book(5, 30, func(p int) string {
			return "Heading\nMore\nText\n" + fmt.Sprintf("see %d here", p) + "\nA\nB\nC"
		}), 0, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, ok := detectOffset(c.pages)
			if got != c.want || ok != c.wantOK {
				t.Fatalf("detectOffset = %d, %v; want %d, %v", got, ok, c.want, c.wantOK)
			}
		})
	}
}

func TestDetectOffsetSurvivesUnreadPages(t *testing.T) {
	pages := book(12, 60, func(p int) string { return prose + "\n" + fmt.Sprint(p) })
	// A third of the body didn't OCR at all.
	for i := 20; i < 40; i++ {
		pages[i] = ""
	}
	if got, ok := detectOffset(pages); !ok || got != 12 {
		t.Fatalf("got %d %v", got, ok)
	}
}
