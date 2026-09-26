package homework

import "github.com/jackt/pset/internal/cards"

const locatePrompt = `You find one homework problem among images of textbook pages.

Reply with only JSON, no prose and no code fence:
{"image": 2, "label": "3.36", "statement": "...", "question_rect": {"x": 0.1, "y": 0.2, "w": 0.8, "h": 0.3},
 "figures": [{"label": "Figure 3.7", "rect": {"x": 0.1, "y": 0.5, "w": 0.3, "h": 0.2}}]}

- image: the number of the image the problem is on, or 0 if none of them shows it.
- label: the problem's number as the book prints it ("3.36", "2.A.4"), or "" if it has none.
- statement: the problem's full text, every part of it, exactly as the book words it. Math in LaTeX
  between $...$. No solution, no commentary.
- question_rect tightly bounds the problem's text, all of its parts, and no figure.
- figures lists each figure the problem refers to, tightly bounded, with the book's name for it.
- Coordinates are fractions of the image, in [0, 1], y from the top.
- An assignment means the problems at the end of a chapter or section. If one image shows that
  problem and another shows a worked example or practice problem with the same number, pick the
  end-of-chapter problem.
- Each image is labelled with its printed page and the part of the book it's in. A problems page
  often doesn't print its section's number: go by the label. When you're told where the problem
  is and how the book prints its number, a problem with that number on a page from that part of
  the book is the one.`

// assignmentPrompt reads a homework assignment out into due dates and
// lines. Filled with today's date, the book's title and how it numbers
// its problems.
const assignmentPrompt = `You read a course's homework assignment for a student, from what their professor gave them: a
PDF, a web page, a photo, or pasted text. Today is %s. The course's textbook is %q, and in it
%s.

Reply with only JSON, no prose and no code fence:
{"title": "Assignment #3", "groups": [{"due": "2026-09-15", "title": "Assignment #3", "rows": [
  {"kind": "book", "text": "Problem 2.1.4, p. 57."},
  {"kind": "own", "text": "There are 24 letters in the Greek alphabet. (a) How many ...? (b) ..."},
  {"kind": "other", "text": "Reading: Sections 2.1 to 2.4"}]}]}

- title: the document's own name for the assignment, or "".
- A group is everything due on one date, in the document's order. due is the date as YYYY-MM-DD,
  its year worked out from the document and today, or "" when none is given. title is the
  group's own name if it has one, else "".
- A table with a row a lecture and a column of problems (a semester schedule) is one group per
  due date, gathering every row due then.
- rows, one per line of homework as the document gives it:
  - "book": problems from the textbook. text is the line as written, the reference and every
    note with it, like "2.1: 1, 4, 6 (do c, 6 pts each)", "4.25 (no PSpice or MultiSim)" or
    "Problem 2.3.4, p. 60. Express your answer in terms of p." Keep notes in the line.
  - "own": a problem the professor wrote out. text is all of it, every part, as written, with
    math in LaTeX between $...$. A book problem with changes ("do problem 2.5.2, but for 500
    packets") is "book", the changes kept as its note.
  - "other": anything that isn't a problem to hand in: reading, quizzes done but not handed in,
    lecture notes, links.
- Leave out headings, footers, copyright lines and page numbers.`

// referencePrompt rewrites a reference the parser couldn't read in the
// book's own form, for the parser to read. Filled with the book's title,
// how it numbers its problems, and an example of its form.
const referencePrompt = `You rewrite one homework reference a student typed, for the textbook %q, in which
%s. Write each book problem it names in the book's own form, like %q, one per line, with
any parts after the number (7c, 7abc) and the professor's instructions for it in parentheses after it.
A problem known only by its page is "p. 33 #7".

Reply with only JSON, no prose and no code fence: {"lines": ["3.1 #7 (skip part d)", "3.2 #1"]}

- Only problems the text names by number. Don't guess a number it doesn't give: a description ("the odd
  ones in 2.3", "the one about the tank") or a problem written out in full is {"lines": []}.
- Problems from a set the book numbers on its own (review questions, supplementary problems) are
  {"lines": []}.`

// boxedPrompt reads a problem from the boxes a student drew around it.
const boxedPrompt = `You read one homework problem from pictures of its text, cut from a textbook in the order
it runs (it may continue from one picture to the next).

Reply with only JSON, no prose and no code fence: {"label": "7", "statement": "..."}

- label: the problem's number as printed ("7", "4.27", "2.1.4"), or "" if it has none.
- statement: the problem's full text, every part of it, exactly as the book words it. Math in LaTeX
  between $...$. No solution, no commentary.`

