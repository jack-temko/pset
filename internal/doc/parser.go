// Package doc is the document a model writes and the UI renders: typed
// blocks (a hint, parts, steps, paragraphs, math, callouts, tables, plots
// and so on), written as JSON lines and checked, repaired and stored here.
// A text field is a string when the model writes it and runs when it is
// stored and sent, split by Split, so the renderer parses nothing. Ask
// answers and homework guides both write through this package. Spec:
// design/backend.md, "The document".
package doc

import (
	"context"
	"encoding/json"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/jackt/pset/internal/pagenum"
)

// Block is one block of a document as stored and sent: the JSON of one of
// the block structs in wire.go, or of a RawBlock. The type says which.
type Block = json.RawMessage

// TypeOf is the type of a block.
func TypeOf(b Block) string { return peekType(b) }

// Mode is what the document is for.
type Mode int

const (
	// Guide is a homework guide: only the final round is the document.
	// Text before the first block is a preamble and is dropped.
	Guide Mode = iota
	// Ask is an answer to a question: its blocks may come between tool
	// calls.
	Ask
)

// Handler receives what the parser finds, as it finds it. Any may be nil.
type Handler struct {
	// BlockStart fires as soon as a block's type has arrived: draw its
	// skeleton.
	BlockStart func(typ string)
	// Text is the open text block's new runs: text as it comes, a math run
	// or a bold phrase whole once it has closed.
	Text func(runs []Run)
	// Repairing fires when a block needs a repair call: "Tidying".
	Repairing func(typ string)
	// Block is a finished block, replacing the skeleton. failed says it is
	// a raw block, because repair could not make it valid.
	Block func(b Block, failed bool)
}

type Options struct {
	Mode Mode
	// Pages moves printed-page citations onto PDF pages.
	Pages pagenum.Map
	// PageCount is the book's length in PDF pages, for checking citations;
	// zero checks nothing.
	PageCount int
	// Model makes the repair calls; without one nothing is repaired.
	Model Model
}

// Parser consumes one streamed reply. Not safe for concurrent use.
type Parser struct {
	ctx context.Context
	opt Options
	h   Handler
	pl  *pipeline

	blocks []Block
	failed []bool

	line    string // the line in progress
	pending string // the earlier lines of an object not yet finished

	started  bool // BlockStart fired for the object in progress
	emitted  int  // bytes of its text already sent
	sawBlock bool // a block has arrived since the last Reset
}

func NewParser(ctx context.Context, opt Options, h Handler) *Parser {
	p := &Parser{ctx: ctx, opt: opt, h: h}
	p.pl = &pipeline{ctx: ctx, pages: opt.Pages, pageCount: opt.PageCount, model: opt.Model, budget: MaxRepairCalls,
		repairing: func(typ string) {
			if h.Repairing != nil {
				h.Repairing(typ)
			}
		}}
	return p
}

// Feed consumes one streamed chunk.
func (p *Parser) Feed(chunk string) {
	for {
		i := strings.IndexByte(chunk, '\n')
		if i < 0 {
			p.line += chunk
			p.stream()
			return
		}
		p.line += chunk[:i]
		// The text the line still has to stream goes out before the block
		// replaces it.
		p.stream()
		line := p.line
		p.line = ""
		p.complete(line)
		chunk = chunk[i+1:]
	}
}

// Finish ends the stream: the last partial line settles, and an object the
// stream ended inside is kept raw. Call it after an abort too; what
// arrived is kept.
func (p *Parser) Finish() {
	if p.line != "" {
		line := p.line
		p.line = ""
		p.complete(line)
	}
	if p.pending != "" {
		text := p.pending
		p.pending = ""
		p.add(rawBlock(peekTypeLoose(text), text), true)
	}
}

// Reset forgets everything written so far. A guide calls it when a round
// ends in tool calls: what was written in it was narration, not the
// document.
func (p *Parser) Reset() {
	p.blocks, p.failed = nil, nil
	p.line, p.pending = "", ""
	p.started, p.emitted, p.sawBlock = false, 0, false
}

// Blocks is the document so far, in order.
func (p *Parser) Blocks() []Block { return p.blocks }

// Failed says which blocks are raw because repair could not save them.
func (p *Parser) Failed() int {
	n := 0
	for _, f := range p.failed {
		if f {
			n++
		}
	}
	return n
}

// Complete says a guide is whole: a hint and at least one answer have
// arrived. Any text is not enough: a guide that says "Here is the guide."
// and then calls a tool would otherwise end with nothing written.
func (p *Parser) Complete() bool {
	hint, answer := false, false
	for _, b := range p.blocks {
		switch TypeOf(b) {
		case TypeHint:
			hint = true
		case TypeAnswer:
			answer = true
		}
	}
	return hint && answer
}

