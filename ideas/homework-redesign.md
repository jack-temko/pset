# Homework redesign

## Status

**Planned** (2026-09-30), on branch `homework-redesign`. The whole homework panel is
redesigned from the tired student's point of view. The grill is done and waiting for
Jack's OK: the decisions, wireframes, states, data and acceptance are in
`web/src/views/homework/grill.md` (drawn on `/views/homework`, Grill tab), and the
live wireframes are at `/views/homework?mode=wireframes`. Nothing is built but the
wireframes and the Menu. Jack asks before any merge into `main`.

Build order (D32): the UI first on mocks so it can be judged in `/views`, then the
real backend swapped in. Phase A is the UI, phase B the backend.

## Information

**Decided and recorded in the grill** (see its Summary, Reversals and Assumed):
a header that carries progress (a difficulty-weighted bar as its edge, the count
opening the question list, the time left in gray); one primary button (Next
question, Mark incomplete, Skip for now); compact rows that open in place in place
of the Veil, which is deleted; Focus in two columns; a finish page; a book opens on
the Homework list and a set on its next unfinished question; one redesigned Menu
everywhere, one open at a time.

**Not decided, first in phase A:** the Menu's hover (it must not fill the whole
row), how it reads as attached to its dropdown, and its colors measured in both
themes. Jack asked for an A/B (D33).

**Rules for every task.** Follow `design/design-system.md`; only the spacing scale
exists (`npm run build` fails on anything else); no em dashes; look at every state
in Paper and Night at 1280 wide or more; every new or changed component gets a
README and a `/components` section. Backend tasks that call a model run on Jack's
Claude-only eval key, never the key in his own library.

## Tasks

- [x] 1. (opus) The Menu's hover, attachment and colors: an A/B, then the winner
  - Files: `web/src/components/menu/index.tsx`, `web/src/components/menu/README.md`, `web/src/views/homework/wireframes.tsx`, `web/src/pages/components/sections/overlays.tsx`
  - Do: build two or three live variants of the menu on the wireframes page: a hover that does not fill the whole row (an inset pill, a left accent, a content-width wash), and a card that reads as attached to its dropdown (flush under the trigger with a shared edge, a caret, or aligned with the trigger kept tinted). Measure the contrast of every color involved (hover, current, icon, text, border, shadow) in both themes against the design system's floors and report the numbers. Ask Jack to choose; apply the winner to `Menu` and its README.
  - Done when: Jack has chosen from the live page, the contrast numbers are in the README, every menu in the app (book menu, homework menus, `/components`) looks right in both themes, and `npm run build` and the tests pass.
- [x] 2. (sonnet) A disclosure row that opens in place, and the Veil removed
  - Files: `web/src/components/disclosure/index.tsx`, `web/src/components/disclosure/README.md`, `web/src/pages/components/sections/feedback.tsx`, `web/src/pages/components/sections/containers.tsx`, `web/src/components/veil/index.tsx`
  - Do: promote the wireframes' `Help` rows to a `Disclosure` component (a row with a title and a meta on the right that opens its content in place and stays open; `writing` state with a spinner that cannot open). Delete `components/veil` and its `/components` section; remove the mentions in `design/design-system.md`, `design/workspace.md` and the READMEs that point at it.
  - Done when: nothing imports `@/components/veil`; `/components` shows Disclosure with its README; typecheck, tests, lint and build pass.
- [x] 3. (sonnet) A difficulty-weighted progress bar component
  - Files: `web/src/components/progress-bar/index.tsx`, `web/src/components/progress-bar/README.md`, `web/src/components/progress-bar/progress-bar.test.ts`, `web/src/pages/components/sections/feedback.tsx`
  - Do: promote the wireframes' `WeightedBar` (segments as wide as their weight; done, current, waiting, failed; equal widths when there is no weight; not a control). Test the width math and the fallback.
  - Done when: it is on `/components` in both themes; tests, typecheck and build pass.
- [x] 4. (opus) The walkthrough: header, question row, rows, the one button, next unfinished, keyboard
  - Files: `web/src/views/homework/walkthrough.tsx`, `web/src/views/homework/progress.ts`, `web/src/views/homework/progress.test.ts`, `web/src/views/homework/keys.ts`, `web/src/views/homework/failed-question.tsx`
  - Do: rebuild the walkthrough to the wireframes: the header with the count Menu (its list of questions, current row), the weighted bar as its edge, the time left in gray; the question row (Show in book, the question menu); read-only notes; the three Disclosure rows; the footer with Ask about this and the one button (Next question marks done and moves to the next unfinished, wrapping, to the finish page when none are left; Mark incomplete on a done question; Skip for now on a question being written, failed or with no guide). Keyboard (D27): left and right browse, 1 2 3 toggle the rows, Enter on the primary; off while typing. Pure logic in `progress.ts` with tests.
  - Done when: every state in the grill's table renders in `/views` in both themes; the logic tests pass; the counts meet the acceptance numbers; the main flow works from the keyboard alone.
  - Built: tab stops from the tabs to the first row are 6 in `/views` and 7 in the workspace (the Focus toggle is live there), one over the acceptance number; 14 controls on a ready question with the usage line's toggle, one over 13. Both are for the post-build review. Finish page wiring waits for task 6: with nothing left, Next marks done and stays.
