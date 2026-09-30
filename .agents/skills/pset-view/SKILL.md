---
name: pset-view
description: Redesign, tweak or extract one of PSet's views (the homework panel, and others as they are put on /views). A redesign starts by grilling the user in gates (purpose and inventory, flow and layout, behavior and states, data and acceptance) using the grill skill, stops for their OK, then builds, verifies, photographs and documents it. A tweak fixes a bug or one friction row. Extract puts a view still inside its screen onto /views. Judges everything from the tired student's point of view. Use when asked to work on a PSet view, screen or panel, redesign it, audit its UX, or put a view on /views.
---

# pset-view

Work on one PSet view at a time, from the student's point of view to code, docs and a
merge. A view is a separable piece of the UI (today the homework panel) that stands
alone at `/views/<name>` on sample data, with its spec beside it.

This skill knows about views: the gates, the harness, the build, the checks. It does
**not** know how to interview someone: that is the `grill` skill, which this one calls
(`.agents/skills/grill/`) and hands a brief to. The two are independent; `grill` is used
for many things besides views.

**The student** (every decision answers to them): hour 7 of a study marathon, 1am, Night
theme, glancing between a textbook scan and this panel, low patience, low working
memory. They will not read a paragraph to learn why something is waiting, and they
cannot aim at a small target.

## Invoke

`pset-view <view> <mode> [what]`, for example `pset-view homework redesign`,
`pset-view homework tweak "Back from Ask loses the set"`, `pset-view contents-rail extract`.

| Mode | For | Grill |
|---|---|---|
| `redesign` | a view from scratch, or a new flow, layout or behavior | yes, all gates; gate 1 shrinks to a quick confirm when the purpose is clearly unchanged |
| `tweak` | a bug, a small adjustment, one friction row | no. With no target it is the read-only audit |
| `extract` | a view still inside its screen, put on `/views` unchanged | no |

If the view or mode is missing, ask. If the view is not on `/views` and the mode is
`redesign`, run `extract` first.

## Redesign

1. **Set up.** Read `AGENTS.md`: work in a worktree (`git worktree add ../pset-<topic> -b <topic>`), never in the main checkout. Node needs `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`. Run frontend tools from `web/`. `npm ci` in a fresh worktree.
2. **Frame (gate 0), alone.** Read the view's `spec.md`, scenarios, any earlier `grill.md`, `design/design-system.md`, the screen spec in `design/`, the components' READMEs, and the code. Drive the view in every scenario (see `references/verify.md`) and count its flow: clicks, decisions, typing, tab stops. Write the audit brief (`references/grill-stages.md`, gate 0) and photograph the current state.
3. **Grill.** Load the `grill` skill and hand it the brief in `references/grill-stages.md`: the topic, the output path `web/src/views/<name>/grill.md`, the tired student as point of view, the locked decisions, and the four gates with their question seeds, artifacts and exit tests. Archive an existing `grill.md` to `grills/<date>.md` first. The grill ends with the summary written at that path.
4. **Stop for the OK.** Hand back the summary (it is drawn on `/views/<name>`). Do not build until the user approves it or amends it. If they cannot be reached, stop; do not build on assumptions.
5. **Build.** Implement what the spec says. Exits from a view stay props: a view never navigates, it calls a prop, so `/views` can log the handoff. Reuse a component, then extend one, then create one (folder, README, a section under `web/src/pages/components/sections/`). Backend: write what the frontend needs into the spec's `wants` and propose it; build it only if asked, and run `make gen` if a `wire.go` changes.
6. **Verify.** `references/verify.md`: every scenario, both themes, 1280 wide or more, keyboard-only for the main flow, the flow's counts against the spec's `budget`, `make test`, `cd web && npm run build`.
7. **Post-build review round.** Photograph the real view (both themes, every key scenario, framed on the panel and its log) and show the photos to the user. Run a short grill on what feels off, what to cut and what is missing (at most two batches, recommended fixes first). Record the answers as dated post-build decisions in `grill.md`. Small ones become a `tweak`; a large one reopens a gate.
8. **Docs.** Rewrite the view's `spec.md` to match what was built (mission, inventory, states, actions, handoffs, data, why, a fresh friction log, wants, open). Update the READMEs of components you changed or created, `design/design-system.md` if a token or rule moved, and the screen's `design/*.md` for any reversal the grill approved. Set `grill.md` to `status: built`.
9. **Land it.** Follow `AGENTS.md`. The user has asked to be asked before any merge into `main`: ask, and merge only on a yes. If told to park, stop after the commit and leave the branch and worktree.

## Tweak

1. Set up as above. Read the spec, the scenarios and the friction log; the brief is the row or the bug the user named.
2. Reproduce it in a scenario (add one if the state is unreachable). Count the flow if the fix touches it.
3. Make the smallest change that closes it. Prefer removing to adding. A tweak never reverses a locked decision: mark the row `raise with Jack` and stop.
4. Verify as in redesign step 6. Mark the friction row fixed in the spec; update any README the change touched. Land it as in step 9.

**With no target,** `tweak` is the read-only audit: apply the ten lenses in `references/student-lens.md`, update the spec's `student`, `flow`, `budget` and `friction`, add scenarios for states you could not reach, and report. No code.

## Extract

Move a view out of its screen and onto `/views` without changing it. Follow
`references/mock-layer.md` ("Extracting a view from a screen"): move the code verbatim,
turn every exit into a prop, write the stage, the simulated backend routes and the
scenarios, register it. Then run the audit above to write its spec as it is today. The
extract lands like any change (step 9). No grill: nothing is being decided.

## Guardrails

- **Locked decisions are not silently reversed.** In a redesign the grill asks a reversal as an explicit question; a tweak never reverses one. The locked list: the panel stays open and remembers its tab; the Focus toggle; every stage of a guide veiled, one click each; Complete is a checkbox that does not advance; the 15px type floor; Primer geometry (32px controls, 6px radius); status is ink, not fill. The dated decisions in `design/*.md` are also locked until a reversal is approved.
- **Never touch a real library or server.** Port 8420 is the user's own PSet. Run Vite on another port with `PSET_API_TARGET=http://127.0.0.1:9`. Test only against `/views` (the mock) or a scratch server on its own port and data dir.
- **Only the token scale exists.** No fractional or arbitrary spacing utilities; `npm run build` fails on them.
- **There is no formatter.** Match the file's own style by hand (no semicolons, single quotes); never run prettier.
- **Type-check with `npx tsc -b`** (as `make test` does). `tsc --noEmit -p .` checks nothing here.
- **Nothing in the repo but source.** Screenshots, traces and logs go to a scratch directory outside it.
- **Writing.** No em dashes in UI copy, docs or commits. Sentence case, verb-first labels ("Import a PDF"). Commits carry no `Co-Authored-By` or "Generated with" lines.
- **Do not `pkill -f` a pattern in your own command line**; it kills your shell. Stop a server by PID (`ss -ltnp`).
- **When the user cannot be asked** (an unattended run), write the question into the spec's `open` and your report, choose the reversible option, and carry on. Never in a redesign's decisions: those stop at step 4.
- **Report faithfully.** If a check failed or a state was not verified, say so.

## References

- `references/grill-stages.md`: the brief handed to `grill`: gates 0 to 4, seeds, artifacts, exit tests, the walkthrough simulation, the cross-view check, the post-build review.
- `references/student-lens.md`: the ten lenses and the friction log.
- `references/spec-template.md`: the `spec.md` format.
- `references/mock-layer.md`: how a view runs on `/views`, and extracting one.
- `references/verify.md`: running, driving and checking a view.
