package doc

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/jackt/pset/internal/pagenum"
)

// feedIn streams text in pieces of n bytes, the way a model cuts it.
func feedIn(p *Parser, text string, n int) {
	for len(text) > 0 {
		k := min(n, len(text))
		p.Feed(text[:k])
		text = text[k:]
	}
	p.Finish()
}

type events struct {
	starts    []string
	repairing []string
	blocks    []string
	failed    int
	text      []Run
}

func (e *events) handler() Handler {
	return Handler{
		BlockStart: func(t string) { e.starts = append(e.starts, t) },
		Repairing:  func(t string) { e.repairing = append(e.repairing, t) },
		Block: func(b Block, failed bool) {
			e.blocks = append(e.blocks, TypeOf(b))
			if failed {
				e.failed++
			}
		},
		Text: func(rs []Run) { e.text = append(e.text, rs...) },
	}
}

// noModel fails the test if a repair call is made.
func noModel(t *testing.T) Model {
	return func(context.Context, string, string) (string, error) {
		t.Helper()
		t.Error("an unexpected repair call")
		return "", errors.New("no model")
	}
}

// script is a fake model: it answers each call from the next reply, and
// records what it was asked.
type script struct {
	replies []string
	asked   []string
}

func (s *script) model() Model {
	return func(_ context.Context, system, user string) (string, error) {
		s.asked = append(s.asked, user)
		if len(s.replies) == 0 {
			return "", errors.New("out of replies")
		}
		r := s.replies[0]
		s.replies = s.replies[1:]
		return r, nil
	}
}

func types(p *Parser) []string {
	var out []string
	for _, b := range p.Blocks() {
		out = append(out, TypeOf(b))
	}
	return out
}

