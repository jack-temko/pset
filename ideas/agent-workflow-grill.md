# Model-tiered agent workflow: grill

- status: approved
- date: 2026-10-08
- brief: which Claude models plan, implement, review, check and land PSet changes, and through which Claude Code features; judged from Jack's point of view (usage limits, his attention, and the quality of what lands on `dev`)
- sources: code.claude.com docs (sub-agents, model-config, costs, prompt-caching, skills, workflows, agent-teams, advisor, agents); Haiku 5.5 launch coverage (theneuron, beam.ai, developersdigest, officechai, tbreak); AGENTS.md; Makefile; ~/.claude/settings.json; ~/.claude.json account fields

## Summary

### In one line
Opus judges and plans, Sonnet builds and reviews, Haiku reads, checks, photographs and lands, joined by a plan file so no model pays twice for the same context.

### Decisions
| # | Decision | Why | Beat |
|---|---|---|---|
| D1 | A change is: Opus plans in the main session (with Haiku doing the reading), writes the plan to `ideas/`, Sonnet builds from the file | context paid once per session; the plan survives restarts and is yours to OK | one Sonnet session + advisor; opusplan; Opus orchestrating fine-grained subagents |
| D2 | The `/change` orchestrator runs on Opus | triage and planning are judgment; triage is a turn or two on a short context | Sonnet orchestrator switching to Opus to plan |
| D3 | The orchestrator proposes a tier and you confirm it: **quick** (no plan), **planned** (Opus plan file), **grilled** (grill or pset-view first) | you asked for the orchestrator to judge complexity and check with you | two tiers; full pipeline always; Haiku doing small ones |
| D4 | After your OK the orchestrator dispatches a background Sonnet builder into the worktree with the brief "build ideas/x.md" | Opus pays only for one-line briefs and short reports; you stay in one chat | you starting sessions by hand; a saved workflow |
| D5 | No advisor. A stuck builder stops and reports; the orchestrator answers and resumes it | the advisor is one global setting, so it would also put Opus on Opus; it is experimental | Opus advisor everywhere; advisor only in hand-started sessions |
| D6 | A read-only Sonnet reviewer sees the plan plus the diff; it escalates to an Opus reviewer when it flags doubt or the diff touches the fixed risk list | independent eyes for little usage | Opus on every diff; built-in /code-review; no review |
| D7 | The reviewer's findings go back to the same builder (resumed), not a fresh one | it still holds its context; a 1h cache makes the resume cheap | fresh builder; Opus fixing |
| D8 | Haiku takes all searching (Explore override), `make check` (failures only), UI screenshots, and landing (push, PR, update-branch, CI wait, squash-merge, worktree removal) | mechanical work where Haiku is strong and Opus was wasted | keeping any of these on the main model |
| D9 | Opus judges Haiku's screenshots against `design/` on changes touching `web/` only | design judgment is where Opus earns its cost | you always; the Sonnet reviewer |
| D10 | `pset-view` uses the same split: grills and the final visual verdict on Opus, build steps to the Sonnet builder | your biggest jobs get the biggest saving | all Opus |
| D11 | Packaging: committed `.claude/agents/` plus one `/change` skill | one command; cloud sessions get it too; nothing loads into unrelated sessions | AGENTS.md rules; a saved workflow |
| D12 | Rollout: update Claude Code to 2.1.293+, build on branch `agent-workflow`, pilot one real change, compare `/usage` attribution, then land | prove it saves before it becomes the rule | spec only |

### The artifact: roles

| Agent | Model, effort | Tools | Job | Returns |
|---|---|---|---|---|
| main session running `/change` | Opus, medium | all | triage, propose tier, plan with you, dispatch, answer stuck builders, judge UI | to you: tier, plan, what landed |
| `Explore` (overrides built-in) | Haiku, medium | read-only | every codebase search | short findings with file:line |
| `builder` | Sonnet, medium, 1h cache | edit, bash | build `ideas/x.md` in the worktree, run its tests | what changed, what it checked, or "stuck: why" |
| `checker` | Haiku, low | bash, read | `make check` | pass, or only the failures |
| `reviewer` | Sonnet, high | read-only + git | plan + diff | findings, and `escalate: yes/no` with reason |
| `opus-reviewer` | Opus, medium | read-only + git | plan + diff, risky changes only | findings |
| `shooter` | Haiku, low | bash, browser | photograph each changed state, Paper and Night, 1280+, into scratch outside the repo | paths to images |
| `lander` | Haiku, low | bash (git, gh) | push, `gh pr create --base dev`, wait for CI, `update-branch` if needed, squash-merge, remove the worktree | PR link and result |

Flow: `/change <ask>` → triage → tier proposed → you confirm → (planned: Opus plan file → your OK) → worktree → builder → checker → reviewer (→ opus-reviewer) → fixes back to builder → (web/: shooter → Opus verdict) → lander → "landed: ..."

