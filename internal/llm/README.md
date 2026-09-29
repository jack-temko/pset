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

OpenAI-compatible, as spoken by `https://api.z.ai/api/paas/v4` and OpenAI-
shaped local servers (ollama's `/v1`):

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

`shape` fits each request to the endpoint, known by its host:

- **Z.ai** (`api.z.ai`, `bigmodel.cn`): `reasoning_effort` as given, and
  the model's reasoning sent back on its assistant turns as
  `reasoning_content`, with `thinking: {type: enabled, clear_thinking:
  false}` ("preserved thinking").
- **OpenRouter** (`openrouter.ai`): `reasoning: {effort}` (or `{enabled:
  true}` when no effort is asked for), the reasoning sent back as
  `reasoning`, and `provider: {quantizations: [fp8, fp16, bf16, fp32,
  unknown]}`, so no host running 4-bit weights serves PSet. Its streamed
  thinking arrives as `delta.reasoning`, and every reply carries `usage`
  with the call's `cost`.
- **Anything else** gets neither the effort nor the reasoning: some
  endpoints refuse the fields (DeepSeek's own API answers 400).

A reply's `usage`, when the provider sends one, is kept on `Reply.Usage`
and written to the call log. `Classify` names a failure: cut, busy,
rejected, or **credit**, an account with no money left (OpenRouter's 402,
Z.ai's 429 with code 1113), which is never retried.

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
