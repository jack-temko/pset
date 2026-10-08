# Memory holds your preferences only

## Status

**Done** · branch `memory-preferences-only` (2026-10-08). Spec in `design/memory.md`.

## Information

**Why.** A wrong find was saved to the book's memory as a problem range and
then steered later finds in that chapter to the wrong page. Nothing checks a
find before it is remembered, and nothing shows the range helps: since #15,
finds start from the contents' Problems pages and the Reader decides whether
a page holds the problem. Book notes the tutor saves on its own are the same
kind of unchecked steering. Preferences ("use V_0, V_1 for nodal voltages")
are what earns memory its place.

**Decisions** (Jack, 2026-10-08):

- **Find memory goes**: no problem ranges are written or read, find and
  locate search as if none existed, and the guide no longer opens with
  remembered pages (`theory()`).
- **Memory is preferences only**: the kind `book` is gone, and so is a
  memory's page. Existing book and PSet rows are deleted by a migration.
- **Only Ask saves**: Ask keeps `remember` (a preference, no kind or page) and
  `forget`. It saves only what the student states or asks for about how they
  want answers. The walkthrough writer loses `remember`, but **still reads
  every preference** in its system prompt, as Ask does.
- **The walkthrough's memory lines go** (`questions.memory`, "What the guide
  remembered", "Found from memory"), with the column.
- Preferences already saved, by You or Tutor, stay as they are.

### Files

Go:

- `internal/memory/memory.go`: delete `Seen`, `problemsKey`, `Problems`,
  `ProblemsSeen`, `SawProblem`, `printedRange`. `Save` takes only a
  preference, no page. Add migration `memory/2`: delete rows where
  `kind = 'book' OR source = 'pset'`, drop index `memories_key`, drop columns
  `key`, `detail`, `page` (keep `kind` if a constraint blocks dropping it,
  always `'preference'`).
- `internal/memory/wire.go`: remove `Kind`, `KindBook`, `SourcePSet`, and
  `page` from `Memory` and `NewMemory`. Same in `http.go` if it reads them.
