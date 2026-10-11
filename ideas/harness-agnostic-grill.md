# Harness-agnostic skills and agents: grill

- status: In progress, branch `harness-agnostic` (this file is both the grilled spec and the plan; the plan is the sections after the Summary)
- date: 2026-10-10
- brief: make the /change, /pset-view and /grill stack run from any harness (Claude Code, ZCode, OpenAI Codex and the like) without forking the rules, judged from Jack's point of view: one workflow, maintained once, that works wherever he opens it
- sources:
  - .agents/skills/change/SKILL.md, references/plan-template.md, references/try.sh
  - .agents/skills/pset-view/SKILL.md and its references (grill-stages, verify, mock-layer)
  - .agents/skills/grill/SKILL.md and its references (frontier, grill-file, packs, fallback)
  - .claude/agents/*.md (builder, Explore, checker, reviewer, opus-reviewer, shooter, lander)
  - .claude/settings.json (PostToolUse hook running tools/format-file.sh)
  - ideas/agent-workflow-grill.md (the approved spec this builds on)
  - AGENTS.md (skills, models and agents, model keys, test library sections)
  - ~/.zcode/agents/general-purpose-5.3-flash.md (ZCode agent file format)
  - ZCode configuration guide (skills/commands/hooks scopes; no documented workspace agents dir)
  - Codex docs and community, Oct 2026: subagents native, delegation via AGENTS.md and skills; per-subagent model pinning in flux (multi_agent_v2)

## Summary

### In one line

The role briefs move into the skill (one source of truth), each harness keeps thin
pointer shims that pin its own models, and the skills and AGENTS.md speak judge, build
and mechanical instead of Opus, Sonnet and Haiku; Claude Code and ZCode are verified,
OpenAI is structured for and waits.

### Decisions

| #   | Decision                                                                                                                                                                         | Why                                                                   | Beat                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| D1  | First-class targets: Claude Code and ZCode now; OpenAI structured for, not verified                                                                                              | the two Jack opens; prove portability where it is cheapest to see     | all three verified now; Claude-only reference                 |
| D2  | A harness counts as working only when every role can be pinned to its own model                                                                                                  | keeps the model economy honest; a harness without pins pays the judge | procedure parity; rules parity                                |
| D3  | The seven role briefs live in `.agents/skills/change/references/roles/`; a harness's agent files are shims: name, model, tools, pointer                                          | one text to maintain; each harness keeps its pins and frontmatter     | manifest plus generator; one shared symlinked agents dir      |
| D4  | The vocabulary is judge, build, mechanical, plus a per-harness model map (Claude: opus, sonnet, haiku; ZCode: GLM-5.3 judges and builds, GLM-5.3-Flash mechanical; Codex: unset) | skill prose stays true in every harness                               | Anthropic names as labels; native names, no shared vocabulary |
| D5  | A stuck builder resumes through the harness's own mechanism (Claude by name, ZCode by agent id); where none exists a fresh builder re-reads the brief and plan file              | no new machinery; the plan file already carries the job               | handoff state file; always a fresh builder                    |
| D6  | Setup is by hand: no install tooling. ZCode shims in `~/.zcode/agents` point into the repo, so only a model id can drift                                                         | least maintenance; pointer shims keep instructions current            | install target plus SETUP doc; per-harness READMEs            |
| D7  | Model keys stay on the openrouter-keys mod (Claude only); other harnesses ask Jack in chat                                                                                       | one approval surface; no new code on the key path                     | a keys CLI for all harnesses; out of scope entirely           |
| D8  | Landing: build on a branch, pilot one real change through /change in ZCode, then merge                                                                                           | the portability claim is checked where it will be used                | land now, pilot after; spec only                              |
| D9  | The design leaves exactly one copy of each truth: briefs once, map once, setup steps once, beside the source                                                                     | maintenance weight is the regret Jack named; the pilot watches for it | duplicated per-harness copies of the rules                    |
| D10 | If the change must shrink, the OpenAI structuring cuts first; everything verified stays verified                                                                                 | verification is the value; Codex is in flux anyway                    | cutting the ZCode hook; keeping AGENTS.md as is               |

### The artifact(s)

What gets built, in one list:

- `.agents/skills/change/references/roles/`: `builder.md`, `checker.md`, `explore.md`,
  `reviewer.md`, `opus-reviewer.md`, `shooter.md`, `lander.md` (the briefs lifted from
  `.claude/agents/`, wording harness-neutral) and a `README.md` holding the model map
  and the per-harness setup steps.
- `.claude/agents/*.md` shrink to shims: frontmatter kept whole (model, tools, effort,
  `cacheTtl`), body one line pointing at the brief.
- `~/.zcode/agents/*.md`: hand-created shims (per the map: GLM-5.3 for builder and
  reviews, GLM-5.3-Flash for explore, checker, shooter, lander), pointing at the same
  briefs. Outside the repo, per machine.
- Skills prose rewritten to the role vocabulary: `change/SKILL.md` (including "You run
  on Opus" and its description), `pset-view` step 5, and AGENTS.md's "Models and
  agents" section (roles in the table, pointer to the map, Claude-specific bits
  marked as Claude's).
- `.zcode/config.json` committed with the format-file hook (the ZCode twin of
  `.claude/settings.json`), `hooks.enabled` set.
- Nothing for OpenAI: the roles vocabulary and AGENTS.md simply stop blocking it.

Acceptance, checkable by someone who did not write it:

- In Claude Code, `/change` runs as before and every role still runs on its pinned
  model; resuming `builder-<topic>` by name still works.
- In ZCode, `/change` loads, roles spawn on the mapped GLM models, and the approval
  gate (try.sh plus the ask in chat) works end to end.
- Editing one brief in `references/roles/` changes both harnesses with no other edit.
- `make check` green; `grill` untouched (already neutral).

### Assumed

- A1: Tier names judge, build, mechanical (AGENTS.md's own words).
- A2: The model map and setup steps live in `references/roles/README.md`; AGENTS.md
  points at it rather than duplicating it.
- A3: Skill frontmatter extras (`disable-model-invocation`, `argument-hint`) stay;
  harnesses that do not know them ignore them. Verify in the build.
- A4: The skills say "the harness's ask-user tool"; grill's `references/fallback.md`
  remains the no-tool fallback, unchanged.
- A5: `.zcode/config.json` is committed with the hook; it was Jack's second cut if it
  misbehaves.
- A6: The Codex column of the map stays unset until its per-agent model pinning
  settles (multi_agent_v2, in flux as of 2026-10).

### Open

- The pilot change to run through ZCode: pick when the build is done.
- Codex verification waits on multi_agent_v2 settling.
- If ZCode grows a workspace agents directory, the shims move into the repo and D6's
  hand-setup shrinks further.

## Plan

### Why

`/change`, `/pset-view` and AGENTS.md speak Claude: Opus, Sonnet, Haiku in the prose,
the seven role briefs live only in `.claude/agents/`, resumption assumes Claude's
SendMessage. The workflow cannot run from ZCode (or anything else) as designed, and
the skills already claim to be vendor-neutral.

**Decisions.** The grilled decisions D1 to D10 above; no others enter the build.

### Files

Every file the builder will touch, with what changes in it:

- `.agents/skills/change/references/roles/builder.md` (new): the builder brief, lifted
  from `.claude/agents/builder.md`, wording de-vendored (tier words for model names,
  "the harness's resume mechanism" for SendMessage, "search tools" for Grep/Glob).
- `.agents/skills/change/references/roles/checker.md` (new): from
  `.claude/agents/checker.md`, same treatment.
- `.agents/skills/change/references/roles/explore.md` (new): from
  `.claude/agents/explore.md`.
- `.agents/skills/change/references/roles/reviewer.md` (new): from
  `.claude/agents/reviewer.md`.
- `.agents/skills/change/references/roles/second-reviewer.md` (new): from
  `.claude/agents/opus-reviewer.md`, renamed (opus-reviewer was a vendor name).
- `.agents/skills/change/references/roles/shooter.md` (new): from
  `.claude/agents/shooter.md`.
- `.agents/skills/change/references/roles/lander.md` (new): from
  `.claude/agents/lander.md`.
- `.agents/skills/change/references/roles/README.md` (new): the model map (judge,
  build, mechanical; Claude: opus, sonnet, haiku; ZCode: GLM-5.3 judges and builds,
  GLM-5.3-Flash mechanical, exact ids `account:zai-individual-coding-plan/GLM-5.3`
  and `account:zai-individual-coding-plan/GLM-5.3-Flash`; Codex: unset, pinning in
  flux as of 2026-10), the roles table, the per-harness setup steps, and the drift
  rule (shims stay pointers; only a model id can drift, and only by hand).
- `.claude/agents/builder.md` (rewrite): shim only. Frontmatter kept whole (model,
  tools, effort, cacheTtl, color; description de-vendored), body one line pointing at
  `references/roles/builder.md`. Same for `checker.md`, `explore.md` (its `name:`
  stays `Explore`, capital E, to keep overriding Claude's built-in), `reviewer.md`,
  `shooter.md`, `lander.md`.
- `.claude/agents/opus-reviewer.md` (rename to `second-reviewer.md` via git mv, then
  shim as above; its `name:` becomes `second-reviewer`).
- `.agents/skills/change/SKILL.md` (rewrite prose): description frontmatter and body
  speak roles and tiers, not models; "You run on Opus" becomes the judge tier on the
  session's strongest model; step 4's "resume it with SendMessage to builder-<topic>"
  becomes the harness's own resume mechanism with the plan file as the fallback (D5);
  role names updated (opus-reviewer → second-reviewer). The tiers, the gate, try.sh
  and every step's substance stay as they are.
- `.agents/skills/pset-view/SKILL.md` (step 5 only): "the Sonnet builder subagent"
  becomes "the builder (build tier)"; "stay in the Opus session" becomes "stay with
  the orchestrator".
- `.zcode/config.json` (new): `{"hooks":{"enabled":true,"events":{"PostToolUse":[{"matcher":"Write|Edit","hooks":[{"type":"command","command":"\"${ZCODE_PROJECT_DIR}\"/tools/format-file.sh","timeout":120}]}]}}}`,
  the ZCode twin of `.claude/settings.json`'s format hook (timeout is in seconds for
  a command hook).
- `AGENTS.md` (Models and agents section only): the intro and the table in role
  vocabulary (role, tier, job); models live in the map, linked; the shims named
  (Claude's committed in `.claude/agents/`, ZCode's per machine in
  `~/.zcode/agents/`); the keys mod stays Claude-only, unchanged; the drift rule
  stated. Nothing else in AGENTS.md moves.
- `ideas/README.md` (one row): Harness-agnostic roles, In progress, branch
  `harness-agnostic`.
- `ideas/harness-agnostic-grill.md` (this file): status updates only.

Not touched: `.agents/skills/grill/` (already neutral, verified), `CLAUDE.md`,
`tools/format-file.sh` (its stdin path already parses the hook JSON), any code under
`cmd/`, `internal/` or `web/`.

### Steps

1. `git mv .claude/agents/opus-reviewer.md .claude/agents/second-reviewer.md`.
2. Create the seven briefs under `.agents/skills/change/references/roles/`, lifting
   each body from its `.claude/agents/` file and de-vendoring the wording. The
   briefs keep their rules verbatim where the rules are true in any harness:
   worktree discipline, report formats, read-only scope, escalation list, the
   lander's two modes, the shooter's scratch directory and port rules.
3. Shrink the seven `.claude/agents/*.md` to shims (frontmatter whole, descriptions
   de-vendored, body the one-line pointer).
4. Write `references/roles/README.md` (map, roles table, setup steps, drift rule).
5. Rewrite `change/SKILL.md` prose to roles and tiers.
6. Fix `pset-view/SKILL.md` step 5.
7. Add `.zcode/config.json`.
8. Rewrite AGENTS.md's Models and agents section.
9. Add the `ideas/README.md` row; set this file's Status line.
10. `make fmt`, then `make check`, in the worktree; fix what they find.

### Tests

`make check` (fmt-check judges the new Markdown and JSON; nothing else in the change
is executable). Structural checks, run and reported by the builder:

- `grep -rn 'Opus\|Sonnet\|Haiku\|SendMessage' .agents/skills/change .agents/skills/pset-view AGENTS.md`
  returns hits only where a vendor model is legitimate: the map, the shim
  frontmatter (`model:`), and the keys mod paragraph.
- Every `.claude/agents/*.md` body is exactly the pointer line; every brief exists
  once under `references/roles/`.
- `jq . .zcode/config.json` parses; the matcher is `Write|Edit`; `hooks.enabled` is
  true.

Next-session checks (recorded as not checked in the PR, they need a fresh session):
ZCode loads the seven shims from `~/.zcode/agents` and `/change` spawns them on the
mapped models; Claude Code `/change` behaves as before.

### Acceptance

What done looks like, checkable by someone who did not write it:

- The role instructions exist in exactly one place, `references/roles/`; editing a
  brief there changes every harness with no other edit.
- The three skills and AGENTS.md read in tier words; only the map and the shim
  frontmatter name vendor models.
- `make check` is green.

### Out of scope

- The OpenAI/Codex column of the map (unset until its per-agent pinning settles).
- The `~/.zcode/agents` shim files themselves: machine setup outside the repo,
  created per the README's setup steps, not part of this PR.
- The openrouter-keys mod, any keys change.
- The pilot change through `/change` in ZCode (follows this landing).
- The grill skill (already neutral; verified, untouched).

## Reversals

None. The agent-workflow grill's decisions (tiers, the gate, the model-tier philosophy)
stand; only their Anthropic naming is replaced.

## Disagreements

D2 and D6 were chosen against the recommendation without push-back; both were coherent
with earlier answers, so they were recorded as decisions rather than argued.

## Frontier

(empty: every gate ended 2026-10-10)

## Log

### Batch 3 (2026-10-10, the tail: tiers, regret, cut line)

- ZCode models: GLM-5.3 + Flash tiers (Recommended) / Flash builds too / Decide at install time. Answer: "GLM-5.3 + Flash tiers (Recommended)"
- Regret risk: Silent divergence (Recommended) / Claude regression / Gate friction in ZCode / Maintenance weight. Answer: "Maintenance weight"
- Cut line: Cut OpenAI first (Recommended) / Cut the ZCode hook / Keep AGENTS.md as is / Nothing: it is minimal. Answer: "Cut OpenAI first (Recommended)"

Folded: D4's ZCode column, D9 (one copy of each truth, the pilot's watch item), D10.

### Batch 2 (2026-10-10, resume, setup, keys, rollout)

- Q5 Resume: Harness resume + plan file (Recommended) / Handoff file in worktree / Always a fresh builder. Answer: "Harness resume + plan file (Recommended)"
- Q6 Setup: Install target + SETUP.md (Recommended) / Manual README per harness / Nothing: hand-setup only. Answer: "Nothing: hand-setup only"
- Q7 Keys: Claude mod only, else ask (Recommended) / A keys CLI for all harnesses / Out of scope for now. Answer: "Claude mod only, else ask (Recommended)"
- Q8 Rollout: Pilot in ZCode first (Recommended) / Land now, pilot after / Spec only. Answer: "Pilot in ZCode first (Recommended)"

Folded: D5, D6 (against the recommendation), D7, D8. Pointer shims noted as what makes
hand-setup safe: only a model id can drift, instructions cannot.

### Batch 1 (2026-10-10, scope and architecture)

- Q1 Harnesses: Claude + ZCode now (Recommended) / All three verified / Claude reference only. Answer: "Claude + ZCode now (Recommended)"
- Q2 Parity bar: Procedure parity (Recommended) / Full model parity / Rules parity only. Answer: "Full model parity"
- Q3 Role briefs: Briefs in the skill (Recommended) / Manifest + generator / One shared agents dir. Answer: "Briefs in the skill (Recommended)"
- Q4 Model names: Roles + per-harness map (Recommended) / Anthropic names as labels / Native names everywhere. Answer: "Roles + per-harness map (Recommended)"

Decisions folded: D1 (Claude + ZCode first-class, OpenAI structured for), D2 (a harness
works only when every role can be pinned to its own model; consequences: Codex is out
of scope until its pinning settles, and ZCode's per-machine shims are load-bearing),
D3 (briefs in .agents/skills/change/references/roles/, shims point at them), D4 (judge,
build, mechanical vocabulary plus a per-harness model map).

### Gate 0 facts (2026-10-10)

- The stack: /change orchestrates (triage, tier, plan, dispatch, judge, gate, merge);
  /pset-view is the view domain skill (redesign, tweak, extract) that hands /grill a
  brief; /grill is the interview engine. All three live in .agents/skills, which
  AGENTS.md already calls the vendor-neutral place, and .claude/skills is a symlink to
  it. ZCode reads .agents/skills natively.
- Already portable: the skills' home, grill's ask-user fallback (references/fallback.md),
  try.sh and format-file.sh (plain bash), the make targets, gh, AGENTS.md itself.
- Claude-bound today: the seven agent files in .claude/agents (frontmatter: model
  opus/sonnet/haiku, tools, effort, cacheTtl); Anthropic model names in the prose of
  change/SKILL.md, its frontmatter description, pset-view step 5, and AGENTS.md's
  models table; resumption by SendMessage to builder-<topic>; the ask-user tool name;
  the PostToolUse hook format in .claude/settings.json; disable-model-invocation and
  argument-hint frontmatter; the openrouter-keys mod (~/.claude/mods, loaded via
  CLAUDE_CODE_PLUGIN_DIRS).
- ZCode: agents are markdown + frontmatter (name, description, color, model id,
  thoughtLevel, injectAgentsMd) at user scope ~/.zcode/agents; no workspace agents
  directory is documented; skills, commands, hooks and MCP do have workspace scope
  (.zcode/ or .agents/). Hooks need hooks.enabled in config.
- OpenAI Codex (Oct 2026): subagents are native and follow AGENTS.md and skill
  instructions that request delegation; the Codex app runs parallel agents on
  worktrees; per-subagent model and reasoning pinning is in flux under multi_agent_v2
  (5.6 reports say those fields are restricted). AGENTS.md is the native instruction
  file.
- Unknown: what exactly Jack means by OpenAI (Codex CLI assumed); whether he wants the
  same subagent economy on every harness or is content with the pipeline running.