### Assumed
- A1: Effort per role as in the table above.
- A2: The risk list for escalation: `internal/` database and migrations, the updater and `tools/release/`, wire types and `web/src/api/gen`, keys and auth, CI config.
- A3: The plan file is the `ideas/<topic>.md` convention (Status, Information) plus Files, Steps, Tests and Acceptance sections, so the builder reads only what it names.
- A4: The orchestrator makes the named worktree itself (`../pset-<topic>`), per AGENTS.md, instead of `isolation: worktree`, which branches with generated names.
- A5: Only the builder gets the 1h subagent cache (`experimental.cacheTtl: 1h`), not every subagent.
- A6: The lander merges green PRs per AGENTS.md, except where a project says to ask first (the homework redesign).
- A7: The `/change` skill has `disable-model-invocation: true`, so it runs only when you type it.
- A8: AGENTS.md gets a short pointer to `/change` and the roles; the detail lives in the skill.

### Open
- What "Something else" was in the Gate 0 pain answer.
- The pilot change: pick it when the build is done.

## Gate 0: what is true today

- Claude Code 2.1.288 in the grilling session; 2.1.294 installed for new sessions. Haiku 5.5 as a main model or advisor needs 2.1.293.
- Account: Pro subscription (confirmed by Jack), extra usage off.
- `~/.claude/settings.json`: model `opus[1m]`, effort `medium`. No `.claude/agents/`, no hooks, no saved workflows, no `advisorModel`.
- Built-in Explore runs on the main model, so today every search is Opus.
- Project skills: `grill`, `pset-view`. CI: `make check`.

## Built

- 2026-10-08, approved ("yes, go."). Agents in `.claude/agents/`, the skill in `.agents/skills/change/`, pointers in `AGENTS.md` and `pset-view`. The shooter uses the Playwright path from `pset-view/references/verify.md`. Explore is overridden by an agent named `Explore`.

## Reversals

## Disagreements

## Frontier

## Log

### Gate 0 facts
- Plan: "Pro"
- Pain: "Something else,Hitting usage limits,Paying Opus for grunt work,Quality slips" (the "Something else" came with no text)

### Batch 1
- Q1 Shape of a normal change: Plan file, then Sonnet (Recommended) / One Sonnet session + advisor / opusplan, one session / Opus orchestrates subagents. Answer: "Plan file, then Sonnet (Recommended)"
- Q2 Review before merge: Sonnet, escalate to Opus (Recommended) / Opus on every diff / Built-in /code-review / No separate review. Answer: "Sonnet, escalate to Opus (Recommended)"
- Q3 Haiku jobs (multi): All searching (Explore) / Running make check / Landing the PR / UI screenshots. Answer: "All searching (Explore),Running make check,Landing the PR,UI screenshots"

### Batch 2
- Q4 How the Sonnet build starts: Plan session dispatches it (Recommended) / You start a new session / One saved workflow. Answer: "Plan session dispatches it (Recommended)"
- Q5 Who judges UI screenshots: Opus, on UI changes only (Recommended) / You, always / The Sonnet reviewer. Answer: "Opus, on UI changes only (Recommended)"
- Q6 What escalates review to Opus: Flag or fixed list (Recommended) / Size of the diff / Only when you ask. Answer: "Flag or fixed list (Recommended)"
- Q7 pset-view uses the same split: Yes, same split (Recommended) / No, keep it all Opus. Answer: "Yes, same split (Recommended)"

### Batch 3
- Q8 Stuck builder: Report back to the plan session (Recommended) / Opus advisor everywhere / Advisor only in builder sessions. Answer: "Report back to the plan session (Recommended)"
- Q9 Fixes after review: Resume the same builder (Recommended) / A fresh builder / Opus fixes them. Answer: "Resume the same builder (Recommended)"
- Q10 Small changes: Skip the plan, keep review (Recommended) / Full pipeline always / Haiku does small ones. Answer: "skip the plan, keep review. But I want the orchestrator to know when these changes do not require a plan, and to confirm it with me. So the orchestrator helps decide the complexity of the problem"
- Q11 Packaging: Agents + one /change skill (Recommended) / Agents + AGENTS.md rules / Saved workflow after OK. Answer: "Agents + one /change skill (Recommended)"

### Batch 4
- Q12 Orchestrator model: Opus (Recommended) / Sonnet, Opus to plan. Answer: "Opus (Recommended)"
- Q13 Tiers: Three: quick, planned, grilled (Recommended) / Two: quick or planned. Answer: "Three: quick, planned, grilled (Recommended)"
- Q14 Rollout: Build it, pilot on one change (Recommended) / Spec only for now. Answer: "Build it, pilot on one change (Recommended)"
