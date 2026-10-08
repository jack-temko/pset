# homework

Problem sets. A set belongs to a book; its questions are found in the book
(or aren't in it), given a figure reading if they have figures, and a hint
and a walkthrough. Specs: `design/workspace.md` ("Homework", "Importing an
assignment", "The professor's notes", "Boxing a problem on the page") and
`design/import.md`. The document a guide is written as is `internal/doc`.

## Tables

`homework` (a set: title, due date, turned-in time), `questions` (in a
set, ordered by `position`; the statement, professor's notes, page,
`pinned_page`, `rect` and `figures` once found, the boxes the student drew,
the figure `reading` and its `reading_doubts`, the `hint` and
`walkthrough` blocks, `revealed`, saved tool `rounds` and the `memory` lines
its guide made, `state`, `failure` and `reason`, and a `rev` that a
trigger bumps on every change so no write can forget it), and
`assignment_reads` (an imported PDF, page or text being read in the
background, and its result until the student reviews it). Both cascade
from the book, and questions from their set.

## Questions

A question's state: `pending` (waiting), `locating`, `located` (found,
waiting for its guide), `reading` (its figures being read, when it has
some), `writing` (the hint may already be out), `ready`, `failed`, and
`unwritten` (found, with no guide: the guides written before structured
guides, asked for with `POST /api/questions/{id}/guide`). A failure has a
kind the page acts on: `not_found` (give the page, or paste it),
`generation` (try again), `unavailable` (the provider was busy), `setup`
(the key: Settings).

A question is up to three jobs in the `question` lane (two at a time):
**locate** (`find.go`), which queues the next step in the same write as
its result; **read** (`question.go`), for a question with figures; then
**guide**. Finds and readings run at priority 1, guides at 0, so a free
slot always takes a question still to be found or read first; a running
guide is never interrupted. A restart puts a step back to waiting: a find
starts over, a guide carries on from its last saved round. An assignment
read is a job of its own kind in the `assignment` lane.

Events: `homework.changed/removed`, `question.changed/removed` (the
question with its `rev`; a copy no newer than the one held is ignored),
`assignment.changed/removed`. A new question is announced before the queue
is woken, so nothing streams into a question the page doesn't hold.

## Files

| File | Holds |
|---|---|
| `service.go`, `store.go`, `http.go`, `wire.go` | Sets and questions: behaviour, SQL and migrations, routes, wire types. |
| `question.go` | The three steps as jobs, failures in words, reading figures, writing guides. |
| `find.go`, `locate.go`, `scope.go`, `reference.go`, `rewrite.go`, `prompts.go` | Finding a problem: the reference parser, the scope it must lie in, the ladder, the model's part. |
| `boxes.go` | Boxing: a question made from boxes the student drew, or a failed find pointed out. |
| `notes.go` | The professor's notes: kept with the question, followed by the guide. |
| `assignment.go`, `reads.go`, `update.go` | Importing an assignment: reading a file, page or text into rows for review, and updating sets from a document. |
| `worksheet.go` | The worksheet PDF and figure crops. |

## How a problem is found, read and written

**Finding a problem starts from its reference** (2026-09-25). A
question is read as the book problems it names, in the book's own
numbering (`reference.go`; the numbering is `internal/probnum`, detected
at import). When the numbering and the contents can place it, it is
looked for there and only there (`scope.go`): a section's pages from its
Problems heading to its end, a chapter's problems, or a cited page and
its neighbours. The page whose text has the problem's own line ("7."
after the section's heading, "4.25 ...", "2.1.4 ...") comes first, then
the pages memory points to, then the rest of the span, a few at a time.

**Where the text can't say, the contents and the Reader do** (2026-10-08).
A chapter whose pages have no text, or lost it, has no heading or
problem line to go by: it used to be shown from its first page, its
teaching, 16 pages at most, so the problems at its end were never
reached and a worked practice problem with the same number was taken
(4.69, 10.47, 13.47, 16.49 in the circuits book). Now the contents'
"Problems" entry inside the part (`probnum.Part.ProblemsStart`) comes
right after the exact hits, and without one the span is shown from its
end back. The Finder's label isn't the check any more: it echoed the
number it was asked for on a practice problem's page, and copied the
prompt's example ("3.36") on the right one. The Reader is: writing the
problem out, it replies NOT ON THIS PAGE when the page shows another
problem, a practice problem with the number, or the section before's
problem (printed above the section's heading), and the find asks again
with the rest of the batch, less that page.
Each page shown to the model carries its printed page and section, and
the model is told how the book prints the number, since a problems page
rarely prints its section. A pick outside the span is another problem
with the same number and doesn't count; a reference that can't be found
there fails as "Looked through Section 3.1 (p. 106 to p. 112)...", rather
than landing on a wrong page. References that name no numbers, and
books without contents, keep the older ladder: exact tiers, search,
memory, then a sweep of the chapter.

**Figures are read out before the guide** (2026-09-24). A misread
figure was the likeliest way for a guide to be wrong: the 4.25 guide had
its 2 A source backwards. Three things fixed it:

- **The model's crops are cut from a 2400px render**, not the 1800 the
  walkthrough and the worksheet use. At 1800 that source's arrow read as
  pointing left eleven times in eleven; at 2400, right every time.
- **Reading is its own step.** Three quick readings (low effort, at
  once), each listing every node, then every part between two nodes with
  its value and direction, are settled into one by a careful call that
  keeps what they agree on and looks at the figure where they differ.
  One reading alone got a node or an arrow wrong about one time in four;
  a single reading "checked" against the figure had its wrong nodes
  fixed but its right arrows talked out of. Settled, the set's hardest
  five figures came out right ten times in ten.
- **The guide works from the reading**, which opens its brief under the
  figures: "where your own look at the figures disagrees, the reading
  is right". The student sees the reading and can correct it
  (design/workspace.md); a corrected reading writes the guide again and
  is the student's word, over the figure.

A reading that fails leaves none, and the guide reads the figures itself.

**The writer sees the problem's figures, not its page.** A problem with
figures opens with them cut from the page (as the walkthrough shows
them, from the wider render); one without gets the page. The pages memory names that a search
for the problem also finds open the guide too, so the writer doesn't
spend a round reading them. Each tool round is saved on the question as
it finishes, so a restart, or a retry of the same problem, carries on
from the last round instead of starting over. A model's reasoning goes
back with its turn through OpenRouter, so it carries on from its own
thinking rather than redoing it after every tool call; only hosts
serving full-precision weights are used, and a guide's calls share one
OpenRouter session (internal/llm/README.md, "Providers").
The writer's brief is a short rule list, how to work before what to
write: set the problem up as equations and let `compute` and
`solve_linear` do every number in the guide, checks included.
