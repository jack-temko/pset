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