const repairPrompt = `You fix one malformed card for a rendering pipeline. You get its kind, the
card as written, what is wrong with it, and the JSON schema it must satisfy. Reply with only the
corrected JSON object: no prose, no code fence, no comments.`

// guideSystem is the writer's brief. It's written for any student: the
// name is for Ask, where it's a conversation; in a guide it only got in
// the way.
//
// It's a short rule list, how to work before what to write, because
// that's what GLM models follow. Tried against the long explanatory brief
// it replaced (glm-5.3-flash, three circuits problems, several runs), it
// halved the arithmetic the model does in its thinking and took the
// numbers it made up itself out of the guides: every number now comes
// from compute or solve_linear. No prompt stops the thinking checking its
// own work, and a lower reasoning_effort, the one control over thinking,
// got circuits wrong.
func guideSystem() string {
	return `You write the guide for one homework problem: a hint, then a worked solution the student checks their own work against.

How to work. Earlier rules win.
1. Never do arithmetic yourself, in your thinking or in what you write. Every number comes back from compute or solve_linear, even 2 × 3.
2. Set up, don't solve. Read the problem and any figure once and write the problem down as equations in symbols. Then send them to the tools: solve_linear for a system, compute for the rest. Send every call you can in one turn.
3. Don't work the problem out first and check it with the tools after. The tools are the working, and the checking: a sum that should balance, a substitution back, a units check are compute calls too, sent with the rest.
4. Find the method in the book with search_pages and read_page. Use view_page only for a figure or page you haven't got. Pages you give or get are printed page numbers.
5. The tools take whole expressions: never simplify one first. Give compute "4*(150/13) + 60/(15+50)" as it stands, and write solve_linear's entries as they come off the problem, like "1/10 + 1/(150/13)".
6. Every number the guide shows comes from a tool too, a simplified coefficient or a cleared equation included. When the write-up needs one, add a compute for it to the same turn.
7. Don't try to recall this problem's answer from the book or anywhere else. Work it.
8. Write the guide only when the tools have given you every number in it. Don't draft it before then.

What to write: exactly two parts, each under its own heading line, in this order.

## Hint
One or two sentences that point the way without giving the method away. No working.

## Walkthrough
The worked solution: short paragraphs, the working in cards, a steps card above all. Be warm and encouraging, like a tutor beside them, but let the mathematics do the talking.

` + cards.Prompt + `

Rules:
- Cite the book as [p. N], N the printed page number, right where a page supports what you say. Cite only pages you were shown or read.
- Use only what the problem and the book show. If something is unreadable, say so rather than guess.
- No other headings.`
}

// readPrompt reads a problem's figures into words, which the guide is
// written from. Reading is its own call, three times over, and settled
// by settlePrompt: see readFigures.
const readPrompt = `You read the figures of a homework problem for a tutor who can't see them. Write down exactly
what they show, so the problem can be solved from your words alone. Don't solve anything, and don't
add what isn't drawn. Only the figures: not their captions, and not text from the page around them.

Write one fact per line, each starting "- ". No headings and nothing else. Math goes in $...$.

For a circuit:
- The nodes first. A node is everything joined by bare wire, however long or bent: two points with
  only wire between them are one node, with one name. Follow every wire to its end before you name
  a node. Use the figure's own labels (a, b) where it has them, else capital letters. One line per
  node: its name, then everything that touches it, as "- Node A: top of the 4 Ω, left end of the
  9 Ω, left end of the 2 A source."
- Then one line per element, between two of those nodes: "- 2 A current source from A to B (its
  arrow points to B)." "- 30 V source between D and E, + at D." A dependent source with its value
  as drawn. A marked voltage or current (like $v_o$ or $i_x$): which end is + or which way its
  arrow points.
- Wires that cross without a dot: say whether you took them as joined.

Any other figure (a graph, a diagram, a geometric figure): the same way, every labelled quantity,
value, direction and relation, one per line.`

// settlePrompt makes one reading out of several. It keeps what they
// agree on: asked to check a single reading against the figure, the
// model fixed its wrong nodes but talked itself out of right arrows
// (4.62's source, both times), and a fact every reading agrees on is
// rarely the wrong one.
const settlePrompt = `You get the figures of a homework problem and several readings of them, each written on its own
for a tutor who can't see the figures. Write the one right reading.

Where the readings all agree, keep what they say: change it only if the figures plainly show
otherwise. Where they differ, look at the figures and settle it. Follow the wires, since everything
joined by bare wire is one node, and look at the arrow or the + sign itself.

Give back the whole reading, in the same form: the nodes first, then one line per element between
two of them, then any marked voltage or current. One fact per line, each starting "- ", and nothing
else. One set of node names throughout, the figure's own labels where it has them. Only what the
figures show: not their captions or text around them.`
