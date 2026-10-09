// Package llm is a dependency-free OpenAI-compatible client: streaming chat
// completions (with multimodal text/image content) and embeddings, over
// plain net/http. PSet's chat goes through OpenRouter; the client also
// speaks to any OpenAI-shaped endpoint, local ones such as ollama included.
package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackt/pset/internal/cleanup"
)

// DefaultTimeout bounds a whole HTTP exchange, streaming included. It is
// generous because the long-form calls are genuinely long: writing one
// walkthrough is a single request that routinely runs minutes, and cutting
// it off mid-answer costs the whole call. A dead endpoint is caught by
// dialTimeout instead, which is what a short overall cap was really being
// used for.
const DefaultTimeout = 20 * time.Minute

// dialTimeout bounds getting a connection, which is where an endpoint that
// is down actually shows up: wrong host, nothing listening, no route.
//
// Deliberately NOT a response-header timeout. The long-form calls are not
// streamed (Stream: false), and a non-streaming completion sends no headers
// until the model has finished generating — so any header deadline is really
// a deadline on the whole generation, and would cut off exactly the
// minutes-long guide calls this budget exists to allow.
const dialTimeout = 10 * time.Second

// transport is every Client's: they are built per call (Open), and a
// Transport of their own each kept its idle connections, and the three
// goroutines behind each, for good. One shared pool reuses connections
// and closes idle ones.
var transport = &http.Transport{
	DialContext:         (&net.Dialer{Timeout: dialTimeout}).DialContext,
	TLSHandshakeTimeout: dialTimeout,
	MaxIdleConnsPerHost: 8,
	IdleConnTimeout:     90 * time.Second,
}

// Client talks to one chat endpoint and one embeddings endpoint, both
// OpenAI-shaped. The zero value is not usable; use New.
type Client struct {
	apiBaseURL   string
	apiKey       string
	embedBaseURL string
	embedModel   string
	http         *http.Client
}

// New builds a client. apiBaseURL serves /chat/completions, embedBaseURL
// serves /embeddings; embedModel names the embeddings model to request.
func New(apiBaseURL, apiKey, embedBaseURL, embedModel string) *Client {
	return &Client{
		apiBaseURL:   strings.TrimRight(apiBaseURL, "/"),
		apiKey:       apiKey,
		embedBaseURL: strings.TrimRight(embedBaseURL, "/"),
		embedModel:   embedModel,
		http:         &http.Client{Timeout: DefaultTimeout, Transport: transport},
	}
}

// Config is a saved, tested connection pair, the one shape every feature
// is handed. A side that was never saved is blank: blank means "not set up".
type Config struct {
	ChatEndpoint  string
	APIKey        string
	ChatModel     string
	EmbedEndpoint string
	EmbedModel    string
}

// ChatReady and EmbedReady report whether a side is set up.
func (c Config) ChatReady() bool { return c.ChatEndpoint != "" && c.ChatModel != "" }

// EmbedReady reports whether embeddings are set up.
func (c Config) EmbedReady() bool { return c.EmbedEndpoint != "" && c.EmbedModel != "" }

// Open builds a client for a Config.
func Open(c Config) *Client {
	return New(c.ChatEndpoint, c.APIKey, c.EmbedEndpoint, c.EmbedModel)
}

// ChatConfigured reports whether the chat endpoint has a base URL and key.
func (c *Client) ChatConfigured() bool { return c.apiBaseURL != "" && c.apiKey != "" }

// EmbedConfigured reports whether the embeddings endpoint is reachable in
// principle (a base URL is set).
func (c *Client) EmbedConfigured() bool { return c.embedBaseURL != "" }

// CallError is a failed model call with the HTTP status and response body.
// Adapters wrap it in a user-facing message; the body stays reachable for
// verbose output.
type CallError struct {
	Status int
	Body   string
}

func (e *CallError) Error() string {
	return fmt.Sprintf("model request failed (HTTP %d)", e.Status)
}

