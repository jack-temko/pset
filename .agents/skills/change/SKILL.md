---
name: change
description: Take one change to PSet from ask to merged on dev. The session builds it itself in the change's own worktree with tight context; subagents only search, photograph and review risky changes. A change that touches the UI waits for Jack to try it and approve; any other change merges once it is green and reviewed. Use when Jack types /change.
argument-hint: '[what to change]'
disable-model-invocation: true
---

# change

You build the change yourself. Writing a plan detailed enough for another agent to
build is most of the work of building it, and the agent then rebuilds the context you
already had. So keep the context tight instead: one worktree, only the files the change
touches, and subagents only for work that needs none of your context. Reasons:
`ideas/agent-workflow-grill.md`, "Reversals" (2026-11-04).

## Rules for you

- **Build and fix yourself**, in the change's worktree. Read only what the change
  touches; send a broad search ("where is X used across the app") to `Explore`.
- **Subagents only for work without your context**: `Explore` (searches), `shooter`
  (pictures of UI states, which keeps big images out of your context), `reviewer` and
  `second-reviewer` (fresh eyes on a risky change).
- **Batch Jack's feedback.** His annotations or notes from one look are one round of
  fixes, then one check.
- **The UI gate.** Use judgment on when Jack needs to see a change before it merges;
  mostly, a UI change waits. A change to what the student sees merges only after he
  tries it and approves it, in this session, in his own words, for this change. A
  change he would not want to look at (tests, tooling, CI, backend without a visible
  effect, rules, docs) merges once it is green and reviewed; tell him afterwards what
  landed. When unsure, show him.
- Everything in `AGENTS.md` holds: a named worktree per change, PR into `dev`, never
  `main`, never edit Jack's checkout, no attribution lines, no em dashes.

## 1. Size it

Read the ask. If Jack's decisions are the work (a redesign, a feature with open
choices), grill first with `grill` (or `pset-view` for a view); the approved spec is the
plan. Otherwise say in a line or two what you will do, and start. Ask Jack only what
the code and the docs cannot answer.

## 2. Set up

Pick a kebab-case topic for what the change does. From Jack's checkout, only:
`git fetch origin dev && git worktree add ../pset-<topic> -b <topic> origin/dev`.
A change with a spec marks its `ideas/` file In progress with the branch.

## 3. Build

Make the change in the worktree. Commit in small steps that each say what they do.

## 4. Check, once

`make check` once, when the change is done, in the background. A failure is fixed and
checked again; never re-run hoping for green.

## 5. Review (risky changes only)

The risk list: the database and migrations, the updater and release scripts, CI, wire
types, API keys and the settings that hold them. For a change on it, run `reviewer`
with the worktree and the spec (or a few lines of what the change does), and
`second-reviewer` if it escalates. Fix what you agree with; say what you dropped and
why. Any other change: read your own diff once before the pull request.

## 6. Pictures (UI changes)

`shooter` on the changed states, Paper and Night, at 1280 or more. Look at them
yourself against `design/design-system.md` and the screen's spec. Fix what is wrong
before Jack sees it.

## 7. Open the pull request

Push and `gh pr create --base dev`: the title says what the change does; the body says
what it does, what was checked, and what was not. The `design/` and `ideas/` docs are
updated first.

## 8. Jack tries it (UI changes only)

Start the branch's app:

```sh
.agents/skills/change/references/try.sh start /home/jackt/dev/pset-<topic>
```

It runs the branch's server and Vite on private ports (never 8420), on the worktree's
own data. If it needs model calls, ask the openrouter-keys mod for a key first
(`AGENTS.md`, "Model keys"). Give Jack the full link, what changed in his terms, what
to try, and what was not verified, and ask. His changes go back into the branch (one
batch, one check) and he tries it again. Only his approval lets it merge.

## 9. Merge

When it is green (and approved, for a UI change): if `dev` moved, update the branch
(`gh api -X PUT repos/jack-temko/pset/pulls/<number>/update-branch`) and wait for CI
again. Then `gh pr merge --squash --delete-branch`, stop the app
(`try.sh stop <worktree>`), and remove the worktree. Never merge into `main`.

## 10. Report

Tell Jack in a few lines what landed, the PR link, what was checked and what was not.
