package homework

import (
	"bytes"
	"context"
	"image/jpeg"
	"slices"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/jackt/pset/internal/doc"
	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/llm/llmtest"
)

func TestFigureNumbers(t *testing.T) {
	for in, want := range map[string][]string{
		"Find the Norton equivalent in Fig. 4.119.":                                              {"4.119"},
		"Figure 7.1.3(a) shows the masses; the forces are in Figure 7.1.3(b).":                   {"7.1.3"},
		"(see FIGURE 2.5.9). In this case":                                                       {"2.5.9"},
		"shown in Figures 1.1.5 through 1.1.10. … The direction field of Figure 1.1.6.":          {"1.1.6"},
		"Consider the circuit shown in Figure 7.1.2 and the one in Fig 7.1.4, then Figure 7.1.2": {"7.1.2", "7.1.4"},
		"No figure here, just the configuration of a figure-eight.":                              nil,
	} {
		if got := figureNumbers(in); !slices.Equal(got, want) {
			t.Errorf("%q: %q, want %q", in, got, want)
		}
	}
}

func TestFigureCandidates(t *testing.T) {
	texts := []string{"", "", "shown in Figure 7.1.2. Let V", "", "", "7.1.20 is not it", "the problem"}
	// The problem's own page, the page that mentions it, then the rest
	// within reach, nearest first; never past the book.
	if got := figureCandidates(texts, 7, "7.1.2"); !slices.Equal(got, []int{7, 3, 6, 5, 4}) {
		t.Fatalf("candidates %v", got)
	}
}

// A figure the Finder boxed that the problem doesn't name is dropped, and
// the one it names is looked for on the pages around, and kept once its
// caption says it's the one.
func TestAFigureOnAnotherPageIsFound(t *testing.T) {
	e := newEnv(t)
	var captionCalls atomic.Int32
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		sys := req.Messages[0].Content.Text()
		switch {
		case strings.Contains(sys, "You write out one homework problem"):
			return llmtest.Reply{Text: "Find the voltage across $R_2$ in Figure 3.7."}
		case strings.Contains(sys, "You read the captions"):
			// The figure boxed on the problem's page is 3.8; the one found
			// on another page is 3.7.
			if captionCalls.Add(1) == 1 {
				return llmtest.Reply{Text: `{"captions": ["3.8"]}`}
			}
			return llmtest.Reply{Text: `{"captions": ["3.7"]}`}
		case strings.Contains(sys, "You find one figure"):
			return llmtest.Reply{Text: `{"image": 3, "rect": {"x": 0.1, "y": 0.1, "w": 0.5, "h": 0.4}}`}
		}
		return fakeModel(req)
	})
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	if len(q.Figures) != 1 || q.Figures[0].Label != "Figure 3.7" {
		t.Fatalf("figures %+v", q.Figures)
	}
	r, err := getQuestion(context.Background(), e.svc.c.DB, q.ID)
	if err != nil {
		t.Fatal(err)
	}
	// Found on image 3 of the problem's page 3 and the pages around it: 3,
	// 2, 4.
	if r.FigRect[0].Page != 4 {
		t.Fatalf("figure on page %d, want 4", r.FigRect[0].Page)
	}
	// The wire carries the size of the cropped image (the box with its
	// padding) as page fractions, so the image can hold its place. The served
	// image snaps each edge to a gutter, up to 2.5% of the page, so its
	// proportions lie within what that can move from the wire's.
	got := q.Figures[0]
	pageJPG, err := e.svc.c.Library.PageJPEG(context.Background(), h.BookID, r.FigRect[0].Page, cropWidth)
	if err != nil {
		t.Fatal(err)
	}
	pageImg, err := jpeg.Decode(bytes.NewReader(pageJPG))
	if err != nil {
		t.Fatal(err)
	}
	aspect := float64(pageImg.Bounds().Dy()) / float64(pageImg.Bounds().Dx())
	jpg, err := e.svc.Figure(context.Background(), q.ID, 0)
	if err != nil {
		t.Fatal(err)
	}
	img, err := jpeg.Decode(bytes.NewReader(jpg))
	if err != nil {
		t.Fatal(err)
	}
	ratio := float64(img.Bounds().Dy()) / float64(img.Bounds().Dx())
	const snap = 2 * 0.025 // both edges, a fraction of the page
	lo := (got.H - snap) * aspect / (got.W + snap)
	hi := (got.H + snap) * aspect / (got.W - snap)
	if got.W <= 0 || got.H <= 0 || ratio < lo || ratio > hi {
		t.Fatalf("served image %v high per wide; the wire's %v x %v of a page at aspect %v allows %v to %v", ratio, got.W, got.H, aspect, lo, hi)
	}

	// The set's own summary carries the question it opens on: its figures'
	// sizes and the help rows left open, so the walkthrough can reserve them.
	d, err := e.svc.Get(context.Background(), h.ID)
	if err != nil {
		t.Fatal(err)
	}
	op := d.Homework.Opening
	if op == nil || len(op.Figures) != 1 || op.Figures[0].W != got.W || op.Figures[0].H != got.H || op.Revealed == nil {
		t.Fatalf("opening %+v, want one figure %v x %v", op, got.W, got.H)
	}
	if _, err := e.svc.c.DB.Exec(`UPDATE questions SET revealed = '["hint"]' WHERE id = ?`, q.ID); err != nil {
		t.Fatal(err)
	}
	if d, err = e.svc.Get(context.Background(), h.ID); err != nil || len(d.Homework.Opening.Revealed) != 1 || d.Homework.Opening.Revealed[0] != "hint" {
		t.Fatalf("revealed rows %+v %v", d.Homework.Opening, err)
	}
}