// Message is one chat turn. Content may be plain text or multimodal parts —
// build it with TextMessage or the Content helpers, not by hand. A tool
// round adds two shapes: an assistant turn carrying ToolCalls, and a
// role:"tool" turn whose ToolCallID answers a specific call.
type Message struct {
	Role       string     `json:"role"`
	Content    Content    `json:"content"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	// Reasoning is what a thinking model reasoned before this assistant
	// turn. Sent back, it lets the model carry on from its own thinking
	// instead of redoing it after every tool call. Only OpenRouter gets it
	// (see shape); the field is its name for it.
	Reasoning string `json:"reasoning,omitempty"`
	// ReasoningDetails is OpenRouter's structured reasoning, signatures
	// included, which Anthropic models need back across tool calls.
	ReasoningDetails json.RawMessage `json:"reasoning_details,omitempty"`
}

// TextMessage is a plain-text chat turn.
func TextMessage(role, text string) Message {
	return Message{Role: role, Content: TextContent(text)}
}

// Content marshals either as a JSON string (plain text) or as an array of
// typed parts (text + images). The zero Content is an empty string.
type Content struct {
	text  string
	parts []Part
}

// TextContent wraps plain text.
func TextContent(text string) Content { return Content{text: text} }

// TextPart returns a text content part.
func TextPart(text string) Part { return Part{Type: "text", Text: text} }

// ImagePart returns an image content part; url is a data URL such as
// "data:image/png;base64,…".
func ImagePart(url string) Part {
	return Part{Type: "image_url", ImageURL: &ImageURL{URL: url}}
}

// PartsContent builds multimodal content from parts.
func PartsContent(parts ...Part) Content { return Content{parts: parts} }

// AppendPart adds one part to multimodal content.
func (c *Content) AppendPart(p Part) { c.parts = append(c.parts, p) }

// Text returns the plain-text form; empty when the content is multimodal.
func (c Content) Text() string { return c.text }

// Parts returns the multimodal parts; nil for plain-text content.
func (c Content) Parts() []Part { return c.parts }

// Part is one multimodal content unit: type "text" with text, or
// "image_url" with an image URL object.
type Part struct {
	Type     string    `json:"type"`
	Text     string    `json:"text,omitempty"`
	ImageURL *ImageURL `json:"image_url,omitempty"`
}

// ImageURL carries the image reference; OpenAI-shaped APIs expect the URL
// nested under this key.
type ImageURL struct {
	URL string `json:"url"`
}

// MarshalJSON writes plain text as a string and parts as a list, as the API takes both.
func (c Content) MarshalJSON() ([]byte, error) {
	if len(c.parts) > 0 {
		return json.Marshal(c.parts)
	}
	return json.Marshal(c.text)
}

// UnmarshalJSON reads either a string or a list of parts.
func (c *Content) UnmarshalJSON(data []byte) error {
	if bytes.HasPrefix(bytes.TrimSpace(data), []byte("[")) {
		c.parts = nil
		return json.Unmarshal(data, &c.parts)
	}
	c.parts = nil
	return json.Unmarshal(data, &c.text)
}

// Tool declares one function the model may call; Parameters is a JSON
// Schema object describing the arguments object.
type Tool struct {
	Type     string       `json:"type"` // always "function"
	Function ToolFunction `json:"function"`
}

// ToolFunction is the function half of a Tool declaration.
type ToolFunction struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

// NewTool is the single constructor; type is fixed on the wire.
func NewTool(name, description string, parameters json.RawMessage) Tool {
	return Tool{Type: "function", Function: ToolFunction{
		Name: name, Description: description, Parameters: parameters,
	}}
}

// ToolCall is the model asking to run one function; Arguments is a JSON
// object as a string.
type ToolCall struct {
	ID       string       `json:"id"`
	Type     string       `json:"type"` // "function"
	Function ToolCallFunc `json:"function"`
}

// ToolCallFunc names the call and carries its raw JSON arguments.
type ToolCallFunc struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// Reply is one completed model turn: prose content plus any tool calls it
// requested. Either half may be empty.
type Reply struct {
	Content   string
	ToolCalls []ToolCall
	// Reasoning is what a thinking model reasoned before answering.
	Reasoning string
	// ReasoningDetails is the same reasoning as OpenRouter structures it.
	ReasoningDetails json.RawMessage
	// Usage is what the call cost, when the provider says (OpenRouter
	// always does; others when they send it).
	Usage *Usage
	// Host is who served the call, as OpenRouter names it ("Z.AI",
	// "Parasail"): OpenRouter spreads a model over many hosts.
	Host string
	// Model is the model that answered, as the provider names it: a
	// fallback's, when the one asked for failed or was rate limited.
	Model string
}

// Usage is a call's token counts and, from OpenRouter, its cost in
// dollars.
type Usage struct {
	PromptTokens     int     `json:"prompt_tokens"`
	CompletionTokens int     `json:"completion_tokens"`
	Cost             float64 `json:"cost,omitempty"`
	PromptDetails    struct {
		CachedTokens int `json:"cached_tokens"`
		// CacheWriteTokens is what this call put in the cache.
		CacheWriteTokens int `json:"cache_write_tokens"`
	} `json:"prompt_tokens_details"`
	CompletionDetails struct {
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"completion_tokens_details"`
}

