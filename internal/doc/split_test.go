package doc

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/jackt/pset/internal/pagenum"
)

func runsJSON(rs []Run) string {
	b, _ := json.Marshal(rs)
	return string(b)
}

func TestSplit(t *testing.T) {
	pages := pagenum.Single(16)
	tests := []struct {
		name, in string
		want     []Run
	}{
		{"plain", "just words", []Run{{T: "just words"}}},
		{"inline math", `since \(1/p\) minutes`, []Run{{T: "since "}, {M: "1/p"}, {T: " minutes"}}},
		{"display", `so \[x = 1\] there`, []Run{{T: "so "}, {M: "x = 1", D: true}, {T: " there"}}},
		{"citation moves to the PDF page", "as shown [p. 28].", []Run{{T: "as shown "}, {Cite: 44}, {T: "."}}},
		{"citation range", "see [pp. 28-30]", []Run{{T: "see "}, {Cite: 44, CiteTo: 46}}},
		{"marks", "a **bold** and *italic* and `code`", []Run{{T: "a "}, {T: "bold", B: true}, {T: " and "}, {T: "italic", I: true}, {T: " and "}, {T: "code", Code: true}}},
		{"math inside bold", `**so \(x\) wins**`, []Run{{T: "so ", B: true}, {M: "x"}, {T: " wins", B: true}}},
		{"an escaped dollar is a dollar", `costs \$15 per month plus \$1`, []Run{{T: "costs $15 per month plus $1"}}},
		{"money in dollars", "costs $15 per month plus $1 a minute", []Run{{T: "costs $15 per month plus $1 a minute"}}},
		{"money written as math, from Assignment #5", `the plan is $\$20$ a month`, []Run{{T: "the plan is $20 a month"}}},
		{"money with cents as math", `a call at $\$25.42$.`, []Run{{T: "a call at $25.42."}}},
		{"a table cell in dollars", "$0.20", []Run{{T: "$0.20"}}},
		{"math the model wrote in dollars anyway", `then $x^2 + 1$ is positive`, []Run{{T: "then "}, {M: "x^2 + 1"}, {T: " is positive"}}},
		{"a dollar inside dollar math does not close it", `at $p \ge \$5 + x$ we stop`, []Run{{T: "at "}, {M: `p \ge \$5 + x`}, {T: " we stop"}}},
		{"a closing dollar before a digit is money", "between $5 and $10 dollars", []Run{{T: "between $5 and $10 dollars"}}},
		{"money, then math, in one sentence", "costs $20 per month with a geometric variable $M$ and more", []Run{{T: "costs $20 per month with a geometric variable "}, {M: "M"}, {T: " and more"}}},
		{"a dollar amount then a dollar-math with a digit", "$5 for each of $x$ and $1/p$ minutes", []Run{{T: "$5 for each of "}, {M: "x"}, {T: " and "}, {M: "1/p"}, {T: " minutes"}}},
		{"a mistyped close of display math", "so $$P(X \\le 1) = 0.1.$ ok", []Run{{T: "so "}, {M: `P(X \le 1) = 0.1.`, D: true}, {T: " ok"}}},
		{"display in double dollars", "$$Y = \\frac{X}{2}.$$", []Run{{M: `Y = \frac{X}{2}.`, D: true}}},
		{"textit and textbf outside math", `runs in \textit{PSpice} and \textbf{Multisim}`, []Run{{T: "runs in "}, {T: "PSpice", I: true}, {T: " and "}, {T: "Multisim", B: true}}},
		{"a lone star is a star", "2 * 3 * 4", []Run{{T: "2 * 3 * 4"}}},
		{"an unclosed marker is text", "half **open", []Run{{T: "half **open"}}},
		{"unicode survives", "Ω and é and 4 V", []Run{{T: "Ω and é and 4 V"}}},
		{"code holds its stars", "`a*b*c` ok", []Run{{T: "a*b*c", Code: true}, {T: " ok"}}},
		{"a bare bracket is text", "[c = 20.5] and [1]", []Run{{T: "[c = 20.5] and [1]"}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Split(tt.in, pages)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("Split(%q)\n got %s\nwant %s", tt.in, runsJSON(got), runsJSON(tt.want))
			}
		})
	}
}

func TestProblemsFindsTeXLeftInText(t *testing.T) {
	for _, in := range []string{
		`[c = 20.5,\ 21,\ \dots]`,
		`an unclosed \(x^2 stays text`,
		`a stray backslash \ here`,
	} {
		if len(Problems(Split(in, pagenum.Map{}))) == 0 {
			t.Errorf("%q: no problem found", in)
		}
	}
	for _, in := range []string{`fine \(x\) and $20`, "`code \\n` is fine", `[p. 3] and **b**`} {
		if p := Problems(Split(in, pagenum.Map{})); len(p) != 0 {
			t.Errorf("%q: %v", in, p)
		}
	}
}

func TestSourceReadsBackAsTheSameRuns(t *testing.T) {
	pages := pagenum.Single(16)
	for _, in := range []string{
		`a **bold** call \(x^2\) at $25 [p. 28] and *this*`,
		"so \\[x = 1\\] there\nnext line",
	} {
		runs := Split(in, pages)
		back := Split(Source(runs, pages), pages)
		if !reflect.DeepEqual(runs, back) {
			t.Errorf("%q\n runs %s\n back %s", in, runsJSON(runs), runsJSON(back))
		}
	}
}

func TestTextMarksMathKatexCannotParseAsRaw(t *testing.T) {
	runs := Text(`find \(x^2\) and $\frac{1}{$`, pagenum.Map{})
	if len(runs) != 4 || runs[1].Raw || !runs[3].Raw || runs[3].M != `\frac{1}{` {
		t.Fatalf("%s", runsJSON(runs))
	}
}
