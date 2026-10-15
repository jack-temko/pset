# Grilling without an ask-user tool

Some harnesses and models have no structured ask-user tool. The grill still works: the
same batch, the same options, in plain text.

## Format of a batch

Send one message, at most four questions, numbered. Each question:

```
1. <header>: <the question, two lines at most>
   A. <option> (Recommended): <why, one or two sentences>
   B. <option>: <what it costs or buys>
   C. <option>: <...>
   Or say something else.
```

For a visual choice, put the wireframe or sample under the option in a code block.

End with one line telling the user how to answer: "Reply with letters (1A, 2B, ...), or
in your own words; 'you decide' works for any of them."

## Reading the reply

- "1A, 2B" and similar are choices. Free text is read as it would be through the tool:
  it can settle several questions, add new ones, or reopen an old decision.
- "you decide" or "your call" settles that question at your recommendation, recorded as
  assumed.
- "done" or "that's enough" ends the grill: assume the rest and write the spec.
- If a reply is ambiguous, ask that one question again, alone, before the next batch.

Everything else in `SKILL.md` is unchanged: the frontier, the weights, the gates, one
push back, reversals as questions, and the same grill file.
