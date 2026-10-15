package doc

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/cleanup"
	"github.com/jackt/pset/internal/pagenum"
)

// Model is one small model call: a system prompt and a message in, the
// reply out. The document's repairs use it, at low reasoning effort: they
// are small and mechanical.
type Model func(ctx context.Context, system, user string) (string, error)

const (
	// MaxRepairCalls is how many repair calls one document may make.
	MaxRepairCalls = 6
	// maxTries is how many times one failure is put to the model.
	maxTries = 2
)

// pipeline runs what the model wrote through every check, repairing what
// it can within the document's budget of calls.
type pipeline struct {
	ctx       context.Context
	pages     pagenum.Map
	pageCount int
	model     Model
	budget    int
	// repairing fires when a block's first repair call starts.
	repairing func(typ string)
}

func (p *pipeline) spend() bool {
	if p.model == nil || p.budget <= 0 || p.ctx.Err() != nil {
		return false
	}
	p.budget--
	return true
}

// call is one repair call: the reply, or "" when there was no call to make
// or it failed.
func (p *pipeline) call(system, user string, typ string, said *bool) string {
	if !p.spend() {
		return ""
	}
	if !*said {
		*said = true
		if p.repairing != nil {
			p.repairing(typ)
		}
	}
	reply, err := p.model(p.ctx, system, user)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(reply)
}

func peekType(obj []byte) string {
	var t struct {
		Type string `json:"type"`
	}
	cleanup.Log("doc: read a block type", json.Unmarshal(obj, &t))
	return t.Type
}

// check is one block the model wrote, as a JSON object, through every
// check: its schema, the split of its text, its math, its citations. The
// block that comes back is as good as repair could make it, and failed
// says it is a raw block because repair could not.
func (p *pipeline) check(obj []byte) (block Block, failed bool) {
	typ := peekType(obj)
	said := false

	validateAll := func(obj []byte) (*built, []string) {
		b, problems := validate(obj, p.pages)
		if b != nil && b.typ == TypeStatement && !p.pageOK(b.page) {
			return nil, []string{"page is not a page of the book: give the printed page the statement is on, from a page you were shown or read"}
		}
		return b, problems
	}
	b, problems := validateAll(obj)
	for try := 0; b == nil && try < maxTries; try++ {
		fixed := p.call(blockFixPrompt, fmt.Sprintf("The block as written:\n%s\n\nWhat's wrong:\n- %s\n\nSchema of a %q block:\n%s",
			obj, strings.Join(problems, "\n- "), typ, schemaOrTypes(typ)), typ, &said)
		next, ok := lenientObject(unfence(fixed))
		if !ok {
			continue
		}
		obj = next
		b, problems = validateAll(obj)
	}
	if b == nil {
		return rawBlock(typ, string(obj)), true
	}

	// The text: no TeX or delimiter left in plain text, no citation of a
	// page the book doesn't have.
	for _, f := range b.fields {
		probs := p.textProblems(*f.dst)
		for try := 0; len(probs) > 0 && try < maxTries; try++ {
			fixed := p.call(textFixPrompt, fmt.Sprintf("The text as written:\n%s\n\nWhat's wrong:\n- %s", f.src, strings.Join(probs, "\n- ")), typ, &said)
			if fixed == "" {
				break
			}
			f.src = unquote(fixed)
			*f.dst = Split(f.src, p.pages)
			probs = p.textProblems(*f.dst)
		}
		*f.dst = p.unlinkBadCites(*f.dst)
	}

	// The math: every run, tex field and derivation line must parse.
	p.checkMath(b, typ, &said)
	return b.block(), false
}

func schemaOrTypes(typ string) string {
	if s := Schema(typ); s != "" {
		return s
	}
	return "(no such type; the types are " + strings.Join(Types, ", ") + ")"
}

func rawBlock(of, text string) Block {
	out, _ := json.Marshal(RawBlock{Type: TypeRaw, Of: of, Text: text})
	return out
}

// textProblems is what is wrong with a text field's runs: TeX outside
// math, a citation of a page the book doesn't have.
func (p *pipeline) textProblems(runs []Run) []string {
	out := Problems(runs)
	for _, r := range runs {
		if r.Cite != 0 && !p.pageOK(r.Cite) || r.CiteTo != 0 && !p.pageOK(r.CiteTo) {
			out = append(out, fmt.Sprintf("the citation of %s is not a page of the book (it has printed pages 1 to %s): cite only pages you were shown or read",
				p.pages.Name(max(r.Cite, r.CiteTo)), p.lastPrinted()))
		}
	}
	return out
}

func (p *pipeline) lastPrinted() string {
	if n, ok := p.pages.Printed(p.pageCount); ok && p.pageCount > 0 {
		return fmt.Sprint(n)
	}
	return "the last"
}

func (p *pipeline) pageOK(pdf int) bool {
	return p.pageCount == 0 || (pdf >= 1 && pdf <= p.pageCount)
}

// unlinkBadCites turns the citations still wrong after repair back into
// the text the model wrote: a chip to nowhere is worse than a number.
func (p *pipeline) unlinkBadCites(runs []Run) []Run {
	for i, r := range runs {
		if r.Cite != 0 && !p.pageOK(r.Cite) || r.CiteTo != 0 && !p.pageOK(r.CiteTo) {
			runs[i] = Run{T: Source([]Run{r}, p.pages)}
		}
	}
	return mergeRuns(runs)
}

