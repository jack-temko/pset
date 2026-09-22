# UX audit — pset web (loop log)

Rubric: `ui-audit.md`. Bar: a tech-savvy student, new to pset's concepts.
Method per round: live Playwright pass on a scratch instance (fresh data,
local ollama embeddings, chat key deliberately empty so failure states are
real), full shot gallery + driver probe log under
`web/e2e/artifacts/audit-round-N/`, then independent auditor subagents over
the gallery. Findings are fixed, re-rendered, and re-audited until a round
comes back clean. Work happens on branch `audit/ux-loop`.

---

## Round 1 — 2026-09-22

Gallery: `web/e2e/artifacts/audit-round-1/` (27 shots, light+dark, manifest
with driver probes). Auditors: 3 independent passes (shell/home/settings,
book workspace, failure/recovery/consistency).

### P0

1. **Failed homework questions stay "Queued…" forever.** The server publishes
   the failure and the stream is connected (home live-updates), but the open
   homework panel never reflects it; only a manual reload (which also resets
   the reader position) reveals the designed failure card. Skeletons promise
   content that will never come. Fix: root-cause the `question.changed`
   delivery to the open set, plus a poll/staleness guard while any question is
   outstanding, so missed events self-heal within seconds. Wording: only say
   "it starts when the questions ahead of it are done" when something actually
   is ahead.

### P1

2. **No lost-touch indicator.** Server killed: 42s of perfectly normal-looking
   UI, 79 console errors, no banner. The old "Lost touch with pset /
   Reconnecting…" card was dropped in the rewrite. `useEventStream` ignores
   `onerror`/`onopen`. Fix: expose connection state, render a slim
   reconnecting banner; replay/recovery machinery underneath is already good.
3. **Ask failure is a dead-end red line.** "Set up a chat model in Settings
   first." as plain 12px text; not clickable, no sent bubble, while the same
   root cause in Homework gets a titled card with Open Settings + Try again.
   Fix: same card pattern, canonical sentence, Settings deep link, visible
   failed attempt in the thread.
4. **Fresh install's primary CTA is a dead button.** Both Add CTAs disabled
   behind `embeddingsReady`; the explanation and only action live in a banner
   above. Fix: when blocked, the empty-state CTA becomes a primary
   "Set up in Settings" deep link (`/settings#connections` exists); banner copy
   matches the actual unblocking gesture ("Save one in Settings" when defaults
   are prefilled).

### P2

5. **Chapter jump highlights the wrong chapter.** Current-section logic counts
   only section start pages; the clicked chapter gets a transient hover gray
   while another row keeps the blue. Fix: clicked destination wins until the
   next scroll; chapter starts participate in the computation.
6. **Empty Homework tab is a lone button.** No copy explaining what a set is
   for. Fix: one sentence + keep the button (mirror the set-level pattern).
7. **"In this book" checkbox is unexplained.** Fix: one explainer line at the
   top of the Add questions dialog; "Add 0 questions" reads oddly → "Add
   questions" when the count is zero.
8. **Memory dialog stacks two same-worded controls** (add-form kind pills vs
   list filter tabs). Fix: visible "Add a memory" caption above the pills.
9. **Scan chrome is invisible until you scroll.** Page pill starts
   `opacity-0`; zoom is pinch/ctrl-wheel only with no visible control. Fix:
   pill awake on mount (fade after), stay awake on focus-within; zoom menu
   (Fit to width / 100 / 150 / 200) using the existing Menu.
10. **Filename stands in for the book title everywhere**, including Ask's
    pitch ("Ask anything about sample scanned."). Fix: one-time quiet prompt
    on the book page offering "Edit the title?" when title == filename stem.
11. **Settings Save hidden when clean** reads as a missing button on the
    sister card. Fix: always render Save, disabled when clean; one line
    explaining Test-tries-without-saving / Save-tests-then-keeps.
12. **Settings 401 copy accuses a key the user never typed.** Fix (Go,
    `settings/service.go explain()`): when the key is empty say "This endpoint
    wants an API key and none is set (401)."
13. **Import refusal omits the filename** while the duplicate error names it.
    Fix (frontend): "notes.txt isn't a PDF. PSet can only shelve PDF files."
14. **Week stats don't add up across tiles and the by-book bar** (rounding at
    different grains). Fix: derive both views from the same per-book numbers.
15. **API key renders as plain text.** Fix: `type="password"` + Show toggle.

### P3

16. Chat test failure: reason is a card-height above the verdict; scroll the
    errored field into view (or echo "see API key above" at the footer).
17. Health rows name plumbing, not purpose: add "renders PDF pages" /
    "reads scanned pages" clauses.
18. New homework dialog: placeholder reads as a prefilled value and disabled
    Create says nothing; add a field hint.
19. Edit-book dialog is titled "Book"; the affordance says "Edit this book" —
    retitle "Edit book".
20. Night mode leaves the page at full paper white; add a gentle dim for the
    page render in Night (scans stay unfiltered by default).
21. Two dot languages: activity tiles and the by-book legend use the same
    round-dot shape with overlapping palettes; legend becomes a small
    cover-gradient swatch tied to each spine.
22. Canonical sentence for the chat-model dependency (homework's sentence is
    the best); align Ask preflight (Go) and in-turn failure (Go); consider
    titling the box "Chat model".

### Verified fine (auditor consensus)

Reset flow with counts and no-undo warning; Save-tests-first connection
semantics; "Connected · 768 dimensions" copy; import-in-flight row (plain
phase words, determinate bar, Stop, per-state controls); first-run restraint
(zero-week sections hidden); scroll-aware top bar; theme control (instant,
persists, System keeps following); designed failed-question card (light+dark);
queued-vs-working skeleton language; set lifecycle and delete confirms;
question chrome (counter, end-disabled moves, reversible Complete, Ask chip);
memory dialog details (counts, source labels, page jumps); icon-button
tooltips; printed-page numbering; viewport gate copy and a11y; severity
colors in both themes.

