package homework

import (
	"context"
	"math"
	"math/rand"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackt/pset/internal/activity"
	"github.com/jackt/pset/internal/db"
	"github.com/jackt/pset/internal/llm/llmtest"
)

func TestNothingToSayUntilTwoFinishedQuestionsAreTimed(t *testing.T) {
	cases := map[string][]estimateItem{
		"none timed":                     {{Done: true}, {Done: true}, {}},
		"one timed":                      {{Done: true, Difficulty: 2, Seconds: 600}, {Done: true}, {Difficulty: 3}},
		"two but one is a click-through": {{Done: true, Difficulty: 2, Seconds: 600}, {Done: true, Difficulty: 2, Seconds: 20}, {Difficulty: 3}},
		"timed but not finished":         {{Difficulty: 2, Seconds: 600}, {Difficulty: 2, Seconds: 600}, {Difficulty: 3}},
		"all done":                       {{Done: true, Difficulty: 2, Seconds: 600}, {Done: true, Difficulty: 2, Seconds: 600}},
		"nothing in it":                  nil,
	}
	for name, items := range cases {
		if e, n := estimateLeft(items); e != nil || n != 0 {
			t.Errorf("%s: said %+v from %d", name, e, n)
		}
	}
}

func TestPaceIsSecondsPerPointOfDifficulty(t *testing.T) {
	// 600 s for each of two 2-point questions is 300 s a point; a 4-point
	// and a 1-point question left is 1500 s.
	e, n := estimateLeft([]estimateItem{
		{Done: true, Difficulty: 2, Seconds: 600},
		{Done: true, Difficulty: 2, Seconds: 600},
		{Difficulty: 4},
		{Difficulty: 1},
	})
	if e == nil || n != 2 || e.Seconds != 1500 {
		t.Fatalf("estimate %+v from %d, want 1500 s from 2", e, n)
	}
	if !(e.Low < e.Seconds && e.Seconds < e.High) || e.Low < 0 {
		t.Fatalf("range %+v does not hold the estimate", e)
	}
}

func TestUnrankedQuestionsShareEvenly(t *testing.T) {
	e, _ := estimateLeft([]estimateItem{{Done: true, Seconds: 300}, {Done: true, Seconds: 300}, {}, {}})
	if e == nil || e.Seconds != 600 {
		t.Fatalf("estimate %+v, want 600 s", e)
	}
}

func TestAQuestionStartedHasLessLeftButNeverLessThanAQuarter(t *testing.T) {
	base := []estimateItem{{Done: true, Difficulty: 1, Seconds: 400}, {Done: true, Difficulty: 1, Seconds: 400}}
	// A 2-point question is 800 s; 300 s in, 500 are left.
	e, _ := estimateLeft(append(base, estimateItem{Difficulty: 2, Seconds: 300}))
	if e == nil || e.Seconds != 500 {
		t.Fatalf("started: %+v, want 500 s", e)
	}
	// Run far over: a quarter of it, 200 s, still to go.
	e, _ = estimateLeft(append(base, estimateItem{Difficulty: 2, Seconds: 2000}))
	if e == nil || e.Seconds != 200 {
		t.Fatalf("over: %+v, want 200 s", e)
	}
}

// simulate runs timed sets whose questions take their difficulty times a
// pace, with noise, finishes the first few, and asks for the time left. It
// reports the median relative error of the estimate, how often the true
// time left was inside the range, and the median width of the range against
// the estimate.
func simulate(sigma float64, done, trials int, seed int64) (medianErr, coverage, medianWidth float64) {
	rng := rand.New(rand.NewSource(seed))
	var errs, widths []float64
	covered := 0
	for i := 0; i < trials; i++ {
		m := done + 3 + rng.Intn(9)
		pace := 200 + 400*rng.Float64()
		var items []estimateItem
		var truth float64
		for j := 0; j < m; j++ {
			d := 1 + rng.Intn(5)
			// Mean-preserving noise: a question takes what its difficulty
			// says, on average, and more or less than it by luck.
			secs := float64(d) * pace * math.Exp(sigma*rng.NormFloat64()-sigma*sigma/2)
			if j < done {
				items = append(items, estimateItem{Done: true, Difficulty: d, Seconds: int(secs)})
			} else {
				items = append(items, estimateItem{Difficulty: d})
				truth += secs
			}
		}
		e, _ := estimateLeft(items)
		if e == nil {
			continue
		}
		errs = append(errs, math.Abs(float64(e.Seconds)-truth)/truth)
		widths = append(widths, float64(e.High-e.Low)/float64(e.Seconds))
		if float64(e.Low) <= truth && truth <= float64(e.High) {
			covered++
		}
	}
	sort.Float64s(errs)
	sort.Float64s(widths)
	return errs[len(errs)/2], float64(covered) / float64(len(errs)), widths[len(widths)/2]
}