// RepairCalls is how many repair calls the document has used.
func (p *Parser) RepairCalls() int { return MaxRepairCalls - p.pl.budget }

func (p *Parser) add(b Block, failed bool) {
	p.blocks = append(p.blocks, b)
	p.failed = append(p.failed, failed)
	p.sawBlock = true
	p.started, p.emitted = false, 0
	if p.h.Block != nil {
		p.h.Block(b, failed)
	}
}

// complete handles one whole line.
func (p *Parser) complete(line string) {
	line = strings.TrimSuffix(line, "\r")
	if p.pending != "" {
		p.object(p.pending + "\n" + line)
		return
	}
	t := strings.TrimSpace(line)
	switch {
	case t == "":
	case strings.HasPrefix(t, "```"):
		// A fence the model wrote round its lines: not a line of the document.
	case t[0] == '{':
		p.object(line)
	default:
		p.notJSON(line)
	}
}

// object handles text that starts as a JSON object: a block, an object
// that runs on to the next line, or JSON that will never be one.
func (p *Parser) object(text string) {
	if objs := lenientObjects(text); len(objs) > 0 {
		p.pending = ""
		for _, o := range objs {
			p.block(o)
		}
		return
	}
	if unfinished(text) && strings.Count(text, "\n") < 40 {
		p.pending = text
		return
	}
	p.pending = ""
	p.notJSON(text)
}

// block checks and stores one block the model wrote.
func (p *Parser) block(obj []byte) {
	if !p.started && p.h.BlockStart != nil {
		if typ := peekType(obj); isType(typ) {
			p.h.BlockStart(typ)
		}
	}
	b, failed := p.pl.check(obj)
	p.add(b, failed)
}

// notJSON handles a line that isn't a block: before a guide's first block
// it is a preamble ("Here is the guide."), dropped; anywhere else it is
// rewritten as blocks, and kept raw when that fails.
func (p *Parser) notJSON(text string) {
	if p.opt.Mode == Guide && !p.sawBlock {
		p.started, p.emitted = false, 0
		return
	}
	blocks, failed := p.pl.rewrite(text)
	if blocks == nil {
		if p.ctx.Err() != nil {
			return
		}
		// Nothing came back: the model was down or gave up. Kept raw.
		if p.pl.model != nil && p.pl.budget >= 0 && looksEmpty(text) {
			return
		}
		p.add(rawBlock("", strings.TrimSpace(text)), true)
		return
	}
	for i := range blocks {
		p.add(blocks[i], failed[i])
	}
}

func looksEmpty(text string) bool { return strings.TrimSpace(text) == "" }

var typePrefix = regexp.MustCompile(`^\s*\{\s*"type"\s*:\s*"([a-z]+)"`)

func peekTypeLoose(text string) string {
	if m := typePrefix.FindStringSubmatch(text); m != nil {
		return m[1]
	}
	return ""
}

var textKey = regexp.MustCompile(`"text"\s*:\s*"`)

// streamedTypes are the blocks whose open text field goes out as it is
// written.
var streamedTypes = map[string]bool{TypeHint: true, TypePara: true, TypeNote: true, TypeCallout: true, TypeAnswer: true, TypeStatement: true}

// stream announces the object in progress: its type as soon as it has
// arrived, its text as it grows.
func (p *Parser) stream() {
	if p.h.BlockStart == nil && p.h.Text == nil {
		return
	}
	cur := p.line
	if p.pending != "" {
		cur = p.pending + "\n" + p.line
	}
	if !strings.HasPrefix(strings.TrimSpace(cur), "{") {
		return
	}
	typ := peekTypeLoose(cur)
	if typ == "" || !isType(typ) {
		return
	}
	if !p.started {
		p.started = true
		if p.h.BlockStart != nil {
			p.h.BlockStart(typ)
		}
	}
	if p.h.Text == nil || !streamedTypes[typ] {
		return
	}
	loc := textKey.FindStringIndex(cur)
	if loc == nil {
		return
	}
	text, closed := decodeString(cur[loc[1]:])
	safe := len(text)
	if !closed {
		safe = stableLen(text)
	}
	if safe <= p.emitted {
		return
	}
	runs := Split(text[p.emitted:safe], p.opt.Pages)
	p.emitted = safe
	if len(runs) > 0 {
		p.h.Text(runs)
	}
}