// ChatRequest is one chat completion call. Model is required; MaxTokens
// caps the reply (0 = provider default); Temperature nil = provider default;
// Tools enables function calling (the model chooses when to call).
type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Stream      bool      `json:"stream"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature *float64  `json:"temperature,omitempty"`
	Tools       []Tool    `json:"tools,omitempty"`
	// ToolChoice is "none" for a round that must answer in words: the
	// tools stay declared, since a model whose history holds tool calls
	// may call one anyway when they're gone.
	ToolChoice string `json:"tool_choice,omitempty"`
	// ReasoningEffort is how hard a thinking model thinks: "low",
	// "high" or "max". OpenRouter gets it as Reasoning's effort, and no
	// other endpoint gets it; see shape. Never sent as is. A plain Job
	// sets it to send no reasoning at all.
	ReasoningEffort string `json:"-"`
	// Fallbacks are the models OpenRouter tries, in order, when Model
	// fails or is rate limited: shape sends them, after Model, as Models.
	Fallbacks []string `json:"-"`
	Models    []string `json:"models,omitempty"`
	// Reasoning is OpenRouter's thinking switch, and Provider which of a
	// model's hosts may serve it. shape sets both for OpenRouter only.
	Reasoning *ReasoningOptions `json:"reasoning,omitempty"`
	Provider  *ProviderOptions  `json:"provider,omitempty"`
	// CacheControl is OpenRouter's automatic prompt caching: the prefix a
	// request shares with the one before (a guide's rounds, a book's Ask
	// conversation) is billed at a tenth. shape sets it for the models that
	// cache only when asked (Anthropic's); Gemini and the rest cache on
	// their own, and asking would buy Gemini's paid explicit cache.
	CacheControl *CacheControl `json:"cache_control,omitempty"`
	// SessionID groups a job's calls on OpenRouter, where a guide's
	// rounds and repairs, or a book's whole conversation, read as one
	// session; it also keeps them on one host, which keeps its cache warm.
	// Left empty, it comes from the context (WithSession).
	SessionID string `json:"session_id,omitempty"`
	// Subject is what this call was for, the thing its cost lands on.
	// Left empty it comes from the context (WithSubject), which the job
	// sets where it sets its session; the call log and the usage sink
	// read it.
	Subject Subject `json:"-"`
	// stage and run are the job's WithStage and WithRun, read when the
	// call starts and recorded with it.
	stage, run string
	// OnReasoning, if set, receives a thinking model's reasoning as it
	// streams: the part it writes before, and apart from, its answer.
	OnReasoning func(text string) `json:"-"`
}

// ReasoningOptions is OpenRouter's reasoning object: an effort, or just
// switched on at the model's own default.
type ReasoningOptions struct {
	Effort  string `json:"effort,omitempty"`
	Enabled bool   `json:"enabled,omitempty"`
}

// CacheControl is a prompt cache request: "ephemeral" is five minutes.
type CacheControl struct {
	Type string `json:"type"`
}

// cachesWhenAsked is a model that caches its prompt only when the request
// asks: Anthropic's. Without it Haiku's guides cached nothing, and their
// input was over half their cost.
func cachesWhenAsked(model string) bool { return strings.HasPrefix(model, "anthropic/") }

// ProviderOptions is OpenRouter's say in which hosts serve a model: which
// to try first (Order, falling back to the rest), at what precision, and
// how to rank the rest (Sort).
type ProviderOptions struct {
	Order         []string `json:"order,omitempty"`
	Quantizations []string `json:"quantizations,omitempty"`
	Sort          string   `json:"sort,omitempty"`
}

// fastestFirst ranks a model's hosts by speed. Hosts of one model differ
// several times over: an assignment read that took 157s on the host
// OpenRouter chose took 28s on the fastest, reading the same rows, for
// about half a cent more (DeepSeek V4.1 Flash, 2026-09-29). A session's
// later calls still ask first for the host that served its first.
const fastestFirst = "throughput"

// fullPrecision is the weights OpenRouter may serve PSet's models at. The
// cheapest hosts run 4-bit weights (fp4, int4), which can reason worse;
// the saving isn't worth a wrong walkthrough. "unknown" keeps first-party
// hosts, which don't say.
var fullPrecision = []string{"fp8", "fp16", "bf16", "fp32", "unknown"}

type sessionKey struct{}

// sessionPrefix makes this install's sessions its own: two copies of one
// library (a test copy beside the real one) have the same question ids,
// and would otherwise share sessions on one OpenRouter account. Set once
// at startup, before any call.
var sessionPrefix string

// SetSessionPrefix sets the tag every session id starts with.
func SetSessionPrefix(tag string) { sessionPrefix = tag }

// hosts remembers the host that served each session's first call, so the
// rest of the session asks it first: a host keeps its prompt cache to
// itself, and a guide that hops between hosts pays for its whole prompt
// again each round. Bounded: it starts over past maxHosts sessions.
var hosts struct {
	sync.Mutex
	m map[string]string
}

const maxHosts = 1000

func hostFor(session string) string {
	hosts.Lock()
	defer hosts.Unlock()
	return hosts.m[session]
}

func keepHost(session, host string) {
	if session == "" || host == "" {
		return
	}
	hosts.Lock()
	defer hosts.Unlock()
	if hosts.m == nil || len(hosts.m) >= maxHosts {
		hosts.m = map[string]string{}
	}
	if _, ok := hosts.m[session]; !ok {
		hosts.m[session] = host
	}
}

// WithSession names the session every model call made under ctx belongs
// to: a job sets it once, and the calls it makes, however deep, join it.
func WithSession(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, sessionKey{}, id)
}

// Subject is what a call was for: the kind of thing that spent it
// ("question", "read", "turn", "book" — usage names them) and its id. A
// call with no subject has an empty type.
type Subject struct {
	Type string
	ID   string
}

type subjectKey struct{}

// WithSubject names what every model call made under ctx was for: a job
// sets it once, and the calls it makes, however deep, record it.
func WithSubject(ctx context.Context, s Subject) context.Context {
	return context.WithValue(ctx, subjectKey{}, s)
}

func subjectOf(ctx context.Context) Subject {
	s, _ := ctx.Value(subjectKey{}).(Subject)
	return s
}

type stageKey struct{}
type runKey struct{}

// WithStage names the part of a job every model call made under ctx
// belongs to ("Find", "Guide", "Round 2"), so the usage store can split a
// job's spending by what it was spent on.
func WithStage(ctx context.Context, stage string) context.Context {
	return context.WithValue(ctx, stageKey{}, stage)
}

// WithRun names the run of a subject the calls under ctx belong to: the
// steps one find chains together share one, and a retry or a rewrite
// starts another.
func WithRun(ctx context.Context, run string) context.Context {
	return context.WithValue(ctx, runKey{}, run)
}

// RunOf is the run ctx carries, empty when it has none.
func RunOf(ctx context.Context) string {
	r, _ := ctx.Value(runKey{}).(string)
	return r
}

func stageOf(ctx context.Context) string {
	s, _ := ctx.Value(stageKey{}).(string)
	return s
}

// maxSession is OpenRouter's limit on a session id.
const maxSession = 256

func sessionOf(ctx context.Context) string {
	id, _ := ctx.Value(sessionKey{}).(string)
	if id != "" && sessionPrefix != "" {
		id = sessionPrefix + "-" + id
	}
	if len(id) > maxSession {
		id = id[:maxSession]
	}
	return id
}

// ToolMessage is the result turn for one tool call.
func ToolMessage(callID, content string) Message {
	return Message{Role: "tool", ToolCallID: callID, Content: TextContent(content)}
}

// AssistantToolMessage is the assistant turn that requested calls, kept so
// the transcript replays exactly as the exchange happened, reasoning
// included.
func AssistantToolMessage(reply Reply) Message {
	return Message{Role: "assistant", Content: TextContent(reply.Content), ToolCalls: reply.ToolCalls, Reasoning: reply.Reasoning, ReasoningDetails: reply.ReasoningDetails}
}

// openRouter reports whether the endpoint is OpenRouter, the provider
// PSet's chat goes through: one key for many models, with its own
// reasoning and host options.
func (c *Client) openRouter() bool {
	u, err := url.Parse(c.apiBaseURL)
	if err != nil {
		return false
	}
	host := u.Hostname()
	return host == "openrouter.ai" || strings.HasSuffix(host, ".openrouter.ai")
}

// shape fits a request to the endpoint. OpenRouter gets its reasoning
// object (the effort, or reasoning switched on), the model's earlier
// reasoning back on its assistant turns, and full-precision hosts only.
// Any other endpoint gets neither the reasoning nor the effort: some
// refuse the fields (DeepSeek's own API answers 400), and a model that
// isn't sent its thinking back simply thinks again.
func (c *Client) shape(ctx context.Context, req ChatRequest) ChatRequest {
	if c.openRouter() {
		if req.SessionID == "" {
			req.SessionID = sessionOf(ctx)
		}
		if len(req.Fallbacks) > 0 && len(req.Models) == 0 {
			req.Models = append([]string{req.Model}, req.Fallbacks...)
		}
		if req.Reasoning == nil && req.ReasoningEffort != ownDefault {
			if req.ReasoningEffort != "" {
				req.Reasoning = &ReasoningOptions{Effort: req.ReasoningEffort}
			} else {
				req.Reasoning = &ReasoningOptions{Enabled: true}
			}
		}
		if req.CacheControl == nil && cachesWhenAsked(req.Model) {
			req.CacheControl = &CacheControl{Type: "ephemeral"}
		}
		if req.Provider == nil {
			req.Provider = &ProviderOptions{Quantizations: fullPrecision, Sort: fastestFirst}
			if h := hostFor(req.SessionID); h != "" {
				req.Provider.Order = []string{h}
			}
		}
		return req
	}
	req.Reasoning, req.Provider, req.SessionID, req.Models, req.CacheControl = nil, nil, "", nil, nil
	carries := false
	for _, m := range req.Messages {
		if m.Reasoning != "" || len(m.ReasoningDetails) > 0 {
			carries = true
			break
		}
	}
	if !carries {
		return req
	}
	msgs := make([]Message, len(req.Messages))
	for i, m := range req.Messages {
		m.Reasoning, m.ReasoningDetails = "", nil
		msgs[i] = m
	}
	req.Messages = msgs
	return req
}

// ChatOnce runs a non-streaming completion and returns the reply text —
// used for connection tests and one-shot calls.
func (c *Client) ChatOnce(ctx context.Context, req ChatRequest) (string, error) {
	reply, err := c.ChatOnceFull(ctx, req)
	if err != nil {
		return "", err
	}
	return reply.Content, nil
}

// Mechanical is a small one-shot call: a system prompt and a message in,
// the reply out, at low reasoning effort. It is what the document's
// repairs are made with: small, mechanical work that needs no long
// thought. Its type is the document's Model, which llm does not import.
func (c *Client) Mechanical(model string) func(ctx context.Context, system, user string) (string, error) {
	return func(ctx context.Context, system, user string) (string, error) {
		return c.ChatOnce(ctx, ChatRequest{Model: model, ReasoningEffort: "low", Messages: []Message{
			TextMessage("system", system),
			TextMessage("user", user),
		}})
	}
}

// ChatOnceFull is ChatOnce with any requested tool calls visible.
func (c *Client) ChatOnceFull(ctx context.Context, req ChatRequest) (reply Reply, err error) {
	start := time.Now()
	if req.Subject.Type == "" {
		req.Subject = subjectOf(ctx)
	}
	req.stage, req.run = stageOf(ctx), RunOf(ctx)
	defer func() { logCall(req, start, reply, err) }()
	req.Stream = false
	req = c.shape(ctx, req)
	var payload struct {
		Choices []struct {
			Message struct {
				Content          Content         `json:"content"`
				ToolCalls        []ToolCall      `json:"tool_calls"`
				ReasoningContent string          `json:"reasoning_content"`
				Reasoning        string          `json:"reasoning"`
				ReasoningDetails json.RawMessage `json:"reasoning_details"`
			} `json:"message"`
		} `json:"choices"`
		Usage *Usage `json:"usage"`
		Host  string `json:"provider"`
		Model string `json:"model"`
	}
	if err := c.post(ctx, c.apiBaseURL+"/chat/completions", req, &payload); err != nil {
		return Reply{}, err
	}
	if len(payload.Choices) == 0 {
		return Reply{}, fmt.Errorf("model reply had no choices")
	}
	msg := payload.Choices[0].Message
	keepHost(req.SessionID, payload.Host)
	return Reply{Content: msg.Content.text, ToolCalls: normalizeToolCalls(msg.ToolCalls), Reasoning: firstOf(msg.ReasoningContent, msg.Reasoning), ReasoningDetails: msg.ReasoningDetails, Usage: payload.Usage, Host: payload.Host, Model: payload.Model}, nil
}

// ChatStream runs a streaming completion and returns the assembled reply
// text.
func (c *Client) ChatStream(ctx context.Context, req ChatRequest, delta func(text string) error) (string, error) {
	reply, err := c.ChatStreamFull(ctx, req, delta)
	return reply.Content, err
}

// ChatStreamFull runs a streaming completion, invoking delta for every
// content fragment as it arrives, and returns the assembled reply with any
// tool calls — providers stream those as argument fragments across many
// chunks, so they are accumulated by index. The stream ends at the SSE
// [DONE] sentinel; a cancelled ctx aborts mid-stream.
func (c *Client) ChatStreamFull(ctx context.Context, req ChatRequest, delta func(text string) error) (reply Reply, err error) {
	start := time.Now()
	if req.Subject.Type == "" {
		req.Subject = subjectOf(ctx)
	}
	req.stage, req.run = stageOf(ctx), RunOf(ctx)
	defer func() { logCall(req, start, reply, err) }()
	req.Stream = true
	req = c.shape(ctx, req)

	resp, err := c.doWithRetry(ctx, c.apiBaseURL+"/chat/completions", req)
	if err != nil {
		return Reply{}, err
	}
	defer cleanup.Close(resp.Body)

	var full, reasoning strings.Builder
	var usage *Usage
	var host, answered string
	// finished is the stream saying it's done, by [DONE] or a choice's
	// finish_reason. A stream that just stops without either was cut, even
	// when every event in it parsed.
	finished := false
	calls := newToolCallAccumulator()
	var details []map[string]any
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	// Server-sent events: an event's data may span several data: lines,
	// joined by newlines, and ends at a blank line.
	var event strings.Builder
	next := func() (string, bool) {
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				if event.Len() > 0 {
					data := event.String()
					event.Reset()
					return data, true
				}
				continue
			}
			if strings.HasPrefix(line, "data:") {
				if event.Len() > 0 {
					event.WriteByte('\n')
				}
				event.WriteString(strings.TrimPrefix(strings.TrimPrefix(line, "data:"), " "))
			}
		}
		data := event.String()
		event.Reset()
		return data, data != ""
	}
	for {
		if ctx.Err() != nil {
			return Reply{}, ctx.Err()
		}
		raw, ok := next()
		if !ok {
			break
		}
		data := strings.TrimSpace(raw)
		if data == "" {
			continue
		}
		if data == "[DONE]" {
			finished = true
			break
		}
		var chunk struct {
			Choices []struct {
				FinishReason string `json:"finish_reason"`
				Delta        struct {
					Content          Content          `json:"content"`
					ReasoningContent string           `json:"reasoning_content"`
					Reasoning        string           `json:"reasoning"`
					ReasoningDetails []map[string]any `json:"reasoning_details"`
					ToolCalls        []struct {
						Index    int    `json:"index"`
						ID       string `json:"id"`
						Function struct {
							Name      string `json:"name"`
							Arguments string `json:"arguments"`
						} `json:"function"`
					} `json:"tool_calls"`
				} `json:"delta"`
			} `json:"choices"`
			Usage *Usage `json:"usage"`
			Host  string `json:"provider"`
			Model string `json:"model"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			if ctx.Err() != nil {
				// Stopped, or shutting down: the drop is ours.
				return Reply{}, ctx.Err()
			}
			if isCut(err) {
				// The connection dropped mid-event.
				return Reply{Content: full.String()}, fmt.Errorf("%w: %v", ErrStreamCut, err)
			}
			return Reply{}, fmt.Errorf("decode stream chunk: %w", err)
		}
		if chunk.Usage != nil {
			usage = chunk.Usage
		}
		if chunk.Host != "" {
			host = chunk.Host
		}
		if chunk.Model != "" {
			answered = chunk.Model
		}
		for _, choice := range chunk.Choices {
			if choice.FinishReason != "" {
				finished = true
			}
			// OpenRouter names the thinking reasoning; other
			// OpenAI-shaped servers (vLLM, DeepSeek) reasoning_content. A
			// server that sent both would send it twice.
			if r := firstOf(choice.Delta.ReasoningContent, choice.Delta.Reasoning); r != "" {
				reasoning.WriteString(r)
				if req.OnReasoning != nil {
					req.OnReasoning(r)
				}
			}
			details = mergeDetails(details, choice.Delta.ReasoningDetails)
			text := choice.Delta.Content.text
			if text == "" {
				calls.feed(choice.Delta.ToolCalls)
				continue
			}
			full.WriteString(text)
			calls.feed(choice.Delta.ToolCalls)
			if delta != nil {
				if err := delta(text); err != nil {
					return Reply{Content: full.String()}, err
				}
			}
		}
	}
	if ctx.Err() != nil {
		return Reply{}, ctx.Err()
	}
	if err := scanner.Err(); err != nil {
		return Reply{Content: full.String()}, fmt.Errorf("%w: %v", ErrStreamCut, err)
	}
	if !finished {
		return Reply{Content: full.String()}, fmt.Errorf("%w: the stream ended without finishing", ErrStreamCut)
	}
	keepHost(req.SessionID, host)
	var rd json.RawMessage
	if len(details) > 0 {
		rd, _ = json.Marshal(details)
	}
	return Reply{Content: full.String(), ToolCalls: calls.finish(), Reasoning: reasoning.String(), ReasoningDetails: rd, Usage: usage, Host: host, Model: answered}, nil
}

