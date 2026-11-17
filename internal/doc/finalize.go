package doc

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackt/pset/internal/cleanup"
)

// Finalize runs the whole-document checks a guide has, once it is written:
// it has a hint, and every part has an answer. Each missing piece costs
// one model call, and what comes back goes through the block checks like
// any other. A piece that can't be had is left missing; the guide is not
// whole and its writer is asked again.
func (p *Parser) Finalize() {
	if p.opt.Mode != Guide || p.opt.Model == nil || p.ctx.Err() != nil {
		return
	}
	if !p.has(TypeHint) && len(p.blocks) > 0 {
		user := "The guide:\n" + ModelLines(p.blocks, p.opt.Pages)
		if b, ok := p.write(hintPrompt, user, TypeHint); ok {
			p.blocks = append([]Block{b}, p.blocks...)
			p.failed = append([]bool{false}, p.failed...)
		}
	}
	// Each part, from its marker to the next.
	var out []Block
	var outFailed []bool
	i := 0
	for i < len(p.blocks) {
		if TypeOf(p.blocks[i]) != TypePart {
			out, outFailed = append(out, p.blocks[i]), append(outFailed, p.failed[i])
			i++
			continue
		}
		j := i + 1
		answered := false
		for j < len(p.blocks) && TypeOf(p.blocks[j]) != TypePart {
			answered = answered || TypeOf(p.blocks[j]) == TypeAnswer
			j++
		}
		out, outFailed = append(out, p.blocks[i:j]...), append(outFailed, p.failed[i:j]...)
		if !answered {
			var part PartBlock
			cleanup.Log("doc: read a part block", json.Unmarshal(p.blocks[i], &part))
			user := fmt.Sprintf("The part's blocks:\n%s\n\nWrite the answer for %s.", ModelLines(p.blocks[i:j], p.opt.Pages), part.Label)
			if b, ok := p.write(answerPrompt, user, TypeAnswer); ok {
				out, outFailed = append(out, b), append(outFailed, false)
			}
		}
		i = j
	}
	p.blocks, p.failed = out, outFailed
}

func (p *Parser) has(typ string) bool {
	for _, b := range p.blocks {
		if TypeOf(b) == typ {
			return true
		}
	}
	return false
}

// write is one whole-document call for a block of a type. It comes back
// only when the block is valid, or as valid as repair could make it.
func (p *Parser) write(system, user, typ string) (Block, bool) {
	if p.h.Repairing != nil {
		p.h.Repairing(typ)
	}
	reply, err := p.opt.Model(p.ctx, system, user)
	if err != nil {
		return nil, false
	}
	obj, ok := lenientObject(unfence(strings.TrimSpace(reply)))
	if !ok || peekType(obj) != typ {
		return nil, false
	}
	b, failed := p.pl.check(obj)
	if failed {
		return nil, false
	}
	if p.h.Block != nil {
		p.h.Block(b, false)
	}
	return b, true
}

const hintPrompt = `You write the hint for a homework guide that has none. You get the guide as blocks. A hint is one or two
sentences that point the way without giving the method away: no working, no result. Reply with only one
JSON object on one line: {"type":"hint","text":"..."}. Inline math in the text is \( ... \) with the
backslashes doubled in JSON. A $ is only ever money. No em dashes.`

const answerPrompt = `You write the answer for one part of a homework guide that has none. You get the part's blocks. The answer
is the final result of the part, as briefly as it can be said, in the guide's own notation. Reply with only one
JSON object on one line: {"type":"answer","label":"(b)","text":"..."}, the label the part's own. Inline
math in the text is \( ... \) with the backslashes doubled in JSON. A $ is only ever money. No em dashes.`