// A problem that names no figure by number keeps what was boxed: there's
// nothing to check it against.
func TestUnnamedFiguresStay(t *testing.T) {
	e := newEnv(t)
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	if len(q.Figures) != 1 || requestsTo(e, "You read the captions") != 0 {
		t.Fatalf("figures %+v, caption checks %d", q.Figures, requestsTo(e, "You read the captions"))
	}
}

func TestBalance(t *testing.T) {
	for in, want := range map[string]string{
		`{"figures": [{"rect": {"h": 0.2}}}`: `{"figures": [{"rect": {"h": 0.2}}]}`,
		`{"a": [1, 2}`:                       `{"a": [1, 2]}`,
		`{"a": "}]"`:                         `{"a": "}]"}`,
		`{"a": 1}}`:                          `{"a": 1}`,
	} {
		if got, _ := balance(in); got != want {
			t.Errorf("%s: %s, want %s", in, got, want)
		}
	}
	var pin struct {
		Image   int `json:"image"`
		Figures []struct {
			Label string `json:"label"`
		} `json:"figures"`
	}
	if err := decodeReply("```json\n{\"image\": 1, \"figures\": [{\"label\": \"Figure 7.1.3\", \"rect\": {\"h\": 0.2}}}\n```", &pin); err != nil || pin.Image != 1 || len(pin.Figures) != 1 {
		t.Fatalf("%+v %v", pin, err)
	}
}

func TestSameNumber(t *testing.T) {
	for _, c := range []struct {
		label, number string
		want          bool
	}{
		{"7.1 #14", "14", true}, {"14.", "14", true}, {"*4.68", "68", true}, {"Problem 4.72", "72", true},
		{"", "14", false}, {"7.1 #13", "14", false}, {"4.7", "72", false},
	} {
		if got := sameNumber(c.label, c.number); got != c.want {
			t.Errorf("%q vs %q: %v", c.label, c.number, got)
		}
	}
}