func fixture(t *testing.T, name string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// The guides the real model wrote (see ideas/structured-guides.md, "Prompt
// evaluation") parse whole at any chunking: every block valid, no repair,
// every math run and tex field passing KaTeX, a hint first and an answer
// somewhere, and no raw math shown.
func TestRealGuidesParseWholeAtAnyChunking(t *testing.T) {
	files, _ := filepath.Glob("testdata/guide-*.jsonl")
	if len(files) < 5 {
		t.Fatalf("fixtures: %v", files)
	}
	for _, f := range files {
		text := fixture(t, filepath.Base(f))
		for _, n := range []int{1, 5, 64, 100000} {
			var e events
			p := NewParser(context.Background(), Options{Mode: Guide, Pages: pagenum.Single(12), PageCount: 700, Model: noModel(t)}, e.handler())
			feedIn(p, text, n)
			if p.Failed() != 0 {
				t.Fatalf("%s n=%d: %d raw blocks", f, n, p.Failed())
			}
			if !p.Complete() {
				t.Fatalf("%s n=%d: not complete: %v", f, n, types(p))
			}
			if got := types(p)[0]; got != TypeHint {
				t.Fatalf("%s n=%d: first block is %s", f, n, got)
			}
			for _, b := range p.Blocks() {
				assertNoRawMath(t, f, b)
			}
			// One start per block, and the block replaces it.
			if len(e.starts) != len(e.blocks) || len(e.blocks) != len(p.Blocks()) {
				t.Fatalf("%s n=%d: %d starts, %d blocks events, %d blocks", f, n, len(e.starts), len(e.blocks), len(p.Blocks()))
			}
		}
	}
}

func assertNoRawMath(t *testing.T, f string, b Block) {
	t.Helper()
	var v any
	json.Unmarshal(b, &v)
	var walk func(any)
	walk = func(x any) {
		switch x := x.(type) {
		case map[string]any:
			if raw, _ := x["raw"].(bool); raw {
				t.Errorf("%s: raw math in %s", f, b)
			}
			for _, y := range x {
				walk(y)
			}
		case []any:
			for _, y := range x {
				walk(y)
			}
		}
	}
	walk(v)
}

func TestSingleEscapedBackslashesAndFormFeedsAreRead(t *testing.T) {
	text := fixture(t, "guide-single-escaped.jsonl")
	p := NewParser(context.Background(), Options{Mode: Guide, Model: noModel(t)}, Handler{})
	feedIn(p, text, 64)
	all := ""
	for _, b := range p.Blocks() {
		all += string(b)
	}
	if strings.ContainsAny(all, "\f\b\r") || strings.Contains(all, `\u000c`) {
		t.Fatal("a control character survived into the stored blocks")
	}
	if !strings.Contains(all, `\\frac`) {
		t.Fatal("no fraction in the guide")
	}
}

func TestNarrationBeforeTheFirstBlockIsDropped(t *testing.T) {
	text := fixture(t, "guide-narrated.jsonl")
	p := NewParser(context.Background(), Options{Mode: Guide, Model: noModel(t)}, Handler{})
	feedIn(p, text, 100)
	if types(p)[0] != TypeHint || p.Failed() != 0 {
		t.Fatalf("%v failed=%d", types(p), p.Failed())
	}
}

func TestResetDropsARoundOfNarration(t *testing.T) {
	p := NewParser(context.Background(), Options{Mode: Guide, Model: noModel(t)}, Handler{})
	p.Feed(`{"type":"para","text":"Let me compute."}` + "\n")
	p.Reset()
	feedIn(p, `{"type":"hint","text":"Start here."}`+"\n"+`{"type":"answer","text":"42"}`+"\n", 9)
	if !reflect.DeepEqual(types(p), []string{"hint", "answer"}) || !p.Complete() {
		t.Fatalf("%v", types(p))
	}
}

func TestAnObjectSplitOverTwoLinesIsOneBlock(t *testing.T) {
	var e events
	p := NewParser(context.Background(), Options{Mode: Ask, Model: noModel(t)}, e.handler())
	feedIn(p, "{\n  \"type\": \"para\",\n  \"text\": \"one\ntwo\"\n}\n{\"type\":\"note\",\"text\":\"n\"}\n", 3)
	if !reflect.DeepEqual(types(p), []string{"para", "note"}) {
		t.Fatalf("%v", types(p))
	}
}

func TestATextBlockStreamsAsItArrives(t *testing.T) {
	var e events
	p := NewParser(context.Background(), Options{Mode: Ask, Model: noModel(t)}, e.handler())
	line := `{"type":"para","text":"Since \\(1/p\\) minutes cost **a lot** [p. 3], it stays."}` + "\n"
	// Up to the middle of the math run: the words before it are out, the run isn't.
	cut := strings.Index(line, `1/p`) + 1
	p.Feed(line[:cut])
	if len(e.starts) != 1 || e.starts[0] != "para" {
		t.Fatalf("starts %v", e.starts)
	}
	if len(e.text) != 1 || e.text[0].T != "Since " {
		t.Fatalf("streamed %+v", e.text)
	}
	p.Feed(line[cut:])
	p.Finish()
	var got []Run
	for _, r := range e.text {
		if n := len(got); n > 0 && got[n-1].T != "" && r.T != "" && got[n-1].B == r.B && got[n-1].I == r.I {
			got[n-1].T += r.T
			continue
		}
		got = append(got, r)
	}
	var blk ParaBlock
	json.Unmarshal(p.Blocks()[0], &blk)
	if !reflect.DeepEqual(got, blk.Text) {
		t.Fatalf("streamed runs\n%s\nblock runs\n%s", runsJSON(got), runsJSON(blk.Text))
	}
}

func TestStreamedTextEqualsTheBlockAtAnyChunking(t *testing.T) {
	line := `{"type":"para","text":"a *b* and \\(x_1 + 2\\) costs $5 or **so [p. 3]** and \\textit{it} ok."}` + "\n"
	for _, n := range []int{1, 2, 3, 5, 11, 200} {
		var e events
		p := NewParser(context.Background(), Options{Mode: Ask, Pages: pagenum.Single(1)}, e.handler())
		feedIn(p, line, n)
		var got []Run
		for _, r := range e.text {
			if k := len(got); k > 0 && got[k-1].T != "" && r.T != "" && got[k-1].B == r.B && got[k-1].I == r.I && got[k-1].Code == r.Code {
				got[k-1].T += r.T
				continue
			}
			got = append(got, r)
		}
		var blk ParaBlock
		json.Unmarshal(p.Blocks()[0], &blk)
		// What streamed is what's stored, once the last chunk lands.
		if !reflect.DeepEqual(got, blk.Text) {
			t.Fatalf("n=%d\nstreamed %s\nstored   %s", n, runsJSON(got), runsJSON(blk.Text))
		}
	}
}

func TestANonJSONLineIsRewrittenAsBlocks(t *testing.T) {
	s := &script{replies: []string{"```json\n{\"type\":\"para\",\"text\":\"It is \\\\(x\\\\).\"}\n```"}}
	var e events
	p := NewParser(context.Background(), Options{Mode: Ask, Model: s.model()}, e.handler())
	feedIn(p, `{"type":"note","text":"a"}`+"\nIt is x.\n", 4)
	if !reflect.DeepEqual(types(p), []string{"note", "para"}) || len(s.asked) != 1 || !strings.Contains(s.asked[0], "It is x.") {
		t.Fatalf("%v %v", types(p), s.asked)
	}
	if len(e.repairing) != 1 {
		t.Fatalf("repairing %v", e.repairing)
	}
	if !strings.Contains(string(p.Blocks()[1]), `"m":"x"`) {
		t.Fatalf("%s", p.Blocks()[1])
	}
}

func TestAStreamCutMidBlockIsKeptRaw(t *testing.T) {
	p := NewParser(context.Background(), Options{Mode: Ask}, Handler{})
	feedIn(p, `{"type":"para","text":"fine"}`+"\n"+`{"type":"derivation","steps":[{"tex":"a =`, 4)
	var raw RawBlock
	if len(p.Blocks()) != 2 || json.Unmarshal(p.Blocks()[1], &raw) != nil || raw.Type != TypeRaw || raw.Of != "derivation" || !strings.Contains(raw.Text, `"tex":"a =`) {
		t.Fatalf("%v %s", types(p), p.Blocks())
	}
}

func TestABadMathRunIsRepairedAsASpan(t *testing.T) {
	s := &script{replies: []string{`\tfrac{1}{2}(10.85) \approx 5.4`}}
	var e events
	p := NewParser(context.Background(), Options{Mode: Ask, Model: s.model()}, e.handler())
	feedIn(p, `{"type":"para","text":"So \\(\\tfrac{1}{2}(10.85) \\approx \\\\) roughly."}`+"\n", 100)
	if len(s.asked) != 1 || !strings.Contains(s.asked[0], `\tfrac{1}{2}(10.85) \approx \`) || !strings.Contains(s.asked[0], "KaTeX") {
		t.Fatalf("asked %v", s.asked)
	}
	var blk ParaBlock
	json.Unmarshal(p.Blocks()[0], &blk)
	if len(blk.Text) != 3 || blk.Text[1].M != `\tfrac{1}{2}(10.85) \approx 5.4` || blk.Text[1].Raw {
		t.Fatalf("%s", runsJSON(blk.Text))
	}
	if !reflect.DeepEqual(e.repairing, []string{"para"}) {
		t.Fatalf("repairing %v", e.repairing)
	}
}

func TestASpanStillBadAfterTwoTriesIsKeptRaw(t *testing.T) {
	s := &script{replies: []string{`\frac{1}{`, `\frac{`}}
	p := NewParser(context.Background(), Options{Mode: Ask, Model: s.model()}, Handler{})
	feedIn(p, `{"type":"para","text":"So \\(\\frac{1}{\\) ok."}`+"\n", 100)
	var blk ParaBlock
	json.Unmarshal(p.Blocks()[0], &blk)
	if len(s.asked) != 2 || !blk.Text[1].Raw || blk.Text[1].M != `\frac{` {
		t.Fatalf("asked %d, %s", len(s.asked), runsJSON(blk.Text))
	}
	if p.Failed() != 0 {
		t.Fatal("a raw run makes the block raw")
	}
}

func TestAtMostSixRepairCallsADocument(t *testing.T) {
	bad := `{"type":"math","tex":"\\frac{1}{"}` + "\n"
	s := &script{}
	for range 20 {
		s.replies = append(s.replies, `\frac{`)
	}
	p := NewParser(context.Background(), Options{Mode: Ask, Model: s.model()}, Handler{})
	feedIn(p, strings.Repeat(bad, 5), 100)
	if len(s.asked) != MaxRepairCalls || p.RepairCalls() != MaxRepairCalls {
		t.Fatalf("%d calls", len(s.asked))
	}
	// The last ones are kept, unrepaired, as raw TeX.
	var m MathBlock
	json.Unmarshal(p.Blocks()[4], &m)
	if !m.Raw {
		t.Fatalf("%s", p.Blocks()[4])
	}
}

func TestABlockAgainstItsSchemaIsRepairedAsABlock(t *testing.T) {
	s := &script{replies: []string{`{"type":"callout","tone":"caveat","text":"Watch the sign."}`}}
	p := NewParser(context.Background(), Options{Mode: Ask, Model: s.model()}, Handler{})
	feedIn(p, `{"type":"callout","tone":"warning","text":"Watch the sign."}`+"\n", 100)
	if !strings.Contains(s.asked[0], "tone") || !strings.Contains(string(p.Blocks()[0]), `"caveat"`) || p.Failed() != 0 {
		t.Fatalf("%v %s", s.asked, p.Blocks())
	}
	// Unrepairable: raw, with what the model wrote.
	p = NewParser(context.Background(), Options{Mode: Ask}, Handler{})
	feedIn(p, `{"type":"callout","tone":"warning","text":"x"}`+"\n", 100)
	var raw RawBlock
	json.Unmarshal(p.Blocks()[0], &raw)
	if raw.Type != TypeRaw || raw.Of != "callout" || p.Failed() != 1 {
		t.Fatalf("%s", p.Blocks()[0])
	}
}

func TestMoneyAndTeXInPlainTextAreRepairedOrKept(t *testing.T) {
	s := &script{replies: []string{`the values \(c = 20.5, 21, \dots\)`}}
	p := NewParser(context.Background(), Options{Mode: Ask, Model: s.model()}, Handler{})
	feedIn(p, `{"type":"para","text":"the values [c = 20.5,\\ 21,\\ \\dots] and $\\$20$ a month"}`+"\n", 100)
	var blk ParaBlock
	json.Unmarshal(p.Blocks()[0], &blk)
	if len(s.asked) != 1 || len(blk.Text) < 2 || blk.Text[1].M != "c = 20.5, 21, \\dots" {
		t.Fatalf("%v %s", s.asked, runsJSON(blk.Text))
	}
}

func TestACitationOfAPageTheBookLacksIsRepairedThenUnlinked(t *testing.T) {
	s := &script{replies: []string{"See [p. 9999] here.", "See [p. 9999] here."}}
	p := NewParser(context.Background(), Options{Mode: Ask, Model: s.model(), Pages: pagenum.Single(10), PageCount: 300}, Handler{})
	feedIn(p, `{"type":"para","text":"See [p. 9999] here."}`+"\n", 100)
	var blk ParaBlock
	json.Unmarshal(p.Blocks()[0], &blk)
	if len(s.asked) != 2 || len(blk.Text) != 1 || blk.Text[0].T != "See [p. 9999] here." {
		t.Fatalf("%d %s", len(s.asked), runsJSON(blk.Text))
	}
}

func TestPlotsSampleAndCarryMarks(t *testing.T) {
	p := NewParser(context.Background(), Options{Mode: Ask}, Handler{})
	feedIn(p, `{"type":"plot","title":"Decay","x":{"label":"t"},"y":{"label":"N"},"series":[{"label":"N(t)","expr":"100*exp(-x/2)","domain":[0,10]}],"marks":[{"x":2,"y":36.8,"label":"e^-1"},{"x":5,"label":"half"}]}`+"\n", 100)
	var pl PlotBlock
	json.Unmarshal(p.Blocks()[0], &pl)
	if len(pl.Series) != 1 || len(pl.Series[0].Points) != plotSamples || len(pl.Marks) != 2 || pl.Marks[1].Y != nil {
		t.Fatalf("%s", p.Blocks()[0])
	}
}

func TestFinalizeFetchesAMissingHintAndAMissingAnswerOnce(t *testing.T) {
	s := &script{replies: []string{
		`{"type":"hint","text":"Start from the total area."}`,
		`{"type":"answer","label":"(a)","text":"\\(K = 2\\)."}`,
	}}
	p := NewParser(context.Background(), Options{Mode: Guide, Model: s.model()}, Handler{})
	feedIn(p, `{"type":"part","label":"(a)","title":"Find K"}
{"type":"para","text":"We integrate."}
{"type":"part","label":"(b)","title":"The CDF"}
{"type":"para","text":"Then integrate again."}
{"type":"answer","label":"(b)","text":"done"}
`, 50)
	if p.Complete() {
		t.Fatal("complete before the checks")
	}
	p.Finalize()
	if !reflect.DeepEqual(types(p), []string{"hint", "part", "para", "answer", "part", "para", "answer"}) || len(s.asked) != 2 {
		t.Fatalf("%v, %d calls", types(p), len(s.asked))
	}
	if !p.Complete() {
		t.Fatal("not complete after")
	}
	// Nothing further to fetch: a second pass makes no call.
	p.Finalize()
	if len(s.asked) != 2 {
		t.Fatalf("asked again: %d", len(s.asked))
	}
}

func TestSplitGuideKeepsExtraHintsAsNotes(t *testing.T) {
	blocks := []Block{
		Block(`{"type":"part","label":"(a)","title":[{"t":"x"}]}`),
		Block(`{"type":"hint","text":[{"t":"first"}]}`),
		Block(`{"type":"hint","text":[{"t":"second"}]}`),
	}
	hint, walk := SplitGuide(blocks)
	if len(hint) != 1 || len(walk) != 2 || TypeOf(walk[1]) != TypeNote {
		t.Fatalf("%s %s", hint, walk)
	}
}

func TestModelLinesReadBackAsTheSameBlocks(t *testing.T) {
	text := fixture(t, "guide-cdf.jsonl")
	pages := pagenum.Single(12)
	p := NewParser(context.Background(), Options{Mode: Guide, Pages: pages, PageCount: 700}, Handler{})
	feedIn(p, text, 1000)
	back := NewParser(context.Background(), Options{Mode: Guide, Pages: pages, PageCount: 700, Model: noModel(t)}, Handler{})
	feedIn(back, ModelLines(p.Blocks(), pages), 1000)
	if len(back.Blocks()) != len(p.Blocks()) {
		t.Fatalf("%d != %d", len(back.Blocks()), len(p.Blocks()))
	}
	for i := range p.Blocks() {
		if TypeOf(p.Blocks()[i]) == TypePlot {
			continue // a plot goes back as its title
		}
		if !jsonEqual(p.Blocks()[i], back.Blocks()[i]) {
			t.Fatalf("block %d\n%s\n%s", i, p.Blocks()[i], back.Blocks()[i])
		}
	}
}

func jsonEqual(a, b []byte) bool {
	var x, y any
	json.Unmarshal(a, &x)
	json.Unmarshal(b, &y)
	return reflect.DeepEqual(x, y)
}
