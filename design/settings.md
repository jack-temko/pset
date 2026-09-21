# Settings

`/settings`. A document page, and the last screen of the three.
Decisions from the 2026-09-21 grill; each is settled, not open.

**What the engine already has** (`internal/engine/config.go`,
`doctor.go`, `reset.go`): `Settings` is four fields — chat endpoint, API
key, embeddings endpoint, embeddings model — in a `config.json` at mode
0600. `TestConnection(override)` dials values without saving them.
Doctor runs six checks, and can fix two of them (data dir, schema).
`Reset` counts before it deletes.

## Shape

One page, stacked, in this order: **Connections · Health · Appearance ·
Reset**, then one mono line — `pset 0.9.0 · /path/to/data`. No
navigation: four fields and four checks don't need any. The top bar's
middle is empty; the h1 says where you are.

## Connections

Two Boxes side by side, because they fail and get fixed independently:

- **Chat** — endpoint, API key, **model** (new: the engine hard-codes it
  today).
- **Embeddings** — endpoint, model.

Every value is mono. **The API key is plain text** — a local app, and you
need to see which key you pasted.

**Test and Save are two different acts:**

- **Test** is always there. It dials the values on screen and writes
  nothing, so you can try a different key without losing the one that
  works.
- **Save** appears only once something in the Box has changed. It
  **tests first and writes only if the test passes** — what's on disk
  always works. A failed Save writes nothing.
- A failure names **the field that caused it**, and the error replaces
  that field's hint (unreachable → endpoint, 401 → key, unknown model →
  model). Editing that field clears it.
- The Box footer says what the last Test or Save found: a spinner while
  it works, then "Connected · glm-4.6" in success ink, or "Not saved —
  the test failed".
- **Nothing is dialled on open.** Status appears only when you ask for
  it.

## Health

The **local system only**, checked on open: data directory, database,
poppler, tesseract. The endpoint checks aren't here — their status lives
beside their fields, so each fact is said once.

A check that fails and can be fixed (data dir, database) gets a **Fix**
button, which is the doctor's `--fix`. One that can't (a missing tool)
says how to install it.

## Appearance

**Theme: Paper · Night · System**, as a segmented control. System keeps
following the OS after load, not just at startup. The theme **left the
top bar**: one preference doesn't earn permanent chrome, and a toggle
can't hold three states.

## Reset

A destructive-tone Box at the bottom, with an outline button in red ink.
**It is a fresh install:** every book, page, homework set and
conversation, **and the settings — API key included**. The confirm
dialog gives the counts from the engine's dry run, says there is no
undo, and lands you on an empty Home.

## Backend changes this asks for

- `Settings` gains a **chat model**; `llm.ChatModel` becomes its default.
- `TestConnection` takes **one side at a time** (chat or embeddings), and
  a failure reports **which field** it points at.
- **Save = test, then write**, as one call that refuses to write on a
  failed probe.
- **Doctor's fixes are callable per check** from the API, not only as
  `--fix` for the lot.
- `Reset` also **removes `config.json`**.
- An **about** endpoint: version and data directory.
