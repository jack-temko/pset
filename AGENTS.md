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

## Checking UI changes

There is no automated visual suite. See a UI change working in the real
app before calling it done:

- `make dev` runs the server and Vite with hot reload, on its own data in
  `.dev/data`, never Jack's library.
- Look at every state you changed, in **both themes** (Paper and Night),
  at a desktop width of 1280 or more.
- A new or changed component also belongs on `/components`, the page
  that shows every component and variant.
- The rules are in `design/design-system.md`, and each screen's spec is
  in `design/`. Where a change would contradict a spec, raise it rather
  than quietly diverging.

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
