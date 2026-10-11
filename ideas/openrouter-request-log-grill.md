# OpenRouter request log (keys mod v2): grill

- status: approved and built 2026-10-08 (in the mod, outside the repo; see Build notes)
- date: 2026-10-08
- brief: v2 of the openrouter-keys mod, a log of the requests made on the PSet workspace's keys, judged from Jack watching what agents spend and why
- sources: `ideas/openrouter-keys-grill.md` (D9, D10, D15 and the Build notes), the mod (`~/.claude/mods/openrouter-keys`), `internal/llm/calllog.go`, OpenRouter's analytics schema (dimensions, the 2-dimension limit, minute granularity for 3 hours or less), `GET /generation`

## Summary

### In one line (as built: the live feed)

Under the keys, a **Live** section shows the latest 12 requests on the PSet workspace's keys, newest on top, with older rows fading and dropping off as new ones arrive. Each row has a status dot, the time, the **model**, the job and where it ran, tokens and cost. A line above says whether tokens are being used right now, and a red banner appears when a model fails repeatedly. There's nothing to open: it's for watching, not inspecting.

### In one line (as first grilled; superseded by the feed)

A section under the keys lists the last 24 hours of requests on the PSet workspace's keys. The rows come from OpenRouter's analytics API, grouped by PSet job, with job names, errors and replies added from the worktrees' local logs. It refreshes every 30 seconds.

### Facts that shaped it

- OpenRouter's analytics can break results down by `generation_id` (one row per request) and by `session_id`, for up to 31 days. A query takes two dimensions at most and can be filtered by key. Minute buckets are available only for windows of 3 hours or less.
- `GET /generation?id=` gives one request's model, provider, tokens, cost, latency and finish reason.
- PSet sends a session id per job, and `make dev` writes every call to `<worktree>/.dev/data/logs/llm.jsonl`: the job, the question, the session, model, tokens, cost, error, prompt and reply. Go evals and scripts write nothing locally.
- How quickly a request reaches the analytics isn't documented. The v1 tiles showed today's spend within minutes.

### Decisions: the feed (2026-10-08, Jack's redesign; supersedes R3, R5, R7 and changes R4, R8, R9)

