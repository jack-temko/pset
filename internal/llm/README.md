# llm

Dependency-free OpenAI-compatible client over `net/http`: streaming chat
completions (with multimodal text/image content) and embeddings. No SDK, no
network at test time — httptest fakes cover it.

## Dependencies

- stdlib only (`net/http`, `encoding/json`, `bufio`)

## Models

PSet picks its models (2026-09-29): the student brings an OpenRouter key
and nothing else. `models.go` gives each job the model that did it best
when they were tested side by side (design/backend.md, "Models"):

| Job | Model | Falls back to |
|---|---|---|
| `Writer`: guides, Ask, assignment reads, contents, repairs | `deepseek/deepseek-v4.1-flash` | |
| `Finder`: finds a problem on its pages, boxes it and its figures | `perceptron/perceptron-mk1.5`, plain | `z-ai/glm-5.3-flash` |
| `Reader`: writes out a problem's words and reads its figures | `openai/gpt-6-luna` | `z-ai/glm-5.3-flash` |

`Job.Ask` fills a request in for its job. **Fallbacks** go to OpenRouter
as `models`, after the model itself: OpenRouter tries the next when one
fails or is rate limited. The Finder's model has one host, and OpenRouter
held a new account to 20 calls a minute of the Reader's, which a problem
set's readings go over. That limit isn't published anywhere: it came back
in the 429's own words ("new accounts are limited to 20 requests per
minute for this model"), and a burst of 60 calls got 9 through. Whether
an older account has it isn't known; the fallback costs nothing if not. A **plain** job sends no `reasoning` at
all: Perceptron found 8 figures of 23 thinking, and all 23 at its own
default, in a twentieth of the time. The reply says which model answered
(`Reply.Model`), and the call log keeps it as `answered`.

The Writer's model arrives in `Config.ChatModel`, with the saved key;
the embeddings are Ollama's `nomic-embed-text` on this machine
(`EmbedEndpoint`, `EmbedModel`).

## Wire shapes

OpenAI-compatible, as spoken by OpenRouter (`https://openrouter.ai/api/v1`,
PSet's chat provider) and OpenAI-shaped local servers (ollama's `/v1`):

- `POST {apiBase}/chat/completions` — body `{"model","messages","stream",
  "max_tokens?"}`; `messages[i].content` is either a plain JSON string or an
  array of parts `{"type":"text","text"}` / `{"type":"image_url",
  "image_url":{"url"}}` where the URL is a `data:image/png;base64,…` data
  URL. Non-streaming replies parse `choices[0].message.content`; streaming
  replies are SSE: `data: {chunk}` lines with `choices[0].delta.content`,
  terminated by `data: [DONE]`.
- `POST {embedBase}/embeddings` — body `{"model","input":[…]}`; reply
  `{"data":[{"index","embedding":[floats]}]}` re-ordered by `index`.

Auth is `Authorization: Bearer <key>` on every request.

## Providers

PSet's chat goes through **OpenRouter** (2026-09-29; direct Z.ai support
was dropped then, and choosing a model went the same day). `shape` fits each request to the endpoint, known by its
host:

- **OpenRouter** (`openrouter.ai`): `reasoning: {effort}` (or `{enabled:
  true}` when no effort is asked for); the model's reasoning sent back on
  its assistant turns as `reasoning`, and as `reasoning_details` (the
  structured blocks, signatures included, put back together from the
  stream), so it carries on from its own thinking after each tool call.
  Anthropic and Gemini models need the details: without them Haiku 5.5
  lost its plan every round and failed a quarter of hard guides
  (2026-10-07); `provider: {quantizations: [fp8, fp16,
  bf16, fp32, unknown], sort: "throughput"}`, so no host running 4-bit
  weights serves PSet and the fastest host comes first (a model's hosts
  differ several times over in speed);
  and `session_id` from the context (`WithSession`), which groups a job's
  calls (a guide's rounds and repairs, a book's Ask conversation) on
  OpenRouter and keeps them on one host. Its streamed thinking arrives as
  `delta.reasoning`, and every reply carries `usage` with the call's
  `cost`.
- **Anything else** (a local ollama, say) gets none of that: some
  endpoints refuse the fields (DeepSeek's own API answers 400). A model
  there thinks each step over from the start. Its thinking is still read
  if it streams it, as `reasoning_content` or `reasoning`.

Sessions: `question-<id>-<step>` (finding, reading, the guide),
`ask-<book>`, `assignment-<id>`, `book-<id>-<step>`, each led by the
install's tag (`pset-` and a hash of the data directory), so a copy of a
library never shares sessions with the original.

**A session keeps its host.** OpenRouter spreads a model over many hosts,
and each keeps its prompt cache to itself: a guide that hops hosts pays
for its whole prompt again every round (GLM's did, 0% cached on 30-50K
token rounds, 2026-09-29). So the host that serves a session's first call
(OpenRouter names it in the reply) is asked for first by the rest of the
session (`provider.order`), falling back to others if it fails. The call
log records the host of every call.

A reply's `usage`, when the provider sends one, is kept on `Reply.Usage`
and written to the call log. `Classify` names a failure: cut, busy,
rejected, or **credit**, an account with no money left (OpenRouter's
402, or a body saying the balance is gone), which is never retried.

## Contracts

- `New(apiBaseURL, apiKey, embedBaseURL, embedModel)`; `ChatConfigured` /
  `EmbedConfigured` report whether an endpoint is usable in principle.
- `ChatOnce(ctx, req)` — one-shot completion (connection probes).
- `ChatStream(ctx, req, delta)` — invokes `delta` per content fragment and
  returns the assembled text. Delta errors abort the stream.
- `Embed(ctx, texts)` — one vector per text, input order.
- Failures return `*LLMError{Status, Body}` (or a wrapped transport error);
  callers turn these into user-facing messages.
- `Content` marshals as a string for plain text and as a part array once a
  part is appended — both shapes accepted on decode.
