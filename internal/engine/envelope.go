package engine

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"

	"github.com/jackt/pset/internal/llm"
	"github.com/jackt/pset/internal/store"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

//go:embed schemas/*.json
var schemaFS embed.FS

// envelopeKinds are the fence tags the pipeline recognises; every other tag
// streams through as an ordinary code block.
var envelopeKinds = []string{"equation", "steps", "theorem", "definition", "note"}

// envelopeSchemas compiles the embedded schemas once; a bad schema fails the
// first ask loudly instead of silently degrading every envelope.
var envelopeSchemas = sync.OnceValues(func() (map[string]*jsonschema.Schema, error) {
	out := make(map[string]*jsonschema.Schema, len(envelopeKinds))
	for _, kind := range envelopeKinds {
		data, err := schemaFS.ReadFile("schemas/" + kind + ".schema.json")
		if err != nil {
			return nil, err
		}
		doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("schema %s: %w", kind, err)
		}
		compiler := jsonschema.NewCompiler()
		url := kind + ".schema.json"
		if err := compiler.AddResource(url, doc); err != nil {
			return nil, fmt.Errorf("schema %s: %w", kind, err)
		}
		schema, err := compiler.Compile(url)
		if err != nil {
			return nil, fmt.Errorf("schema %s: %w", kind, err)
		}
		out[kind] = schema
	}
	return out, nil
})

// envelopeSchemaText returns a kind's embedded schema verbatim — the repair
// prompt quotes it.
func envelopeSchemaText(kind string) (string, error) {
	data, err := schemaFS.ReadFile("schemas/" + kind + ".schema.json")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// isEnvelopeKind reports whether a fence tag names a schema'd envelope.
func isEnvelopeKind(tag string) bool {
	for _, k := range envelopeKinds {
		if k == tag {
			return true
		}
	}
	return false
}

// checkEnvelope decodes raw payload text and validates it against the kind's
// schema, returning the payload compacted for the wire and storage.
func checkEnvelope(kind, raw string) (json.RawMessage, error) {
	var value any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return nil, fmt.Errorf("not valid JSON: %w", err)
	}
	schemas, err := envelopeSchemas()
	if err != nil {
		return nil, err
	}
	schema := schemas[kind]
	if schema == nil {
		return nil, fmt.Errorf("unknown envelope kind %q", kind)
	}
	if err := schema.Validate(value); err != nil {
		return nil, fmt.Errorf("schema: %w", err)
	}
	var compacted bytes.Buffer
	if err := json.Compact(&compacted, []byte(raw)); err != nil {
		return nil, fmt.Errorf("not valid JSON: %w", err)
	}
	return json.RawMessage(compacted.Bytes()), nil
}

// validationErrorList flattens a schema failure into its leaf complaints, one
// per line — the repair prompt's error list.
func validationErrorList(err error) []string {
	var ve *jsonschema.ValidationError
	if !errors.As(err, &ve) {
		return []string{err.Error()}
	}
	var out []string
	var walk func(*jsonschema.ValidationError)
	walk = func(v *jsonschema.ValidationError) {
		if len(v.Causes) == 0 {
			out = append(out, "- "+v.Error())
			return
		}
		for _, c := range v.Causes {
			walk(c)
		}
	}
	walk(ve)
	return out
}

const repairSystemPrompt = `You repair malformed JSON envelopes for a rendering pipeline. You are
given the envelope's kind, the invalid payload, the validation errors, and
the JSON schema it must satisfy. Reply with only the corrected JSON object:
no prose, no code fences, no comments.`

const repairPromptTemplate = `Repair this %q envelope.

The invalid payload:

%s

The validation errors:

%s

The schema it must satisfy:

%s

Return only the corrected JSON object.`

// AskEventType names one typed unit of a streaming answer. These strings are
// the SSE wire names the API emits; the api layer maps them one to one.
type AskEventType string

const (
	AskDelta             AskEventType = "delta"
	AskEnvelopeStart     AskEventType = "envelope-start"
	AskEnvelopeRepairing AskEventType = "envelope-repairing"
	AskEnvelope          AskEventType = "envelope"
	AskEnvelopeFailed    AskEventType = "envelope-failed"
)

// AskEvent is one typed unit of a streaming answer. Delta carries prose in
// Text; the envelope events carry the fence tag in Kind, and Payload (a
// compacted JSON object) or the raw arrived text on failure.
type AskEvent struct {
	Type    AskEventType
	Kind    string
	Text    string
	Payload json.RawMessage
}

type splitterState int

const (
	proseState splitterState = iota
	envelopeState
	codeState
)

// envelopeSplitter consumes the model's streamed text and re-emits typed
// events: prose deltas, and for each recognised fence the envelope
// lifecycle start → (repairing) → envelope | envelope-failed. It collects
// the ordered segments for storage. Line-buffered: a model chunk that ends
// mid-line is held until the newline settles what the line is.
type envelopeSplitter struct {
	ctx      context.Context
	client   *llm.Client
	logger   *slog.Logger
	emit     func(AskEvent) error
	segments []store.Segment

	state splitterState
	fence int
	kind  string
	body  []string
	line  strings.Builder
}

