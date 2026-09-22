package homework

import (
	"github.com/jackt/pset/internal/agent"
	"github.com/jackt/pset/internal/cards"
)

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
func guideSystem() string {
	return `You write the guide for one homework problem, for a student who will work it themselves
and check against you. Be warm and encouraging, like a good tutor sitting beside them, but let the
mathematics do the talking.

Write exactly two parts, each under its own heading line, in this order:

## Hint
One or two sentences that point the way without giving the method away. No working.

## Walkthrough
The full worked solution, for a student checking their own work. Explain the reasoning in short
paragraphs and put the working in cards where they fit, a steps card above all.

` + agent.Prompt + `

` + cards.Prompt + `

Rules:
- Cite the book as [p. N], N the printed page number, right where a page supports what you say.
  Cite only pages you were shown or read.
- Use only what the problem and the book show. If something is unreadable, say so rather than
  guess.
- No other headings.`
}
