# OpenRouter keys mod: grill

- status: approved; v1 built 2026-10-07 (the mod lives outside the repo, see Build notes)
- date: 2026-10-07
- brief: a Claude Code mod that lets the agent ask for capped OpenRouter keys that Jack approves, shows every key's spend from the OpenRouter API, deletes keys, and logs PSet's requests. Judged from Jack watching and paying for an agent's work, and from the agent that needs a key to test PSet.
- sources: `internal/llm/calllog.go`, `cmd/pset/main.go`, `ideas/model-usage.md`, `.gitignore`, the earlier `usage-band` mod, the plugin-authoring API (`$.http`, `$.tool`, `$.fs`, `$.process`, secret `userConfig`), OpenRouter's [key management API](https://openrouter.ai/docs/features/provisioning-api-keys) and [activity endpoint](https://openrouter.ai/docs/api/api-reference/analytics/get-user-activity-grouped-by-endpoint.md), the eval-key rule in Claude's memory

## Summary

### In one line
When an agent needs a model, it calls a mod tool to ask for a key for its worktree. Jack approves it with a cap in a pane card, the mod creates it with OpenRouter's management API and writes it to the worktree's `.dev/openrouter.key`, and the key is deleted when the worktree goes. The pane lists every key's spend, and (in v2) a request log.

### Facts that shaped it
- OpenRouter's management key can list keys (spend today, this week, this month and lifetime, the cap, what's left), create a key with a cap, change it, disable it and delete it. A new key's secret comes back only once, at creation.
- OpenRouter has no per-request list. `/activity` gives daily totals per model, can be filtered to one key, and covers only finished UTC days.
- PSet already writes every call to `<data>/logs/llm.jsonl`: model, job, time, tokens, cost and error. Each worktree's `make dev` has its own `.dev/data`. `.dev/` is gitignored.

### Decisions
| # | Decision | Why | Beat |
|---|---|---|---|
| D1 | A key's secret is written to `<worktree>/.dev/openrouter.key` (mode 600). The tool result says the path, never the secret. | The secret never enters the transcript; `.dev/` is ignored by git | in the tool result; straight into `.dev/data` settings |
| D2 | The management key is a secret `userConfig` field of the mod. | Claude Code holds it, outside the repo and the mod folder; the agent never sees it | a file Jack owns |
| D3 | Approval is a card in the pane: key name, worktree, why, the suggested cap, buttons for $1, $5 and a custom amount, a daily-reset toggle, then Approve or Deny. A request opens the pane by itself, and the agent waits for the answer. | Jack sets each cap with the reason in front of him | toast plus /keys; plain allow/deny with a fixed cap |
| D4 | The agent may request a key, ask to raise a cap (needs approval) and delete keys it created. Everything else is Jack's. | Cleanup without clicks; money moves only with Jack | request only; raise caps up to a ceiling on its own |
| D5 | Each key belongs to one worktree. When that folder is gone, the mod deletes the key and its file. | Nothing lingers after a merge | Jack deletes by hand; expire after a fixed time |
| D6 | One key per worktree: a second request from the same worktree reuses its key or becomes a request to raise the cap. | Spend is per piece of work; fewer approvals | a key for every request |
| D7 | The pane lists every key on the account with its spend. Agent keys are tagged with their worktree, and Jack can delete any key after a confirmation. | One place for all spend, Jack's own instance included | only agent keys |
| D8 | Surfaces: the pane, plus a status line entry with today's spend on agent keys that lights up while a request waits. | Glanceable without taking up a row | pane only; band above the prompt |
| D9 | The request log merges live rows from each worktree's `llm.jsonl` with OpenRouter's daily totals per key. | Live detail, plus the official numbers | local logs only; OpenRouter only |
| D10 | A log row shows time, worktree, job, model, tokens, cost and seconds, with a mark for failures. Clicking it shows the full error and the reply's last lines. Prompts stay in the file. | Enough to see what's going on without a heavy pane | summary rows only; everything including prompts |
| D11 | The default suggested cap is $1 total, with no reset. | A runaway loop stops at a dollar | $1 a day; $5 total |
| D12 | The shared `key.txt` eval key is retired once the mod works: Jack deletes it in the pane, and the eval-key memory and the `PSET_EVAL_KEY` notes then say to ask the mod. | One way to get a key, and every key capped | keep it as a fallback |
| D13 | PSet only for now: it knows `.dev/` paths and PSet job names. | Smaller; making it general later is mostly about paths | any repo |
| D14 | If Jack is away, the request waits and he gets a push notification. The agent goes on with work that needs no model, or stops and says it's waiting. | No key is created without him, and nothing is lost | deny after 10 minutes |
| D15 | v1 is the keys (list, request, approve, raise, delete, cleanup with the worktree) and the status line. v2 is the request log. | Keys are what change how the agent works | everything at once; log first |

### The artifacts

**The tool the agent calls**

| Tool | Input | Result |
|---|---|---|
| `request_openrouter_key` | `worktree`, `why`, `cap` (default $1) | waits for Jack, then returns `approved, cap $X, key at <path>` or `denied: <reason>` |
| `delete_openrouter_key` | `worktree` | deletes that worktree's key, if the agent created it |

**Pane, top to bottom**
1. A waiting request card, if there is one (D3).
2. Keys: name, worktree tag or "yours", spend today and lifetime against the cap as a meter, reset, and Delete with a confirmation.
3. (v2) Request log, newest first (D10), with OpenRouter's daily totals per key above it.

