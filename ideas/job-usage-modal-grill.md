# Model usage display, reworked: grill

- status: approved
- date: 2026-10-08
- brief: rework where and how PSet shows model usage (cost, tokens, time, model) for every model job, and replace the line with something that opens a modal of the job's details; judged from the student's point of view, and Jack's as the one paying
- sources: web/src/components/usage, web/src/lib/usage-format.ts, internal/usage, internal/llm/calllog.go, homework, ask, library, settings services, design/model-usage.md, design/design-system.md

## Summary

### In one line
Every model job that makes something you look at (a question, an Ask answer, an assignment read, a book) carries one quiet usage line with a chevron; clicking it opens a modal with totals, stages and every call.

### Decisions
| # | Decision | Why | Beat |
|---|---|---|---|
| D1 | Layered: a quiet line for the student, full detail in the modal for Jack | The student can ignore it; Jack can debug and see what things cost | builder-only dense display; student-only cost |
| D2 | Triggers on each question, Ask answer and assignment read; the book's usage is a "Usage" item in the book menu | Those are the things a job produces; the book is out of the way | ranking and key test as their own triggers; book header; library tile |
| D3 | A question has one trigger; the modal splits it by stage | Quiet on the page, the breakdown one click away | one line per stage; guide only |
| D4 | Shown once a job is done or failed, never while running | No flicker or distraction; failures still show what they cost | live while running; failures hidden |
| D5 | Modal: totals, then a stages table, then every call (time, stage, model answered and asked, ms, tokens in and out, cost, error) | Stages answer "what cost most", calls answer "what went wrong" | calls inside stages; flat calls; adding prompts and replies |
| D6 | Store reasoning and cached tokens per call and show them in the modal | Reasoning is often most of Haiku's cost; the data is already in each response | in and out tokens only |
| D7 | Book menu "Usage" opens a dialog: book total, a row each for questions, Ask answers, reads and import, then the import's stages and calls | One place for what a book has cost, including its import | import only with a total; a Settings usage page |
| D8 | A question's total is everything it ever cost; the modal groups calls by run (first find, retry, rewrite after notes) | Honest about spend | latest run only |
| D9 | Difficulty ranking is tied to its set and shows as a shared "Rank" stage in each question's modal | Nothing hidden, no new trigger | tag only; leave unshown |
| D10 | An Ask answer's stages are its tool rounds, with the tools each round called, plus repairs | Shows why an answer took long | a flat call list |
| D11 | The trigger is today's line made a button, with a small trailing chevron that turns accent with the line on hover and focus | Says "opens something" without a loud link | hover only; dotted underline; a Details link; a cost chip; an icon |
| D12 | A new reusable Table component (`components/table`) with its own /components section: quiet header, right-aligned tabular numbers, a muted second line, a soft error row, a bit tighter than the mockup (about 10px), scrolls sideways when too wide, a slightly larger radius | Jack asked for it, and the call list needs real columns | a hand-made list |
| D14 | Font rule: copyable strings (model ids, hashes, paths) and data figures (numbers in tables, stats) are mono; the PDF page number and zoom are Inter (you would not copy them); labels, prose, problem labels and non-copyable summaries such as the usage line are Inter with tabular figures; a table mixes both | Jack's rule after seeing both side by side | all figures Inter; all data mono including the usage line |
| D13 | Jack sees it working for real in the dev app before it merges | His ask | merging on green CI |

### The artifact: surfaces
| Thing | Where the trigger is | Modal stages |
|---|---|---|
| Homework question | last line of the question in the walkthrough, failed or ready | Find, Boxed read, Figures, Guide, Rank (shared), grouped by run |
| Ask answer | after the answer, or after the note on a turn with no reply | Round 1..n (tools called), Repairs |
| Assignment read | in the reads list row, failed or ready | Read |
| Book | "Usage" in the book menu, a dialog | by kind (questions, Ask, reads, import), then Import stages: Naming, Contents |

