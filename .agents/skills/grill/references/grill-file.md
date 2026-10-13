# The grill file

One Markdown file per grill. A person reads the top; a model reads all of it. Fixed
headings, in this order, so any run can find what it needs. Nothing decorative.

```
# <Topic>: grill

- status: grilling | awaiting OK | approved | built | superseded
- date: YYYY-MM-DD, the session's date
- brief: one line, the topic and the point of view it is judged from
- sources: what was read (files, docs, earlier grills)
(a bullet list, so it renders as separate lines: consecutive plain lines run together)

## Summary
The part to read at a glance. It must fit one screen and stand alone.

  ### In one line
  The mission or the decision, one sentence.

  ### Decisions
  | # | Decision | Why | Beat |
  One row per decision, in the order that reads best (not necessarily the order made).
  Why is one short clause. Beat is what it was chosen over.

  ### The artifact(s)
  What the gates produced that a person needs to see: an inventory table, ASCII
  wireframes, a state list, a data table. Only the confirmed final versions.

  ### Assumed
  Taken at the recommended default because the user did not decide. Each with an id
  (A<n>) and a line. The reader overrules any.

  ### Open
  What is genuinely unresolved, and what it waits on.

## Reversals
Locked decisions this grill reversed: what, where it was written, when, and why. Each
was approved by the user as an explicit question.

## Disagreements
Where the user chose against the recommendation after one push back: the question, the
recommendation and its reason, the user's choice. Recorded so nobody re-argues it.

## Frontier
Empty when finished. While grilling, the entries still open (see frontier.md), so an
interrupted grill can resume.

## Log
The Q&A, verbatim, by batch and gate: each question, its options, the user's answer
exactly as given (including free text). This is the evidence for every decision.
```

## Rules

- **The Summary stands alone.** Someone who reads only it can act on it. If it needs the
  log to make sense, it is too thin.
- **Every decision has a why and a beat.** A decision without them is a guess.
- **Assumed is not decided.** Never move an item from Assumed to Decisions unless the
  user confirmed it.
- **Verbatim in the Log.** Paraphrase belongs in Decisions.
- **Reopened decisions** keep their old row struck through with a pointer to the new
  one, so history is readable.
- **Superseding.** When a new grill replaces this one, set `status: superseded`, and the
  caller archives the file (a caller may name where).
- **Length.** The Summary is a page. The Log can be as long as the grill.
- **Style.** No em dashes. Plain words. The user's own names for things.

## A unit's grill

A grill about one unit of the `/design` system (a component, pane or view) keeps its
decisions in the unit's `spec.ts`, not in the grill file (`design/design-docs.md`). The
Decisions table is not written here: each decision goes into `decisions` in
`web/src/units/<id>/spec.ts` with a permanent id (`<unit>-d<n>`), its why, what it beat,
the date and, when a later one replaces it, `supersededBy`. The file kept beside the spec
is `log.md`: the Log section only, word for word, and the spec's `log` field points at
it. Any other grill (vision, theme, a plan) keeps the whole file.

## Where it goes

The brief names the path. A caller such as `pset-view` fixes it
(`web/src/views/<name>/grill.md`). Called directly with nothing named, ask once, and
default to `ideas/<topic>-grill.md` in a repo with an `ideas/` folder.