func TestProblemStarts(t *testing.T) {
	got := problemStarts(`<collection mention="problem">
 <point_box mention="Problem 12"> (538,182) (1034,262) </point_box>
 <point_box mention="Problem 12b"> (560,240) (1034,262) </point_box>
 <point_box mention="Problem 12"> (560,300) (1000,320) </point_box>
 <point_box mention="Problem *4.68"> (88,561) (447,604) </point_box>
 <point_box mention="Equation (19)"> (300,700) (600,730) </point_box>
 <point_box> (1,1) (2,2) </point_box>
</collection>
<collection mention="Problem 7">
 <point_box> (60,800) (500,840) </point_box>
</collection>`)
	if len(got) != 3 || got["12"].Y != 0.182 || got["68"].X != 0.088 || got["7"].Y != 0.8 {
		t.Fatalf("%+v", got)
	}
}

// The page's problems are boxed in the Finder's own mode, with no model
// to fall back on and no reasoning asked for; a reply it can't use leaves
// the find's own box.
func TestTheTextBoxIsAskedForInBoxingMode(t *testing.T) {
	e := newEnv(t)
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if req.Messages[0].Content.Text() == "<hint>BOX</hint>" {
			return llmtest.Reply{Text: `<point_box mention="Problem 3.36"> (100,200) (500,230) </point_box>`}
		}
		return fakeModel(req)
	})
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	asked := false
	for _, r := range e.llm.Chats() {
		if r.Messages[0].Content.Text() == "<hint>BOX</hint>" {
			asked = true
			if r.Model != llm.Finder.Model || len(r.Models) != 0 || r.Reasoning != nil {
				t.Errorf("boxing asked as %s, models %v, reasoning %+v", r.Model, r.Models, r.Reasoning)
			}
		}
	}
	// The fake page is blank: the find's own box stands.
	r, _ := getQuestion(context.Background(), e.svc.c.DB, q.ID)
	if !asked || r.Rect == nil {
		t.Fatalf("asked %v, rect %+v", asked, r.Rect)
	}
}

// The Finder's label echoes the number it was asked for, so a page with a
// practice problem of that number passes its check. The Reader, writing
// the problem out, says the page doesn't show it, and the find goes on to
// the next pages instead of saving its complaint as the problem.
func TestAPageTheReaderRejectsIsPassedOver(t *testing.T) {
	e := newEnv(t)
	var writes atomic.Int32
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if strings.Contains(req.Messages[0].Content.Text(), "You write out one homework problem") {
			if writes.Add(1) == 1 {
				return llmtest.Reply{Text: "NOT ON THIS PAGE"}
			}
			return llmtest.Reply{Text: "Find the mesh currents in Figure 3.7."}
		}
		return fakeModel(req)
	})
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	if got := doc.Plain(q.Statement); got != "Find the mesh currents in Figure 3.7." {
		t.Fatalf("statement %q", got)
	}
	if writes.Load() != 2 || requestsTo(e, "You find one homework problem") < 2 {
		t.Fatalf("%d write-outs, %d finds: the rejected page should send the find on", writes.Load(), requestsTo(e, "You find one homework problem"))
	}
}

// The Finder's label doesn't veto a page: it copies the prompt's example
// on the right page. A pick with another number is written out, and kept
// when the Reader finds the problem on it.
func TestAWrongLabelIsLeftToTheReader(t *testing.T) {
	e := newEnv(t)
	var finds atomic.Int32
	e.llm.Fallback(func(req llm.ChatRequest) llmtest.Reply {
		if strings.Contains(req.Messages[0].Content.Text(), "You find one homework problem") {
			finds.Add(1)
			return llmtest.Reply{Text: `{"image": 1, "label": "3.19", "question_rect": {"x": 0.1, "y": 0.2, "w": 0.8, "h": 0.2}}`}
		}
		return fakeModel(req)
	})
	h := e.newSet(t)
	q := e.wait(t, e.add(t, h.ID, Draft{Text: "3.36", InBook: true})[0].ID, StateReady)
	if finds.Load() != 1 || doc.Plain(q.Statement) != "Find the voltage across R_2." {
		t.Fatalf("%d finds, statement %q: the first pick should stand", finds.Load(), doc.Plain(q.Statement))
	}
}
