# Settings

`/settings`. A document page, and the last screen of the three.
Decisions from the 2026-09-21 grill; each is settled, not open.

**What the engine already has** (`internal/engine/config.go`,
`doctor.go`, `reset.go`): `Settings` is four fields (chat endpoint, API
key, embeddings endpoint, embeddings model) in a `config.json` at mode
0600. `TestConnection(override)` dials values without saving them.
Doctor runs six checks, and can fix two of them (data dir, schema).
`Reset` counts before it deletes.

## Shape

One page, stacked, in this order: **You · Connections · Health ·
Appearance · Reset**, then one mono line: `pset 0.9.0 · /path/to/data`. No
navigation: four fields and four checks don't need any. The top bar's
middle is empty; the h1 says where you are.

## You

One field, **your name** (added 2026-09-21). Home's greeting uses it
("Good evening, Jack.") and the tutor addresses you by it. Empty means
neither does. Save appears once it changes, like a connection's, but
there's nothing to test, so it writes straight away.

## Connections

Two Boxes side by side, because they fail and get fixed independently:

- **Chat**: endpoint, API key, **model** (new: the engine hard-codes it
  today).
- **Embeddings**: endpoint, model.

Every value is mono. **The API key is plain text**: a local app, and you
need to see which key you pasted.

**Test and Save are two different acts:**

- **Test** is always there. It dials the values on screen and writes
  nothing, so you can try a different key without losing the one that
  works.
- **Save** is always there too, and **enabled** only once something in
  the Box has changed, or while that side has never been saved: the
  defaults a fresh install shows aren't saved until you Save them
  (2026-09-22). A Save that never appeared left nothing to find; a
  disabled one says the act exists and is waiting on you. It
  **tests first and writes only if the test passes**: what's on disk
  always works. A failed Save writes nothing.
- A failure names **the field that caused it**, and the error replaces
  that field's hint (unreachable → endpoint, 401 → key, unknown model →
  model). Editing that field clears it.
- The Box footer says what the last Test or Save found: a spinner while
  it works, then "Connected" (with the vector size for embeddings; the model is already in the field) in success ink, or "Not saved:
  the test failed".
- **Nothing is dialled on open.** Status appears only when you ask for
  it.

## Health

The **local system only**, checked on open: data directory, database,
poppler, tesseract. The endpoint checks aren't here: their status lives
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

A destructive-tone Box at the bottom with two ways to start over,
smallest first, each a row with an outline button in red ink. Each asks
first in a confirm under its button (over it, at the foot of the page),
naming what goes (2026-09-24, replacing Reset's dialog).

- **Activity history · Clear history** forgets the time Home counts for
  homework, reading and asking, in every book. Books, homework,
  conversations and the questions you've worked stay: those come from
  homework, not from the time.
- **Reset PSet · Reset everything.** **It is a fresh install:** every
  book, page, homework set and conversation, **and the settings, API
  key included**. The confirm gives the counts from the engine's dry
  run, says there is no undo, reads "Resetting…" while it runs, and
  lands you on an empty Home.

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
