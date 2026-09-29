# llm

Dependency-free OpenAI-compatible client over `net/http`: streaming chat
completions (with multimodal text/image content) and embeddings. No SDK, no
network at test time — httptest fakes cover it.

## Dependencies

- stdlib only (`net/http`, `encoding/json`, `bufio`)

## Model choice

The chat model, like the endpoints, key and embeddings model, is a
setting (`internal/settings`, edited on the Settings screen) and arrives
here in `Config`; this package holds no defaults of its own. The chat
model must be vision-capable: locating a homework problem sends page
images as `image_url` parts.

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
was dropped then). `shape` fits each request to the endpoint, known by its
host:

- **OpenRouter** (`openrouter.ai`): `reasoning: {effort}` (or `{enabled:
  true}` when no effort is asked for); the model's reasoning sent back on
  its assistant turns as `reasoning`, so it carries on from its own
  thinking after each tool call; `provider: {quantizations: [fp8, fp16,
  bf16, fp32, unknown]}`, so no host running 4-bit weights serves PSet;
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
`ask-<book>`, `assignment-<id>`, `book-<id>-<step>`.

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
