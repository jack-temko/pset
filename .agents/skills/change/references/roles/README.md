# Roles

The `/change` workers: one brief per role in this folder, one model map, one set of
setup steps per harness. Each harness's agent files are shims whose body is a pointer
at a brief here, so the role instructions exist in exactly one place. Spec and
reasons: `ideas/harness-agnostic-grill.md`.

## The model map

The judge tier judges, the build tier builds, the mechanical tier does the mechanical
work. Which model each tier runs on, per harness:

| Tier       | Claude Code | ZCode                                              | Codex |
| ---------- | ----------- | -------------------------------------------------- | ----- |
| judge      | `opus`      | `account:zai-individual-coding-plan/GLM-5.3`       | unset |
| build      | `sonnet`    | `account:zai-individual-coding-plan/GLM-5.3`       | unset |
| mechanical | `haiku`     | `account:zai-individual-coding-plan/GLM-5.3-Flash` | unset |

Codex is unset on purpose: its per-agent model pinning is in flux (`multi_agent_v2`,
as of 2026-10). A harness counts as working only when every role can be pinned to its
own model, so Codex waits for that to settle.

## The roles

| Role              | Tier       | Job                                                                           |
| ----------------- | ---------- | ----------------------------------------------------------------------------- |
| `Explore`         | mechanical | every codebase search (replaces the harness's built-in one)                   |
| `builder`         | build      | builds the plan in the worktree; stops and reports when stuck                 |
| `checker`         | mechanical | `make check`, returning only the failures                                     |
| `reviewer`        | build      | reads the plan and the diff; escalates risky or unsure changes                |
| `second-reviewer` | judge      | the second review, for escalated changes                                      |
| `shooter`         | mechanical | screenshots of changed UI states, Paper and Night                             |
| `lander`          | mechanical | push and open the PR; after Jack approves, CI, squash-merge, worktree removal |

## Setup, per harness

- **Claude Code**: nothing to do. The seven shims are committed in `.claude/agents/`
  and pick up these briefs through their pointer line. The explore shim keeps
  `name: Explore`, capital E, so it overrides Claude's built-in Explore.
- **ZCode**: ZCode reads agents from `~/.zcode/agents/`, per machine (it has no
  workspace agents directory yet). Create the seven shims there, one file per role,
  with this frontmatter (shown for the build tier; the mechanical roles take
  `account:zai-individual-coding-plan/GLM-5.3-Flash`), then restart the session:

  ```markdown
  ---
  name: 'builder'
  description: 'PSet build-tier role: builds one planned change in the worktree the caller names, from a plan file in ideas/ or a short brief. Stops and reports when stuck instead of guessing.'
  color: green
  model: 'account:zai-individual-coding-plan/GLM-5.3'
  injectAgentsMd: true
  ---

  Follow `.agents/skills/change/references/roles/builder.md` from the repository root of the worktree you were named. That file is your whole brief.
  ```

- **A new harness**: add a column to the map above, then create shims as pointers:
  frontmatter pinning its models per role, body the one pointer line. Until every
  role can be pinned to its own model, the harness does not count as working.

## The drift rule

Shims stay pointers into this folder. Instructions change only here, once, and every
harness follows on its next run with no other edit. The only thing that can drift is
a model id in a shim's frontmatter, and only by hand.
