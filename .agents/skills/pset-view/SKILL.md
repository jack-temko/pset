---
name: pset-view
description: Fix, redesign, modify or improve one of PSet's views (the homework panel, and others as they are extracted) by first working out the tired student's flow, then declutter and polish it. Works from the view's live page at /views/<name> with sample data, its spec.md, the component library and the design rules; creates components, updates the docs, and proposes backend changes. Use when asked to work on a PSet view, screen or panel, to audit its UX, to find where a student gets stuck or confused, or to extract a new view onto /views.
---

# pset-view

Work on one PSet view at a time, starting from the student and ending in code,
docs and a merge. A view is a separable, important piece of the UI (today the
homework panel) that stands alone at `/views/<name>` on sample data, with its
spec beside it.

**Who the student is** (every decision answers to them): hour 7 of a study
marathon, 1am, Night theme, glancing between a textbook scan and this panel,
low patience, low working memory. They will not read a paragraph to learn why
something is waiting, and they cannot aim at a small target.

## Invoke

`pset-view <view> <mode> [what]`, for example `pset-view homework audit`, or
`pset-view homework fix "Back from Ask loses the set"`.

| Mode | Does |
|---|---|
| `audit` | Steps 1 to 5 only: refresh the student, flow and friction log. No code. |
| `fix` | One friction row or bug: the smallest change that closes it, then docs. |
| `redesign` | A larger reshaping. Shows its flow, findings and proposal, with a recommendation, and **waits for a go-ahead** before building. |
| `modify`, `improve` | A named change, or the top friction rows, through the whole loop. |
| `new <name>` | Extract a view onto `/views` (see `references/mock-layer.md`), then `audit` it. |

If the view or mode is missing, ask. If the view is not on `/views` yet, the mode is `new`.

## The loop

1. **Set up.** Read `AGENTS.md`: work in a worktree (`git worktree add ../pset-<topic> -b <topic>`), never in the main checkout. Node needs `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`. Run frontend tools from `web/`, never the repo root. Run `npm ci` in a fresh worktree.
2. **Load context.** Read, in order: `web/src/views/<name>/spec.md`, its `scenarios.ts`, `design/design-system.md`, the READMEs of the components involved (`web/src/components/*/README.md`), and the view's section of its screen spec in `design/`. Precedence when they disagree: code, then the view's `spec.md`, then `design/*.md`.
3. **Walk the student's flow.** Write or refresh `student`, `flow` and `budget` in the spec. Count clicks, decisions and typing on the happy path as it is. See `references/student-lens.md`.
4. **Find the friction.** Apply the ten lenses in `references/student-lens.md`, driving the view in the browser (`references/verify.md`), including every handoff out and back. Add or update rows in the spec's `friction` table: id, where, what goes wrong for a tired student, severity, fix, status. Add a scenario for any state you could not reach.
5. **Decide.** In this order: declutter (remove before adding), reuse an existing component, extend one, create one (folder, README, a section under `web/src/pages/components/sections/`). For `redesign`, stop here and present the flow, the friction rows and the proposal with a recommendation. Ask the user only when a finding depends on how they or their students actually behave: at most three questions, batched.
6. **Implement** in the view (and components). Exits from a view stay props: a view never navigates, it calls a prop, so `/views` can log the handoff.
7. **Backend.** Write what the frontend needs into the spec's `wants` and propose the change (the `wire.go`, route or event, and why). Build it only if asked. If a `wire.go` changes, run `make gen`.
8. **Verify against `budget`.** Every scenario, both themes (Paper and Night), 1280 wide or more, and keyboard-only for the main flow. Then `make test` and `cd web && npm run build`. Save screenshots outside the repo. See `references/verify.md`.
9. **Update the docs.** The view's `spec.md` (states, actions, handoffs, data, why, friction row marked fixed, wants, open), the READMEs of components you changed or created, `design/design-system.md` if a token or rule moved, and the view's screen spec in `design/` if a decision changed.
10. **Land it.** Per `AGENTS.md`: bring `main` in, re-run the checks, merge with a merge commit named "Merge <branch>: <what it does>", push, remove the worktree and branch. If the caller said to park it, stop after the commit and leave the branch and worktree.

## Guardrails

- **Locked decisions are not yours to change.** The panel stays open and remembers its tab; the Focus toggle; every stage of a guide veiled, one click each; Complete is a checkbox that does not advance; the 15px type floor; Primer geometry (32px controls, 6px radius); status is ink, not fill. If a finding contradicts one, mark the row `raise with Jack` and do not act on it. The full list is in `design/design-system.md` and the screen spec.
- **Never touch a real library or server.** Port 8420 is the user's own PSet. Run Vite on another port with `PSET_API_TARGET=http://127.0.0.1:9`. Test only against `/views` (the mock) or a scratch server on its own port and data dir.
- **Only the token scale exists.** No fractional or arbitrary spacing utilities; `npm run build` fails on them.
- **Nothing in the repo but source.** Screenshots, traces and logs go to a scratch directory outside it.
- **Writing.** No em dashes in UI copy, docs or commits. Sentence case, verb-first labels ("Import a PDF"). Commits carry no `Co-Authored-By` or "Generated with" lines.
- **Do not `pkill -f` a pattern that is in your own command line**; it kills your shell. Stop a server by its PID (`ss -ltnp`).
- **Report faithfully.** If a check fails or a state was not verified, say so.

## References

- `references/student-lens.md`: the ten lenses, the friction-log rules, what a good row looks like.
- `references/spec-template.md`: the `spec.md` format, heading by heading.
- `references/mock-layer.md`: how a view runs on `/views`, and how to extract a new one.
- `references/verify.md`: running the view, driving it with Playwright, the checklist, known gotchas.
