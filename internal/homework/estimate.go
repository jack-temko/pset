package homework

import (
	"context"
	"math"
)

// The time left on a set, from how long its finished questions took the
// student and how hard each question is. The one thing the student would
// regret is being told a time confidently and being wrong, so this says
// nothing until it has something to go on, and says how sure it is:
//
//   - nothing until two finished questions have been timed, and a
//     question done in under a minute is not counted (it was clicked
//     through, and would teach the pace that the rest take no time);
//   - a range, from the spread in how long the finished ones took against
//     how hard they were, how few of them there are, and how few are left;
//   - never below zero, never for a finished set.
//
// The client rounds it to five minutes and shows "about", or the range
// when it is wide. A calibration test (estimate_test.go) feeds it timed
// sets with known noise and checks its error and its range's coverage.
// Spec: web/src/views/homework/grill.md, A1 and D28.

const (
	// minTimed is how many finished, timed questions the pace needs.
	minTimed = 2
	// minSeconds is the least a finished question's time can be to count.
	minSeconds = 60
	// spreadFloor is the least spread between questions assumed: people
	// are never as steady as two or three questions look.
	spreadFloor = 0.25
	// scoreError is how wrong the difficulty scores themselves are, as a
	// fraction of the time they predict.
	scoreError = 0.1
	// z is the range's width in standard errors: about nine times in ten.
	z = 1.645
	// leastLeft is the share of a started question still to go, however
	// long has been spent: a question is not done because it has run long.
	leastLeft = 0.25
)

// estimateItem is one question as the estimate sees it.
type estimateItem struct {
	Done       bool
	Difficulty int
	Seconds    int
}

// weight is a question's share of the work: its difficulty, or an even
// share when it has not been ranked.
func (i estimateItem) weight() float64 {
	if i.Difficulty <= 0 {
		return 1
	}
	return float64(i.Difficulty)
}

// estimateLeft is the time left and how many questions it learned the pace
// from; nil, 0 when it has nothing to say.
func estimateLeft(items []estimateItem) (*Estimate, int) {
	var learned []estimateItem
	for _, it := range items {
		if it.Done && it.Seconds >= minSeconds {
			learned = append(learned, it)
		}
	}
	if len(learned) < minTimed {
		return nil, 0
	}
	// The pace: seconds a point of difficulty took, over everything
	// finished (a ratio of sums, so one odd question moves it least).
	var secs, weights float64
	for _, it := range learned {
		secs += float64(it.Seconds)
		weights += it.weight()
	}
	pace := secs / weights

	// How far the questions vary from that pace, as a fraction of it,
	// with the spread never assumed smaller than people are.
	var rates []float64
	for _, it := range learned {
		rates = append(rates, float64(it.Seconds)/it.weight()/pace)
	}
	n := float64(len(rates))
	var ss float64
	for _, r := range rates {
		ss += (r - 1) * (r - 1)
	}
	cv := math.Max(math.Sqrt(ss/(n-1)), spreadFloor) * (1 + 2/n)

	// What is left: each unfinished question's share, less what has been
	// spent on it, but never less than a quarter of it.
	var left, remW, remW2 float64
	open := 0
	for _, it := range items {
		if it.Done {
			continue
		}
		w := it.weight()
		want := w * pace
		left += math.Max(want-float64(it.Seconds), leastLeft*want)
		remW += w
		remW2 += w * w
		open++
	}
	if open == 0 || left <= 0 {
		return nil, 0
	}

	// How unsure: the pace is learned from few questions (its own
	// variance), what is left will vary from its own mean (more, the fewer
	// questions there are), and the scores are not exact.
	var lw2 float64
	for _, it := range learned {
		lw2 += it.weight() * it.weight()
	}
	nEff := weights * weights / lw2
	rel := math.Sqrt(cv*cv/nEff + cv*cv*remW2/(remW*remW) + scoreError*scoreError)
	low := math.Max(left*(1-z*rel), 0)
	high := left * (1 + z*rel)
	return &Estimate{Seconds: int(math.Round(left)), Low: int(math.Round(low)), High: int(math.Round(high))}, len(learned)
}

// fillSummaries puts on each set what is worked out from its questions:
// its bar (one entry per question), how many questions the pace was
// learned from, and the time left. Two queries for any number of sets.
func (s *Service) fillSummaries(ctx context.Context, hs []Summary) error {
	if len(hs) == 0 {
		return nil
	}
	marks, args := placeholders(len(hs))
	for i, h := range hs {
		args[i] = h.ID
	}
	rows, err := s.c.DB.QueryContext(ctx, `SELECT id, homework_id, done_at != '', state = 'failed', difficulty
		FROM questions WHERE homework_id IN (`+marks+`) ORDER BY homework_id, position`, args...)
	if err != nil {
		return err
	}
	type one struct {
		id string
		estimateItem
		failed bool
	}
	bySet := map[string][]one{}
	var ids []string
	for rows.Next() {
		var o one
		var set string
		if err := rows.Scan(&o.id, &set, &o.Done, &o.failed, &o.Difficulty); err != nil {
			rows.Close()
			return err
		}
		bySet[set] = append(bySet[set], o)
		ids = append(ids, o.id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	var seconds map[string]int
	if s.c.Time != nil {
		if seconds, err = s.c.Time.QuestionSeconds(ctx, ids); err != nil {
			return err
		}
	}
	for i, h := range hs {
		os := bySet[h.ID]
		items := make([]estimateItem, len(os))
		hs[i].Bar = make([]BarEntry, len(os))
		for j, o := range os {
			o.Seconds = seconds[o.id]
			items[j] = o.estimateItem
			items[j].Seconds = o.Seconds
			hs[i].Bar[j] = BarEntry{Done: o.Done, Failed: o.failed, Weight: o.Difficulty}
		}
		hs[i].Estimate, hs[i].Timed = estimateLeft(items)
	}
	return nil
}

// placeholders is n "?"s joined, and a slice to hold their arguments.
func placeholders(n int) (string, []any) {
	m := make([]byte, 0, 2*n)
	for i := 0; i < n; i++ {
		if i > 0 {
			m = append(m, ',')
		}
		m = append(m, '?')
	}
	return string(m), make([]any, n)
}