func newEnvelopeSplitter(ctx context.Context, client *llm.Client, logger *slog.Logger, emit func(AskEvent) error) *envelopeSplitter {
	if emit == nil {
		emit = func(AskEvent) error { return nil }
	}
	return &envelopeSplitter{ctx: ctx, client: client, logger: logger, emit: emit}
}

// Feed consumes one streamed chunk.
func (sp *envelopeSplitter) Feed(chunk string) error {
	for {
		i := strings.IndexByte(chunk, '\n')
		if i < 0 {
			sp.line.WriteString(chunk)
			return nil
		}
		sp.line.WriteString(chunk[:i])
		if err := sp.lineComplete(strings.TrimSuffix(sp.line.String(), "\r"), true); err != nil {
			return err
		}
		sp.line.Reset()
		chunk = chunk[i+1:]
	}
}

// Finish flushes the trailing partial line and degrades an envelope the
// stream ended inside — nothing is ever dropped.
func (sp *envelopeSplitter) Finish() error {
	if sp.line.Len() > 0 {
		line := sp.line.String()
		sp.line.Reset()
		if err := sp.lineComplete(line, false); err != nil {
			return err
		}
	}
	if sp.state == envelopeState {
		if err := sp.failEnvelope(); err != nil {
			return err
		}
		sp.state = proseState
	}
	return nil
}

func (sp *envelopeSplitter) lineComplete(line string, complete bool) error {
	switch sp.state {
	case proseState:
		if open, length := fenceOpen(line); length > 0 {
			if isEnvelopeKind(open) {
				if err := sp.emit(AskEvent{Type: AskEnvelopeStart, Kind: open}); err != nil {
					return err
				}
				sp.state = envelopeState
				sp.fence = length
				sp.kind = open
				sp.body = nil
				return nil
			}
			sp.state = codeState
			sp.fence = length
		}
		return sp.passThrough(line, complete)
	case envelopeState:
		if length := fenceClose(line); length >= sp.fence {
			if err := sp.closeEnvelope(); err != nil {
				return err
			}
			sp.state = proseState
			return nil
		}
		sp.body = append(sp.body, line)
		return nil
	default:
		if length := fenceClose(line); length >= sp.fence {
			sp.state = proseState
		}
		return sp.passThrough(line, complete)
	}
}

// passThrough forwards prose (an unknown-tag fence included) as a delta and
// merges it into the trailing prose segment.
func (sp *envelopeSplitter) passThrough(line string, complete bool) error {
	text := line
	if complete {
		text += "\n"
	}
	if err := sp.emit(AskEvent{Type: AskDelta, Text: text}); err != nil {
		return err
	}
	if n := len(sp.segments); n > 0 && sp.segments[n-1].Type == store.SegmentProse {
		sp.segments[n-1].Text += text
		return nil
	}
	sp.segments = append(sp.segments, store.Segment{Type: store.SegmentProse, Text: text})
	return nil
}

func (sp *envelopeSplitter) closeEnvelope() error {
	raw := strings.Join(sp.body, "\n")
	payload, err := sp.validatedPayload(sp.kind, raw)
	if err != nil {
		return sp.failEnvelope()
	}
	if err := sp.emit(AskEvent{Type: AskEnvelope, Kind: sp.kind, Payload: payload}); err != nil {
		return err
	}
	sp.segments = append(sp.segments, store.Segment{Type: store.SegmentEnvelope, Kind: sp.kind, Payload: payload})
	return nil
}

func (sp *envelopeSplitter) failEnvelope() error {
	raw := strings.Join(sp.body, "\n")
	if err := sp.emit(AskEvent{Type: AskEnvelopeFailed, Kind: sp.kind, Text: raw}); err != nil {
		return err
	}
	sp.segments = append(sp.segments, store.Segment{Type: store.SegmentCode, Text: raw})
	return nil
}

// validatedPayload validates the raw payload; on failure it runs the single
// repair round before giving up. A repair call that errors or times out
// degrades the envelope like any other failure.
func (sp *envelopeSplitter) validatedPayload(kind, raw string) (json.RawMessage, error) {
	payload, err := checkEnvelope(kind, raw)
	if err == nil {
		return payload, nil
	}
	if err := sp.emit(AskEvent{Type: AskEnvelopeRepairing, Kind: kind}); err != nil {
		return nil, err
	}
	fixed, rerr := sp.repair(kind, raw, err)
	if rerr == nil {
		if payload, rerr = checkEnvelope(kind, fixed); rerr == nil {
			return payload, nil
		}
	}
	sp.logRepairFailure(kind, rerr)
	return nil, rerr
}

func (sp *envelopeSplitter) logRepairFailure(kind string, err error) {
	if sp.ctx.Err() == nil {
		sp.logger.Warn("envelope repair failed", "kind", kind, "err", err)
	}
}

