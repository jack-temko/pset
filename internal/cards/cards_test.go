package cards

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
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

type log struct {
	deltas   strings.Builder
	events   []string
	sections []string
}

func (l *log) handler() Handler {
	return Handler{
		Delta:     func(t string) { l.deltas.WriteString(t) },
		CardStart: func(k Kind) { l.events = append(l.events, "start:"+string(k)) },
		Repairing: func(k Kind) { l.events = append(l.events, "repair:"+string(k)) },
		Card:      func(s Segment) { l.events = append(l.events, string(s.Type)+":"+string(s.Kind)) },
		Section:   func(n string) { l.sections = append(l.sections, n) },
	}
}

const answer = "The span comes first [p. 28].\n\n```steps\n{\"steps\":[{\"math\":\"p(T)=0\",\"why\":\"Given [p. 142].\"},{\"math\":\"q(T)=0\"}]}\n```\n\nSo $p = q$.\n"

func TestProseAndCardSurviveAnyChunking(t *testing.T) {
	for _, n := range []int{1, 2, 3, 7, 64, 4096} {
		var l log
		p := NewParser(context.Background(), Options{Offset: 16}, l.handler())
		feedIn(p, answer, n)
		segs := p.Segments()
		if len(segs) != 3 || segs[0].Type != SegmentProse || segs[1].Type != SegmentCard || segs[2].Type != SegmentProse {
			t.Fatalf("n=%d: %+v", n, segs)
		}
		if segs[0].Text != "The span comes first [p. 44]." {
			t.Fatalf("n=%d: citation not moved to the PDF page: %q", n, segs[0].Text)
		}
		var c StepsCard
		json.Unmarshal(segs[1].Card, &c)
		if len(c.Steps) != 2 || c.Steps[0].Why != "Given [p. 158]." {
			t.Fatalf("n=%d: card %s", n, segs[1].Card)
		}
		// What streamed is what's stored: no citation ever went out on its
		// printed page, however it was cut.
		if strings.Contains(l.deltas.String(), "[p. 28]") || !strings.Contains(l.deltas.String(), "[p. 44]") {
			t.Fatalf("n=%d: deltas %q", n, l.deltas.String())
		}
		if strings.Contains(l.deltas.String(), "```") {
			t.Fatalf("n=%d: a card fence leaked into prose", n)
		}
		if strings.Join(l.events, ",") != "start:steps,card:steps" {
			t.Fatalf("n=%d: events %v", n, l.events)
		}
	}
}

func TestProseStreamsBeforeTheLineEnds(t *testing.T) {
	var l log
	p := NewParser(context.Background(), Options{}, l.handler())
	p.Feed("Because powers of T cannot")
	if l.deltas.String() != "Because powers of T cannot" {
		t.Fatalf("held back: %q", l.deltas.String())
	}
	p.Feed(" stay [p. 1")
	if l.deltas.String() != "Because powers of T cannot stay " {
		t.Fatalf("an open citation went out: %q", l.deltas.String())
	}
}

func TestUnknownFenceIsPlainCode(t *testing.T) {
	p := NewParser(context.Background(), Options{}, Handler{})
	feedIn(p, "Run it:\n```python\nprint(1)\n```\nDone.", 5)
	segs := p.Segments()
	if len(segs) != 1 || !strings.Contains(segs[0].Text, "```python\nprint(1)\n```") {
		t.Fatalf("%+v", segs)
	}
}

func TestInvalidCardIsRepairedOnce(t *testing.T) {
	var l log
	calls := 0
	repair := func(_ context.Context, k Kind, raw string, problems []string, schema string) (string, error) {
		calls++
		if k != KindTable || len(problems) == 0 || !strings.Contains(schema, "columns") {
			t.Errorf("repair got %s %v", k, problems)
		}
		return "```json\n{\"columns\":[\"n\"],\"rows\":[[\"1\"]]}\n```", nil
	}
	p := NewParser(context.Background(), Options{Repair: repair}, l.handler())
	feedIn(p, "```table\n{\"columns\":[\"n\"]}\n```\n", 4)
	if calls != 1 || strings.Join(l.events, ",") != "start:table,repair:table,card:table" {
		t.Fatalf("calls %d events %v", calls, l.events)
	}
}

