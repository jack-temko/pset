package pagenum

// Detection. Every page whose head or foot carries its printed number
// votes for the distance between its PDF page and that number. Figure and
// equation numbers vote too, but they scatter; a real run is a stretch of
// pages that agree. A scan that lost a page shows as two stretches, one
// distance apart.
const (
	// minVotes is how many pages must agree on a distance for it to be
	// one at all: fewer is chance.
	minVotes = 5
	// minRun is how many pages in a row, among those carrying a number,
	// make a run: one or two in a row are a stray figure number.
	minRun = 3
	// minShare is how much of the book the runs must account for.
	minShare = 0.2
)

// Detect finds a book's runs from the numbers each page carries at its
// head or foot: numbers[i] are PDF page i+1's candidates, nil for a page
// without text. ok is false when no numbering stands out; the book then
// keeps what it has.
func Detect(numbers [][]int) (runs []Run, ok bool) {
	count := map[int]int{}
	withText := 0
	for i, ns := range numbers {
		if ns == nil {
			continue
		}
		withText++
		seen := map[int]bool{}
		for _, n := range ns {
			if d := i + 1 - n; !seen[d] {
				seen[d] = true
				count[d]++
			}
		}
	}

	// Each numbered page takes one distance: the run it's in, when it
	// has that one, else the best supported it has.
	type mark struct{ page, d int }
	var marks []mark
	cur, have := 0, false
	for i, ns := range numbers {
		best, found := 0, false
		for _, n := range ns {
			d := i + 1 - n
			if count[d] < minVotes {
				continue
			}
			if have && d == cur {
				best, found = d, true
				break
			}
			if !found || count[d] > count[best] || (count[d] == count[best] && d < best) {
				best, found = d, true
			}
		}
		if found {
			marks = append(marks, mark{i + 1, best})
			cur, have = best, true
		}
	}

	// Stretches of marks with one distance; short ones are strays, and
	// dropping one can join its neighbours, so repeat until nothing
	// changes.
	type stretch struct{ first, last, d, n int }
	var ss []stretch
	for _, mk := range marks {
		if k := len(ss); k > 0 && ss[k-1].d == mk.d {
			ss[k-1].last = mk.page
			ss[k-1].n++
			continue
		}
		ss = append(ss, stretch{mk.page, mk.page, mk.d, 1})
	}
	for {
		var kept []stretch
		for _, s := range ss {
			if s.n < minRun && len(ss) > 1 {
				continue
			}
			if k := len(kept); k > 0 && kept[k-1].d == s.d {
				kept[k-1].last = s.last
				kept[k-1].n += s.n
				continue
			}
			kept = append(kept, s)
		}
		if len(kept) == len(ss) {
			break
		}
		ss = kept
	}

	total := 0
	for _, s := range ss {
		total += s.n
	}
	if len(ss) == 0 || total < minVotes || float64(total) < minShare*float64(withText) {
		return nil, false
	}
	// A run starts on the page after the last one the run before it
	// numbered: pages between carry no number of their own, and the gap
	// is behind them.
	for i, s := range ss {
		from := 1
		if i > 0 {
			from = ss[i-1].last + 1
		}
		runs = append(runs, Run{From: from, Offset: s.d})
	}
	return New(runs).Runs(), true
}
