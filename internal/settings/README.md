# settings

The Settings screen: the OpenRouter key, the student's name, health, reset,
about. Spec: `design/settings.md`. Which model does which job is `llm`'s
(`internal/llm/README.md`); this package says it and holds the key.

## Tables

The store's `settings` (internal/store, not logged): one row per saved thing,
as JSON, keyed by name. `chat` is the key (`{apiKey}`), `profile` is the
student's name. The old database's `settings` table is no longer read.

## Key

- `GET /api/settings`: the saved key and name, the models by job, and
  `ready.key`, whether a key that can be used is saved.
- `POST /api/settings/test {apiKey}`: dials OpenRouter with the key as sent
  (one word to the Writer's model) and writes nothing.
- `PUT /api/settings {apiKey}`: tests, and writes only if the test passes,
  so a stored key always worked when it was stored. Answers the settings
  and the test's detail.
- `PUT /api/settings/profile {name}`: the name, whitespace tidied, at most
  60 characters; nothing to test, so it writes straight away.
- A failed test names its cause: `bad_key` on `apiKey` for a refused key
  (401, 403) or an account out of credit (402), `bad_model` when OpenRouter
  doesn't know a model PSet uses, `unreachable` for a timeout, a network
  failure or any other error.
- Other features get `LLM(ctx) llm.Config`: OpenRouter with the saved key
  and the Writer's model once a key is saved, blank before, and Ollama's
  embeddings always. `Name(ctx)` is what the tutor calls the student.

## Health

Moved to `internal/health`: the checks keep what they find as conditions.

## Reset

`GET /api/reset` counts books and pages (through the library); `POST`
wipes the old database's tables, deletes the key and the name from the
store, and deletes every file in the data directory except the open
databases. The store's other tables stay: Reset moves onto the store at the
cut-over (track 9 of `ideas/backend-courses.md`).

## About

`GET /api/about`: version and data directory.
