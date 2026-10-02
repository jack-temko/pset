# Git workflow: grill

- status: built (2026-10-01), except the runner, which is its own grill
- date: 2026-10-01
- brief: how PSet's changes are branched, checked, merged and released, from Jack's side (one person, several agent sessions at once, friends who run releases)
- sources: AGENTS.md, `.github/workflows/ci.yml`, the Makefile, `git log`, the repo's GitHub settings (public, no branch protection, merge commits, no PRs ever), memory notes branch-worktree-workflow, pset-github and no-commit-attribution
- locked by Jack before the grill: L1, L2, L3 below

## Summary

### In one line
Everything is built on `dev` and lands there by pull request once `make check` is green; `main` holds only releases, which Jack promotes from `dev` and tags, and a tag starts the binary build.

### Locked by Jack (not asked)
| # | Rule |
|---|---|
| L1 | Every branch must pass the basic frontend and backend tests before it is merged. |
| L2 | `main` stays for releases Jack is comfortable having his friends use; a runner builds the binaries from it (what it builds, and making PSet work on WSL and macOS, is the next conversation). |
| L3 | A new branch, `dev`, is used for all development. |

### Decisions
| # | Decision | Why | Beat |
|---|---|---|---|
| D1 | Everything lands by pull request, and a GitHub ruleset blocks the merge until the CI check is green. | The gate holds without anyone remembering it, for agents and cloud sessions too. The repo is public, so Actions is free. | A local `make land` script; both |
| D2 | The required check is `make check` (Go tests, typecheck, vitest, lint, generated-types drift, then the Go tests under the race detector). | It is what CI ran and it caught the ranking race that `make test` let through. About 3 to 4 minutes. | `make test` only; `make check` + web build |
| D3 | Jack merges `dev` into `main` when he is comfortable, and tags it. The tag starts the runner. | Main only moves by his hand and every release has a name. | Release branches; automatic promotion |
| D4 | An agent merges its own PR into `dev` once the check is green, then tells Jack what landed. | `dev` is the integration branch and `main` is what protects friends. Fewer interruptions. | Ask every time; only Jack merges |
| D5 | Squash merge into `dev`: one commit per change, titled with what it does. | `dev` reads as a list of changes, and undoing one is a plain `git revert`. | Merge commit; rebase |
| D6 | Rulesets on `dev` and `main`: no direct pushes, no bypass for agents. Jack, as repo owner, can bypass in an emergency. | Cloud sessions pushed straight to `main` before; a ruleset stops that. | Bind Jack too; convention only |
| D7 | A bug in a release is fixed on `dev` and released again (v0.2.1). | One flow, no special case. | Hotfix branch off `main`; decide each time |
| D8 | Day one: copy today's `main` to `dev`, make `dev` GitHub's default branch, then replace `main` with an empty root and a README until release 1. | Jack's choice; see Disagreements. | Leave `main`, tag v0.1.0 later |
| D9 | The existing `ci.yml` stays and becomes the required check. The branch that deleted it is dropped. | The gate needs CI. | Delete it and rewrite from blank |
| D10 | A release PR (`dev` into `main`) also runs `npm run build` and `govulncheck`. | It is the code friends run; the build catches CSS and spacing breakage the tests do not. | Nothing extra; plus a hand smoke test |
| D11 | A branch must be up to date with `dev` before it merges, so CI re-runs if `dev` moved. | Two green branches can still break each other. | No |
| D12 | The worktree-per-branch rule stays: each task in `../pset-<topic>`, Jack's checkout sits on `dev` and agents never edit it. Merged branches are deleted on GitHub automatically, and the worktree removed locally. | It is what lets several sessions work while Jack does. | Agents switch branches in one checkout |

### The flow
| Step | Who | What |
|---|---|---|
| 1 | Agent or Jack | `git worktree add ../pset-<topic> -b <topic> dev`; commit on it. |
| 2 | Agent or Jack | Open a PR into `dev`: title is what the change does; the body says what it does, what was checked, what was not. |
| 3 | CI | Runs `make check` on the PR. The ruleset needs it green and the branch up to date with `dev`. |
| 4 | Agent | Squash-merges its own green PR into `dev`, deletes the branch and worktree, and tells Jack what landed. |
| 5 | Jack | When `dev` is something friends can use: opens a PR from `dev` into `main`. CI runs `make check`, the web build and `govulncheck`. |
| 6 | Jack | Merges it and tags `vMAJOR.MINOR.PATCH`. |
| 7 | Runner | A `v*` tag on `main` builds the binaries and attaches them to a GitHub release (the next conversation). |
| 8 | Anyone | A release bug is fixed by repeating steps 1 to 6 from `dev`. |

### Assumed
Taken at the recommended default; overrule any.
- **A1** Tags are semver, `vMAJOR.MINOR.PATCH`, starting at v0.1.0 for release 1.
- **A2** Branch names stay descriptive kebab-case, never generated names. Commits keep carrying no Co-Authored-By and no "Generated with" lines.
- **A3** A red check is fixed, never re-run until green. A flaky test is fixed in its own change before the next merge. If `dev` goes red, revert first, then fix on a branch.
- **A4** The rules live in `AGENTS.md` (one file, `CLAUDE.md` imports it) and replace its merge sections. The memory notes branch-worktree-workflow and pset-github are updated to match. The ask-before-merge rule narrows to "agents never touch `main`".
- **A5** The ideas tracker keeps its statuses. "Merged" means into `dev`; a release notes which ideas it shipped.
- **A6** Cloud sessions branch from `dev` and open PRs like anyone else. The ruleset stops direct pushes.
- **A7** CI runs on PRs into `dev` and `main`, and on pushes to both.
- **A8** The release trigger is a `v*` tag on `main`.

