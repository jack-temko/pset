package cards

import "encoding/json"

// Kind names a card: what the model writes after the opening fence.
type Kind string

const (
	KindStatement Kind = "statement"
	KindSteps     Kind = "steps"
	KindPlot      Kind = "plot"
	KindTable     Kind = "table"
	KindCode      Kind = "code"
)

// SegmentType is what a stretch of an answer is.
type SegmentType string

const (
	// SegmentProse is markdown with inline $math$, $$display math$$, and
	// page citations written [p. N], N a PDF page.
	SegmentProse SegmentType = "prose"
	// SegmentCard is a validated card.
	SegmentCard SegmentType = "card"
	// SegmentRaw is a card that couldn't be made valid, kept as the text
	// the model wrote: nothing is ever dropped.
	SegmentRaw SegmentType = "raw"
)

// Segment is one stretch of an answer, in order. What's stored is exactly
// what the student saw.
type Segment struct {
	Type SegmentType     `json:"type" tstype:"'prose' | 'card' | 'raw'"`
	Text string          `json:"text,omitempty"`
	Kind Kind            `json:"kind,omitempty"`
	Card json.RawMessage `json:"card,omitempty" tstype:"StatementCard | StepsCard | PlotCard | TableCard | CodeCard"`
}

// StatementCard quotes a definition or theorem as the book states it.
type StatementCard struct {
	Kind   string `json:"kind"`
	Number string `json:"number"`
	Name   string `json:"name,omitempty"`
	Page   int    `json:"page"`
	Text   string `json:"text"`
}

// Step is one line of a worked derivation: bare TeX, and why.
type Step struct {
	Math string `json:"math"`
	Why  string `json:"why,omitempty"`
}

type StepsCard struct {
	Steps []Step `json:"steps"`
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

type PlotCard struct {
	Title  string   `json:"title"`
	X      Axis     `json:"x"`
	Y      Axis     `json:"y"`
	Series []Series `json:"series"`
}

type TableCard struct {
	Columns []string   `json:"columns"`
	Rows    [][]string `json:"rows"`
}

type CodeCard struct {
	Code     string `json:"code"`
	Language string `json:"language,omitempty"`
}
