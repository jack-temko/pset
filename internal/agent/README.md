# agent

The tutor's hands, shared by Ask and the homework walkthrough writer so a
guide checks its work exactly as an answer does.

- **Tools** (printed page numbers in and out; the library speaks PDF
  pages, and each tool converts once): `search_pages`, `read_page` (up to
  three pages), `view_page` (the image goes into the model's context as
  the next user message), `compute` (a list of expressions in one call,
  a numbered line each) and `solve_linear` (mathx, exact).
- **`Loop.Run`** streams a round, runs any tool calls, and goes again,
  until the model answers without a tool or `Rounds` runs out. Then it's
  told to answer with what it has, the tools still declared and
  `tool_choice: "none"`; a model that calls one anyway (Gemini did) is
  asked once more with its work written out as plain text and no tools.
  Each assistant turn keeps its reasoning, which the llm client sends
  back to endpoints that take it.
- **Carrying on**: `Round` hands the caller the conversation after each
  tool round. Given those messages back, `Run` goes on from the next
  round, counting the ones before toward `Rounds`.
- **Pages in view**: `Shown` is the pages the messages already show as
  images. `view_page` on one of those, or on a page viewed earlier in the
  run, points back at it instead of sending the same image again.
- **Steps**: every tool call is a step, present tense while it runs and
  past tense with its count after. A thinking model's reasoning is a step
  too: "Thinking…", then "Thought for 12s". `Writing` fires when a
  round's answer text starts.
- `Prompt` tells a system prompt how to use the tools.
- **Memory** (optional): with `Loop.Memory` set, `System` goes out each
  round with every preference after it, read fresh, so a save in Ask
  reaches a walkthrough running on the same book within a round. Only
  with `Student` (Ask) does the model get `remember` and `forget`, and its
  rules; the walkthrough writer only reads. Saves are steps ("Remembered ·
  Use SI units"), and `Remembered` hands the caller the note for its Undo.