### Open
- **The runner** (what it builds, for which platforms, the WSL and macOS backend changes) is the next conversation.
- Whether a macOS runner is free for a public repo, and what it costs if it is not.
- With strict up-to-date and several agents landing together, CI may re-run often; there is no merge queue on a personal repo. Watch it, and relax D11 if it hurts.
- Whether anyone else (a friend contributing) will ever need write access, which changes D6.

## Reversals
- **R1** "Nuke the CI file" (Jack, 2026-10-01, a pick in this grill's setup, committed as `remove-ci-workflow`, unmerged): reversed by Jack in this grill because the required check needs CI. The branch is deleted. No document held the decision.

## Disagreements
- **G1** The starting point (D8). Recommended: leave `main` where it is and tag v0.1.0 later, because emptying `main` means force-pushing a new root over a public branch, and anyone opening the repo or cloning it lands on a near-blank `main` until `dev` is the default. Jack chose an empty `main` with `dev` as default. The steps to do it safely are in the order below, so it needs no further argument.

## Frontier
Empty. Everything left is assumed or open above.

## Built (2026-10-01)
1. `dev` cut from `main`, the empty release root merged under it (so `main` is an ancestor of `dev` and a release is a plain pull request), `dev` made the default branch. Done.
2. `ci.yml` runs on pull requests and pushes to `dev` and `main`; `release-build` and `vulnerabilities` run only for `main`. Done (pull request 1, the first change to go through the new flow).
3. Rulesets on `dev` (squash only, a green `check`, up to date, no direct pushes, no deletion or force-push) and `main` (merge commit only, `check`, `release-build` and `vulnerabilities`, the same). Repo admin can bypass only by way of a pull request, never by a direct push. Branches are deleted on merge; auto-merge and "update branch" are on. Done.
4. `AGENTS.md` git section and the memory notes rewritten. Done.
5. `main` replaced with an empty root and a README, by force-push; its old history is inside `dev`. Done.
6. The runner: its own grill, next.

**Not tested:** that a direct push is refused. The rules read back as active through the API, but the harness would not let me probe them with a push. **Note:** agents run on Jack's GitHub login, so "no bypass for agents" is a rule in `AGENTS.md`, not something GitHub can tell apart from Jack.

## Log

### Setup (before the grill)
- Jack, on the audit: "Resume the grill but first some things I want for sure. First, all branches, before being merged have to pass the basic tests, frontend and backend. I also want to setup a new branch system. Main will stay for releases I feel comfortable having my friends use. That branch will have some sort of runner to build binaries (we will talk about this next, including backend changes to have pset work on WSL and MacOS). The new branch dev will be used for all development. Lets grill"
- Earlier, in the scope question: of four pieces offered to delete ("AGENTS.md workflow rules", "Workflow memory notes", "CI workflow file", "Ideas tracker process") Jack picked only "CI workflow file"; and "Branch and ask first (Recommended)" for how to work meanwhile. Reversed as R1.

### Batch 1
- How do we make sure no branch merges without passing the tests? Options: PRs + required checks (Recommended) / Local land script / Both. Answer: **PRs + required checks (Recommended)**.
- What are the "basic tests" every branch must pass? Options: make check (Recommended) / make test only / make check + web build. Answer: **make check (Recommended)**.
- How does something go from dev to main as a release? Options: You merge dev to main and tag (Recommended) / Release branches / Automatic from dev. Answer: **You merge dev to main and tag (Recommended)**.
- When a branch has passed the tests, who merges it into dev? Options: The agent, when green (Recommended) / Ask you every time / Only you merge. Answer: **The agent, when green (Recommended)**.

### Batch 2
- What should main be on day one? Options: Leave it, tag v0.1.0 later (Recommended) / Roll main back / Main empty until release 1. Answer: **Main empty until release 1**.
- Push back (agent): emptying main force-pushes a new root over a public branch and leaves a near-blank front page unless dev is the default; leaving main and tagging later keeps the same promise. Asked again: Empty main, dev is default / Leave main, tag v0.1.0 later (Recommended). Answer: **Empty main, dev is default**.
- How does a branch land in dev? Options: Squash, one commit per change (Recommended) / Merge commit / Rebase. Answer: **Squash, one commit per change (Recommended)**.
- Do the rules bind you too? Options: Bind everyone but main (Recommended) / Bind everyone, you too / Bind agents by convention. Answer: **Bind everyone but main (Recommended)**. (Recorded as D6: rulesets on both branches, no bypass for agents, Jack can bypass.)
- A friend finds a bug in a release you shipped. Options: Fix on dev, release again (Recommended) / Hotfix branch off main / Decide each time. Answer: **Fix on dev, release again (Recommended)**.

### Batch 3
- Reversal of "nuke the CI file". Options: Yes, drop that branch (Recommended) / No, rewrite CI from blank. Answer: **Yes, drop that branch (Recommended)**.
- What more must pass for a release than a normal change? Options: Add web build + govulncheck (Recommended) / Nothing extra / Add your smoke test. Answer: **Add web build + govulncheck (Recommended)**.
- Must a branch be up to date with dev before it can merge? Options: Yes, strict (Recommended) / No. Answer: **Yes, strict (Recommended)**.
- Does the worktree-per-branch rule stay, with your own checkout sitting on dev that agents never edit? Options: Keep it (Recommended) / Drop worktrees. Answer: **Keep it (Recommended)**.
