# Agent notes

## Branches: `dev` is where work lands, `main` is releases

- **`main` holds releases only**: what Jack is comfortable handing to
  friends. Never branch from it, push to it or merge into it. Jack alone
  promotes `dev` into `main` and tags the release (`vMAJOR.MINOR.PATCH`,
  starting at v0.1.0); a `v*` tag on `main` starts the binary build.
- **`dev` is the default branch and takes every change**, by pull request.
  Jack's own checkout sits on `dev` and may hold his uncommitted changes
  at any moment, so don't edit, stage or commit in it.
- **Every change gets its own branch and worktree**, from `dev`, next to
  the repo: `git worktree add ../pset-<topic> -b <topic> dev`. Name the topic
  for what the change does, in kebab-case (`delete-anything-confirmed`),
  never a generated name like `claude/laughing-gauss-1135o5`. Parked and
  throwaway branches are named the same way. Commits carry no
  Co-Authored-By and no "Generated with" lines.

**Landing a change** (the tests, and the real app for a UI change, first):

1. Push the branch and open a pull request into `dev`:
   `gh pr create --base dev`. The title is what the change does. The body
   says what it does, what was checked, and what was not.
2. CI runs `make check` (Go tests, typecheck, vitest, lint, the
   generated-types check, then the Go tests again under the race
   detector). A ruleset on `dev` blocks the merge until it is green and the
   branch is up to date with `dev`: if `dev` moved, update it with
   `gh api -X PUT repos/jack-temko/pset/pulls/<number>/update-branch` (this
   machine's `gh` has no `pr update-branch`) and wait for the run again. Run `make check` yourself first; don't use
   CI to find out.
3. A red check is fixed, never re-run until it goes green. A flaky test is
   fixed in its own change before the next merge. If `dev` itself goes red,
   revert the change that did it first, then fix on a branch.
4. **Jack tries it and approves before anything merges.** Start the
   branch's own app for him (`.agents/skills/change/references/try.sh start
   <worktree>`: private ports, the worktree's own data, never 8420), tell him
   what changed and what to try, and ask. His changes go back into the
   branch and he tries it again. Only his approval, in his own words, for
   this change, lets it merge: never a reviewer's, a subagent's, or an
   earlier one.
5. When he has approved and it is green, squash-merge it
   (`gh pr merge --squash --delete-branch`), tell him what landed, and
   remove the worktree. Never merge into `main`.

**Releasing is Jack's**: a pull request from `dev` into `main`, merged with
a merge commit (not a squash, so `main` stays an ancestor of `dev`), which
also runs the web build and `govulncheck`, then the tag. A bug in a release
is fixed on `dev` and released again (v0.2.1); there is no hotfix branch.
Cloud sessions (claude.ai/code) follow the same rules: branch from `dev`,
open a pull request. Direct pushes to `dev` and `main` are refused.
Spec and reasons: `ideas/git-workflow-grill.md`.

## Ideas in progress

`ideas/` holds work that's decided but not built, being built, or
stuck: one file per group, each with a Status and an Information
section, indexed in `ideas/README.md`. When you start one, mark it In
progress with its branch; when it ships (merged into `dev`), the spec goes
in `design/` and the idea is marked Done.

## Checking UI changes

There is no automated visual suite. See a UI change working in the real
app before calling it done:

- `make dev` runs the server and Vite with hot reload, on its own data in
  `.dev/data`, never Jack's library.
- Look at every state you changed, in **both themes** (Paper and Night),
  at a desktop width of 1280 or more.
- A new or changed component also belongs on `/components`, the page
  that shows every component and variant: a section in a group file under
  `web/src/pages/components/sections/`, with the component's README as its
  Docs.
- The rules are in `design/design-system.md`, and each screen's spec is
  in `design/`. Where a change would contradict a spec, raise it rather
  than quietly diverging.

## Model keys: ask the openrouter-keys mod

Every real model call an agent makes (an eval with `PSET_EVAL_KEY`, `make
dev` talking to a model, a one-off script) runs on an OpenRouter key Jack
approved for that worktree, in his PSet workspace on OpenRouter. There is
no shared key: `key.txt` is retired.

- Call `request_openrouter_key` with the worktree's absolute path, a
  one-line reason and a limit in dollars (default $1). It returns at once.
  Jack approves or denies in the OpenRouter keys pane (`/keys`), and his
  answer arrives as a message. Meanwhile do work that needs no model, and
  send a push notification if he may be away.
- An approved key is in `<worktree>/.dev/openrouter.key` (mode 600,
  ignored by git). Read it only into a variable:
  `PSET_EVAL_KEY="$(tr -d '[:space:]' < .dev/openrouter.key)"`. For
  `make dev`, save it through the dev server's `PUT /api/settings`. Never
  print, copy or commit it.
- One key per worktree: asking again with a higher limit asks Jack to
  raise it. Removing the worktree deletes its key; `delete_openrouter_key`
  deletes it sooner.
- Never use or read the key in Jack's own library (`~/.local/share/pset`).
  A new key for his PSet is `request_pset_instance_key`, which writes it
  there itself; deleting any key is `request_openrouter_key_deletion`.
  Both wait for his approval. `list_openrouter_keys` shows every key's
  spend and the latest jobs, never a secret.
- Without these tools (a cloud session, or the mod not loaded), ask Jack.
  The mod is `~/.claude/mods/openrouter-keys`, loaded in every session
  through `CLAUDE_CODE_PLUGIN_DIRS`; its spec is
  `ideas/openrouter-keys-grill.md`.

## Test library

`~/.local/share/pset-test-library/` is a read-only snapshot of Jack's books and
textbooks with up to three of his newest homework sets per book (questions and
guides included), and no key, tutor turns, memories, activity or usage. When a
test needs a library, run `make seed` in your worktree: it copies the snapshot into
`.dev/data` in seconds, with no model call (`try.sh start` does it for an empty
worktree). Never use the snapshot directly or Jack's own library. `make test-library`
refreshes the snapshot from his library (he runs it, or an agent with his OK).
Spec: `ideas/test-library.md`.

## Skills

Project skills live in `.agents/skills/<name>/` (a `SKILL.md` with `name`
and `description` frontmatter, plus a `references/` folder), the
vendor-neutral place any harness can read. `.claude/skills` is a symlink
to it for Claude Code: edit the skill in `.agents/skills`, never a copy.
Three skills:

- `grill` interviews the user in weighted batches (recommended option first, four
  questions a batch) until a decision or spec is ironed out, then writes a one-page
  summary they can read at a glance. Use it for a redesign, a feature, what to cut,
  an architecture choice or positioning: anything with decisions only the user can make.
- `pset-view` works on one view on `/views`, judged from the tired student's point of
  view. Modes: `redesign` (grills first, using `grill`, stops for the user's OK, then
  builds, verifies, photographs and documents), `tweak` (a bug or one friction row) and
  `extract` (put a view still inside its screen onto `/views`). Its design is
  `ideas/views-gallery.md` and `ideas/grill-skill.md`.
- `change` takes one change from ask to merged on `dev`, splitting the work by model
  (below), with a gate where Jack tries the change and approves it before it merges. Jack starts it with `/change`; it uses the other two when a change needs a
  grill.

## Models and agents

Opus judges, Sonnet builds, Haiku does the mechanical work, so no model pays twice to
read the same code. `/change` runs in an Opus session: it sizes the change, proposes
a tier (quick, planned, grilled) for Jack to confirm, plans, and judges the result.
The workers are Claude Code subagents in `.claude/agents/` (Claude-specific, so they
live there, not in `.agents/`):

| Agent           | Model  | Job                                                                           |
| --------------- | ------ | ----------------------------------------------------------------------------- |
| `Explore`       | Haiku  | every codebase search (replaces the built-in one)                             |
| `builder`       | Sonnet | builds the plan in the worktree; stops and reports when stuck                 |
| `checker`       | Haiku  | `make check`, returning only the failures                                     |
| `reviewer`      | Sonnet | reads the plan and the diff; escalates risky or unsure changes                |
| `opus-reviewer` | Opus   | the second review, for escalated changes                                      |
| `shooter`       | Haiku  | screenshots of changed UI states, Paper and Night                             |
| `lander`        | Haiku  | push and open the PR; after Jack approves, CI, squash-merge, worktree removal |

Outside `/change`, the same split holds: search with `Explore`, and hand mechanical
work to `checker` or `lander` instead of doing it on Opus. Spec and reasons:
`ideas/agent-workflow-grill.md`.

This file is the one set of agent instructions. `CLAUDE.md` only imports
it (`@AGENTS.md`); put nothing else there.

## Format and lint

Each language follows its own standard: Go through gofmt and goimports, the web
(TS, CSS, JSON, YAML, Markdown) through oxfmt in Google TS style, shell through
shfmt. `make fmt` rewrites the repo; `make fmt-check` fails on any diff and
runs first in `make check`. A hook in `.claude/settings.json` formats each
file an agent writes or edits, with the formatters of the worktree the file is
in (`tools/format-file.sh`; it skips ignored files, such as `web/src/api/gen`,
and a worktree without `web/node_modules`, and never fails an edit). Files an
agent writes in a worktree are therefore formatted before `make check`; anything
else (your own edits, generated files, a shell command that rewrites a file)
needs `make fmt`. Linting
(`make lint`) comes in a second change; a `//nolint` will need a reason.

## Repo hygiene: no artifacts in the repo

Never leave screenshots, console logs, traces, browser-tool output, or
any other inspection artifacts in the repository, not even temporarily.
This repo once filled with 83 stray PNGs from ad-hoc browser sessions;
don't do that again.

- Browser automation tools save to the working directory by default.
  When driving a browser, always pass an explicit output path in a
  scratch or temp directory outside the repo.
- Run frontend tooling from `web/`, never from the repo root: stray
  `node_modules` and tool caches at the root are the same pollution.
- `.gitignore` backs this up with `/*.png` and friends, but the ignore
  rules are the safety net, not the rule. Clean up after yourself.