- [x] 5. (sonnet) Focus in two columns
  - Files: `web/src/views/homework/walkthrough.tsx`, `web/src/views/homework/stage.tsx`, `web/src/pages/workspace/index.tsx`
  - Do: the panel passes whether it is in Focus; in Focus the question, Show in book and the notes are pinned on the left and the rows scroll on the right; header and footer unchanged.
  - Done when: the Focus checkbox on `/views` and the Focus toggle in the workspace both show two columns, in both themes.
- [x] 6. (sonnet) The finish page
  - Files: `web/src/views/homework/finish.tsx`, `web/src/views/homework/greetings.ts`, `web/src/views/homework/walkthrough.tsx`, `web/src/views/homework/finish.test.ts`
  - Do: the finish page from the wireframes (greeting line, two StatTiles, a bar per question with the hardest marked, the hardest listed, Turn in, Back to list), reached when the last unfinished question is done and from the count's list. The greeting reuses Home's mechanism with its own lines, seven stretches of the day; draft three a stretch for Jack to approve.
  - Done when: the `finish` scenario shows it in both themes; Turn in works and is undoable from the set menu; tests pass.
- [x] 7. (sonnet) The list, and opening a set on its next unfinished question
  - Files: `web/src/views/homework/index.tsx`, `web/src/views/homework/progress.ts`, `web/src/pages/workspace/index.tsx`
  - Do: each set row carries the bar and "n of m done, time left"; opening a set (from the list or Home's due row) lands on its next unfinished question; a book opens on the Homework tab at the list; the Panel keeps both tabs mounted so Ask and back returns to the same question within a visit.
  - Done when: `handoff-in` and the list scenarios behave as in the grill; going to Ask and back keeps the question and scroll; a reload opens the list.
- [x] 8. (sonnet) The mock world and scenarios for the new view
  - Files: `web/src/views/homework/world.ts`, `web/src/views/homework/scenarios.ts`, `web/src/views/homework/routes.ts`, `web/src/views/homework/stage.tsx`
  - Do: the world carries difficulty, seconds, an estimate and attempts so the view runs on sample data; add scenarios `finish`, `no-guide`, `long-set` (24 questions) and `long-title`; the stage behaves like the workspace (opens on the list, keeps both tabs, stub Ask with the chip).
  - Done when: every scenario in the grill's states table is reachable from the picker and plays.
- [x] 9. (sonnet) The docs: spec, design docs, views README
  - Files: `web/src/views/homework/spec.md`, `design/workspace.md`, `design/design-system.md`, `web/src/views/README.md`
  - Do: rewrite `spec.md` to match what was built (mission, inventory, states, actions, handoffs, data, why, a fresh friction log, wants, open); write each reversal R1 to R10 into `design/workspace.md` (and the Menu and Veil changes into `design/design-system.md`).
  - Done when: the spec reads correctly beside the live view and every reversal in the grill is recorded where the decision was written.
- [x] 10. (opus) Post-build review round with Jack
  - Files: `web/src/views/homework/grill.md`
  - Do: photograph the real view (both themes, every key scenario, about 1500 tall, clipped to the panel and its log), show the photos, run a short grill (at most two batches) on what feels off, what to cut and what is missing; record the answers under a dated Post-build heading.
  - Done when: Jack has seen the photos and answered; small fixes are done or queued, a large one has reopened its gate.
- [x] 11. (opus) The difficulty ranking step
  - Files: `internal/homework/rank.go`, `internal/homework/prompts.go`, `internal/homework/store.go`, `internal/homework/wire.go`, `internal/homework/rank_test.go`
  - Do: after a set's questions are found, one cheap model call sees every statement and scores each 1 to 5 against the others; store it (`difficulty` on the question, a migration); re-rank when questions are added or removed; a heuristic (statement length, parts, a figure) when the model is down; send `difficulty` on `Question` (run `make gen`). Evaluate the prompt on a real model with the eval key.
  - Done when: tests pass with a fake model and with the heuristic fallback; the eval shows scores that separate a long hard question from a short easy one; `make test` passes.
  - Built: `rank.go` (job `rank`, one per set, queued when no question is left to find: after a find ends or fails, questions added, a question removed; the Reader model; strict parse; heuristic fallback), migration `homework/15`, `difficulty` on `Question`. Tests use a fake model. **Run on a real model (2026-09-30, the eval key, Reader model):** easy one-step questions scored 1, a mid nodal-analysis question 3, a four-part question with two figures 5: it separates them as wanted. One small set, one run; not a benchmark.
- [x] 12. (sonnet) Time per question
  - Files: `internal/activity/wire.go`, `internal/activity/activity.go`, `internal/homework/wire.go`, `web/src/api/activity.ts`, `internal/activity/activity_test.go`
  - Do: a study stretch carries the `questionId` when the walkthrough is open on one; a question's `seconds` is the sum of its stretches with overlaps counted once and idle pauses as today; the workspace tells the store which question is open (the view's `onQuestion` prop); send `seconds` on `Question`.
  - Done when: tests cover overlapping stretches and a question switch; `seconds` appears on the wire; `make test` passes.
  - Built: `activity/3` adds `question_id` to stretches; `Service.QuestionSeconds` (union, overlap once); homework reads it through a `Time` interface and sends `seconds` on every question snapshot; the workspace reports the open question (the view's `onQuestion` prop) and `useStudyTime` starts a new stretch when it changes. Idle stays as today's stretches (20 minutes on homework), not the 5 minutes A14 first assumed.
- [x] 13. (sonnet) The time-left estimate
  - Files: `internal/homework/estimate.go`, `internal/homework/wire.go`, `internal/homework/estimate_test.go`, `internal/homework/service.go`
  - Do: compute a set's time left from the remaining questions' difficulty and the seconds per point of difficulty learned from its timed questions; nothing with fewer than two timed; a range when the spread is wide; send it on the set. Add a test that feeds timed sample sets and checks the error.
  - Done when: the calibration test passes its bound; with fewer than two timed questions the field is absent; `make test` passes.
  - Built: `estimate.go` (pace from finished questions of a minute or more, at least two; range from the spread, how few finished and how few left, with a floor; a started question keeps a quarter), `Summary` gains `bar`, `estimate`, `timed`, filled on every list, get and event. `estimate_test.go` simulates timed sets: median error 0.08 / 0.21 / 0.41 for steady / usual / erratic students, the truth inside the range 100% / 95% / 85% of the time; the range narrows with more finished and only a steady student's gets narrow enough for "about". The client shows a range past a width of 0.8 of the estimate (`WIDE` in `progress.ts`). The simulation assumes time follows difficulty with noise; the real check is Jack's own timings.
  - The wire types now carry `difficulty`, `seconds`, `bar`, `estimate`, `timed`: the view's local extension types are gone (part of task 15).
- [x] 14. (glm) attempts and failedAt
  - Files: `internal/homework/store.go`, `internal/homework/wire.go`, `internal/homework/question.go`, `internal/homework/homework_test.go`
  - Do: count a question's tries and record when it last failed (a migration); set them on retry and on failure; send `attempts` and `failedAt` on `Question`.
  - Done when: tests show the count rising on retry and the time set on failure; `make test` passes.
  - Built: migration `homework/16` (`attempts`, `failed_at`); a retry or pointing out a failed question counts an attempt; `failedAt` is sent only while failed. The failed block says "Tried once more and it failed again, 2 minutes ago" (and, for an outage, "It failed 5 minutes ago"); a waiting question says "It is 3rd in line" (derived in the view).
- [x] 15. (sonnet) Swap the mocks for the real backend
  - Files: `web/src/api/homework.ts`, `web/src/views/homework/world.ts`, `web/src/views/homework/walkthrough.tsx`, `web/src/pages/workspace/index.tsx`
  - Do: the view reads the real `difficulty`, `seconds`, estimate, `attempts` and `failedAt`; the waiting and failed copy uses `attempts` and `failedAt`; queue place derived from the set's questions; the mock world keeps the same shapes for `/views`.
  - Done when: the view works on the real API with a scratch server (never port 8420) and on `/views`; the estimate guards hold; `make check` passes.
  - Built: the view reads the generated types (no local stand-ins), queue place derived in the view, the mock keeps the same shapes. Verified end to end in Go (real activity service, real stretches, seconds and time left on the wire). **Not verified:** the real workspace with a real book (importing one needs a model key; a scratch server on 8499 refused without one), so the stretch-with-a-question code in `useStudyTime` is typechecked but not run against a server, and the ranking prompt has not met a real model.