// mergeRuns joins neighbouring text runs that look the same.
func mergeRuns(runs []Run) []Run {
	var out []Run
	for _, r := range runs {
		if n := len(out); n > 0 && r.T != "" && out[n-1].T != "" && out[n-1].B == r.B && out[n-1].I == r.I && out[n-1].Code == r.Code {
			out[n-1].T += r.T
			continue
		}
		out = append(out, r)
	}
	return out
}

// mathRef is one piece of TeX the check looks at, and how to change it.
type mathRef struct {
	tex     func() string
	set     func(string)
	fail    func()
	display bool
}

func mathRefs(b *built) []mathRef {
	var refs []mathRef
	for _, f := range b.fields {
		runs := *f.dst
		for i := range runs {
			r := &runs[i]
			if r.M == "" {
				continue
			}
			refs = append(refs, mathRef{
				tex:     func() string { return r.M },
				set:     func(s string) { r.M = s },
				fail:    func() { r.Raw = true },
				display: r.D,
			})
		}
	}
	for _, t := range b.texs {
		refs = append(refs, mathRef{
			tex:     func() string { return *t.tex },
			set:     func(s string) { *t.tex = s },
			fail:    func() { *t.raw = true },
			display: true,
		})
	}
	return refs
}

func (p *pipeline) checkMath(b *built, typ string, said *bool) {
	for _, ref := range mathRefs(b) {
		msg := MathError(ref.tex(), ref.display)
		for try := 0; msg != "" && try < maxTries; try++ {
			fixed := p.call(mathFixPrompt, fmt.Sprintf("TeX: %s\nKaTeX says: %s", ref.tex(), msg), typ, said)
			if fixed = cleanTeX(fixed); fixed == "" {
				break
			}
			ref.set(fixed)
			msg = MathError(fixed, ref.display)
		}
		if msg != "" {
			ref.fail()
		}
	}
}

// cleanTeX is a repaired span as bare TeX: no fences, no delimiters.
func cleanTeX(s string) string {
	s = unfence(s)
	s = strings.TrimSpace(s)
	for _, pair := range [][2]string{{`\(`, `\)`}, {`\[`, `\]`}, {"$$", "$$"}, {"$", "$"}} {
		if strings.HasPrefix(s, pair[0]) && strings.HasSuffix(s, pair[1]) && len(s) >= len(pair[0])+len(pair[1]) {
			s = strings.TrimSpace(s[len(pair[0]) : len(s)-len(pair[1])])
			break
		}
	}
	return s
}

// unquote is a repaired text field without the quotes a model puts round
// it, and without fences.
func unquote(s string) string {
	s = unfence(s)
	s = strings.TrimSpace(s)
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		var out string
		if json.Unmarshal([]byte(s), &out) == nil {
			return out
		}
	}
	return s
}

// unfence tolerates a reply wrapped in a code fence.
func unfence(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "```") {
		return s
	}
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[i+1:]
	}
	if i := strings.LastIndex(s, "```"); i >= 0 {
		s = s[:i]
	}
	return strings.TrimSpace(s)
}

// rewrite asks the model to make blocks of a line that wasn't JSON. Each
// one that comes back goes through the checks.
func (p *pipeline) rewrite(line string) (blocks []Block, failed []bool) {
	said := false
	for try := 0; try < maxTries; try++ {
		reply := p.call(lineFixPrompt, "The line:\n"+line, "", &said)
		if reply == "" {
			continue
		}
		objs := lenientObjects(unfence(reply))
		if len(objs) == 0 {
			// It answered with nothing to write: the line was no part of
			// the document.
			if strings.EqualFold(strings.Trim(reply, " ."), "nothing") {
				return nil, nil
			}
			continue
		}
		for _, o := range objs {
			b, f := p.check(o)
			blocks, failed = append(blocks, b), append(failed, f)
		}
		return blocks, failed
	}
	return nil, nil
}

const blockFixPrompt = `You fix one malformed block of a document for a rendering pipeline. You get the block as
written, what is wrong with it, and the JSON schema of its type. Reply with only the corrected
JSON object on one line: no prose, no code fence, no comments. Keep the content; change only what
the problems say. Inline math in text fields is \( ... \), with the backslashes doubled in JSON.`

const textFixPrompt = `You fix one piece of text in a document for a rendering pipeline. Text may hold only these
marks: inline math in \( ... \) with TeX inside; [p. N] to cite a book page; **bold**; *italic*;
` + "`code`" + `. A $ is only ever a dollar sign, as in "$20". Bare TeX in text (a backslash command, a
[list, \dots] written without delimiters) goes inside \( ... \). Reply with only the corrected text:
no quotes, no JSON, no explanation. Keep the meaning and the wording; change only what the problems say.`

const mathFixPrompt = `You fix one piece of TeX for KaTeX. You get the TeX and KaTeX's error. Reply with only the
corrected TeX: no delimiters, no dollar signs, no code fence, no explanation. Keep the meaning; change
only what the error needs (a cut-off expression is finished or shortened, an unknown command replaced
by the standard one).`

const lineFixPrompt = `You turn a line of text into blocks of a document for a rendering pipeline. The model that wrote
it should have written JSON objects, one per line, but wrote this instead. Reply with only the
blocks, one JSON object per line, no fences, no commentary. The blocks are:
` + blockList + `
Inline math in text fields is \( ... \) with the backslashes doubled in JSON; a $ is only money. Use a
para block for prose. If the line is only a greeting, a sign-off or a remark about the document
itself, reply with the single word: nothing`
