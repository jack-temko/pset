# Removals ledger

Every feature the UI overhaul removes gets a line here, so a final pass can
reconcile the backend: endpoints, types, and jobs nothing renders anymore.
Format: what was removed, where it lived, which backend surface (if any) it
touched, and whether that surface has other consumers.

| Removed | Lived in | Backend surface | Other consumers | Reconciled |
|---|---|---|---|---|
| Mobile layouts (app is desktop-only; <1024px shows the gate in `index.html`) | sidebar Sheet branch, `CloseMobileNavOnNavigate`, task-center mobile Sheet, ask history drawer, `ui/sheet.tsx`, `hooks/use-mobile.ts` | none (frontend-only) | n/a | n/a |
| Sidebar state cookie (`sidebar_state`) | `ui/sidebar.tsx` (was written, never read) | none | n/a | n/a |
| Import **page** (route `/import`, sidebar entry, `pages/import.tsx`) — replaced by the dialog on `/` (`pages/library/import-dialog.tsx`) | `pages/import.tsx`, `App.tsx`, `app-shell.tsx` nav | none (same endpoints, new home) | `/import` now redirects to `/`; `/?import=1` opens the dialog | n/a |
| Path import UI (`{path}` JSON mode + `maxAttempts`) | import page's collapsed path form | `POST /api/import` JSON body mode, `maxAttempts` field (`internal/api/api.go:333-412`) | **web-unused now**; curl/scripts may still use it | pending backend pass |
| Recent imports card, "Go to library" handoff button, "Processing in background" prose | `pages/import.tsx` | none (derived data) | n/a | n/a |
| Library tally library-path (`~/.pset/library`) | `pages/library.tsx` footer | none | n/a | n/a |
| Import CTA in search-no-match state | `pages/library.tsx` | none | header button + hero remain | n/a |
| `subject` as a search field (still shown as author fallback) | `pages/library.tsx` filter | none | `Book.subject` still rendered | n/a |
| StatusPill `Ready` state + semantic-search violet dot — replaced by card tags (`Needs OCR`, `Semantic search`) and the cover JobBadge | `pages/library.tsx` | none | n/a | n/a |
| Import dialog auto-close: ~4s acceptance ring timer, hover-to-pause, indeterminate upload pulse bar — replaced by a static accepted view (success roundel + next-steps panel) that closes only by user action; the task-pill pulse now fires on acceptance instead of on timer completion | `pages/library/import-dialog.tsx` | none (frontend-only) | n/a | n/a |
| Card state tags `Needs OCR` + `Semantic search` — OCR is now automatic and mandatory inside the import job (a warning field will cover in-flight/cancelled OCR later), and every import ends semantically indexed; the card shows the locked kind (`Scanned`/`Digital`) instead | `pages/library/index.tsx` | none (`textState`/`searchState` still exist as book state) | n/a | n/a |
| Schema migration stack v1–v7 — reset to a single v1 schema (adds `books.kind`); pre-release databases are refused with `ErrSchemaMismatch` and must be deleted (fresh rebuild, no backfill) | `internal/store/migrate.go` | the whole schema (fresh start) | n/a | done |
| Tasks filter chips (6-way segmented control: All/Running/Waiting/Blocked/Done/Failed, with per-filter empty states) — replaced by fixed state sections: Running / Waiting / Blocked / Recent | `pages/tasks.tsx` | none (frontend-only) | n/a | n/a |
| Task pill idle state (the header showed a `Tasks` button even with nothing running) — the pill renders only while work is active; `/tasks` owns history | `components/task-center.tsx` | none (frontend-only) | n/a | n/a |
| Recent finished rows in the task-center popover (capped at 6, `+ N earlier`) — the popover is active-only, fully expanded rows; history lives on `/tasks` | `components/task-center.tsx` | none (frontend-only) | n/a | n/a |
| Per-row primary-tinted running card in the popover; separate page/popover job-row designs — replaced by one `JobRow` (`components/job-row.tsx`) used by both surfaces | `pages/tasks.tsx`, `components/task-center.tsx` | none (frontend-only) | n/a | n/a |
| Finished-job retention sweep (`finishedJobLimit = 20`, `Runner.pruneRetention`, `job_removed` events from pruning) — history is unbounded; `Clear finished` is the only pruning; `job_removed` now fires from clear-finished only | `internal/engine/runner.go`, `internal/engine/job.go` (`JobViews` limit arg), `TestJobsEndpointCapsFinished` → `TestJobsEndpointKeepsFinishedHistory` | store's `FinishedJobs(limit)` primitive kept (0 = all); `PruneFinishedJobs` is now prod-dead (tests only) | n/a | pending backend pass |
| Blocked row's `Open Settings` button (a `/settings/i` regex guess on the error text) — the error message already names the fix and the sidebar owns the Settings link; blocked rows keep Retry + Cancel like every other state | `components/task-center.tsx` (original), then `components/job-row.tsx` | none (frontend-only) | n/a | n/a |
| Task pill and popover | The navbar pill (`components/task-center.tsx`) and its popover are gone; the sidebar's bottom card is the live surface and `/tasks` holds the rest. | none | n/a | tasks redesign |
| `ocr` / `index` / `embed` job types | They were phases inside ingest *and* standalone jobs with their own buttons — two doors for one job. The phases stay; the job types, the `POST /api/books/{sha}/ocr|index|embed` routes, and `OcrAction`/`IndexAction`/`EmbedAction` are gone. | none | n/a | tasks redesign |
| `blocked` and `cancelled` statuses | Nothing can park on configuration any more (import and homework are refused at the door), and stopping keeps its work, so a stopped task rests at `paused` instead of being terminal. | none | n/a | tasks redesign |
| Parent/child step rows | `job_steps.parent_id` and every item child (embed batches, homework questions). Phases are a flat ordered list; a question's state lives on its own row, where its repair doors are. | none | n/a | tasks redesign |
| Per-step retry | `POST /api/jobs/{id}/steps/{key}/retry`, `RetryStep`, `ResetStepsForRetry`'s targeted mode, and the per-item retry buttons. Retry resumes the task, and question repair is scoped and synchronous. | none | n/a | tasks redesign |
| `attempts` / `maxAttempts` | The columns, `SubmitOptions.MaxAttempts`, the `maxAttempts` request field, and the attempts badge. Transient retries happen inside a phase, invisibly. | none | n/a | tasks redesign |
| `Exhaustion` policies | fail / skip / block per step. A phase that gives up fails the task; a phase with nothing to do is done with a note. | none | n/a | tasks redesign |
| Worker pool, type caps, wait reasons | `workerPoolSize`, `typeCaps`, the per-book lock, and every server-authored wait string ("2nd in queue", "waiting for a free OCR slot"). The runner is serial, so a queued task shows only "Waiting". | none | n/a | tasks redesign |
| `text_state` / `index_state` / `search_state` | Readiness is derived by counting rows, so no flag can drift. `TextStateBadge` goes with them. | none | n/a | tasks redesign |
| Job warnings | The `warnings` column, `maxJobWarnings`, and the notices chip. What a phase could not do either blocks the book (a failed page) or does not matter (a blank one). | none | n/a | tasks redesign |
| `Clear finished` | `POST /api/jobs/clear-finished`. History keeps its newest 25 and prunes itself as tasks settle. **This reverses the retention-sweep removal above.** | none | n/a | tasks redesign |
| Dead client job surface | `JobsApi.connected` as a no-op, `jobById`, `useJob`, `api.jobs()`, `api.job()`. | none | n/a | tasks redesign |
| `pset:task-pulse` | The import dialog's pill nudge, with the pill it nudged. | none | n/a | tasks redesign |