// mergeDetails folds streamed reasoning_details chunks into whole
// entries, one per index: text pieces joined, the signature kept.
func mergeDetails(acc []map[string]any, chunk []map[string]any) []map[string]any {
	for _, d := range chunk {
		idx, hasIdx := d["index"].(float64)
		var found map[string]any
		if hasIdx {
			for _, a := range acc {
				if i, ok := a["index"].(float64); ok && i == idx {
					found = a
					break
				}
			}
		}
		if found == nil {
			c := map[string]any{}
			for k, v := range d {
				c[k] = v
			}
			acc = append(acc, c)
			continue
		}
		for k, v := range d {
			switch k {
			case "text", "summary", "data":
				if sv, ok := v.(string); ok {
					prev, _ := found[k].(string)
					found[k] = prev + sv
				}
			default:
				if v != nil && v != "" {
					found[k] = v
				}
			}
		}
	}
	return acc
}

// firstOf is the first non-empty string.
func firstOf(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// ErrStreamCut is a streamed reply that ended partway: the connection
// dropped, or the endpoint gave up on a long answer.
var ErrStreamCut = errors.New("the model's stream was cut off")

// isCut is a JSON error that means the text simply stopped.
func isCut(err error) bool {
	return strings.Contains(err.Error(), "unexpected end of JSON input")
}

// toolCallAccumulator assembles streamed tool calls; each index's id and
// name arrive once, arguments in fragments.
type toolCallAccumulator struct {
	byIndex map[int]*partialToolCall
}

type partialToolCall struct {
	id   string
	name strings.Builder
	args strings.Builder
}

func newToolCallAccumulator() *toolCallAccumulator {
	return &toolCallAccumulator{byIndex: map[int]*partialToolCall{}}
}

func (a *toolCallAccumulator) feed(calls []struct {
	Index    int    `json:"index"`
	ID       string `json:"id"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}) {
	for _, tc := range calls {
		p := a.byIndex[tc.Index]
		if p == nil {
			p = &partialToolCall{}
			a.byIndex[tc.Index] = p
		}
		if tc.ID != "" {
			p.id = tc.ID
		}
		p.name.WriteString(tc.Function.Name)
		p.args.WriteString(tc.Function.Arguments)
	}
}

func (a *toolCallAccumulator) finish() []ToolCall {
	if len(a.byIndex) == 0 {
		return nil
	}
	indexes := make([]int, 0, len(a.byIndex))
	for i := range a.byIndex {
		indexes = append(indexes, i)
	}
	sort.Ints(indexes)
	out := make([]ToolCall, 0, len(indexes))
	for _, i := range indexes {
		p := a.byIndex[i]
		if p.name.Len() == 0 && p.args.Len() == 0 {
			continue
		}
		out = append(out, ToolCall{
			ID: p.id, Type: "function",
			Function: ToolCallFunc{Name: p.name.String(), Arguments: p.args.String()},
		})
	}
	return out
}

// normalizeToolCalls fills the type field providers omit and drops empty
// calls.
func normalizeToolCalls(calls []ToolCall) []ToolCall {
	out := make([]ToolCall, 0, len(calls))
	for _, c := range calls {
		if c.Function.Name == "" && c.Function.Arguments == "" {
			continue
		}
		if c.Type == "" {
			c.Type = "function"
		}
		out = append(out, c)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// EmbedRequest asks for vectors of the given texts in input order.
type EmbedRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

// Embed returns one vector per input text, in input order.
func (c *Client) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	req := EmbedRequest{Model: c.embedModel, Input: texts}
	var payload struct {
		Data []struct {
			Index     int       `json:"index"`
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	if err := c.post(ctx, c.embedBaseURL+"/embeddings", req, &payload); err != nil {
		return nil, err
	}
	if len(payload.Data) != len(texts) {
		return nil, fmt.Errorf("embedding endpoint returned %d vectors for %d inputs", len(payload.Data), len(texts))
	}
	out := make([][]float32, len(texts))
	for _, d := range payload.Data {
		if d.Index < 0 || d.Index >= len(out) {
			return nil, fmt.Errorf("embedding endpoint returned out-of-range index %d", d.Index)
		}
		out[d.Index] = d.Embedding
	}
	return out, nil
}

func (c *Client) post(ctx context.Context, url string, body any, out any) error {
	resp, err := c.doWithRetry(ctx, url, body)
	if err != nil {
		return err
	}
	defer cleanup.Close(resp.Body)
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode model reply: %w", err)
	}
	return nil
}

func (c *Client) request(ctx context.Context, method, url string, body any) (*http.Request, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("encode request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	return req, nil
}

func readErrorBody(status int, body []byte) error {
	return &CallError{Status: status, Body: string(body)}
}

// doWithRetry POSTs a JSON body and returns a 200 response. Providers
// shed load with 429 and occasional 5xx, so failed attempts are
// retried with a growing pause (honouring Retry-After) before the error
// reaches the caller.
func (c *Client) doWithRetry(ctx context.Context, url string, body any) (*http.Response, error) {
	for attempt := 0; ; attempt++ {
		httpReq, err := c.request(ctx, http.MethodPost, url, body)
		if err != nil {
			return nil, err
		}
		resp, err := c.http.Do(httpReq)
		if err != nil {
			return nil, fmt.Errorf("model request failed: %w", err)
		}
		if resp.StatusCode == http.StatusOK {
			return resp, nil
		}
		data, readErr := io.ReadAll(io.LimitReader(resp.Body, 8*1024))
		cleanup.Close(resp.Body)
		if readErr != nil {
			return nil, fmt.Errorf("read model error reply: %w", readErr)
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if (resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500) && attempt < 2 && !OutOfCredit(resp.StatusCode, string(data)) {
			delay := time.Duration(attempt+1) * 2 * time.Second
			if ra := resp.Header.Get("Retry-After"); ra != "" {
				if secs, perr := strconv.Atoi(ra); perr == nil && secs >= 0 && secs <= 120 {
					delay = time.Duration(secs) * time.Second
				}
			}
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
			continue
		}
		return nil, readErrorBody(resp.StatusCode, data)
	}
}

// Trouble is what a failed call means for the person waiting on it.
type Trouble string

const (
	// TroubleCut means the reply stopped partway. Asking again usually works.
	TroubleCut Trouble = "cut"
	// TroubleBusy means the provider didn't answer, is overloaded, or the
	// network failed. Nothing to fix; try again later.
	TroubleBusy Trouble = "busy"
	// TroubleRejected means the provider refused the request (a bad key, an
	// unknown model): something in the connection's settings is wrong.
	TroubleRejected Trouble = "rejected"
	// TroubleCredit means the account has no money left. Asking again can't
	// help until it's topped up; switching provider in Settings can.
	TroubleCredit Trouble = "credit"
)

// OutOfCredit reports whether a failed call means the account has run out
// of money: OpenRouter answers 402. Other providers say it in words, some
// under a status they also shed load with (429), so the body counts too.
func OutOfCredit(status int, body string) bool {
	if status == http.StatusPaymentRequired {
		return true
	}
	b := strings.ToLower(body)
	return strings.Contains(b, "insufficient balance") || strings.Contains(b, "insufficient credits") ||
		strings.Contains(b, "more credits")
}

// NoKey says it in words, wherever a model call would need a key that was
// never saved. The one sentence: the web tells a setup failure by the
// failure kind, not by this text, but it should still read the same
// everywhere.
const NoKey = "There's no OpenRouter key yet. Add yours in Settings, under Connections, then try again."

// NoCredit says it in words, for the person waiting on the call.
const NoCredit = "Your OpenRouter account is out of credit. Top it up at openrouter.ai, then try again."

// Classify names a model call's failure, with the HTTP status when the
// provider gave one.
func Classify(err error) (Trouble, int) {
	if errors.Is(err, ErrStreamCut) {
		return TroubleCut, 0
	}
	var e *CallError
	if errors.As(err, &e) {
		if OutOfCredit(e.Status, e.Body) {
			return TroubleCredit, e.Status
		}
		if e.Status == http.StatusTooManyRequests || e.Status >= 500 {
			return TroubleBusy, e.Status
		}
		return TroubleRejected, e.Status
	}
	return TroubleBusy, 0
}

// Refusal says in words why a provider refused a request, by its status.
func Refusal(status int) string {
	switch status {
	case http.StatusUnauthorized, http.StatusForbidden:
		return fmt.Sprintf("OpenRouter turned the request down (HTTP %d): the API key in Settings may be wrong or expired.", status)
	case http.StatusNotFound:
		return "OpenRouter doesn't know the model PSet asked for (HTTP 404)."
	}
	return fmt.Sprintf("OpenRouter turned the request down (HTTP %d).", status)
}

// Unfence tolerates JSON wrapped in a code fence.
func Unfence(s string) string {
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
