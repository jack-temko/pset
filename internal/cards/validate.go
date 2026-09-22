package cards

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"

	"github.com/jackt/pset/internal/mathx"
)

//go:embed schemas/*.json
var schemaFS embed.FS

// Kinds are the cards a model may write, in the order a prompt lists them.
var Kinds = []Kind{KindStatement, KindSteps, KindPlot, KindTable, KindCode}

func isKind(tag string) bool {
	for _, k := range Kinds {
		if string(k) == tag {
			return true
		}
	}
	return false
}

var schemas = sync.OnceValues(func() (map[Kind]*jsonschema.Schema, error) {
	c := jsonschema.NewCompiler()
	out := map[Kind]*jsonschema.Schema{}
	for _, k := range Kinds {
		name := "schemas/" + string(k) + ".json"
		data, err := schemaFS.ReadFile(name)
		if err != nil {
			return nil, err
		}
		doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(data))
		if err != nil {
			return nil, err
		}
		if err := c.AddResource(name, doc); err != nil {
			return nil, err
		}
		if out[k], err = c.Compile(name); err != nil {
			return nil, err
		}
	}
	return out, nil
})

// Schema is a kind's schema text, for prompts and repair.
func Schema(k Kind) string {
	data, _ := schemaFS.ReadFile("schemas/" + string(k) + ".json")
	return string(data)
}

// Invalid is a card that failed validation, with each complaint.
type Invalid struct{ Problems []string }

func (e *Invalid) Error() string { return strings.Join(e.Problems, "; ") }

// Validate checks a card the model wrote and returns it as it goes on the
// wire: citations and pages moved to PDF pages, a plot's expressions
// sampled into points.
func Validate(kind Kind, raw string, offset int) (json.RawMessage, error) {
	raw = Cite(raw, offset)
	var value any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return nil, &Invalid{[]string{"not valid JSON: " + err.Error()}}
	}
	all, err := schemas()
	if err != nil {
		return nil, err
	}
	s := all[kind]
	if s == nil {
		return nil, fmt.Errorf("unknown card kind %q", kind)
	}
	if err := s.Validate(value); err != nil {
		return nil, &Invalid{leafErrors(err)}
	}
	switch kind {
	case KindStatement:
		var c StatementCard
		json.Unmarshal([]byte(raw), &c)
		c.Page += offset
		return json.Marshal(c)
	case KindPlot:
		return samplePlot(raw)
	}
	var buf bytes.Buffer
	json.Compact(&buf, []byte(raw))
	return buf.Bytes(), nil
}

func leafErrors(err error) []string {
	var ve *jsonschema.ValidationError
	if !errors.As(err, &ve) {
		return []string{err.Error()}
	}
	var out []string
	var walk func(*jsonschema.ValidationError)
	walk = func(v *jsonschema.ValidationError) {
		if len(v.Causes) == 0 {
			out = append(out, v.Error())
			return
		}
		for _, c := range v.Causes {
			walk(c)
		}
	}
	walk(ve)
	return out
}

// plotSamples is how many points an expression becomes: smooth at the
// card's size, and small on the wire.
const plotSamples = 160

type modelSeries struct {
	Label  string       `json:"label"`
	Expr   string       `json:"expr"`
	Domain []float64    `json:"domain"`
	Points [][2]float64 `json:"points"`
}

func samplePlot(raw string) (json.RawMessage, error) {
	var in struct {
		Title  string        `json:"title"`
		X      Axis          `json:"x"`
		Y      Axis          `json:"y"`
		Series []modelSeries `json:"series"`
	}
	if err := json.Unmarshal([]byte(raw), &in); err != nil {
		return nil, &Invalid{[]string{err.Error()}}
	}
	out := PlotCard{Title: in.Title, X: in.X, Y: in.Y}
	var problems []string
	for i, s := range in.Series {
		if s.Expr == "" {
			out.Series = append(out.Series, Series{Label: s.Label, Points: s.Points})
			continue
		}
		pts, err := sample(s.Expr, s.Domain[0], s.Domain[1])
		if err != nil {
			problems = append(problems, fmt.Sprintf("series[%d].expr %q: %v", i, s.Expr, err))
			continue
		}
		out.Series = append(out.Series, Series{Label: s.Label, Points: pts})
	}
	if len(problems) > 0 {
		return nil, &Invalid{problems}
	}
	return json.Marshal(out)
}

// sample evaluates expr in x across [a, b]. Points where it isn't a real
// number (a pole, a square root of a negative) are left out; an
// expression that is almost nowhere real, or doesn't parse, is invalid.
func sample(expr string, a, b float64) ([][2]float64, error) {
	if !(b > a) || math.IsInf(a, 0) || math.IsInf(b, 0) {
		return nil, fmt.Errorf("the domain must run from a smaller number to a larger one")
	}
	var pts [][2]float64
	var firstErr error
	for i := range plotSamples {
		x := a + (b-a)*float64(i)/float64(plotSamples-1)
		v, err := mathx.EvalAt(expr, "x", x)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		if y, ok := v.Real(); ok {
			pts = append(pts, [2]float64{x, y})
		}
	}
	if len(pts) < plotSamples/4 {
		if firstErr != nil {
			return nil, firstErr
		}
		return nil, fmt.Errorf("it isn't a real number over most of the domain")
	}
	return pts, nil
}

var citation = regexp.MustCompile(`\[(pp?)\.\s*(\d+)(?:\s*[–-]\s*(\d+))?\]`)

// Cite moves citations from the printed page the model read ([p. 42]) to
// the PDF page the wire speaks ([p. 58] at offset 16). A range keeps both
// ends.
func Cite(text string, offset int) string {
	if offset == 0 {
		return text
	}
	return citation.ReplaceAllStringFunc(text, func(m string) string {
		g := citation.FindStringSubmatch(m)
		a, _ := strconv.Atoi(g[2])
		if g[3] == "" {
			return fmt.Sprintf("[p. %d]", a+offset)
		}
		b, _ := strconv.Atoi(g[3])
		return fmt.Sprintf("[pp. %d–%d]", a+offset, b+offset)
	})
}
