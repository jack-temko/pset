# settings

The Settings screen: connections, health, reset, about. Spec:
`design/settings.md`.

## Connections

One `settings` row per side (`chat`, `embeddings`), JSON. A side with no
row shows the defaults but is **not ready**: only Save writes, and Save
tests first, so a row means "this worked when it was stored".

- `POST /api/settings/test {chat|embeddings}`: exactly one side, dialled
  as sent, nothing written.
- `PUT /api/settings {chat|embeddings}`: test, then write.
- Failures name the field: a malformed URL or unreachable host →
  `endpoint`, 401/403 → `apiKey`, an error body mentioning the model →
  `model`.
- Other features get `LLM(ctx) llm.Config`, with never-saved sides blank.

## Health

`GET /api/health`: data directory, database (quick_check and pending
migrations), poppler, tesseract. `POST /api/health/{id}/fix` repairs the
two that can be repaired (creates the data directory, applies
migrations) and answers the re-run check.

## Reset

`GET /api/reset` counts books and pages (through the library); `POST`
pauses the queue, wipes every table, deletes every file in the data
directory except the open database, and resumes. A fresh install.

## About

`GET /api/about`: version and data directory.