func TestUnrepairableAndCutOffCardsAreKeptRaw(t *testing.T) {
	failing := func(context.Context, Kind, string, []string, string) (string, error) {
		return "", errors.New("model down")
	}
	p := NewParser(context.Background(), Options{Repair: failing}, Handler{})
	feedIn(p, "```code\n{\"lang\":1}\n```\n", 3)
	if s := p.Segments(); len(s) != 1 || s[0].Type != SegmentRaw || s[0].Text != `{"lang":1}` {
		t.Fatalf("unrepairable: %+v", s)
	}
	// The stream stops mid-card.
	p = NewParser(context.Background(), Options{}, Handler{})
	feedIn(p, "Here:\n```steps\n{\"steps\":[{\"ma", 4)
	s := p.Segments()
	if len(s) != 2 || s[1].Type != SegmentRaw || s[1].Kind != KindSteps {
		t.Fatalf("cut off: %+v", s)
	}
}

func TestSectionsSplitTheAnswer(t *testing.T) {
	var l log
	p := NewParser(context.Background(), Options{Sections: []string{"Hint", "Walkthrough"}}, l.handler())
	feedIn(p, "## Hint\nStart from a dependence.\n\n## Walkthrough\nSuppose $a_1v_1=0$.\n```steps\n{\"steps\":[{\"math\":\"x=1\"}]}\n```\n", 6)
	if strings.Join(l.sections, ",") != "Hint,Walkthrough" {
		t.Fatalf("sections %v", l.sections)
	}
	hint, walk := p.Section("hint"), p.Section("walkthrough")
	if len(hint) != 1 || hint[0].Text != "Start from a dependence." {
		t.Fatalf("hint %+v", hint)
	}
	if len(walk) != 2 || walk[1].Type != SegmentCard {
		t.Fatalf("walkthrough %+v", walk)
	}
	if strings.Contains(l.deltas.String(), "##") {
		t.Fatal("a section heading leaked into prose")
	}
}

func TestPlotExpressionsAreSampled(t *testing.T) {
	card, err := Validate(KindPlot, `{"title":"Decay","x":{"label":"t"},"y":{"label":"N"},
		"series":[{"label":"N(t)","expr":"100exp(-x/2)","domain":[0,10]},{"label":"data","points":[[0,100],[2,37]]}]}`, 0)
	if err != nil {
		t.Fatal(err)
	}
	var c PlotCard
	json.Unmarshal(card, &c)
	if len(c.Series) != 2 || len(c.Series[0].Points) != plotSamples || c.Series[0].Points[0] != [2]float64{0, 100} {
		t.Fatalf("%+v", c.Series)
	}
	cases := map[string]string{
		"bad expression":   `{"title":"t","x":{"label":""},"y":{"label":""},"series":[{"label":"a","expr":"x+*2","domain":[0,1]}]}`,
		"backwards domain": `{"title":"t","x":{"label":""},"y":{"label":""},"series":[{"label":"a","expr":"x","domain":[1,0]}]}`,
		"never real":       `{"title":"t","x":{"label":""},"y":{"label":""},"series":[{"label":"a","expr":"sqrt(x)","domain":[-10,-1]}]}`,
		"expr and points":  `{"title":"t","x":{"label":""},"y":{"label":""},"series":[{"label":"a","expr":"x","domain":[0,1],"points":[[0,0],[1,1]]}]}`,
		"three series":     `{"title":"t","x":{"label":""},"y":{"label":""},"series":[{"label":"a","points":[[0,0],[1,1]]},{"label":"b","points":[[0,0],[1,1]]},{"label":"c","points":[[0,0],[1,1]]}]}`,
	}
	for name, raw := range cases {
		var bad *Invalid
		if _, err := Validate(KindPlot, raw, 0); !errors.As(err, &bad) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestStatementPageMovesToPDF(t *testing.T) {
	card, err := Validate(KindStatement, `{"kind":"Theorem","number":"5.22","page":143,"text":"Suppose [p. 140] says so."}`, 16)
	if err != nil {
		t.Fatal(err)
	}
	var c StatementCard
	json.Unmarshal(card, &c)
	if c.Page != 159 || c.Text != "Suppose [p. 156] says so." {
		t.Fatalf("%+v", c)
	}
}

func TestCite(t *testing.T) {
	for in, want := range map[string]string{
		"see [p. 4]":              "see [p. 20]",
		"see [p.4] and [pp. 4-6]": "see [p. 20] and [pp. 20–22]",
		"[p. x]":                  "[p. x]",
	} {
		if got := Cite(in, 16); got != want {
			t.Errorf("Cite(%q) = %q, want %q", in, got, want)
		}
	}
}
