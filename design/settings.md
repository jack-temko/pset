# Settings

`/settings`. A document page, and the last screen of the three.
Decisions from the 2026-09-21 grill; each is settled, not open.

## Shape

One page, stacked, in this order: **You · Connections · Health ·
Appearance · Reset**, then one mono line: `pset <version> · /path/to/data`. No
navigation: two fields and five checks don't need any. The top bar's
middle is empty; the h1 says where you are.

## You

One field, **your name** (added 2026-09-21). Home's greeting uses it
("Good evening, Jack.") and the tutor addresses you by it. Empty means
neither does. Save appears once it changes, like a connection's, but
there's nothing to test, so it writes straight away.

## Connections

**One Box, OpenRouter, with one field: the API key** (2026-09-29). PSet
picks its models, so there's nothing else to choose: no provider, no
endpoint, no model. Under the key, a quiet line in muted ink says which
model does which job ("PSet picks the models. Guides and Ask: `deepseek/…`
· Finding problems: `perceptron/…` · Reading figures: `openai/…`"), each
job kept whole on a line, the model names in mono. It's said, not
chosen; design/backend.md, "Models", says why each. The key's hint says
where it comes from and that it pays for those models.

Embeddings aren't a connection any more: Ollama with `nomic-embed-text`
on this machine, fixed, and checked under Health, since it's a program
here. A key saved before this, for an endpoint other than OpenRouter,
doesn't count as saved.

The key is mono, and **plain text**: a local app, and you need to see
which key you pasted.

**Test and Save are two different acts:**

- **Test** is always there. It tries the key on screen and writes
  nothing, so you can try a different key without losing the one that
  works.
- **Save** is always there too, and **enabled** only once the key has
  changed, or while none has ever been saved (2026-09-22). A Save that
  never appeared left nothing to find; a disabled one says the act
  exists and is waiting on you. Enter in the field saves too. It **tests
  first and writes only if the test passes**: what's on disk always
  works. A failed Save writes nothing.
- A failure that's the key's (refused, 401 or 403; out of credit)
  replaces the key's hint, and editing the key clears it. Any other
  (OpenRouter unreachable or slow, a model it doesn't know) is said in
  the footer: the key can't fix it.
- **Out of credit** (2026-09-29): an account with no money left
  (OpenRouter's 402) says so on the key, and a guide or Ask answer that
  fails on it says so too, with the way to Settings, rather than "busy,
  try again in a minute".
- The Box footer says what the last Test or Save found: a spinner while
  it works, then "Connected" in success ink, or "Not saved: the test failed".
- **Nothing is dialled on open.** Status appears only when you ask for
  it.

## Health

The **local system only**, checked on open: data directory, database,
poppler, tesseract, and **Ollama** (2026-09-29), which searches the
books. OpenRouter isn't here: its status lives beside the key, so each
fact is said once.

A check that fails and can be fixed (data dir, database, and Ollama
running without its model, which Fix downloads) gets a **Fix** button,
which repairs it and runs the check again. One that can't (a missing tool, Ollama
not running) says how to install or start it.

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
  key included**. The confirm gives the counts from a dry
  run, says there is no undo, reads "Resetting…" while it runs, and
  lands you on an empty Home.
