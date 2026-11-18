# Dependencies, removal, undo and the purge: grill

- status: awaiting OK
- date: 2026-11-18
- brief: how the things in the new store depend on each other, and what removing, undoing and purging do to those links; judged from a student who removes things freely and expects nothing finished to break
- sources: internal/store/schema.go, internal/store/undo.go, internal/store/purge.go, internal/runner/runner.go (visible, pauseHidden), internal/material/service.go (remove, textbook), internal/course/service.go, ideas/backend-courses-grill.md (D12 to D15), the real-import run of 2026-11-18

## Summary

### In one line

Every link between things is declared once, in one map in the store, and that map drives visibility, the purge, removal's message and a test that walks every link. A removed thing keeps working for whatever already points at it, but nothing new can point at it, and it is purged only once nothing points at it. Textbooks become a kind of material, so a course can have several, and no single role can break.

### Decisions

| #   | Decision                                                                                                                                                                                                                                                                               | Why                                                                     | Beat                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| D1  | One declared dependency map in the store, beside Tables. Each link names its child and parent, says whether it **owns** or **refers**, and gives its column. Visibility, purge order, the "kept while used" checks, the counts in a removal's message and a walk test all come from it | One place to read the graph; a new table can't forget a rule            | A removed flag cascaded onto children; rules kept per feature |
| D2  | An **owned** child is hidden while any ancestor is removed (worked out from the map, never written onto the child) and is purged with its owner                                                                                                                                        | Removing a set takes its problems with it, in one row                   | Writing removed_at down the tree                              |
| D3  | A **reference** to a removed target keeps resolving: finds still show their page, figures and boxes. Nothing new may point at a removed thing; the finder and the pickers see only visible targets                                                                                     | Removing never breaks finished work (extends D13 to every reference)    | Marking the referrer stale; refusing the removal              |
| D4  | A removed thing is purged after a week only once nothing un-purged refers to it, for every refers-link in the map. A test checks that no reference can point at a purged row                                                                                                           | No dangling references, ever                                            | Purge after a week regardless, so the referrer loses it       |
| D5  | Undo reaches back a week for everything. A thing kept underneath past that (because something still uses it) can't be restored; adding it again is the way back                                                                                                                        | One promise: Undo reaches back a week                                   | Restorable for as long as it is kept                          |
| D6  | Each action's undo restores exactly what it changed, in any order. A thing that stays hidden behind a removed parent is said: "Brought back problem 3. Its set is still removed."                                                                                                      | Undo stays one rule, ready for the planned history screen               | Restoring the parent too; allowing newest first only          |
| D7  | A step already running when its target is removed finishes, and its result stands. Steps that start afterwards see only visible targets. A step whose own subject is removed still pauses, as now                                                                                      | No work or spend thrown away; no half-states                            | Stopping and redoing the step                                 |
| D8  | Textbooks and materials are split in the UI but share one table and one import: `materials.kind` is `textbook` or `material`, and a course may have several textbooks. The single textbook role (the `textbook` flag) is dropped                                                       | Matches how students think; no one-of-a-kind role that a removal breaks | Separate tables; keeping one textbook per course              |
| D9  | Import detection proposes the kind (numbered problems mean a textbook). The material lands under Textbooks or Materials, and an undoable action moves it                                                                                                                               | No extra question at upload; fixable in a click                         | Asking at upload                                              |
| D10 | A problem's reference ("3.12", "redo 3.12 with ...") is looked up first in the course's textbooks, then in its earlier sets' problems and their sheets. Removed things never count                                                                                                     | Covers the book's 3.12 and last week's problem 4                        | Searching every material alike                                |
| D11 | When "3.12" matches in two textbooks, the one this set's other problems resolved in wins. If it is still a tie, the find shows both and the student picks once for the set                                                                                                             | Right almost always, never silently wrong                               | A primary textbook per course                                 |
| D12 | Two windows on one course share one layout; the last to write wins                                                                                                                                                                                                                     | Most students use one window; "it opens as I left it"                   | A layout per window                                           |
| D13 | No guard against an old store.db. Jack deletes it, or has a one-off migration written for what he chooses to keep                                                                                                                                                                      | Nobody else runs this branch                                            | Refusing a stale store at open                                |

### The artifact: the map, as it stands

| Child         | Parent                    | Link   | Column                   |
| ------------- | ------------------------- | ------ | ------------------------ |
| material      | course                    | owns   | materials.course_id      |
| set           | course                    | owns   | sets.course_id           |
| turn          | course                    | owns   | turns.course_id          |
| memory        | course                    | owns   | memories.course_id       |
| study stretch | course                    | owns   | study.course_id          |
| page, section | material                  | owns   | material_id              |
| question      | set                       | owns   | questions.set_id         |
| find, reading | question (one each)       | owns   | question_id              |
| document      | question or turn          | owns   | owner_kind, owner_id     |
| step          | its subject               | owns   | subject_kind, subject_id |
| place         | its owner                 | owns   | owner_kind, owner_id     |
| incident      | its subject               | owns   | subject_kind, subject_id |
| find          | material (a page)         | refers | finds.material_id, page  |
| find          | an earlier problem's find | refers | finds.earlier_id         |
| set           | its sheet (a material)    | refers | sets.sheet_id            |
| turn          | its answer (a document)   | refers | turns.answer_id          |

