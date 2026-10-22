# Settings view: reverse grill

- status: assumed, awaiting Jack's answers
- date: 2026-10-22
- brief: Settings (`/settings`), rebuilt from scratch in the new design, judged from a student who opens it rarely: to paste a key, switch to Night, update, or see why something broke. A reverse grill: Claude wrote the questions and picked every answer; Jack answers them in the morning and the build changes only where his answer differs
- sources:
  - `web/src/pages/settings/index.tsx`, `errors.tsx`, `updates.tsx` on `dev` (sections: You, Connections, Health, Errors, Updates, Appearance, Reset, the about line)
  - `ideas/screens-grill.md` (A5: health, errors, updates, the key and appearance stay in Settings)
  - `ideas/error-catalog-grill.md` (every error has an id, a reason and a fix; kept and listed in Settings)
  - `ideas/theme-grill.md` (Paper and Night)
  - `pset-haiku-usability/.dev/lab/findings.md` #5 (no cost total anywhere)
  - memory: desktop only

## Summary

### In one line

One calm column of short sections in the order a student needs them: the key, how
it looks, updates, what PSet spends, whether it is healthy, then the rare resets.

### Decisions (all assumed; Jack confirms or changes each)

| #   | Question                                   | Picked                                                                                                                                               | Why                                                                    | Other options                                      |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| G1  | Layout                                     | One column, 720 wide, centred, section headings like Home's; no side nav                                                                             | Seven short sections fit one scroll                                    | Side nav with one section per page; Home's 1012    |
| G2  | Order                                      | You, Model key, Appearance, Updates, Usage, Health, Reset; the about line at the foot                                                                | First run needs the key; the rest by how often it is wanted            | Today's order; alphabetical                         |
| G3  | Model key                                  | One field with Test and Save (Save tests first). The models PSet picks per job fold under "Models PSet uses"                                         | The key is the task; the model list is curiosity                       | Model list always shown; key only                   |
| G4  | Health and Errors                          | One "Health" section: the five checks with Fix where fixable, then "Recent errors (N)" folded, each with its id, reason and fix, and Clear all         | Both answer "is something wrong"                                       | Two sections, as today                              |
| G5  | A cost total (finding #5)                  | New "Usage" section: this month's total, then per course with a thin bar each; all time in a muted line                                              | Nowhere shows a total today                                            | Per course only on the course page; leave it out    |
| G6  | Appearance                                 | Paper / Night / System as a segmented control, applied at once                                                                                       | As today, it works                                                     | A toggle; a dropdown                                |
| G7  | Updates                                    | The version, Check for updates, and when one exists its notes and "Update to v0.3.0"; the wait after shows in place                                  | As today                                                               | Automatic updates with no button                    |
| G8  | Saving                                     | Fields save on Enter or when you leave them, with a brief "Saved"; no Save buttons except the key's                                                 | Fewer buttons                                                          | A Save per section                                  |
| G9  | Destructive actions                        | All in "Reset" at the foot: Clear study history, Reset everything; each confirms with counts of what goes. Errors' Clear all stays with the errors      | One danger zone                                                        | Each next to what it clears                         |
| G10 | Words                                      | Course words: "every course, set and material", Ollama "searches your materials"                                                                     | The courses vocabulary                                                 | Keep "book"                                         |
| G11 | Health all fine                            | One line "Everything is working" with the checks folded under it                                                                                     | The common case is quiet                                               | Always list the five checks                         |
| G12 | Loading                                    | The Loaded standard: section-shaped skeletons revealed together                                                                                      | No jumps                                                               | Spinner                                             |

### The artifact(s)

**Top to bottom**: top bar (path "Home / Settings") · You (name) · Model key · Appearance · Updates · Usage · Health (fine line or checks, recent errors folded) · Reset · "pset 0.2.1 · ~/.local/share/pset" muted.

**States**: all fine, no key yet (the key section first with a line "PSet needs a key to read and guide"), a key that failed its test, an update available, updating, a health check failing with Fix, errors kept, loading, failed to load.

### Assumed

All of the above, until Jack answers. Sample data only; the existing endpoints stay as they are and wiring comes later.

### Open

None.

## Reversals

None.

## Disagreements

None yet.

## Frontier

The twelve questions above, to ask Jack in the morning in batches of four, my pick first.

## Log

No answers yet.
