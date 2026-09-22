// Package cards turns a model's streamed answer into what the UI renders:
// prose, and cards (statement, steps, plot, table, code) the model writes
// as fenced JSON. Only this package ever sees a fence; everything after it
// works with segments. Ask and homework walkthroughs both write through it.
package cards

import (
	"context"
	"errors"
	"regexp"
	"strings"
)

// Handler receives what the parser finds, as it finds it. Any may be nil.
type Handler struct {
	// Delta is prose as it streams, citations already on PDF pages.
	Delta func(text string)
	// CardStart fires when a card's fence opens: draw its skeleton.
	CardStart func(k Kind)
	// Repairing fires when a card failed validation and a repair call is
	// under way.
	Repairing func(k Kind)
	// Card is a finished card, valid or raw.
	Card func(s Segment)
	// Section fires on a heading that names one of Options.Sections.
	Section func(name string)
}

// Repair asks the model to fix an invalid card, given what's wrong with it
// and its schema. It returns the corrected JSON.
type Repair func(ctx context.Context, k Kind, raw string, problems []string, schema string) (string, error)

type Options struct {
	// Offset moves printed-page citations onto PDF pages.
	Offset int
	// Repair, if set, gets one try at an invalid card.
	Repair Repair
	// Sections are the headings ("## Hint") that split the answer into
	// named parts, matched without regard to case.
	Sections []string
}

type state int

const (
	inProse state = iota
	inCard
	inCode
)

// Parser consumes one streamed answer. Not safe for concurrent use.
type Parser struct {
	ctx context.Context
	opt Options
	h   Handler

	segs    []Segment
	secOf   []string
	section string

	state state
	fence int
	kind  Kind
	body  []string

	line string // the line in progress
	sent int    // how much of line has gone out as prose already
}

func NewParser(ctx context.Context, opt Options, h Handler) *Parser {
	return &Parser{ctx: ctx, opt: opt, h: h}
}

// Feed consumes one streamed chunk.
func (p *Parser) Feed(chunk string) {
	for {
		i := strings.IndexByte(chunk, '\n')
		if i < 0 {
			p.line += chunk
			p.flushPartial()
			return
		}
		p.line += chunk[:i]
		p.complete(strings.TrimSuffix(p.line, "\r"), true)
		p.line, p.sent = "", 0
		chunk = chunk[i+1:]
	}
}

// Finish ends the answer: the last partial line settles, and a card the
// stream ended inside is kept raw. Call it after an abort too; what
// arrived is kept.
func (p *Parser) Finish() {
	if p.line != "" {
		p.complete(p.line, false)
		p.line, p.sent = "", 0
	}
	if p.state == inCard {
		p.raw()
		p.state = inProse
	}
	for i := range p.segs {
		if p.segs[i].Type == SegmentProse {
			p.segs[i].Text = strings.Trim(p.segs[i].Text, "\n")
		}
	}
	// Prose that was only blank lines between cards says nothing.
	var keep []Segment
	var keepSec []string
	for i, s := range p.segs {
		if s.Type == SegmentProse && strings.TrimSpace(s.Text) == "" {
			continue
		}
		keep = append(keep, s)
		keepSec = append(keepSec, p.secOf[i])
	}
	p.segs, p.secOf = keep, keepSec
}

// Segments is the whole answer, in order.
func (p *Parser) Segments() []Segment { return p.segs }

// Section is the part of the answer under one heading ("" for anything
// before the first).
func (p *Parser) Section(name string) []Segment {
	var out []Segment
	for i, s := range p.segs {
		if strings.EqualFold(p.secOf[i], name) {
			out = append(out, s)
		}
	}
	return out
}

// flushPartial sends the settled part of the line in progress, so prose
// streams by the word, not by the paragraph. It holds back what could
// still turn into something else: a fence or a heading at the start of
// the line, a citation not yet closed.
func (p *Parser) flushPartial() {
	if p.state == inCard {
		return
	}
	trimmed := strings.TrimLeft(p.line, " ")
	if p.sent == 0 && (trimmed == "" || strings.HasPrefix(trimmed, "`") ||
		(len(p.opt.Sections) > 0 && strings.HasPrefix(trimmed, "#"))) {
		return
	}
	pending := p.line[p.sent:]
	if i := strings.LastIndexByte(pending, '['); i >= 0 && !strings.Contains(pending[i:], "]") && len(pending)-i < 16 {
		pending = pending[:i]
	}
	if pending == "" {
		return
	}
	p.prose(pending)
	p.sent += len(pending)
}

