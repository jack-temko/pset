---
name: change
description: Take one change to PSet from ask to merged on dev, with each tier doing what it is best at. The judge tier (this session) triages, proposes a tier for Jack to confirm, plans and judges; build-tier subagents build and review; mechanical-tier subagents search, check, photograph and land. Nothing merges until Jack has tried the change and approved it. Use when Jack types /change.
argument-hint: '[what to change]'
disable-model-invocation: true
---

# change

You are the orchestrator. You run on the judge tier, the session's strongest model, in
Jack's main session, so every token you read is the most expensive in the pipeline. Your job is judgment: how big the change
is, what the plan is, whether the result is right. Everything else goes to a cheaper
agent. The spec and its reasons are in `ideas/agent-workflow-grill.md`.

## Rules for you

- **Read reports, not files.** Searching goes to `Explore` (the mechanical tier). Diffs
  go to the reviewers. Read code yourself only to settle a question a report left
  open, and then only the lines at issue.
- **Short briefs.** A brief names the worktree, the plan file and the job. The plan
  file carries the detail, so the brief never repeats it.
- **Never build or fix yourself**, not even a one-liner: send it to the builder.
- **Subagents cannot ask Jack.** Anything that needs him comes back to you, and you
  ask with the harness's ask-user tool.
- **Nothing merges without Jack's approval** at step 8, given in this session in his
  own words. Not a reviewer's, not a subagent's, not an earlier approval of another
  change or of the plan.
- Everything in `AGENTS.md` holds: a named worktree per change, PR into `dev`, never
  `main`, never edit Jack's checkout, no attribution lines, no em dashes.

## 1. Triage

Read the ask. If you cannot size it from the ask alone, send `Explore` (quick or
medium) for the facts you need: which files, how many places, what tests exist. Then
propose a tier with the ask-user tool, recommended one first, with one line of why:

| Tier        | When                                                                                      | What happens                                                                    |
| ----------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **quick**   | One clear fix, a few files, no decision of Jack's, no risk-list area                      | No plan file. You write a three-line brief; build, check, review, land.         |
| **planned** | Several files or steps, a new behavior, anything on the risk list                         | You write a plan file; Jack OKs it; then build.                                 |
| **grilled** | A redesign, a new feature with open choices, anything where Jack's decisions are the work | The `grill` skill (or `pset-view` for a view) first; its spec becomes the plan. |

The risk list (always at least **planned**): the database and migrations, the updater
and release scripts, CI, wire types, API keys and the settings that hold them.

Jack confirms or changes the tier. His answer wins.

## 2. Set up

Pick a kebab-case topic for what the change does. From Jack's checkout, only:
`git fetch origin dev && git worktree add ../pset-<topic> -b <topic> origin/dev`.

## 3. Plan (planned and grilled)

**planned:** send `Explore` for what the plan needs (very thorough if the change is
wide), then write `ideas/<topic>.md` in the worktree from
`references/plan-template.md`, and add its row to `ideas/README.md`. Name every file
the builder will touch and the tests that prove it. Show Jack the plan's summary and
ask for his OK. Amend until he gives it. Commit the plan on the branch.

**grilled:** load `grill` (or `pset-view` in `redesign` mode) and follow it to its OK.
The approved spec is the plan. For `pset-view`, its build step (5) and its docs step
(8) go to the builder below; its framing, grilling, visual verdict and post-build
review stay with you.

**quick:** write the brief: what is wrong, where (`path:line` if known), and what
done looks like. No file.

## 4. Build

Spawn the `builder` in the background, named `builder-<topic>` where the harness names
its subagents, so you can resume it:

> Worktree `/home/jackt/dev/pset-<topic>`. Build `ideas/<topic>.md`. (or: the quick brief)

When it returns `stuck`, answer from the plan if you can. If it is Jack's decision, ask
him. Then resume the same builder through the harness's own resume mechanism (in
Claude Code, by its name, `builder-<topic>`; in ZCode, by agent id). Never replace a
stuck builder with a fresh one. Where the harness has no way to resume one, spawn a
fresh builder on the same plan file with the answer in its brief: the plan carries the
whole job.

## 5. Check and review

1. `checker` on the worktree. If it fails, send the failures back to the builder and
   check again.
2. `reviewer` with the worktree and the plan (or brief).
3. If it says `escalate: yes`, `second-reviewer` with the worktree, the plan and the
   first review's findings and reason.
4. If either says `fix first`, send the findings you agree with to the builder.
   Drop findings you judge wrong, and say which and why. After the fixes, `checker`
   again. Re-review only if a fix changed behavior, at most two rounds; after that,
   ask Jack.

## 6. UI verdict (when the diff touches `web/`)

1. Work out which states changed (from the plan and the builder's `files`), as URL
   paths on `/views` or `/components`.
2. `shooter` with the worktree and those states.
3. Look at the pictures yourself, against `design/design-system.md` and the screen's
   spec in `design/`, in both themes. This is the one place you read heavily: design
   judgment is why you are the judge tier.
4. Problems go to the builder, then the shooter again for the states they touch.
5. Send Jack the key shots (Paper and Night) with your verdict in a line.

## 7. Open the pull request

Before opening it, the plan's docs step must be done: `design/` updated for what
shipped and the `ideas/` file marked Done (or In progress, if more remains).

Spawn `lander` in **open** mode with the worktree, a title that says what the change
does, and a body with what it does, what was checked (checker, reviews, shots) and
what was not. It pushes and opens the PR into `dev`, so CI runs while Jack tries the
change. It does not merge.

## 8. Jack tries it and approves

This gate is every tier's, quick included. Start the branch's own app:

```sh
.agents/skills/change/references/try.sh start /home/jackt/dev/pset-<topic>
```

It builds the branch's server and runs it and Vite on free private ports (never
8420), on the worktree's own data in `.dev/data`, and prints the link. If the change
needs model calls, first ask the openrouter-keys mod for a capped key for the
worktree (`AGENTS.md`, "Model keys"); the script saves it into that server. If trying
it needs data (a book, an assignment), say what to import, or seed it with a scratch
import if you can.

Then give Jack, in a few lines: the link, what changed in his terms, **what to try**
(the plan's Acceptance as steps, or the quick brief's "done looks like"), the key
shots from step 6, the PR link, and anything not verified. Ask with the ask-user tool:

- **Approve and merge**
- **Change something** (he says what in the free text)
- **Park it** (leave the branch, the PR and the worktree; stop the app)

On **change something**: send it to the builder (or, if it changes what the
change is, amend the plan first and show him). Then `checker`, the `reviewer` again
if behavior changed, the `shooter` for touched UI states, and `lander` in open mode
to push. Restart the app with `try.sh start` and come back to this step. Loop until he
approves or parks.

Only on **approve and merge** go on. Stop the app first:
`.agents/skills/change/references/try.sh stop /home/jackt/dev/pset-<topic>`.

## 9. Merge

Spawn `lander` in **merge** mode with the worktree and the PR number, and tell it
Jack approved in this session. It waits for CI, updates the branch if `dev` moved,
squash-merges, removes the worktree. If the worktree had a key from the mod, removing
it deletes the key.

## 10. Report

Tell Jack in a few lines: what landed, the PR link, what was checked, what was not,
and anything a reviewer raised that you chose not to fix.