// repair runs one non-streaming model call carrying the kind, the invalid
// payload, the validator's complaints, and the schema verbatim. Same model
// and connection settings as the ask itself.
func (sp *envelopeSplitter) repair(kind, raw string, verr error) (string, error) {
	schema, err := envelopeSchemaText(kind)
	if err != nil {
		return "", err
	}
	prompt := fmt.Sprintf(repairPromptTemplate, kind, raw,
		strings.Join(validationErrorList(verr), "\n"), schema)
	fixed, err := sp.client.ChatOnce(sp.ctx, llm.ChatRequest{
		Model: llm.ChatModel,
		Messages: []llm.Message{
			llm.TextMessage("system", repairSystemPrompt),
			llm.TextMessage("user", prompt),
		},
	})
	if err != nil {
		return "", err
	}
	return unwrapFences(fixed), nil
}

// unwrapFences tolerates the model returning its JSON wrapped in a code
// fence.
func unwrapFences(reply string) string {
	reply = strings.TrimSpace(reply)
	if !strings.HasPrefix(reply, "```") {
		return reply
	}
	if i := strings.IndexByte(reply, '\n'); i >= 0 {
		reply = reply[i+1:]
	}
	if i := strings.LastIndexByte(reply, '\n'); i >= 0 && isBacktickRun(reply[i+1:]) {
		reply = reply[:i]
	}
	return strings.TrimSpace(reply)
}

func isBacktickRun(s string) bool {
	return s != "" && strings.TrimLeft(s, "`") == ""
}

// fenceOpen matches a fenced code block opener (up to three leading spaces,
// three or more backticks plus an info string) and reports its tag and
// backtick length.
func fenceOpen(line string) (tag string, length int) {
	trimmed := strings.TrimLeft(line, " ")
	if len(line)-len(trimmed) > 3 || !strings.HasPrefix(trimmed, "```") {
		return "", 0
	}
	rest := trimmed
	for len(rest) > 0 && rest[0] == '`' {
		rest = rest[1:]
	}
	length = len(trimmed) - len(rest)
	info := strings.TrimSpace(rest)
	if info == "" {
		return "", 0
	}
	tag = strings.ToLower(strings.Fields(info)[0])
	return tag, length
}

// fenceClose matches a closing fence: a backtick run alone on a line.
func fenceClose(line string) int {
	trimmed := strings.TrimLeft(line, " ")
	if len(line)-len(trimmed) > 3 {
		return 0
	}
	if trimmed == "" || strings.TrimLeft(trimmed, "`") != "" {
		return 0
	}
	return len(trimmed)
}

// Segments returns the ordered answer collected so far.
func (sp *envelopeSplitter) Segments() []store.Segment { return sp.segments }

// AppendSegment adds one segment the stream itself cannot produce — a tool
// card — at the current position, so the ordered answer stays aligned with
// the turn that produced it.
func (sp *envelopeSplitter) AppendSegment(seg store.Segment) {
	sp.segments = append(sp.segments, seg)
}

// Boundary flushes the buffered partial line when the model pauses prose to
// call a tool: the prose segment closes and the tool card lands after it.
// Envelope state survives the boundary (a fence still open keeps
// accumulating on the next round).
func (sp *envelopeSplitter) Boundary() error {
	if sp.line.Len() > 0 {
		line := sp.line.String()
		sp.line.Reset()
		if err := sp.lineComplete(line, false); err != nil {
			return err
		}
	}
	return nil
}

// SystemPrompt exposes the ask system prompt; the costly-tier prompt
// conformance test drives the real model with it.
func SystemPrompt() string { return systemPrompt }

// ValidateEnvelope checks one envelope payload against its kind's schema;
// the error lists every violated rule. Test-facing seam for prompt
// conformance.
func ValidateEnvelope(kind, payload string) error {
	_, err := checkEnvelope(kind, payload)
	return err
}

// messageText renders a stored message the way the model wrote it — the
// history form for follow-up asks. Answers re-fence their envelopes; tool
// cards collapse to their result line.
func messageText(m store.Message) string {
	if len(m.Segments) == 0 {
		return m.Content
	}
	var b strings.Builder
	for _, seg := range m.Segments {
		switch seg.Type {
		case store.SegmentProse:
			b.WriteString(seg.Text)
		case store.SegmentEnvelope:
			fmt.Fprintf(&b, "```%s\n%s\n```\n", seg.Kind, seg.Payload)
		case store.SegmentCode:
			fmt.Fprintf(&b, "```\n%s\n```\n", seg.Text)
		case store.SegmentTool:
			var p store.ToolPayload
			if json.Unmarshal(seg.Payload, &p) == nil {
				fmt.Fprintf(&b, "[tool %s: %s]\n", p.Tool, firstLineOf(p.Result))
			}
		}
	}
	return strings.TrimRight(b.String(), "\n")
}

// firstLineOf clips a tool result to its first line for history rendering.
func firstLineOf(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[:i]
	}
	if len(s) > 160 {
		s = s[:160] + "…"
	}
	return s
}