// decodeString reads the JSON string body at the start of s, up to its
// closing quote or as far as has arrived, leniently: \( is a backslash and
// a parenthesis, and a form feed or tab before a letter is the backslash
// of a TeX command. An escape cut in half is left for the next chunk.
func decodeString(s string) (out string, closed bool) {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch c {
		case '"':
			return b.String(), true
		case '\\':
			if i+1 >= len(s) {
				return b.String(), false
			}
			n := s[i+1]
			switch n {
			case '"', '\\', '/':
				b.WriteByte(n)
			case 'n':
				b.WriteByte('\n')
			case 'b', 'f', 't', 'r':
				// Before a letter, a TeX command: \frac, \text, \beta.
				if i+2 < len(s) && isLetter(s[i+2]) {
					b.WriteByte('\\')
					b.WriteByte(n)
				} else {
					b.WriteByte(' ')
				}
			case 'u':
				if i+5 >= len(s) {
					return b.String(), false
				}
				var r rune
				for _, h := range s[i+2 : i+6] {
					r = r*16 + hexVal(h)
				}
				b.WriteRune(r)
				i += 4
			default:
				b.WriteByte('\\')
				b.WriteByte(n)
			}
			i++
		default:
			b.WriteByte(c)
		}
	}
	return b.String(), false
}

func isLetter(c byte) bool { return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' }

func hexVal(r rune) rune {
	switch {
	case r >= '0' && r <= '9':
		return r - '0'
	case r >= 'a' && r <= 'f':
		return r - 'a' + 10
	case r >= 'A' && r <= 'F':
		return r - 'A' + 10
	}
	return 0
}

// stableLen is how much of a text still being written can go out without
// being reinterpreted by what follows: everything before the first thing
// that could still turn into math, a citation, a mark or a dollar sign.
func stableLen(text string) int {
	n := len(text)
	// An unclosed \( or \[, a bracket that may become [p. N], a lone
	// backslash, a dollar sign or a backtick at the end.
	for _, open := range [][2]string{{`\(`, `\)`}, {`\[`, `\]`}} {
		if i := strings.LastIndex(text, open[0]); i >= 0 && !strings.Contains(text[i:], open[1]) {
			n = min(n, i)
		}
	}
	if i := strings.LastIndexByte(text, '['); i >= 0 && !strings.Contains(text[i:], "]") && len(text)-i < 24 {
		n = min(n, i)
	}
	if strings.HasSuffix(text, `\`) {
		n = min(n, len(text)-1)
	}
	// A dollar sign may open math the model wrote in dollars: hold from the
	// first one until the block closes.
	if i := strings.IndexByte(text, '$'); i >= 0 {
		n = min(n, i)
	}
	if strings.Count(text, "`")%2 == 1 {
		n = min(n, strings.LastIndexByte(text, '`'))
	}
	// A mark still open: an ** or * that could open and has no closer yet.
	// Cutting before it can leave an earlier one unpaired, so look again.
	for {
		hold := firstOpenMark(text[:n])
		if hold < 0 {
			break
		}
		n = hold
	}
	// Never cut a rune.
	for n > 0 && n < len(text) && !utf8.RuneStart(text[n]) {
		n--
	}
	return n
}

// firstOpenMark is where the first ** or * that could still open a mark
// sits in text, when it has no closer, or -1.
func firstOpenMark(text string) int {
	toks := tokenizeMarks(text)
	for a := range toks {
		if !toks[a].open || toks[a].paired {
			continue
		}
		for b := a + 1; b < len(toks); b++ {
			if toks[b].close && !toks[b].paired && toks[b].s == toks[a].s {
				toks[a].paired, toks[b].paired = true, true
				break
			}
		}
		if !toks[a].paired {
			return toks[a].pos
		}
	}
	return -1
}

type markTok struct {
	s           string
	pos         int
	open, close bool
	paired      bool
}

// tokenizeMarks lists the ** and * markers of text outside math and code,
// with where they are.
func tokenizeMarks(text string) []markTok {
	var out []markTok
	for i := 0; i < len(text); {
		c := text[i]
		switch {
		case c == '\\' && strings.HasPrefix(text[i:], `\(`):
			if j := strings.Index(text[i+2:], `\)`); j >= 0 {
				i += j + 4
				continue
			}
			return out
		case c == '\\' && strings.HasPrefix(text[i:], `\[`):
			if j := strings.Index(text[i+2:], `\]`); j >= 0 {
				i += j + 4
				continue
			}
			return out
		case c == '\\':
			i += 2
		case c == '`':
			if j := strings.IndexByte(text[i+1:], '`'); j >= 0 {
				i += j + 2
				continue
			}
			return out
		case c == '*':
			n := 1
			if i+1 < len(text) && text[i+1] == '*' {
				n = 2
			}
			out = append(out, markTok{
				s: text[i : i+n], pos: i,
				// A marker at the end may still become ** or open: not decided.
				open:  i+n >= len(text) || !isSpace(text[i+n]),
				close: i > 0 && !isSpace(text[i-1]),
			})
			i += n
		default:
			i++
		}
	}
	return out
}
