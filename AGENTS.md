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
   branch is up to date with `dev`: if `dev` moved, `gh pr update-branch`
   and wait for the run again. Run `make check` yourself first; don't use
   CI to find out.
3. A red check is fixed, never re-run until it goes green. A flaky test is
   fixed in its own change before the next merge. If `dev` itself goes red,
   revert the change that did it first, then fix on a branch.
4. When it is green, **merge your own pull request** with a squash
   (`gh pr merge --squash --delete-branch`) and tell Jack what landed. Then
   remove the worktree. Don't wait for Jack, and never merge into `main`.

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

## Skills

Project skills live in `.agents/skills/<name>/` (a `SKILL.md` with `name`
and `description` frontmatter, plus a `references/` folder), the
vendor-neutral place any harness can read. `.claude/skills` is a symlink
to it for Claude Code: edit the skill in `.agents/skills`, never a copy.
Two skills, independent of each other:

- `grill` interviews the user in weighted batches (recommended option first, four
  questions a batch) until a decision or spec is ironed out, then writes a one-page
  summary they can read at a glance. Use it for a redesign, a feature, what to cut,
  an architecture choice or positioning: anything with decisions only the user can make.
- `pset-view` works on one view on `/views`, judged from the tired student's point of
  view. Modes: `redesign` (grills first, using `grill`, stops for the user's OK, then
  builds, verifies, photographs and documents), `tweak` (a bug or one friction row) and
  `extract` (put a view still inside its screen onto `/views`). Its design is
  `ideas/views-gallery.md` and `ideas/grill-skill.md`.

This file is the one set of agent instructions. `CLAUDE.md` only imports
it (`@AGENTS.md`); put nothing else there.

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