### Round 1 outcome

All findings above were fixed by three file-partitioned fixers and verified
live against the fixed build. Gates: `tsc -b` clean, vitest 12/12,
`npm run build` + class gate clean (one fractional `py-1.5` slipped into the
title-prompt strip and was corrected to `py-1`), `go build`/`go vet` clean,
scoped Go tests pass.

Verification highlights (shots 28-33, `audit-round-1/`):

- **P0**: adding a question now reaches the designed failed card live, no
  reload (~8s). Root cause was an event/snapshot race: the Add-questions POST
  response wrote a stale `pending` snapshot over the already-arrived `failed`
  event. Fix: monotonic state application in `applyQuestion` (forced writes
  only for Try again) + a 5s poll while any question is outstanding + honest
  "Waiting for its turn…" wording when nothing is ahead. Shot 29.
- **Lost-touch banner**: appears ~1s after the server dies ("Lost touch with
  pset. Reconnecting…", amber strip under the top bar, every page) and clears
  on recovery. Shots 30; live kill/restart probe.
- **Ask failure** now uses the homework failure card pattern (title, canonical
  sentence, Open Settings, Try again); canonical sentence unified in Go
  (`ask` package const). Shot 31.
- **Fresh install**: empty-state primary is a live "Set up in Settings" button
  (deep-links to `#connections`); banner copy matches the actual gesture.
  Shot 28, click-through verified.
- **Chapter jump**: clicked chapter is the only `aria-current` row. **Zoom**
  is a real menu (Fit to width ✓ / 150% / 200%) and the page pill wakes on
  mount. Shot 32. **Title prompt** shows once on filename-titled books.
  Shot 33. **Empty homework tab** has its sentence. **Import refusal** names
  the file ("not-a-pdf.txt isn't a PDF. PSet can only shelve PDF files.").
  **Settings**: Save always present (disabled when clean) + Test/Save hint on
  both cards, API key masked with Show/Hide, health rows carry purpose
  clauses.
- Accepted deviations, noted for re-audit: zoom menu omits a separate "100%"
  row (identical to fit width in this zoom model); the title prompt uses a
  filename-looking heuristic because the wire doesn't carry the original
  filename; week tiles are derived client-side from the per-book minutes
  (exact reconciliation would need a Go wire change); no fake sent-bubble for
  failed asks (the turn never existed server-side).

Round 2 re-audit of the whole app follows.

---

## Round 2 — 2026-09-22 (re-audit of the fixed build)

Gallery: `web/e2e/artifacts/audit-round-2/` (22 shots + probes, both themes,
fresh DB instance for first-run). Three independent fresh auditors (home/
settings, book workspace, failure/consistency).

### Fix verification

Every round-1 finding was verified as holding, including the P0 re-tested
live: a newly added question reached the designed failed card with no reload
(`applyQuestion` monotonicity + 5s backstop poll). Week tiles reconcile with
the by-book bar in every shot; lost-touch appears ~1s after a server kill and
clears on recovery; the canonical sentence is shared verbatim across Ask and
Homework.

### New findings (all small; the loop continues)

1. **[P2] Gallery hole** — the round-2 capture of `01-settings-top--light.png`
   was a mislabeled duplicate of shot 02, so the settings-at-rest state (You
   card, masked key, Show, both Save states) existed in no shot, in neither
   theme.
2. **[P3] Lost-touch banner lowercased the product name** ("Lost touch with
   pset.") — the only surface that did.
3. **[P3] A mid-turn chat-model failure** (model removed while answering)
   still rendered as the old one-line red note instead of the failure card
   the preflight path uses.
4. **[P3, folded into 1's recapture] `#connections` deep-link landing** left
   the Connections heading flush under the fixed bar before data settled.

Verdict: 2/3 areas CLEAN, failure/consistency ISSUES on the four items above.

---

## Round 3 — 2026-09-22 (delta fixes + targeted verification)

Fixes (applied directly, they were one-liners and one small refactor):

1. Recaptured `01-settings-top--light.png` at rest and added
   `24-settings-connections--dark.png` — the settings state now exists in the
   gallery in both themes.
2. Banner copy: "Lost touch with PSet. Reconnecting…"
3. Mid-turn setup failures now render the full failure card: `AskError` was
   refactored into a shared `FailureNotice`; a failed turn whose reason is
   the canonical setup sentence gets title + Open Settings + Try again
   (`isSetupReason`), other turn failures keep the one-line `FailedTurn`.
   Code-verified only — exercising it live needs a real model key, which is
   out of scope by design.
4. `Section` gained `scroll-mt-6` and the `#connections` anchor re-scrolls
   once the cards settle, so the deep link lands with the heading clear of
   the bar. Verified by click-through: shot 23.

Gates: `tsc -b` clean, vitest 12/12, build + class gate clean, binary
rebuilt and re-verified live (banner wording, deep-link landing, gallery
recaptures — shots 01, 23, 24, 25).

### Final verdict

All 25 round-1/2 findings fixed and verified; the round-2 audit's three
leftovers fixed and evidenced. **The audit loop is clean.**

Accepted deviations (deliberate, recorded for review): the zoom menu offers
Fit to width / 150% / 200% (100% is the same destination in this zoom model);
the filename-title prompt uses a filename-looking heuristic because the wire
does not carry the original filename; week tiles are derived client-side from
the per-book minutes (exact reconciliation would need a Go wire change);
failed asks keep the typed question in the composer rather than showing a
sent bubble (nothing was sent); mid-turn setup-failure card is code-verified
only (needs a paid key to reproduce live).
