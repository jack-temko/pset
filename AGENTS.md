# Agent notes

## Work on a branch, then merge it

Jack works in the main checkout at the same time, so it can hold his
uncommitted changes at any moment. Every change goes on its own branch,
in its own worktree next to the repo, never straight onto `main`:
`git worktree add ../pset-<topic> -b <topic>`. Don't edit, stage or
commit in Jack's checkout. Name the topic for what the change does, in
kebab-case (`delete-anything-confirmed`), never a generated name like
`claude/laughing-gauss-1135o5`: it lands in `main`'s history through
the merge commit.

When the change is done and checked (the tests, and the real app for a
UI change):

1. Bring `main` into the branch and resolve any conflicts there.
2. Run the checks again on the merged result.
3. Merge the branch into `main` with a merge commit, named like the
   history's own ("Merge <branch>: <what it does>"), and push. The merge
   is the one step that runs in the main checkout. If Jack's uncommitted
   changes touch the files the merge would change, stop and ask rather
   than stash, reset or overwrite.
4. Remove the worktree and delete the branch.

## Ideas in progress

`ideas/` holds work that's decided but not built, being built, or
stuck: one file per group, each with a Status and an Information
section, indexed in `ideas/README.md`. When you start one, mark it In
progress with its branch; when it ships, the spec goes in `design/` and
the idea is marked Done.

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
