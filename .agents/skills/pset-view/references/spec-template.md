# The `spec.md` format

One file per view, at `web/src/views/<name>/spec.md`. Compact and readable by a
model and a person: fixed headings, terse lines, tables where a table fits. The
`/views` page draws it beside the live view, so it must render as Markdown (the
renderer handles headings, paragraphs, lists, tables, fences, quotes, and
`code`, bold, italic and links). Keep it in the app's voice: no em dashes.

```
# <View name>

purpose:  one line, what it is for
where:    the screen and slot, its size, the code folder, the screen spec's section
budget:   the targets, as numbers a run can fail (e.g. "resume in 1 click; per
          question at most 4 clicks, 0 typing, 1 decision")

## student
who, when, state of mind, in a few lines. What they open it to do. What they
will not do.

## flow
Numbered happy path. Per step: what they see, decide, do. Then the exits, and the
re-entry after a break.

## anatomy
The component tree, one line of role each, indented as it nests.

## states
| state | shows | scenario |
Every state a student can be in, each reachable by a scenario id.

## actions
user action -> effect -> feedback or animation. One line each.

## handoffs
out:  action -> target view -> what travels -> how Back works (or "not designed")
in:   from which view -> what arrives -> what it shows for it

## data
reads:   hook | endpoint | wire type
writes:  hook | endpoint | optimistic?
events:  SSE type -> cache effect
(wire types are the generated ones in `web/src/api/gen/`)

## why
Design decisions, each with the reason and what was rejected. This is what stops
the next run from undoing a choice.

## friction
The log (see student-lens.md): id | where | what goes wrong | severity | fix | status

## wants
Backend changes the frontend needs, proposed and not built, each with why.

## open
Unresolved questions.

## links
The screen spec section, design-system, the components used.
```

## Rules

- **State, do not narrate.** "Complete: checkbox, `PATCH {done}`, applied at once,
  does not advance." Not a paragraph about why a checkbox is nice; that goes in
  `why`, one line.
- **Reference what exists.** Hook names, endpoint paths, component names and
  scenario ids are checked against the code and the harness's traffic log.
- **When code and spec disagree, the code is right** and the spec is stale: fix
  the spec in the same change.
- **Decisions the user locked are recorded as locked** in `why`, so a lens
  finding against one becomes `raise with Jack`, not a change.
- Update `friction` and `wants` on every run; update the rest when the change
  touches it.