var heading = regexp.MustCompile(`^\s{0,3}#{1,4}\s+(.+?)\s*#*\s*$`)

func (p *Parser) complete(line string, newline bool) {
	rest := line[p.sent:]
	if newline {
		rest += "\n"
	}
	switch p.state {
	case inProse:
		if p.sent == 0 {
			if tag, n := fenceOpen(line); n > 0 {
				if isKind(tag) {
					p.state, p.fence, p.kind, p.body = inCard, n, Kind(tag), nil
					if p.h.CardStart != nil {
						p.h.CardStart(p.kind)
					}
					return
				}
				p.state, p.fence = inCode, n
				p.prose(rest)
				return
			}
			if m := heading.FindStringSubmatch(line); m != nil {
				for _, s := range p.opt.Sections {
					if strings.EqualFold(strings.TrimRight(m[1], ":"), s) {
						p.section = s
						if p.h.Section != nil {
							p.h.Section(s)
						}
						return
					}
				}
			}
		}
		p.prose(rest)
	case inCard:
		if n := fenceClose(line); n >= p.fence {
			p.closeCard()
			p.state = inProse
			return
		}
		p.body = append(p.body, line)
	case inCode:
		if n := fenceClose(line); n >= p.fence {
			p.state = inProse
		}
		p.prose(rest)
	}
}

// prose sends text and adds it to the trailing prose segment.
func (p *Parser) prose(text string) {
	if text == "" {
		return
	}
	if p.state == inProse {
		text = Cite(text, p.opt.Offset)
	}
	if p.h.Delta != nil {
		p.h.Delta(text)
	}
	if n := len(p.segs); n > 0 && p.segs[n-1].Type == SegmentProse && p.secOf[n-1] == p.section {
		p.segs[n-1].Text += text
		return
	}
	p.add(Segment{Type: SegmentProse, Text: text})
}

func (p *Parser) add(s Segment) {
	p.segs = append(p.segs, s)
	p.secOf = append(p.secOf, p.section)
}

func (p *Parser) closeCard() {
	raw := strings.Join(p.body, "\n")
	card, err := Validate(p.kind, raw, p.opt.Offset)
	var bad *Invalid
	if errors.As(err, &bad) && p.opt.Repair != nil && p.ctx.Err() == nil {
		if p.h.Repairing != nil {
			p.h.Repairing(p.kind)
		}
		if fixed, rerr := p.opt.Repair(p.ctx, p.kind, raw, bad.Problems, Schema(p.kind)); rerr == nil {
			card, err = Validate(p.kind, unwrapFences(fixed), p.opt.Offset)
		}
	}
	if err != nil {
		p.raw()
		return
	}
	s := Segment{Type: SegmentCard, Kind: p.kind, Card: card}
	p.add(s)
	if p.h.Card != nil {
		p.h.Card(s)
	}
}

// raw keeps a card that couldn't be made valid as the text that arrived.
func (p *Parser) raw() {
	s := Segment{Type: SegmentRaw, Kind: p.kind, Text: strings.Join(p.body, "\n")}
	p.add(s)
	if p.h.Card != nil {
		p.h.Card(s)
	}
}

// fenceOpen matches an opening fence (up to three spaces, three or more
// backticks, an info string) and returns its tag and backtick count.
func fenceOpen(line string) (string, int) {
	t := strings.TrimLeft(line, " ")
	if len(line)-len(t) > 3 || !strings.HasPrefix(t, "```") {
		return "", 0
	}
	rest := strings.TrimLeft(t, "`")
	info := strings.TrimSpace(rest)
	if info == "" {
		return "", 0
	}
	return strings.ToLower(strings.Fields(info)[0]), len(t) - len(rest)
}

// fenceClose matches a closing fence: backticks alone on the line.
func fenceClose(line string) int {
	t := strings.TrimSpace(line)
	if t == "" || strings.TrimLeft(t, "`") != "" {
		return 0
	}
	return len(t)
}

// unwrapFences tolerates a repair that comes back wrapped in a fence.
func unwrapFences(s string) string {
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
