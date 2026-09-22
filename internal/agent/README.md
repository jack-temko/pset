# agent

The tutor's hands, shared by Ask and the homework walkthrough writer so a
guide checks its work exactly as an answer does.

- **Tools** (printed page numbers in and out; the library speaks PDF
  pages, and each tool converts once): `search_pages`, `read_page` (up to
  three pages), `view_page` (the image goes into the model's context as
  the next user message), `compute` and `solve_linear` (mathx, exact).
- **`Loop.Run`** streams a round, runs any tool calls, and goes again,
  until the model answers without a tool or `Rounds` runs out (then it's
  told to answer with what it has).
- **Steps**: every tool call is a step, present tense while it runs and
  past tense with its count after. A thinking model's reasoning is a step
  too: "Thinking…", then "Thought for 12s". `Writing` fires when a
  round's answer text starts.
- `Prompt` tells a system prompt how to use the tools.
- **Memory** (optional): with `Loop.Memory` set, the model gets
  `remember` (and, with `Student`, `from_student` and `forget`), and
  `System` goes out each round with memory's rules and every note after
  it, read fresh, so a save by one loop reaches another on the same book
  within a round. Saves are steps ("Remembered · Theorem 1.5 · p. 22"),
  and `Remembered` hands the caller the note for its Undo.