The `materials.textbook` role is gone (D8); "textbook" is a kind. An incident keeps its own week once resolved, as now.

### Assumed

- A1: the map is Go data in internal/store, like Tables, and the queries that need visibility get one generated SQL fragment for each kind of thing. The runner's `visible` is the first to use it.
- A2: removal's notice counts what goes with the removed thing from the map: "Removed Problem set 4 and its 12 problems."
- A3: a find into a removed material is marked "from a removed material" in track 8's screens.
- A4: changing a material's kind after its finds were made does not redo them.
- A5: this lands as a change of its own on `backend` before track 5: the map, the walk test, kind replacing the textbook flag, and the runner and purge using the map. The scan fix comes first (Jack's order).

### Open

- What the finder does when a reference matches nothing visible: a "not found" state, defined in track 5's find design.

## Reversals

- The single textbook per course (track 4: `materials.textbook`, one per course, set by `material.textbook`) is reversed by D8. Jack asked for it in this grill: "Is it too late to separate textbooks and materials? should we?"

## Disagreements

None.

## Frontier

Empty.

## Log

### Gate 0: audit

Shown: two kinds of link (owns, refers); removal sets removed_at on one row; visibility is worked out by walking up the parents, copied into each place that needs it; Undo writes old values back and refuses over newer actions or PSet's work; the purge goes after a week and keeps a material while a find or set uses it; the runner pauses steps on hidden subjects. What looks wrong: visibility copied, not declared; a role outlives its target; "kept while used" covers only materials; no rule for references to removed things; undo across levels undefined. Answer: "LGTM".

### Batch 1

- Where do the dependency rules live? Options: One declared map (Recommended) / A removed flag cascades / Keep per feature. Answer: "One declared map (Recommended)".
- A reference whose target is removed. Options: Keeps working, nothing new (Recommended) / Referrer marked stale / Removal is refused. Answer: "Keeps working, nothing new (Recommended)".
- Purge rule. Options: Every reference (Recommended) / Referrer loses it. Answer: "Every reference (Recommended)".
- Roles. Options: Pointer, cleared, then re-chosen (Recommended) / Pointer, cleared, ask / Role survives removal. Answer: "pointer, cleared, ask. lets make this a setting per textbook."

### Batch 2

- Textbook setting, which meaning. Options: Several textbooks per course (Recommended) / Per-course successor setting / Per-material eligibility. Answer: "lets make a slight change. well maybe its kinda big. Is it too late to separate textbooks and materials? should we? it seems like we have two different things that should be separated ui/ux wise, but can still share much of the same backend".
- Undo across levels. Options: Restore, still hidden (Recommended) / Restore the parent too / Refuse it. Answer: "look at this from the perspective of the user. when would this happen? how? what would they expect the app to do?"
- Old removals. Options: A week, like everything (Recommended) / Restorable while kept. Answer: "A week, like everything (Recommended)".
- Work on removed targets. Options: Finish, then nothing new (Recommended) / Stop and redo. Answer: "Finish, then nothing new (Recommended)".

### Batch 3

- Textbooks. Options: Split in UI, one table (Recommended) / Separate tables / Keep as is. Answer: "split in ui, one table. but I still want questions that reference earlier problems to be able to be found".
- Undo order (explained: Ctrl+Z is newest first, and a newer notice replaces an older one, so out-of-order undo comes only from an API call or a future history screen). Options: Allow, say why hidden (Recommended) / Newest first only. Answer: "Allow, say why hidden (Recommended)".

### Batch 4

- Earlier references. Options: Textbooks and past sets (Recommended) / Every material. Answer: "Textbooks and past sets (Recommended)".
- Two matches. Options: The set's own, then ask (Recommended) / A primary textbook. Answer: "The set's own, then ask (Recommended)".
- Kind choice. Options: Detected, shown, changeable (Recommended) / Asked at upload. Answer: "Detected, shown, changeable (Recommended)".

### Earlier, in the same session (the follow-up questions after the import run)

- Two windows. Answer: "Keep last-write-wins (Recommended)".
- Old stores. Answer: "do nothing. not used yet by anybody but me. I will have you make a one-off migration directly of only the stuff I choose".
- Pure-Go PDF and OCR. Answer: "With the PDF spike, after 9 (Recommended)".
- Scans. Answer: "its likley load and thermal throttle. lets parallelize now if possible. later investiage replacing all with pure go".
- Import test. Answer: "Improve and merge it (Recommended)".
- Track 5. Answer: "Scan fix first, then 5 (Recommended)".
- Embeddings. Answer: "Keep them, decide now (Recommended)".
