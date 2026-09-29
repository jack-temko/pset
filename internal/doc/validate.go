package doc

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strings"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"

	"github.com/jackt/pset/internal/mathx"
	"github.com/jackt/pset/internal/pagenum"
)

//go:embed schemas/*.json
var schemaFS embed.FS

// Types are the blocks a model may write, in the order a prompt lists them.
var Types = []string{
	TypeHint, TypePart, TypeStep, TypePara, TypeNote, TypeMath, TypeDerivation,
	TypeCallout, TypeStatement, TypeTable, TypePlot, TypeCode, TypeAnswer,
}

func isType(t string) bool {
	for _, k := range Types {
		if k == t {
			return true
		}
	}
	return false
}

var schemas = sync.OnceValues(func() (map[string]*jsonschema.Schema, error) {
	c := jsonschema.NewCompiler()
	out := map[string]*jsonschema.Schema{}
	for _, k := range Types {
		name := "schemas/" + k + ".json"
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

// Schema is a block type's schema text, for prompts and repair.
func Schema(typ string) string {
	data, _ := schemaFS.ReadFile("schemas/" + typ + ".json")
	return string(data)
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

// modelBlock is every field any block has, as the model writes them:
// text fields are plain strings. The schema has already said which of them
// its type may carry.
type modelBlock struct {
	Type     string `json:"type"`
	Text     string `json:"text"`
	Title    string `json:"title"`
	Label    string `json:"label"`
	Tex      string `json:"tex"`
	Kind     string `json:"kind"`
	Number   string `json:"number"`
	Name     string `json:"name"`
	Tone     Tone   `json:"tone"`
	Code     string `json:"code"`
	Language string `json:"language"`
	Page     int    `json:"page"`
	Steps    []struct {
		Tex string `json:"tex"`
		Why string `json:"why"`
	} `json:"steps"`
	Columns []string      `json:"columns"`
	Rows    [][]string    `json:"rows"`
	X       Axis          `json:"x"`
	Y       Axis          `json:"y"`
	Series  []modelSeries `json:"series"`
	Marks   []Mark        `json:"marks"`
}

type modelSeries struct {
	Label  string       `json:"label"`
	Expr   string       `json:"expr"`
	Domain []float64    `json:"domain"`
	Points [][2]float64 `json:"points"`
}

// field is a text field of a block: what the model wrote, and where its
// runs live in the wire block.
type field struct {
	src string
	dst *[]Run
}

// texRef is a bare-TeX field of a block: a math block's, or one line of a
// derivation.
type texRef struct {
	tex *string
	raw *bool
}

// built is a block the model wrote, checked against its schema and split
// into runs, with handles on the parts the checks work on.
type built struct {
	typ    string
	v      any // the wire struct, a pointer
	fields []*field
	texs   []texRef
	// page is a statement's own page, a PDF page.
	page int
}

func (b *built) block() Block {
	out, _ := json.Marshal(b.v)
	return out
}

// validate checks what the model wrote against its type's schema, and
// builds the wire block: text fields split into runs, plot expressions
// sampled, a statement's page moved to its PDF page. Problems are what to
// tell the model to fix; the block is nil when there are any.
func validate(obj []byte, pages pagenum.Map) (*built, []string) {
	var value any
	if err := json.Unmarshal(obj, &value); err != nil {
		return nil, []string{"not valid JSON: " + err.Error()}
	}
	m, _ := value.(map[string]any)
	typ, _ := m["type"].(string)
	if typ == TypePlot {
		// The model writes a mark at "11/12" now and then: a constant is a number.
		if coerceNumbers(m) {
			obj, _ = json.Marshal(m)
		}
	}
	if !isType(typ) {
		return nil, []string{fmt.Sprintf("type %q is not a block type; the types are %s", typ, strings.Join(Types, ", "))}
	}
	all, err := schemas()
	if err != nil {
		return nil, []string{err.Error()}
	}
	if err := all[typ].Validate(value); err != nil {
		return nil, leafErrors(err)
	}
	var in modelBlock
	if err := json.Unmarshal(obj, &in); err != nil {
		return nil, []string{err.Error()}
	}
	b := &built{typ: typ}
	// text is a text field of the block: split now, and kept for repair.
	text := func(src string, dst *[]Run) {
		b.fields = append(b.fields, &field{src: src, dst: dst})
		*dst = Split(src, pages)
	}
	switch typ {
	case TypeHint:
		v := &HintBlock{Type: typ}
		text(in.Text, &v.Text)
		b.v = v
	case TypePart:
		v := &PartBlock{Type: typ, Label: strings.TrimSpace(in.Label)}
		text(in.Title, &v.Title)
		b.v = v
	case TypeStep:
		v := &StepBlock{Type: typ}
		text(in.Title, &v.Title)
		b.v = v
	case TypePara:
		v := &ParaBlock{Type: typ}
		text(in.Text, &v.Text)
		b.v = v
	case TypeNote:
		v := &NoteBlock{Type: typ}
		text(in.Text, &v.Text)
		b.v = v
	case TypeMath:
		v := &MathBlock{Type: typ, Tex: strings.TrimSpace(in.Tex)}
		b.texs = append(b.texs, texRef{&v.Tex, &v.Raw})
		b.v = v
	case TypeDerivation:
		v := &DerivationBlock{Type: typ, Steps: make([]DerivationStep, len(in.Steps))}
		for i, s := range in.Steps {
			v.Steps[i].Tex = strings.TrimSpace(s.Tex)
			b.texs = append(b.texs, texRef{&v.Steps[i].Tex, &v.Steps[i].Raw})
			if s.Why != "" {
				text(s.Why, &v.Steps[i].Why)
			}
		}
		b.v = v
	case TypeCallout:
		v := &CalloutBlock{Type: typ, Tone: in.Tone}
		if in.Title != "" {
			text(in.Title, &v.Title)
		}
		text(in.Text, &v.Text)
		b.v = v
	case TypeStatement:
		v := &StatementBlock{Type: typ, Kind: in.Kind, Number: in.Number, Name: in.Name, Page: pages.Nearest(in.Page)}
		b.page = v.Page
		text(in.Text, &v.Text)
		b.v = v
	case TypeTable:
		v := &TableBlock{Type: typ, Columns: make([][]Run, len(in.Columns)), Rows: make([][][]Run, len(in.Rows))}
		for i, c := range in.Columns {
			text(c, &v.Columns[i])
		}
		for i, r := range in.Rows {
			v.Rows[i] = make([][]Run, len(r))
			for j, c := range r {
				text(c, &v.Rows[i][j])
			}
		}
		b.v = v
	case TypeCode:
		b.v = &CodeBlock{Type: typ, Code: in.Code, Language: in.Language}
	case TypeAnswer:
		v := &AnswerBlock{Type: typ, Label: strings.TrimSpace(in.Label)}
		text(in.Text, &v.Text)
		b.v = v
	case TypePlot:
		v, problems := samplePlot(in)
		if len(problems) > 0 {
			return nil, problems
		}
		b.v = v
	}
	return b, nil
}

// plotSamples is how many points an expression becomes: smooth at the
// block's size, and small on the wire.
const plotSamples = 160

func samplePlot(in modelBlock) (*PlotBlock, []string) {
	out := &PlotBlock{Type: TypePlot, Title: in.Title, X: in.X, Y: in.Y, Marks: in.Marks}
	var problems []string
	for i, s := range in.Series {
		if s.Expr == "" {
			out.Series = append(out.Series, Series{Label: s.Label, Points: s.Points})
			continue
		}
		pts, err := sample(s.Expr, s.Domain[0], s.Domain[1], variableOf(s.Expr, in.X.Label))
		if err != nil {
			problems = append(problems, fmt.Sprintf("series[%d].expr %q: %v", i, s.Expr, err))
			continue
		}
		out.Series = append(out.Series, Series{Label: s.Label, Points: pts})
	}
	return out, problems
}

var identifier = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9]*$`)

// variableOf is the variable an expression is in: x, as the prompt says,
// but a model plotting f(b) writes "b^2 - b" and labels the axis b, and
// means it.
func variableOf(expr, axis string) string {
	if _, err := mathx.EvalAt(expr, "x", 0.5); err == nil {
		return "x"
	}
	if axis = strings.TrimSpace(axis); identifier.MatchString(axis) {
		if _, err := mathx.EvalAt(expr, axis, 0.5); err == nil {
			return axis
		}
	}
	return "x"
}

// sample evaluates expr in x across [a, b]. Points where it isn't a real
// number (a pole, a square root of a negative) are left out; an
// expression that is almost nowhere real, or doesn't parse, is invalid.
func sample(expr string, a, b float64, name string) ([][2]float64, error) {
	if !(b > a) || math.IsInf(a, 0) || math.IsInf(b, 0) {
		return nil, fmt.Errorf("the domain must run from a smaller number to a larger one")
	}
	var pts [][2]float64
	var firstErr error
	for i := range plotSamples {
		x := a + (b-a)*float64(i)/float64(plotSamples-1)
		v, err := mathx.EvalAt(expr, name, x)
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

// coerceNumbers reads the numbers of a plot the model wrote as constant
// expressions in strings ("11/12", "1.5") as numbers, and says whether it
// changed any.
func coerceNumbers(plot map[string]any) bool {
	changed := false
	num := func(v *any) {
		s, ok := (*v).(string)
		if !ok {
			return
		}
		val, err := mathx.Eval(s)
		if err != nil {
			return
		}
		if f, ok := val.Real(); ok && !math.IsNaN(f) && !math.IsInf(f, 0) {
			*v, changed = f, true
		}
	}
	each := func(key string, fn func(item map[string]any)) {
		list, _ := plot[key].([]any)
		for _, it := range list {
			if m, ok := it.(map[string]any); ok {
				fn(m)
			}
		}
	}
	each("marks", func(m map[string]any) {
		for _, k := range []string{"x", "y"} {
			if v, ok := m[k]; ok {
				num(&v)
				m[k] = v
			}
		}
	})
	each("series", func(m map[string]any) {
		if d, ok := m["domain"].([]any); ok {
			for i := range d {
				num(&d[i])
			}
		}
	})
	return changed
}
