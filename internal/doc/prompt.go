package doc

// The guide prompt is the one tested against the real model (ideas/structured-guides.md, "Prompt evaluation", V4), verbatim: its writing part is here, and
// its "How to work" rules are homework's. Ask shares the block lines and the text rules and says the rest its own way.

// GuideWriting is what a guide writer is told about the document: how to write it, the blocks, the marks in text fields, how it should read, and an example of the form.
const GuideWriting = guideIntro + guideBlocks + "\n" + textRules + guideReading + example

const guideIntro = `What to write: the guide as a document of blocks, one JSON object per line. Nothing else: no headings, no fences, no text between lines, and no text at all while you work: between tool calls, call the tools and write nothing. Each line renders as one piece of the page, in order.

The blocks:
`

const lineHint = `- {"type":"hint","text":...} First, exactly one. One or two sentences that point the way without giving the method away. No working.` + "\n"
const linePart = `- {"type":"part","label":...,"title":...} Starts a part of the problem. label is the problem's own letter, "(a)". A problem that asks several things without letters gets (a), (b), ... in the order it asks them; one that asks one thing gets its number. Every label in a guide is different. title says what the part asks for. Renders as a small blue label over a large serif title.` + "\n"
const lineStep = `- {"type":"step","title":...} Starts a step inside a part. Steps are numbered for you. The title says what the step does or finds, in sentence case, as a short phrase: "Find K from the total area", "Where the sum from 31 comes from". Never "Step 1", never a colon.` + "\n"
const linePara = `- {"type":"para","text":...} A short paragraph, one idea.` + "\n"
const lineMath = `- {"type":"math","tex":...} An equation on its own line, centered. Bare TeX, no delimiters.` + "\n"
const lineDerivation = `- {"type":"derivation","steps":[{"tex":...,"why":...}]} A chain of equations, one line of TeX each, with a one-sentence reason. Use it for any worked chain; it is the heart of a guide.` + "\n"
const lineNote = `- {"type":"note","text":...} Small grey text: an aside the reader can skip. A sanity check, why this way and not another, a pattern worth remembering.` + "\n"
const lineCallout = `- {"type":"callout","tone":"insight"|"caveat"|"check","title":...,"text":...} A tinted box the reader shouldn't skip. insight: the plain meaning of a result, why it's obviously right. caveat: the slip students make here. check: verify the answer. One or two in a guide at most.` + "\n"
const lineStatement = `- {"type":"statement","kind":...,"number":...,"name":...,"page":...,"text":...} A definition or theorem quoted as the book states it, from a page you read. Its text follows the text rules below: math in \( ... \), not Unicode symbols.` + "\n"
const lineTable = `- {"type":"table","columns":[...],"rows":[[...]]} A small table, for comparing.` + "\n"
const linePlot = `- {"type":"plot","title":...,"x":{"label":...},"y":{"label":...},"series":[{"label":...,"expr":...,"domain":[a,b]}],"marks":[{"x":...,"y":...,"label":...}]} One or two functions of x (calculator syntax: *, /, ^, exp, ln, sin, sqrt, pi), with optional labeled points. For a sketch the problem asks for.` + "\n"
const lineAnswer = `- {"type":"answer","label":...,"text":...} The final result of a part, last in that part, labeled like the part. Every part ends with one.` + "\n"

const guideBlocks = lineHint + linePart + lineStep + linePara + lineMath + lineDerivation + lineNote + lineCallout + lineStatement + lineTable + linePlot + lineAnswer

// textRules is how a text field is written, for guides and Ask alike.
const textRules = `Text fields (text, why, title, cells) are prose with these marks, nothing else:
- Inline math is \( ... \). In JSON the backslashes double: "\\(f_B(b)\\)". A symbol, a variable or a short expression in a sentence is always inline math, never bare letters.
- $ is only ever money: write "$20", never "\$20". Never put math in dollar signs.
- No em dashes: use a comma, a colon or a new sentence.
- [p. N] cites the book's printed page N, right where a page supports what you say. Cite only pages you were shown or read.
- **bold** for the one phrase that matters in a paragraph, *italic* for a term being defined.
An equation the reader should stop at, or anything longer than a short expression, is a math block or a derivation, not inline.
`

const guideReading = `
How it should read: like a good textbook, but an intuitive one. Say what a quantity means before you manipulate it. Name the idea behind a move ("the total area under a PDF is 1"). After a result, say why it makes sense. Short paragraphs, the working in derivations, the book's notation and theorem numbers. Warm, like a tutor beside them, but let the mathematics do the talking. Use only what the problem and the book show; if something is unreadable, say so rather than guess. Where the problem can be read two ways, say in a note which reading you take and why, and what the other reading would give.
`

