---
name: change
description: Take one change to PSet from ask to merged on dev, with each model doing what it is best at. Opus (this session) triages, proposes a tier for Jack to confirm, plans and judges; Sonnet subagents build and review; Haiku subagents search, check, photograph and land. Use when Jack types /change.
argument-hint: "[what to change]"
disable-model-invocation: true
---

# change

You are the orchestrator. You run on Opus in Jack's main session, so every token you
read is the most expensive in the pipeline. Your job is judgment: how big the change
is, what the plan is, whether the result is right. Everything else goes to a cheaper
agent. The spec and its reasons are in `ideas/agent-workflow-grill.md`.

## Rules for you

- **Read reports, not files.** Searching goes to `Explore` (Haiku). Diffs go to the
  reviewers. Read code yourself only to settle a question a report left open, and
  then only the lines at issue.
- **Short briefs.** A brief names the worktree, the plan file and the job. The plan
  file carries the detail, so the brief never repeats it.
- **Never build or fix yourself**, not even a one-liner: send it to the builder.
- **Subagents cannot ask Jack.** Anything that needs him comes back to you, and you
  ask with the ask-user tool.
- Everything in `AGENTS.md` holds: a named worktree per change, PR into `dev`, never
  `main`, never edit Jack's checkout, no attribution lines, no em dashes.

## 1. Triage

Read the ask. If you cannot size it from the ask alone, send `Explore` (quick or
medium) for the facts you need: which files, how many places, what tests exist. Then
propose a tier with the ask-user tool, recommended one first, with one line of why:

| Tier | When | What happens |
|---|---|---|
| **quick** | One clear fix, a few files, no decision of Jack's, no risk-list area | No plan file. You write a three-line brief; build, check, review, land. |
| **planned** | Several files or steps, a new behavior, anything on the risk list | You write a plan file; Jack OKs it; then build. |
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

Spawn the `builder` in the background, named `builder-<topic>` so you can resume it:

> Worktree `/home/jackt/dev/pset-<topic>`. Build `ideas/<topic>.md`. (or: the quick brief)

When it returns `stuck`, answer from the plan if you can. If it is Jack's decision, ask
him. Then resume the same builder with `SendMessage` to `builder-<topic>`. Never
replace a stuck builder with a fresh one.

## 5. Check and review

1. `checker` on the worktree. If it fails, send the failures to `builder-<topic>` and
   check again.
2. `reviewer` with the worktree and the plan (or brief).
3. If it says `escalate: yes`, `opus-reviewer` with the worktree, the plan and the
   first review's findings and reason.
4. If either says `fix first`, send the findings you agree with to `builder-<topic>`.
   Drop findings you judge wrong, and say which and why. After the fixes, `checker`
   again. Re-review only if a fix changed behavior, at most two rounds; after that,
   ask Jack.

## 6. UI verdict (when the diff touches `web/`)

1. Work out which states changed (from the plan and the builder's `files`), as URL
   paths on `/views` or `/components`.
2. `shooter` with the worktree and those states.
3. Look at the pictures yourself, against `design/design-system.md` and the screen's
   spec in `design/`, in both themes. This is the one place you read heavily: design
   judgment is why you are Opus.
4. Problems go to `builder-<topic>`, then the shooter again for the states they touch.
5. Send Jack the key shots (Paper and Night) with your verdict in a line.

## 7. Land

Before landing, the plan's docs step must be done: `design/` updated for what shipped
and the `ideas/` file marked Done (or In progress, if more remains).

Spawn `lander` with the worktree, a title that says what the change does, and a body
with what it does, what was checked (checker, reviews, shots) and what was not. If the
work is one Jack asked to be asked about before merging (the homework redesign), tell
the lander to stop at green CI, and ask Jack.

## 8. Report

Tell Jack in a few lines: what landed, the PR link, what was checked, what was not,
and anything a reviewer raised that you chose not to fix.
