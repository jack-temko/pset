# settings

The Settings screen: the OpenRouter key, the student's name, health, reset,
about. Spec: `design/settings.md`. Which model does which job is `llm`'s
(`internal/llm/README.md`); this package says it and holds the key.

## Tables

`settings`: one row per saved thing, as JSON, keyed by name. `chat` is the
key (`{apiKey}`; a row from before PSet chose its models may carry an
`endpoint`, and a key saved for anywhere but OpenRouter doesn't count as
saved), `profile` is the student's name.

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

`GET /api/health`, the local system only, in this order: data directory,
database (`quick_check`, and migrations not yet applied), poppler,
tesseract, Ollama (running, and with `nomic-embed-text`). OpenRouter isn't
here; its status lives beside the key.

`POST /api/health/{id}/fix` repairs one that can be repaired and answers
its check run again: creates the data directory, applies pending
migrations, or has Ollama pull the embeddings model (about 270 MB). One
that can't be (a missing tool, Ollama not running) is refused `invalid`
with how to install or start it.

## Reset

`GET /api/reset` counts books and pages (through the library); `POST`
pauses the queue, wipes every table, deletes every file in the data
directory except the open database, and resumes. A fresh install, the key
included.

## About

`GET /api/about`: version and data directory.
