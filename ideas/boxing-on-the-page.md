# Boxing a problem on the page

## Status

**Done** · phase 2 (branch `boxing-on-the-page`, 2026-09-25). Spec in
`design/workspace.md`, "Boxing a problem on the page". Built as decided:
both ways in, several boxes over pages and columns, words and figures.

Answers to the open questions, for Jack to confirm: a box's kind is
chosen (the bar's Words or Figure for the next box, a click on its
label to switch), not read by the model; and boxing adds one problem at
a time (Done ends the session).

## Information

### Why

However good finding gets, some book or layout will beat it. A person
can always see where the problem is, and the scan is already on screen
beside the walkthrough. Drawing a box around it works for any book and
any layout.

### Decided (2026-09-25)

One component and one piece of logic, two ways in:

1. **Adding a question.** Box a problem on the scan, and it becomes a
   question in the set you're in: its statement read from the boxes,
   its figures from the boxes you mark as figures. No reference to type
   or find.
2. **A find that failed.** The failed state's main way out is "Show me
   where it is": box it, and the question is found there. The page
   number and paste stay as the lesser ways out.

It must handle a problem that doesn't sit in one rectangle, with
**several boxes**:

- over two pages (the foot of one, the top of the next),
- across columns on a two-column page,
- with its figure on another page, or a figure shared by several
  problems.

### How it could work

- A mode on the scan: the cursor becomes a crosshair and dragging draws
  a box (today dragging pans a zoomed page, so the mode switches that
  off). Boxes can go on any page; the scan scrolls while you draw.
- Each box is marked as **text** or **figure**, and they're kept in
  order. A small floating bar (like the zoom bar) says how many boxes,
  and offers Done and Cancel.
- Done sends the boxes: text boxes are read in order into the statement
  (from the text layer, or by the model for a scan), figure boxes become
  the question's figures, cropped as today. For a failed find, the
  question takes those instead of a find; for a new question, it's
  added and goes on to reading its figures and writing its guide.
- A question stores its boxes as a list of (page, rect, kind), which
  replaces today's single page, statement rect and figure rects.

### Weight

The biggest UI piece in these plans: ~400 lines of UI (the mode, drawing
across pages, the bar, marking and reordering boxes), ~100 on the
server, a migration from one rect to a list. It needs a spec in
`design/workspace.md` and a look on `/components` for the bar.

### Risks and later

- The scan already pans and zooms; a drawing mode must not fight either,
  and must work at every zoom.
- A problem made of boxes on several pages breaks the assumption that a
  question has one page: the page chip, the worksheet crop and the
  guide's "The problem is on p. N" all need a first page and the rest.
- The worksheet prints figures; a problem spread over two pages prints
  as several pieces.

### Open

- Whether a box's kind (text or figure) is chosen, or read by the model.
- Whether boxing several problems at once, in a row, adds each as its
  own question.
