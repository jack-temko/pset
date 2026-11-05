package doc

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/pagenum"
)

// ModelLines is a document written back the way the model writes it, one
// JSON object a line, text fields as strings (math in \(..\), citations on
// printed pages): a conversation sent back to it, or a guide shown to a
// repair call. A plot is its title; a raw block is its text.
func ModelLines(blocks []Block, pages pagenum.Map) string {
	var b strings.Builder
	for _, blk := range blocks {
		line := modelLine(blk, pages)
		if line == "" {
			continue
		}
		b.WriteString(line)
		b.WriteByte('\n')
	}
	return strings.TrimSpace(b.String())
}

func modelLine(blk Block, pages pagenum.Map) string {
	var v map[string]any
	if json.Unmarshal(blk, &v) != nil {
		return ""
	}
	switch v["type"] {
	case TypeRaw:
		text, _ := v["text"].(string)
		return text
	case TypePlot:
		title, _ := v["title"].(string)
		out, _ := json.Marshal(map[string]any{"type": TypeNote, "text": fmt.Sprintf("[a plot: %s]", title)})
		return string(out)
	}
	if v["type"] == TypeStatement {
		if page, ok := v["page"].(float64); ok {
			if n, ok := pages.Printed(int(page)); ok {
				v["page"] = n
			}
		}
	}
	out, _ := json.Marshal(sourceOf(v, pages))
	return string(out)
}

// sourceOf turns every list of runs in a decoded block into the string
// that would split into it.
func sourceOf(v any, pages pagenum.Map) any {
	switch v := v.(type) {
	case map[string]any:
		for k, x := range v {
			v[k] = sourceOf(x, pages)
		}
		return v
	case []any:
		if isRuns(v) {
			runs := make([]Run, len(v))
			raw, _ := json.Marshal(v)
			cleanup.Log("doc: read runs", json.Unmarshal(raw, &runs))
			return Source(runs, pages)
		}
		for i, x := range v {
			v[i] = sourceOf(x, pages)
		}
		return v
	}
	return v
}

// isRuns says a decoded list is a list of runs: objects, each with a
// run's text, math or citation.
func isRuns(v []any) bool {
	if len(v) == 0 {
		return false
	}
	for _, x := range v {
		m, ok := x.(map[string]any)
		if !ok {
			return false
		}
		_, t := m["t"]
		_, mm := m["m"]
		_, c := m["cite"]
		if !t && !mm && !c {
			return false
		}
	}
	return true
}

// SplitGuide separates a guide's hint from its walkthrough: the first hint
// is the hint, and any other becomes a note in the walkthrough, so nothing
// is dropped.
func SplitGuide(blocks []Block) (hint, walk []Block) {
	for _, b := range blocks {
		if TypeOf(b) != TypeHint {
			walk = append(walk, b)
			continue
		}
		if hint == nil {
			hint = []Block{b}
			continue
		}
		var h HintBlock
		cleanup.Log("doc: read a hint block", json.Unmarshal(b, &h))
		note, _ := json.Marshal(NoteBlock{Type: TypeNote, Text: h.Text})
		walk = append(walk, note)
	}
	return hint, walk
}

// Answers is the answer blocks of a document, in order: what the Answers
// veil collects.
func Answers(blocks []Block) []AnswerBlock {
	var out []AnswerBlock
	for _, b := range blocks {
		if TypeOf(b) == TypeAnswer {
			var a AnswerBlock
			cleanup.Log("doc: read an answer block", json.Unmarshal(b, &a))
			out = append(out, a)
		}
	}
	return out
}