// The estimate is never confidently wrong: whatever the student's
// steadiness, the true time left falls inside the range it gives about
// nine times in ten, and the more erratic they are, the wider it says so.
func TestEstimateIsCalibrated(t *testing.T) {
	cases := []struct {
		name   string
		sigma  float64
		maxErr float64
	}{
		{"steady", 0.15, 0.20},
		{"usual", 0.4, 0.35},
		{"erratic", 0.8, 0.70},
	}
	prevWidth := 0.0
	for _, c := range cases {
		err, cover, width := simulate(c.sigma, 3, 4000, 7)
		t.Logf("%s (sigma %.2f): median error %.2f, covered %.2f, median width %.2f", c.name, c.sigma, err, cover, width)
		if err > c.maxErr {
			t.Errorf("%s: median error %.2f over %.2f", c.name, err, c.maxErr)
		}
		if cover < 0.85 {
			t.Errorf("%s: the truth was in the range only %.0f%% of the time", c.name, cover*100)
		}
		if width < prevWidth {
			t.Errorf("%s: a steadier student got a wider range (%.2f after %.2f)", c.name, width, prevWidth)
		}
		prevWidth = width
	}
}

// With only two questions to learn from, it is honest about that.
func TestFewQuestionsGiveAWiderRange(t *testing.T) {
	_, coverTwo, widthTwo := simulate(0.4, 2, 4000, 11)
	_, coverSix, widthSix := simulate(0.4, 6, 4000, 11)
	t.Logf("two done: covered %.2f width %.2f; six done: covered %.2f width %.2f", coverTwo, widthTwo, coverSix, widthSix)
	if coverTwo < 0.85 || coverSix < 0.85 {
		t.Errorf("coverage %.2f (two) and %.2f (six) under 85%%", coverTwo, coverSix)
	}
	if widthTwo <= widthSix {
		t.Errorf("two questions gave a range %.2f, no wider than six's %.2f", widthTwo, widthSix)
	}
}

// clientShowsRange is the width (against the estimate) past which the
// client shows the range instead of "about": web/src/views/homework/progress.ts, WIDE.
const clientShowsRange = 0.8

// The range narrows as more questions are finished: early on everyone
// gets a range, a steady student's narrows to "about" as they go on, and
// an erratic student keeps a range however long they go.
func TestTheRangeNarrowsWithMoreFinishedAndOnlyForASteadyStudent(t *testing.T) {
	prev := math.Inf(1)
	for _, done := range []int{3, 6, 12} {
		_, _, steady := simulate(0.15, done, 4000, 13)
		_, _, erratic := simulate(0.8, done, 4000, 13)
		t.Logf("%d done: steady width %.2f, erratic width %.2f", done, steady, erratic)
		if steady >= prev {
			t.Errorf("%d done: the range did not narrow (%.2f after %.2f)", done, steady, prev)
		}
		if erratic <= clientShowsRange {
			t.Errorf("%d done: an erratic student gets a narrow range (%.2f): a confident number", done, erratic)
		}
		if done == 3 && steady <= clientShowsRange {
			t.Errorf("three done is too few for a number, got width %.2f", steady)
		}
		if done >= 6 && steady > clientShowsRange {
			t.Errorf("%d done and steady, still a range (width %.2f)", done, steady)
		}
		prev = steady
	}
}

