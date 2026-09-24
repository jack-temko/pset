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
  end-of-chapter problem.`

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
// written from. Reading is its own call because a model reads a figure
// well when that's all it's asked, and badly in the middle of solving:
// the writer that got 4.25 wrong had the 2 A source backwards after
// minutes of doubt, and asked only which way it pointed, the same model
// said right every time.
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

// checkPrompt checks a reading against the figures. It is what makes a
// reading trustworthy: a first reading gets a node or a polarity wrong
// about one time in six, and a second look, told what to look for,
// caught every one of those in testing.
const checkPrompt = `You check a reading of a homework problem's figures, written for a tutor who can't see them,
against the figures themselves, line by line, and give it back corrected.

Look at the figures again for every line; don't trust the reading. In a circuit, follow every wire
to its ends, since everything joined by bare wire is one node, and check each element sits between
the right two nodes. Check each source's direction again: which way a current source's arrow
points, which side of a voltage source is +. Check each marked voltage's + end and each marked
current's arrow. Drop anything that isn't part of the figures.

Give back the whole reading, corrected, in the same form: one fact per line, each starting "- ",
and nothing else. Keep what's right as it is.`