**Key states**: waiting for approval, live, near its cap (at or above 80%), at its cap, worktree gone (being deleted), denied.

### Assumed
- A1: Worktrees are found with `git worktree list` in `/home/jackt/dev/pset`. A key is named `claude:<branch>` so it can be matched to its worktree and recognised as the agent's.
- A2: Key spend is refreshed from `GET /api/v1/keys` every 60 seconds, on opening the pane, and after every change (the mod can't tell whether the pane is open).
- A3: The pane opens with `/keys` (or `/openrouter-keys` if that name is taken).
- A4: The mod lives in its own folder outside the repo; this spec is its record in `ideas/`.
- A5: Cleanup checks for worktrees that are gone when the session starts and on each refresh.

### Open
- Whether `limit_reset` can be set when a key is created, or only by a follow-up PATCH. The docs show it on PATCH only. Check this when building.
- Whether a management key can also check the account's remaining credit (`/credits`), worth one line in the pane.

### Build notes (v1, 2026-10-07)
- The mod is `openrouter-keys`, in Claude Code's dev-mods folder for the session that built it (`~/.claude/dev-mods/<session>/openrouter-keys/`), not in this repo. To load it in other sessions, add that folder to `CLAUDE_CODE_PLUGIN_DIRS`, or publish it as a marketplace.
- A hook gets 10 seconds of its own time, so `request_openrouter_key` can't wait for Jack. It returns at once, and his Approve or Deny reaches the agent as a message (`$.prompt.submit`), which wakes an idle session. This is how D14 works.
- The push in D14 is sent by the agent: the tool's result tells it to send one. A mod has no push call of its own.
- The management key is entered once in the pane, which saves it to the mod's secret setting with `$.config.set`. If Claude Code refuses to set a secret field that way, it goes in the mod's settings by hand.
- The pane has a $1 / $5 / custom cap, a daily-reset toggle, Approve and Deny. Agent keys are listed first, and Delete asks for confirmation inline.
- Tests: `claude plugin test` refuses Jack's checkout and stray paths, and covers an approved request (a capped POST, the secret written only to the worktree file, a message naming the path and not the secret).

## Reversals
- The eval-key rule (Claude's memory, 2026-09-29/30: use the one key in `key.txt`) is replaced by D12 once the mod works. Jack asked for this ("let it manage keys as well. So if an agent needs one it can request it and I can approve it with a cap").

## Disagreements
None.

## Frontier
Empty.

## Log

**Gate 0, Jack's correction (verbatim):** "I'd prefer you get this information from the OpenRouter API, and let it manage keys as well. So if an agent needs one it can request it and I can approve it with a cap. And delete them."

**Batch 1**
- When you approve a key, how does its secret reach me? Options: File in my worktree (Recommended) / In the tool result / Straight into .dev/data settings. Answer: "File in my worktree (Recommended)".
- Where does the request log come from? Options: Both, merged (Recommended) / PSet's local logs only / OpenRouter only. Answer: "Both, merged (Recommended)".
- What should the approval look like when I ask for a key? Options: Card in the pane, cap prefilled (Recommended) / Toast plus /keys command / Plain allow/deny, fixed cap. Answer: "Card in the pane, cap prefilled (Recommended)".
- Where should the management key be stored? Options: Mod's secret setting (Recommended) / A file you own. Answer: "Mod's secret setting (Recommended)".

**Batch 2**
- What may I do with keys myself, without asking you? Options: Request, and delete my own (Recommended) / Request only / Request, delete my own, raise caps up to a ceiling. Answer: "Request, and delete my own (Recommended)".
- When does a key I asked for go away? Options: When its worktree is gone (Recommended) / You delete it from the pane / Expire after a set time. Answer: "When its worktree is gone (Recommended)".
- Which keys does the pane list? Options: All keys, mine marked (Recommended) / Only keys I made. Answer: "All keys, mine marked (Recommended)".
- Where does it show up, beyond the pane? Options: Pane + status line (Recommended) / Pane only / Pane + band above the prompt. Answer: "Pane + status line (Recommended)".

**Batch 3**
- What does one request log row show, and what opens when you click it? Options: Summary row, opens to reply + error (Recommended) / Summary rows only / Everything, prompt included. Answer: "Summary row, opens to reply + error (Recommended)".
- What cap should I suggest by default? Options: $1 total (Recommended) / $1 a day, resetting / $5 total. Answer: "$1 total (Recommended)".
- What happens to the shared eval key in key.txt? Options: Retire it once the mod works (Recommended) / Keep it as a fallback. Answer: "Retire it once the mod works (Recommended)".
- Is this mod for PSet only, or for any project? Options: PSet only for now (Recommended) / Any repo. Answer: "PSet only for now (Recommended)".

**Batch 4 (the tail)**
- If you're away when I ask for a key, what happens? Options: I wait, and you get a push (Recommended) / Deny after 10 minutes. Answer: "I wait, and you get a push (Recommended)".
- If you had to halve it, what ships first? Options: Keys first, log second (Recommended) / Everything at once / Log first. Answer: "Keys first, log second (Recommended)".
- Can several sessions or subagents each ask for their own key? Options: One key per worktree (Recommended) / One key per request. Answer: "One key per worktree (Recommended)".