| #   | Decision                                                                                                                                                                                                                                                                      | Why                                                  | Beat                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| F1  | A flat feed of single requests, newest on top. The latest 12 show, and older ones fade and drop off as new ones come in.                                                                                                                                                      | To see requests as they arrive, not to dig into them | jobs grouped and expandable (R3, R5)    |
| F2  | No expanded view and no call details.                                                                                                                                                                                                                                         | Watching, not inspecting                             | click for details (R7)                  |
| F3  | Every row shows the model, in bold. A row reads: status dot, time, model, job ("Walkthrough 4.69") and where it ran ("eval w6", a worktree's branch, "your PSet"), tokens, cost. A failure shows its error ("HTTP 401") in red in place of the tokens.                        | Jack asked for the model on the page                 | a job row first (R8)                    |
| F4  | A line above the feed: "● Using tokens · 41k tokens · $0.08 in the last minute" in Claude's orange, or "Idle · last call 4m ago".                                                                                                                                             | Know at a glance when tokens are being spent         | nothing                                 |
| F5  | A red banner when a model fails 3 or more times within 10 minutes: "Repeated failures: gemini-3.8-flash. 4 of the last 6 calls failed in 10 minutes (HTTP 401) · Walkthrough 4.71 · eval w6". Status dots: red failed, amber cut off, orange in the last minute, grey before. | Watch for repeated failures                          | a mark per job (R9)                     |
| F6  | It covers the last 3 hours and refreshes every 10 seconds. PSet's own calls appear from the worktrees' logs straight away, before the analytics have them.                                                                                                                    | Close to live                                        | the last 24 hours every 30 seconds (R4) |

### Decisions: as first grilled

| #   | Decision                                                                                                                                                                                                                    | Why                                                                                               | Beat                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| R1  | Rows come from OpenRouter's analytics API, one per request. Where a worktree's `llm.jsonl` has the same call, the row also gets PSet's job and question, the full error and the reply's last lines.                         | Every call is counted, evals and scripts included, and PSet's own detail is added where it exists | API only; the local log only (D9 as written)            |
| R2  | The log is a section under the keys in the keys pane.                                                                                                                                                                       | One place for everything                                                                          | its own pane (recommended); tabs                        |
| R3  | Requests are grouped by PSet job (session): one row per job, which opens to its calls.                                                                                                                                      | A walkthrough's find, read and guide read as one thing                                            | flat, newest first; grouped by key                      |
| R4  | It covers the last 24 hours, refreshing every 30 seconds while the pane is open. A Key dropdown narrows it to one key.                                                                                                      | Matches the tiles; new work shows within half a minute                                            | last 3 hours by the minute; a range picker              |
| R5  | The latest 8 jobs show, with Show more adding 8 at a time. A running job stays at the top.                                                                                                                                  | Keeps the pane a sensible height under the keys                                                   | the whole day; collapsed until opened                   |
| R6  | Requests with no PSet job (evals, scripts) form one "Other" row per key for the day.                                                                                                                                        | Compact                                                                                           | bursts of calls per key (recommended); one row per call |
| R7  | A job's calls show time, model, tokens in and out, cost and seconds. Clicking a call adds provider and finish reason, plus the full error and the reply's last lines from the local log. Prompts stay in the file (as D10). | Enough to see why something failed without a heavy pane                                           | everything inline; summary only                         |
| R8  | A job row says what it was, then the numbers: "Walkthrough · 4.25 · haiku-eval", then calls, tokens, cost and time. Without a local log it's "Session 3f9a…".                                                               | Says what the money bought                                                                        | numbers first                                           |
| R9  | Jobs over $0.25 get an amber mark and failed jobs a red one. No toasts.                                                                                                                                                     | Visible when Jack looks, never interrupting                                                       | marks and toasts; no marks                              |
| R10 | First the API rows (jobs, calls, numbers, failures), then the local details (job names, errors, replies).                                                                                                                   | The API rows are the log; the local details are an extra layer                                    | everything at once                                      |

### The artifact as first grilled (superseded by F1 to F6)

1. A **Requests** heading with a **Key** dropdown (All keys, or one key).
2. **Job rows**, newest first, 8 at a time. Each shows: the job's name and question, or "Session …", and its key; the number of calls, tokens, cost and duration; an amber or red mark when one applies; and a chevron that opens it.
3. **Calls** in an open job: time, model, tokens in and out, cost, seconds. Clicking one adds provider, finish reason, the error and the reply's last lines.
4. **"Other · <key>"** rows for calls with no job, opening the same way.
5. **Show more**, adding 8 more jobs.

### Assumed

- A1: A job is matched to local log rows by session id. Its calls are matched by model and time, within 2 seconds.
- A2: The local logs read are each live worktree's `.dev/data/logs/llm.jsonl`, the last 24 hours only, tailed rather than read whole (a log can reach 20 MB).
- A3: "Running" means a job whose last call was less than 2 minutes ago.
- A4: An open "Other" row lists 50 calls at a time.

### Build notes (2026-10-08)

- **Analytics, confirmed live.** Breaking down by `generation_id` works with a key filter. Four queries over the last 24 hours, each by `generation_id` plus one of `session_id` (with spend and tokens), `api_key_id` (it returns the key's name), `model` and `finish_reason`, are joined on the generation id. Each takes about 0.1 to 0.6 s. A generation id carries its unix second (`gen-1791433970-…`), so calls get exact times without minute buckets. Calls with no session come back as `none`.
- **Seen finish reasons:** stop, tool_calls and length (shown as "Cut off"). Failed requests aren't in the analytics.
- **Job names** come from PSet's session ids: `pset-<tag>-question-<id>-guide|locate|read`, `-assignment-`, `-ask-`, `-rank-`, `-book-<id>-import|prepare`. These read as Walkthrough, Finding, Reading, Assignment read, Ask, Ranking, Book import and Book prep. The tag is the first 4 bytes of the SHA-256 of the data folder's path (`installTag` in `cmd/pset/main.go`). The mod hashes each worktree's `.dev/data`, Jack's library, and every folder with a `pset.db` in the sessions' scratchpads (agents' eval runs, named "eval <folder>"), so a job says where it ran.
- **Local details** (phase 2) come from `scripts/local-detail.py` in the mod. For the data folders behind the visible jobs, it reads the questions' labels (read only) and the last day of `logs/llm.jsonl`: session, time, model, error and the reply's last 400 characters. It never reads prompts or settings. A logged call joins the analytics call in the same session within 5 seconds, which replaces A1's model match: the logged model is the one asked, the analytics model the one that answered. A failed call OpenRouter never billed joins its job as "Failed", and its job gets the red mark. In the first eval folder tried, 38 of 275 calls had failed with HTTP 401.
- **The feed (F1 to F6)** is drawn as one SVG, like the tiles, so the columns line up and the rows fade; the terminal gets plain text lines instead. Calls in the local logs that the analytics don't have yet join with the tokens and cost PSet logged, so PSet's calls show at once. The details on click and the job grouping were built first and then taken out for the feed.
- **Refresh:** the feed every 10 seconds over the last 3 hours; the keys and tiles every 30 seconds. The mod can't tell whether the pane is open.
- **For agents:** `list_openrouter_keys` also reports the five most recent jobs (last 3 hours).
- **Tests:** a fifth `claude plugin test` case puts analytics rows into the feed with model, job and tokens, and a call with no session as Other.

### One poller for every pane (2026-10-08)

Every Claude Code session loads the mod, and each one used to poll OpenRouter on its own. With four sessions open, that was about 120 analytics calls a minute, and OpenRouter answered **429 Rate limit exceeded**: errors, and sections that wouldn't load. Jack: "All panes should share the same data, and only one thread populating the source."

- **One poller.** Only the session holding a lease (`~/.claude/mods/openrouter-keys-shared/lease.json`, renewed every 5 seconds, free after 20 seconds without renewal) calls OpenRouter. It writes keys, tiles and feed to `data.json` in the same folder (written beside the file and moved over it, so a reader never sees half a file). If that session closes, another takes the lease within about 20 seconds.
- **Every pane reads the same file** every 5 seconds and redraws only what changed.
- **Pending requests and the agent-key registry** are shared files too (`requests.json`, `agent-keys.json`; the registry moved from `$.store`). A request shows in every pane, and approving it in any pane sends the answer to the session that asked (`$.session.send`, or its own prompt when it's the same session).
- **Kicks.** Refresh and any action (approve, deny, delete, a new management key) write `kick.json`, and the poller fetches everything on its next tick. Agents' `list_openrouter_keys` reads the shared data and never forces a fetch.
- **Intervals:** keys every 60 seconds, the feed's analytics every 30, the tiles every 5 minutes, the local logs every 10 (no OpenRouter calls). The feed's analytics are 3 queries; the finish-reason one went, so "Cut off" only comes from the local logs.
- **429s.** After one, nothing calls OpenRouter for 2 minutes, in any session (the pause is in `data.json`). The pane says so in dim text and keeps showing the last data.
- **The tiles count the whole account,** every workspace and deleted keys included, so they match what OpenRouter charges. A line under them says so. Before, they counted only the workspace's live keys, so spend on deleted keys dropped out.
- **The feed counts deleted keys too.** The poller remembers every workspace key it has seen (the last 200), so a deleted key's calls stay in the feed.
- **Line 1 of a feed entry** now carries the tokens beside the cost ("1.3k tokens · $0.0012"), so they're never cut off. Line 2 is time · job · where it ran.
- **Tests:** seven `claude plugin test` cases, with the shared files in memory. They cover the poller writing what it fetched and a second read inside the intervals calling OpenRouter not at all. They also cover a session that doesn't hold the lease calling nothing and showing the other session's data.

### Open

- How quickly a request reaches the analytics is still unmeasured. Watch it during the next eval run.

## Reversals

- **R3, R5 and R7** (grouped by job, Show more, and details on click; this file, 2026-10-08) are replaced by the feed (F1 to F6) the same day. Jack: "Ok new idea, more like a alert log, where new request come in then go out as new ones come in. the purpose is not to look at the details of a request, but see as they are coming in, watch for repeated failures, and know when you are using tokens. Drop the expanded view, make sure to show the model too on the page, make it look good."
- **D9** in `ideas/openrouter-keys-grill.md` (2026-10-07) said the log merges the local `llm.jsonl` rows with OpenRouter's daily totals. R1 makes OpenRouter's per-request rows the source, with the local rows as added detail. When D9 was written, per-request data from the API wasn't known to exist. Jack chose this on 2026-10-08, in keeping with his preference for the API.

## Disagreements

- **Placement:** I recommended a pane of its own (/requests), so the keys pane stays short and the log gets the full height. Jack chose a section under the keys (R2). R5 keeps it to 8 jobs at a time.
- **Calls with no job:** I recommended grouping each key's calls into bursts, so separate eval runs read separately. Jack chose one "Other" row per key (R6).

## Frontier

Empty.

## Log

**Gate 0.** Brief shown; Jack: "lets go".

**Batch 1**

- Where do the log's rows come from? Options: API rows, local details added (Recommended) / API only / Local llm.jsonl only (as D9 planned). Answer: "API rows, local details added (Recommended)".
- Where does the log live? Options: Its own pane (Recommended) / Section under the keys / Tabs in the keys pane. Answer: "Section under the keys".
- How are the requests grouped? Options: By job, expandable (Recommended) / Flat, newest first / By key. Answer: "By job, expandable (Recommended)".
- How much does it show, and how live? Options: Last 24h, refresh every 30s (Recommended) / Last 3 hours, per minute / Pick a range. Answer: "Last 24h, refresh every 30s (Recommended)".

**Batch 2**

- The log sits under the keys. How much of it shows? Options: Latest 8 jobs + Show more (Recommended) / Everything from 24h / Collapsed until opened. Answer: "Latest 8 jobs + Show more (Recommended)".
- Requests with no PSet job: how are they grouped? Options: By key, in bursts (Recommended) / One row per call / One "Other" group per key. Answer: "One "Other" group per key".
- What does a call show when you open a job? Options: Summary, click for more (Recommended) / Everything inline / Summary only. Answer: "Summary, click for more (Recommended)".

**Batch 3 (the tail)**

- What does a job row say? Options: What it was, then numbers (Recommended) / Numbers first. Answer: "What it was, then numbers (Recommended)".
- Should an expensive or failing job stand out? Options: Mark it, no toast (Recommended) / Mark and toast / No marks. Answer: "Mark it, no toast (Recommended)".
- If you had to halve it, what ships first? Options: API rows first, local details second (Recommended) / All at once. Answer: "API rows first, local details second (Recommended)".

**Redesign (2026-10-08, after the build), verbatim:** "Ok new idea, more like a alert log, where new request come in then go out as new ones come in. the purpose is not to look at the details of a request, but see as they are coming in, watch for repeated failures, and know when you are using tokens. Drop the expanded view, make sure to show the model too on the page, make it look good."
