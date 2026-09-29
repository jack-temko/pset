package doc

// Run is one stretch of text as it is stored and sent: what the model
// wrote as a string ("since \(1/p\) minutes cost [p. 108] ...") split into
// runs, so nothing that reads a run parses anything. Exactly one of T, M
// or Cite is set.
type Run struct {
	// T is text, with any of B (bold), I (italic) or Code.
	T    string `json:"t,omitempty"`
	B    bool   `json:"b,omitempty"`
	I    bool   `json:"i,omitempty"`
	Code bool   `json:"code,omitempty"`
	// M is inline math: TeX without delimiters. D makes it display math
	// (a statement's $$...$$ on its own line).
	M string `json:"m,omitempty"`
	D bool   `json:"d,omitempty"`
	// Raw says M failed to parse even after repair: show its source,
	// muted, rather than render it.
	Raw bool `json:"raw,omitempty"`
	// Cite is a PDF page (the model cites printed pages; the split moves
	// them). CiteTo ends a range ([pp. 12-14]).
	Cite   int `json:"cite,omitempty"`
	CiteTo int `json:"citeTo,omitempty"`
}

// The block types a document is made of, as the model writes them and the
// UI switches on. A block on the wire is one of the structs below; a
// block the checks could not make valid is a RawBlock.
const (
	TypeHint       = "hint"
	TypePart       = "part"
	TypeStep       = "step"
	TypePara       = "para"
	TypeNote       = "note"
	TypeMath       = "math"
	TypeDerivation = "derivation"
	TypeCallout    = "callout"
	TypeStatement  = "statement"
	TypeTable      = "table"
	TypePlot       = "plot"
	TypeCode       = "code"
	TypeAnswer     = "answer"
	TypeRaw        = "raw"
)

// HintBlock is a guide's hint: first, exactly one.
type HintBlock struct {
	Type string `json:"type" tstype:"'hint'"`
	Text []Run  `json:"text"`
}

// PartBlock starts a labeled part of the problem: everything after it
// belongs to it until the next part.
type PartBlock struct {
	Type  string `json:"type" tstype:"'part'"`
	Label string `json:"label"`
	Title []Run  `json:"title"`
}

// StepBlock starts a step inside a part. The renderer numbers steps,
// restarting in each part.
type StepBlock struct {
	Type  string `json:"type" tstype:"'step'"`
	Title []Run  `json:"title"`
}

type ParaBlock struct {
	Type string `json:"type" tstype:"'para'"`
	Text []Run  `json:"text"`
}

// NoteBlock is an aside: small, muted, skippable.
type NoteBlock struct {
	Type string `json:"type" tstype:"'note'"`
	Text []Run  `json:"text"`
}

// MathBlock is display math. Raw says its TeX would not parse.
type MathBlock struct {
	Type string `json:"type" tstype:"'math'"`
	Tex  string `json:"tex"`
	Raw  bool   `json:"raw,omitempty"`
}

// DerivationStep is one line of a worked chain: bare TeX, and why.
type DerivationStep struct {
	Tex string `json:"tex"`
	Why []Run  `json:"why,omitempty"`
	Raw bool   `json:"raw,omitempty"`
}

type DerivationBlock struct {
	Type  string           `json:"type" tstype:"'derivation'"`
	Steps []DerivationStep `json:"steps"`
}

// Tone is what a callout is for.
type Tone string

const (
	// ToneInsight is why a result is obviously right.
	ToneInsight Tone = "insight"
	// ToneCaveat is a common slip.
	ToneCaveat Tone = "caveat"
	// ToneCheck is a way to verify the work.
	ToneCheck Tone = "check"
)

type CalloutBlock struct {
	Type  string `json:"type" tstype:"'callout'"`
	Tone  Tone   `json:"tone" tstype:"'insight' | 'caveat' | 'check'"`
	Title []Run  `json:"title,omitempty"`
	Text  []Run  `json:"text"`
}

// StatementBlock quotes a definition or theorem as the book states it.
// Page is a PDF page.
type StatementBlock struct {
	Type   string `json:"type" tstype:"'statement'"`
	Kind   string `json:"kind"`
	Number string `json:"number"`
	Name   string `json:"name,omitempty"`
	Page   int    `json:"page"`
	Text   []Run  `json:"text"`
}

type TableBlock struct {
	Type    string    `json:"type" tstype:"'table'"`
	Columns [][]Run   `json:"columns"`
	Rows    [][][]Run `json:"rows"`
}

type Axis struct {
	Label string `json:"label"`
}

// Series is one plotted line, always as points by the time it's on the
// wire: an expression is sampled on the server.
type Series struct {
	Label  string       `json:"label"`
	Points [][2]float64 `json:"points" tstype:"Point[]"`
}

// Mark is a labeled point on a plot, or, with no Y, a vertical guide.
type Mark struct {
	X     float64  `json:"x"`
	Y     *float64 `json:"y,omitempty"`
	Label string   `json:"label,omitempty"`
}

type PlotBlock struct {
	Type   string   `json:"type" tstype:"'plot'"`
	Title  string   `json:"title,omitempty"`
	X      Axis     `json:"x"`
	Y      Axis     `json:"y"`
	Series []Series `json:"series"`
	Marks  []Mark   `json:"marks,omitempty"`
}

type CodeBlock struct {
	Type     string `json:"type" tstype:"'code'"`
	Code     string `json:"code"`
	Language string `json:"language,omitempty"`
}

// AnswerBlock is the final result of its part, which is its label. One
// with no part is the whole problem's.
type AnswerBlock struct {
	Type  string `json:"type" tstype:"'answer'"`
	Label string `json:"label,omitempty"`
	Text  []Run  `json:"text"`
}

// RawBlock is a block that could not be made valid, kept as the text the
// model wrote: nothing is ever dropped. Of is the type it was meant to be.
type RawBlock struct {
	Type string `json:"type" tstype:"'raw'"`
	Of   string `json:"of,omitempty"`
	Text string `json:"text"`
}