### Assumed
- A1. Each call records its stage and run: new columns on `calls` (a migration, plus reasoning and cached tokens), set by each job.
- A2. List payloads keep only the line's totals; the modal fetches its detail on open from a new endpoint per subject.
- A3. Ranking's cost is split evenly across the set's questions, marked "shared with N"; the book total counts it once.
- A4. The settings key test stays unshown and untied.
- A5. A failed job keeps the line (with "≥" when calls went uncounted); the modal shows the failed count and the error on each failed call.
- A6. The line stays out of copies (`data-copy-skip`); deleting a question still forgets its usage.
- A7. `UsageLine` is replaced by the trigger and a `UsageModal`, both on /components; the temporary usage-options section is removed before landing.
- A8. The Dialog gets a third, wider width token for this modal rather than a class override.
- A9. The Writer fallback that no call passes is a separate idea, not this change.

### Open
Nothing.

## Reversals
- design/design-system.md (2026-09-25): "what a person reads is never mono". Reversed for figures in tables and stats by D14, Jack's explicit rule, 2026-10-08. Labels and problem labels stay Inter.
- design/model-usage.md (2026-09-30) removed the popover and made the line plain text. This grill makes the line clickable again, opening a modal (Jack's ask). The spec there is rewritten when this ships.

## Disagreements
- Book import's trigger: I recommended the book's header; Jack chose the book menu, then widened it to a Usage dialog for the whole book (D7). No push back: it is quieter and covers more.

## Gate 0: audit

### What is shown today
One component, `UsageLine` (`web/src/components/usage/index.tsx`): inline text, "model +N · time · tokens · cost", with "≥" when some calls were uncounted. No dropdown: the popover was removed 2026-09-30. The per-model split is only in a hover `title`. `Usage.failed` is sent but never shown.

| Surface | Where | Usage of |
|---|---|---|
| Homework question | `views/homework/walkthrough.tsx:566,621` | everything run for that question |
| Assignment reads list | `pages/workspace/assignment-reads.tsx:107,130` | the read |
| Ask answer | `pages/workspace/index.tsx:566,584` | the turn |
| /components, /views | `sections/feedback.tsx`, `views/homework/world.ts` | fixtures |

Data: every chat call is one row in `calls` (requested and answering model, ms, prompt and completion tokens, cost, host, session, error, subject). Reasoning and cached tokens are in the response but not stored. Prompts and replies are in `<data>/logs/llm.jsonl`, not the DB.

### Every model job
| Job | Model | Trigger | Calls per action | Stamped to | Shown |
|---|---|---|---|---|---|
| Find the problem (Finder + Reader, boxing, captions, figures) | Perceptron (GLM), Gemini (Luna) | add a problem, box, retry | many: batches of pages | question | yes, merged |
| Boxed problem read | Gemini (Luna) | student boxed it | 1 | question | yes, merged |
| Figure reading | Gemini (Luna) | after find, if figures | 4 (3 reads + settle) | question | yes, merged |
| Guide writing | Haiku | after find, retry, notes change | up to 2 tries x 10 rounds + repairs | question | yes, merged |
| Ask answer | Haiku | student asks | up to 8 rounds + repairs | turn | yes |
| Assignment read | Haiku | import or read an assignment | 1 stream | read | yes |
| Difficulty ranking | Gemini (Luna) | whole set located | 1 per set | nothing | no |
| Book naming | Haiku | book import | 1 | book | no |
| Book contents (printed, headings) | Haiku | book import | 1 to several | book | no |
| Settings key test | Haiku, 1 token | test or save a key | 1 | nothing | no |
| Embeddings | local Ollama | import, search | many | not logged | no (free) |

### What looks wrong
- A question's line merges four different jobs (find, figures, guide, retries) into one number, so you cannot tell what a retry or a rewrite cost.
- Failed calls are counted but never shown.
- Ranking and the key test are not tied to anything, so they can never be shown.
- Book import is recorded but has no surface.
- Side finding, not this change: the Writer fallback (DeepSeek) is defined but no call passes it.

## Frontier
Empty.

## Log

### Batch 1 (Gate 1, purpose and scope)
- Audience? Both, layered (Rec) / You, the builder / The student. Answer: "Both, layered (Recommended)"
- Which jobs get a trigger? Question, Ask, read / Book import / Difficulty ranking / Settings key test. Answer: "Question, Ask, read,Book import"
- A question's stages? One trigger, split in modal (Rec) / One per stage / Guide only. Answer: "One trigger, split in modal (Recommended)"
- When does it appear? Once done or failed (Rec) / Live while running / Done only, failures hidden. Answer: "Once done or failed (Recommended)"

### Batch 2 (Gate 2, content)
- Modal beyond totals? Stages + every call (Rec) / Also prompts and replies / Totals and per model only. Answer: "Stages + every call (Recommended)"
- Store reasoning and cached tokens? Yes, add columns (Rec) / No. Answer: "Yes, add columns (Recommended)"
- Book import trigger? Book's header in workspace (Rec) / Library tile / Book settings or info menu. Answer: "Book settings or info menu"
- Question total includes retries? Yes, all runs, grouped (Rec) / Latest run only / Latest on line, all in modal. Answer: "Yes, all runs, grouped (Recommended)"

### Batch 3 (Gate 2, content)
- Totals across jobs? Not now (Rec) / Usage section in Settings / Per-book total in the book menu. Answer (free text): "usage button on the book menu, dialog that shows this and the previously answered book import usage"
- Ranking cost? Split onto the set's questions (Rec) / Tag it, show nowhere / Leave it. Answer: "Split onto the set's questions (Recommended)"
- Ask modal stages? Each tool round (Rec) / Just the call list. Answer: "Each tool round (Recommended)"

### Batch 4 (Gate 3, shape; mockups at /components/usage-options)
- Trigger? A: line as button (Rec) / B: cost chip / C: icon only. Answer (free text): "I like the line as a button, but how do we best show that its clickable? Give me some options."
- Modal shape? Yes, as drafted (Rec) / Calls inside each stage / Calls only. Answer: "Yes, as drafted (Recommended)"
- Book dialog? Total, by kind, then import (Rec) / Import only, plus a total. Answer: "Total, by kind, then import (Recommended)"

### Free text between batches
Jack: "Also make a new table component for the UI, and make it look good. Also the spacing on the table for the calls is cramped. Before merging I want to see it for real"

### Batch 5 (Gate 3, shape; round 3 mockups)
- Affordance? A2 dotted underline (Rec) / A3 trailing chevron / A4 Details link / A1 hover only. Answer: "A3: trailing chevron"
- Row height? A bit tighter (Rec) / Keep as is. Answer (free text): "tiny bit tighter, also make sure it scrolls and bump the border radius a bit"

### Batch 6 (after the real-app look: fonts for data)
Jack: "Why is just the time in a different font. Make sure we unify the decsions regarding what font we use for data and stuff."
- Figures a person reads? Inter, tabular figures (Rec) / Mono for all data. Answer: "show me both"
- What stays mono? Only code-like strings (Rec) / Nothing in the product. Answer: "Only code-like strings (Recommended)"
- How wide? Whole app, in this change (Rec) / Usage now, rest separately. Answer: "Whole app, in this change (Recommended)"
- Figures, after the comparison: Inter, tabular (Rec) / Mono. Answer (free text): "So heres the rule. Anything copyable (model id, etc), or a number in a table, or stat, or anything of that nature is mono. Tables can be a mix of two fonts, mono for data, and other font for labels like stages. If its should not be copyable, like the usage line to open the dialog, it should not be in mono"
Jack: "Also the page number and zoom level in the pdf viewer should not be mono, you wouldnt really copy them"