- `internal/agent/memory.go`: `rememberTool` loses `kind` and `page`, and
  says it saves a preference the student stated. Rewrite `memoryRules` for
  preferences only (drop "where a named result lives", "go straight to a page
  it names"). `system()` lists preferences with no page or kind label.
  `remember()` loses kind defaulting and page conversion.
- `internal/agent/loop.go`, `tools.go`: `remember` and `forget` are only
  offered when `Student` is set (Ask). Remove `Complete` and the
  `onlyRemembers` finish path if nothing else uses them. `Memory.Notes` still
  feeds every loop.
- `internal/homework/find.go`, `locate.go`, `scope.go`: remove the problem
  ranges lookup, the remembered tier, "Checking pages from memory…",
  `firstRemembered`, `rememberedPages`, `rememberedMax`, the `remembered`
  parameter of `candidates()`, `location.FromMemory`, and helpers only they
  use (`labelKey`, `labelParts`, `compareKeys`, `lastNumbers`).
- `internal/homework/question.go`: remove `sawProblem` and its call in
  `find()`, `problemLabel` if unused, `theory()` with `theoryPages` and
  `theoryDepth`, the writer's `Remembered` callback, `memory()`,
  `addMemoryLine`, and the found-line keeping in `write()`. The writer still
  gets preferences through `Memory.Notes`.
- `internal/homework/service.go`: narrow the `Memory` interface to `Notes`
  (or whatever the writer loop needs); remove `Problems`, `Seen`; remove the
  retry clear of memory lines.
- `internal/homework/store.go`, `boxes.go`, `notes.go`: stop reading and
  writing `questions.memory`. Migration `homework/17` drops the column.
- `internal/homework/wire.go`: remove `Question.Memory`, `MemoryUse`,
  `MemoryLine`, `MemoryUseFound`.
- `cmd/pset/main.go`: remove `homeworkMemory` and the `ProblemsSeen` adapter;
  wire what remains.
- `web/src/api/gen/*`: regenerate with `make gen`.

Web:

- `web/src/pages/workspace/memory.tsx`: the dialog adds a sentence (no kind
  picker, no page field), lists every preference (no filter tabs, no kind
  label, no page ref) with who saved it, when, and Delete. Remove
  `MemoryLines`, `withPage`, `SOURCE.pset`. Empty state speaks of
  preferences ("How you want answers, like units or notation").
- `web/src/pages/workspace/index.tsx`: Ask's remember step label without a
  page.
- `web/src/views/homework/walkthrough.tsx`: remove the memory lines, the
  peeked `memory`, and the "What the guide remembered" menu item.
- `web/src/api/memory.ts`: drop `MemoryKind` export.
- Fixtures: `web/src/views/homework/world.ts`,
  `web/src/pages/components/sections/document.tsx`,
  `web/src/api/homework.test.ts` lose `memory: []`.
- `web/src/components/transcript/README.md`: example text.

### Steps

1. Find memory out: homework find, locate, scope, question, service, and
   `cmd/pset`; delete their tests. `make check` green.
2. Memory preferences only: `internal/memory` with migration `memory/2`, wire
   types, `make gen`; tests rewritten.
3. Agent: `remember` and `forget` for Ask only, preference only; the writer
   reads preferences and cannot save. Tests.
4. Walkthrough memory lines out: wire, store, migration `homework/17`, web.
5. Memory dialog for preferences only.
6. Docs: rewrite `design/memory.md` (preferences only: who saves, how
   it's used, the dialog, the backend, and a line on why find memory and book
   notes were removed). Update `design/workspace.md:629`,
   `design/backend.md:101,180`, `design/model-usage.md:10`, the READMEs in
   `internal/memory`, `internal/agent`, `internal/homework`, `internal/doc`
   (line 55 only), `internal/ask`, and `web/src/views/homework/spec.md`.
   In `ideas/finding-problems.md`, note that memory keys were removed and
   link here. Mark this file Done.

### Tests

- Delete: `TestSawProblemKeepsOneRangePerChapter`, `TestRememberedPages`,
  `TestCompareLabels` (if its helper goes), `TestMemorysPagesOpenTheGuide`,
  `TestAGuideEndsWhenItsFinishedAndRemembers`,
  `TestMemoryFindsTheNextProblemAndKeepsTheWritersNotes`.
- Rewrite with preferences: `internal/memory/memory_test.go`
  (`TestSaveKeepsOneOfEach`, `TestSaveRefuses` refusing a page or kind
  `book`, `TestReplaceRewritesInPlace`, the HTTP test),
  `internal/agent/memory_test.go`.
- New: `TestMigrationKeepsOnlyPreferences` (memory/2 on a DB holding book,
  pset and preference rows keeps just the preferences);
  `TestWriterReadsPreferencesButCannotRemember` (the writer's system prompt
  holds a preference and its tool list has no `remember`); in homework, a
  find in a chapter after an earlier find writes nothing to memory.
- `make check` green, including the generated-types check.
- UI states to photograph: the Memory dialog empty and with three
  preferences (open from the book menu in `make dev`), and a walkthrough on
  `/views` with no memory lines and its menu.

### Acceptance

- After a find, the `memories` table is unchanged.
- A second find in the same chapter takes the same path it would on a fresh
  book.
- Upgrading a library leaves only its preference rows; the backup from
  `BackupBeforeMigrating` holds the old ones.
- Asking "remember I use V_0, V_1 for nodal voltages" in Ask saves it as
  yours, it shows in the dialog, and the next walkthrough's system prompt
  carries it.
- No "book" kind, page or memory line anywhere in the UI or on the wire.

### Out of scope

- Professor's notes (`internal/homework/notes.go`): unchanged.
- Changing how find searches, beyond removing the remembered tier.
- A confirm step for saving preferences.
- Editing a preference in place (delete and add again).
