# Transcript

The Ask conversation's pieces, from the 2026-09-18 transcript grill
(design/workspace.md has the full spec).

**Asymmetric by design:** `UserTurn` is a compact `primary-soft` block on
the right; `AssistantTurn` is full-width quiet text on the panel ground —
chat where you ask, page where it answers. No bubbles.

- **`Steps`** — the visible step feed: one `text-xs` muted line per tool
  call, "verb · object · count". The line is the whole story; nothing
  expands.
- **`PageRef`** — the inline citation: a small mono `primary-soft` chip
  ("p. 142") that reads as an object in the prose. Click jumps the scan;
  hover fills `primary`.
- **`MathInline` / `MathDisplay`** — KaTeX, `throwOnError: false` so bad
  TeX renders as its source instead of crashing a turn.
- **`AssistantTurn`** carries Copy on hover — the only action a past turn
  has. History is append-only: no edit, no retry.
- **`DayDivider`** — a quiet centered mark on a hairline when the date
  changes.
- **`ConversationStart`** — the top of the endless history:
  "Start of conversation · Clear", confirming in place.
- **`FailedTurn`** — one destructive-ink line + Try again; the feed above
  stays frozen, partial text stays.

**Don't:** give steps chevrons or results; render citations as bare
links or cards; put actions on user turns; auto-clear anything.

## Changes from baseline

- The baseline has no transcript components — the old app's chat was part
  of what the overhaul deletes. This is new surface, specced by grill
  rather than derived from the artifact.

## Open

- Streaming states (Send→Stop, the "stopped" note, steps ticking in) are
  specced but need the loop backend's events to exist.
- Answers here are JSX; the real backend will emit markdown/structured
  content that needs a renderer mapping onto these pieces.
