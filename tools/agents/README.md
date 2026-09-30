# agents

The model team, run on one change at a time. Opus writes the spec, the
cheapest model that can do each task builds it, and a reviewer that has
never seen the work checks each task against the spec before the next
one starts.

Nothing depends on one model remembering what another said. The spec in
`ideas/<topic>.md` is the whole brief, `make test` runs as a Stop hook so
an implementer can't hand back red work, `make check` runs after every
round, and review findings are written to be fixed by a smaller model,
not by the reviewer.

## Roles

| Role | Model | Does |
|---|---|---|
| Architect | Opus | Writes the spec: why, what's decided, and the tasks, each with its files, what to do and how to tell it's done. No code. |
| Reviewer | Opus (Sonnet with `-reviewer sonnet`) | A fresh session per review, with the spec and the diff. Findings only, no fixes. |
| Workhorse | Sonnet | Tasks that cross Go and TypeScript through the wire types, UI work that needs judgment, subtle data or concurrency changes. |
| Implementer | GLM-5.3 | A well-specified change in one layer. |
| Mechanic | GLM-5.3-Flash | Renames, docs, test scaffolding, a pattern repeated. |

The spec gives each task its model: `- [ ] 2. (glm) ...`. A model gets two
rounds at a task (its first, and one to fix what the gate or the review
found), then the next one up takes over from where it got to: flash, glm,
sonnet. A task still failing with Sonnet stops the build: the task is
wrong, not the implementer, so rework it in the spec.

## Setup

GLM runs in Claude Code against Z.ai's Anthropic-compatible endpoint on
the coding plan. The loop reads the plan's key from `ZAI_API_KEY`:

```sh
export ZAI_API_KEY=...   # in ~/.bashrc
```

The Claude models use your Claude Code login. To run GLM by hand, gated
the same way the loop runs it:

```sh
glm() {
  PSET_GATE=1 ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic \
  ANTHROPIC_AUTH_TOKEN="$ZAI_API_KEY" API_TIMEOUT_MS=3000000 \
  ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.3 ANTHROPIC_DEFAULT_SONNET_MODEL=glm-5.3 \
  ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-5.3-flash \
  claude --model glm-5.3 "$@"
}
```

## One change, in order

```sh
go run ./tools/agents plan <topic> "<the brief>"
```

Makes the worktree `../pset-<topic>` on branch `<topic>` (AGENTS.md), and
Opus writes `ideas/<topic>.md` and its row in `ideas/README.md`, then
commits them. **Read the spec before building.** It's the one place a
wrong decision is cheap to fix: edit it, commit, or plan again with more
brief (it revises the spec in place).

```sh
go run ./tools/agents build [-reviewer sonnet] <topic>
```

Builds the open tasks in order. Each task is one commit, amended round by
round, and its box is ticked in the same commit when the review approves
it. When every task is done, the reviewer reads the whole branch against
the spec. Use `-reviewer sonnet` for a routine change, and keep Opus for
anything touching the schema, the wire types, or the finding and model
pipelines.

```sh
go run ./tools/agents review [-reviewer sonnet] <topic>
```

The whole-branch review alone, after changing something by hand.

Then, by hand, as AGENTS.md says: look at any UI change in the app in both
themes, bring `main` in, and merge.

## What it leaves where

- Commits on the topic's branch, in its worktree. Nothing in your checkout.
- Every session's output in `.git/agents/<topic>/`, named by time, step
  and model, and what a failed task had left to fix. Open any session
  with `claude --resume <session_id>` from the worktree.
- The Claude spend of the run, printed at the end. GLM isn't counted:
  the coding plan is flat.

## The hook

`.claude/settings.json` runs `gate.sh` whenever a session stops. It does
nothing unless `PSET_GATE` is set, which the loop sets for implementers
only, so your own sessions stop as usual. Gated, it runs `make gen test`
and sends the failures back, three times at most, then lets the session
stop and the loop's `make check` decide.