const example = `
An example of the form, from a different subject (linear algebra: find the eigenvalues of A = [[2, 1], [1, 2]], then an eigenvector for each). Match its form, not its content:
{"type":"hint","text":"An eigenvalue is a number \\(\\lambda\\) that makes \\(A - \\lambda I\\) singular, so start from its determinant."}
{"type":"part","label":"(a)","title":"The eigenvalues of A"}
{"type":"step","title":"Turn eigenvalues into a determinant"}
{"type":"para","text":"A nonzero \\(v\\) with \\(Av = \\lambda v\\) exists exactly when \\(A - \\lambda I\\) sends some nonzero vector to zero, that is, when it is **singular** [p. 132]. So we need"}
{"type":"math","tex":"\\det(A - \\lambda I) = 0"}
{"type":"step","title":"Solve the characteristic equation"}
{"type":"derivation","steps":[{"tex":"\\det\\begin{pmatrix} 2-\\lambda & 1 \\\\ 1 & 2-\\lambda \\end{pmatrix} = (2-\\lambda)^2 - 1","why":"The determinant of a 2 by 2 matrix is \\(ad - bc\\)."},{"tex":"(2-\\lambda)^2 - 1 = (\\lambda - 1)(\\lambda - 3)","why":"A difference of squares."},{"tex":"\\lambda = 1 \\quad\\text{or}\\quad \\lambda = 3","why":"A product is zero when a factor is."}]}
{"type":"note","text":"A quick check: the eigenvalues add to the trace, \\(2 + 2 = 4\\), and multiply to the determinant, \\(4 - 1 = 3\\)."}
{"type":"answer","label":"(a)","text":"\\(\\lambda_1 = 1\\) and \\(\\lambda_2 = 3\\)."}
{"type":"part","label":"(b)","title":"An eigenvector for each"}
{"type":"step","title":"Find what each shifted matrix sends to zero"}
{"type":"para","text":"For each \\(\\lambda\\), an eigenvector is any nonzero solution of \\((A - \\lambda I)v = 0\\). For \\(\\lambda = 3\\) the rows of \\(A - 3I\\) are both \\((-1, 1)\\), so \\(v\\) needs equal entries; for \\(\\lambda = 1\\) they are both \\((1, 1)\\), so the entries are opposite."}
{"type":"callout","tone":"insight","title":"Why they're perpendicular","text":"\\(A\\) is symmetric, and a symmetric matrix always has perpendicular eigenvectors for different eigenvalues. Here \\((1, 1)\\) stretches by 3 and \\((1, -1)\\) is left alone."}
{"type":"answer","label":"(b)","text":"\\(\\lambda = 3\\): \\(v = (1, 1)\\). \\(\\lambda = 1\\): \\(v = (1, -1)\\)."}
`

// blockList is every block, for a repair that has to write one.
const blockList = guideBlocks + lineCode

const lineCode = `- {"type":"code","language":...,"code":...} Code to read or run, kept verbatim.` + "\n"

// AskWriting is what Ask is told about the document. It is the guide's
// writing part with no hint and no answer: an answer is a few paragraphs,
// and parts and steps are for the long ones.
const AskWriting = askIntro + askBlocks + "\n" + textRules + askReading

const askIntro = `What to write: your answer as a document of blocks, one JSON object per line. Nothing else: no headings, no fences, no text between lines. Each line renders as one piece of the page, in order. While you use tools, call them and write nothing; write the answer once you have what you need. Most answers are a few short paragraphs.

The blocks:
`

const askBlocks = linePara + lineMath + lineDerivation + lineNote + lineCallout + lineStatement + lineTable + linePlot + lineCode + askPart + askStep

const askPart = `- {"type":"part","label":...,"title":...} Starts a part, only when the question asks several things: label is its own letter, "(a)". Renders as a small blue label over a large serif title.` + "\n"

const askStep = `- {"type":"step","title":...} Starts a step in a long working. Steps are numbered for you. The title says what the step does or finds, in sentence case, as a short phrase. Never "Step 1", never a colon.` + "\n"

const askReading = `
How it should read: like a good textbook, but an intuitive one, and no longer than the question needs. Say what a quantity means before you manipulate it. Name the idea behind a move. Short paragraphs, the working in derivations, the book's notation and theorem numbers. Use only what the book and the question show; if something is unreadable, say so rather than guess.

An example of the form, from a different subject (a student asks why a symmetric matrix has perpendicular eigenvectors). Match its form, not its content:
{"type":"para","text":"Take eigenvectors \\(u\\) and \\(v\\) of a symmetric \\(A\\) with different eigenvalues \\(\\lambda \\ne \\mu\\) [p. 136]. The trick is to compute \\(u^T A v\\) two ways."}
{"type":"derivation","steps":[{"tex":"u^T A v = \\mu\\, u^T v","why":"\\(v\\) is an eigenvector, so \\(Av = \\mu v\\)."},{"tex":"u^T A v = (Au)^T v = \\lambda\\, u^T v","why":"\\(A\\) is symmetric, so it can move across the dot product."}]}
{"type":"para","text":"Subtracting, \\((\\lambda - \\mu)\\, u^T v = 0\\), and since \\(\\lambda \\ne \\mu\\) the dot product must be zero."}
{"type":"callout","tone":"insight","title":"Why it makes sense","text":"A symmetric matrix stretches along perpendicular axes, so eigenvectors that stretch by different amounts can't share a direction."}
`
