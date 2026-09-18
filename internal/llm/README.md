# llm

Dependency-free OpenAI-compatible client over `net/http`: streaming chat
completions (with multimodal text/image content) and embeddings. No SDK, no
network at test time — httptest fakes cover it.

## Dependencies

- stdlib only (`net/http`, `encoding/json`, `bufio`)

## Model choice

`ChatModel` in `llm.go` is the single hardcoded vision-capable chat model id
(`"glm-5.3-flash"`); flip it there and nowhere else. Base URLs, keys, and the
embeddings model come from the engine's settings (`internal/engine/config.go`),
never from this package.

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
