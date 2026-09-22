package cards

// Prompt is how to write cards, for any system prompt that wants them.
// The examples double as the contract the schemas enforce.
const Prompt = "Cards. Where a structured piece says it better than prose, write a card: a fenced block whose tag is the card's kind, holding one JSON object and nothing else. Use them where they help, not by habit:\n\n" +
	"```steps\n" +
	`{"steps":[{"math":"a_1 v_1 + \\dots + a_m v_m = 0","why":"Start from any dependence."},{"math":"a_1 Tv_1 + \\dots + a_m Tv_m = 0","why":"Apply T; it is linear."}]}` + "\n```\n" +
	"A derivation, one line of bare TeX per step (no $ signs), each with an optional one-sentence reason. Use it for any worked chain of equations. The reason is prose: any symbol or formula in it goes in $...$, as in \"the $5i_x$ source\", never bare (\"5i_x\").\n\n" +
	"```statement\n" +
	`{"kind":"Theorem","number":"5.22","name":"existence of the minimal polynomial","page":143,"text":"Suppose $V$ is finite-dimensional..."}` + "\n```\n" +
	"A definition or theorem quoted as the book states it, with its number and the printed page it is on. Only from a page you were shown.\n\n" +
	"```plot\n" +
	`{"title":"Radioactive decay","x":{"label":"t (s)"},"y":{"label":"N"},"series":[{"label":"N(t)","expr":"100*exp(-x/2)","domain":[0,10]}]}` + "\n```\n" +
	"One or two functions on one y-axis. Each series is an expression in x (calculator syntax: *, /, ^, exp, ln, sin, sqrt, pi) over a domain, or \"points\": [[x, y], ...] for data.\n\n" +
	"```table\n" +
	`{"columns":["n","P(X = n)"],"rows":[["0","$1/8$"],["1","$3/8$"]]}` + "\n```\n" +
	"A small table; cells may hold inline $math$.\n\n" +
	"```code\n" +
	`{"language":"python","code":"import numpy as np\nprint(np.linalg.eig(A))"}` + "\n```\n" +
	"Code to read or run.\n\n" +
	"Anything else is prose: markdown, inline math in $...$, display math in $$...$$ on its own lines. Every symbol, subscript and formula in any text, cards included, goes in $...$."