func TestSetsCarryTheirBarAndTheTimeLeft(t *testing.T) {
	e := newEnv(t)
	e.llm.Fallback(ranker(func(string) llmtest.Reply { return llmtest.Reply{Text: "no scores"} }))
	h := e.newSet(t)
	qs := e.add(t, h.ID,
		Draft{Text: "One, written here.", InBook: false}, Draft{Text: "Two, written here.", InBook: false},
		Draft{Text: "Three, written here.", InBook: false}, Draft{Text: "Four, written here.", InBook: false})
	for _, q := range qs {
		e.wait(t, q.ID, StateReady)
		e.difficulty(t, q.ID)
	}
	for i, d := range []int{2, 2, 4, 1} {
		e.svc.c.DB.Exec(`UPDATE questions SET difficulty = ? WHERE id = ?`, d, qs[i].ID)
	}
	yes := true
	e.do(t, "PATCH", "/api/questions/"+qs[0].ID, QuestionPatch{Done: &yes}, nil)
	var before Detail
	e.do(t, "GET", "/api/homework/"+h.ID, nil, &before)
	if before.Homework.Estimate != nil || before.Homework.Timed != 0 {
		t.Fatalf("an estimate with nothing timed: %+v", before.Homework)
	}
	e.svc.c.Time = spent{qs[0].ID: 600, qs[1].ID: 600}
	e.do(t, "PATCH", "/api/questions/"+qs[1].ID, QuestionPatch{Done: &yes}, nil)

	var d Detail
	e.do(t, "GET", "/api/homework/"+h.ID, nil, &d)
	est := d.Homework.Estimate
	if est == nil || est.Seconds != 1500 || d.Homework.Timed != 2 {
		t.Fatalf("estimate %+v timed %d, want 1500 s from 2", est, d.Homework.Timed)
	}
	want := []BarEntry{{Done: true, Weight: 2}, {Done: true, Weight: 2}, {Weight: 4}, {Weight: 1}}
	if len(d.Homework.Bar) != 4 {
		t.Fatalf("bar %+v", d.Homework.Bar)
	}
	for i, b := range d.Homework.Bar {
		if b != want[i] {
			t.Errorf("bar[%d] = %+v, want %+v", i, b, want[i])
		}
	}
	// The list carries the same, and so does the event a change sends.
	var list List
	e.do(t, "GET", "/api/books/b1/homework", nil, &list)
	if len(list.Homework) != 1 || list.Homework[0].Estimate == nil || len(list.Homework[0].Bar) != 4 {
		t.Fatalf("list %+v", list.Homework)
	}
	sawEstimate := false
	for _, ev := range e.events.all() {
		if strings.HasPrefix(ev, EventHomeworkChanged) && strings.Contains(ev, `"estimate":{"seconds":1500`) {
			sawEstimate = true
		}
	}
	if !sawEstimate {
		t.Fatal("no homework.changed event carried the estimate")
	}
}

// The real thing end to end: stretches saved through the activity service,
// read back as a question's seconds and a set's time left.
func TestTimeLeftFromRealStretches(t *testing.T) {
	e := newEnv(t)
	e.llm.Fallback(ranker(func(string) llmtest.Reply { return llmtest.Reply{Text: "no scores"} }))
	clock := activity.New(e.svc.c.DB, nil)
	if err := db.Migrate(context.Background(), e.svc.c.DB, activity.Migrations()); err != nil {
		t.Fatal(err)
	}
	e.svc.c.Time = clock
	h := e.newSet(t)
	qs := e.add(t, h.ID, Draft{Text: "One, written here.", InBook: false}, Draft{Text: "Two, written here.", InBook: false},
		Draft{Text: "Three, written here.", InBook: false}, Draft{Text: "Four, written here.", InBook: false})
	for _, q := range qs {
		e.wait(t, q.ID, StateReady)
		e.difficulty(t, q.ID)
	}
	for i, d := range []int{2, 2, 4, 1} {
		e.svc.c.DB.Exec(`UPDATE questions SET difficulty = ? WHERE id = ?`, d, qs[i].ID)
	}
	start := time.Now().UTC().Add(-2 * time.Hour)
	at := func(m int) string { return start.Add(time.Duration(m) * time.Minute).Format(time.RFC3339) }
	for i, s := range []activity.Stretch{
		{ID: "s1", BookID: "b1", Kind: activity.KindHomework, Started: at(0), Ended: at(10), QuestionID: qs[0].ID},
		{ID: "s2", BookID: "b1", Kind: activity.KindHomework, Started: at(10), Ended: at(20), QuestionID: qs[1].ID},
		{ID: "s3", BookID: "b1", Kind: activity.KindHomework, Started: at(20), Ended: at(25)},
	} {
		if err := clock.Save(context.Background(), s); err != nil {
			t.Fatalf("stretch %d: %v", i, err)
		}
	}
	yes := true
	e.do(t, "PATCH", "/api/questions/"+qs[0].ID, QuestionPatch{Done: &yes}, nil)
	e.do(t, "PATCH", "/api/questions/"+qs[1].ID, QuestionPatch{Done: &yes}, nil)
	var d Detail
	e.do(t, "GET", "/api/homework/"+h.ID, nil, &d)
	if d.Questions[0].Seconds != 600 || d.Questions[1].Seconds != 600 || d.Questions[2].Seconds != 0 {
		t.Fatalf("seconds %d %d %d, want 600 600 0 (the stretch with no question is for none)", d.Questions[0].Seconds, d.Questions[1].Seconds, d.Questions[2].Seconds)
	}
	if est := d.Homework.Estimate; est == nil || est.Seconds != 1500 || d.Homework.Timed != 2 {
		t.Fatalf("estimate %+v timed %d, want 1500 s from 2", est, d.Homework.Timed)
	}
}
