// Package llm is a dependency-free OpenAI-compatible client: streaming chat
// completions (with multimodal text/image content) and embeddings, over
// plain net/http. It speaks enough of the wire format for the Z.ai API and
// OpenAI-shaped local endpoints such as ollama.
package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ChatModel is the hardcoded chat model used for every ask. Vision-capable:
// it must accept image_url content parts. Change it here and nowhere else.
const ChatModel = "glm-5.3-flash"

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
		http: &http.Client{
			Timeout: DefaultTimeout,
			Transport: &http.Transport{
				DialContext:         (&net.Dialer{Timeout: dialTimeout}).DialContext,
				TLSHandshakeTimeout: dialTimeout,
			},
		},
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
func (c Config) ChatReady() bool  { return c.ChatEndpoint != "" && c.ChatModel != "" }
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

// LLMError is a failed model call with the HTTP status and response body.
// Adapters wrap it in a user-facing message; the body stays reachable for
// verbose output.
type LLMError struct {
	Status int
	Body   string
}

func (e *LLMError) Error() string {
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

func (c Content) MarshalJSON() ([]byte, error) {
	if len(c.parts) > 0 {
		return json.Marshal(c.parts)
	}
	return json.Marshal(c.text)
}

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
}

// ToolMessage is the result turn for one tool call.
func ToolMessage(callID, content string) Message {
	return Message{Role: "tool", ToolCallID: callID, Content: TextContent(content)}
}

// AssistantToolMessage is the assistant turn that requested calls, kept so
// the transcript replays exactly as the exchange happened.
func AssistantToolMessage(content string, calls []ToolCall) Message {
	return Message{Role: "assistant", Content: TextContent(content), ToolCalls: calls}
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

// ChatOnceFull is ChatOnce with any requested tool calls visible.
func (c *Client) ChatOnceFull(ctx context.Context, req ChatRequest) (Reply, error) {
	req.Stream = false
	var payload struct {
		Choices []struct {
			Message struct {
				Content   Content    `json:"content"`
				ToolCalls []ToolCall `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := c.post(ctx, c.apiBaseURL+"/chat/completions", req, &payload); err != nil {
		return Reply{}, err
	}
	if len(payload.Choices) == 0 {
		return Reply{}, fmt.Errorf("model reply had no choices")
	}
	msg := payload.Choices[0].Message
	return Reply{Content: msg.Content.text, ToolCalls: normalizeToolCalls(msg.ToolCalls)}, nil
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
func (c *Client) ChatStreamFull(ctx context.Context, req ChatRequest, delta func(text string) error) (Reply, error) {
	req.Stream = true

	resp, err := c.doWithRetry(ctx, c.apiBaseURL+"/chat/completions", req)
	if err != nil {
		return Reply{}, err
	}
	defer resp.Body.Close()

	var full strings.Builder
	calls := newToolCallAccumulator()
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	for scanner.Scan() {
		if ctx.Err() != nil {
			return Reply{}, ctx.Err()
		}
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" {
			continue
		}
		if data == "[DONE]" {
			break
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content   Content `json:"content"`
					ToolCalls []struct {
						Index    int    `json:"index"`
						ID       string `json:"id"`
						Function struct {
							Name      string `json:"name"`
							Arguments string `json:"arguments"`
						} `json:"function"`
					} `json:"tool_calls"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			return Reply{}, fmt.Errorf("decode stream chunk: %w", err)
		}
		for _, choice := range chunk.Choices {
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
	if err := scanner.Err(); err != nil {
		return Reply{Content: full.String()}, fmt.Errorf("read model stream: %w", err)
	}
	return Reply{Content: full.String(), ToolCalls: calls.finish()}, nil
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
	defer resp.Body.Close()
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

func readError(resp *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8*1024))
	return readErrorBody(resp.StatusCode, body)
}

func readErrorBody(status int, body []byte) error {
	return &LLMError{Status: status, Body: string(body)}
}

// doWithRetry POSTs a JSON body and returns a 200 response. Coding-plan
// endpoints shed load with 429 and occasional 5xx, so failed attempts are
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
		resp.Body.Close()
		if readErr != nil {
			return nil, fmt.Errorf("read model error reply: %w", readErr)
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if (resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500) && attempt < 2 {
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
