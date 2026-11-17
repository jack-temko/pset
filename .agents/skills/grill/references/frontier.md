# The frontier

The frontier is the list of open questions, kept current after every batch. It lives
in the grill file under **Frontier** while the grill runs, so a session that is
interrupted can resume from it, and it is empty when the grill ends.

## A frontier entry

```
Q<n> [gate] [weight] depends: Q<m>|none
  question: one decision, in the user's words
  options:  A (recommended, why) / B / C / D (2 to 4, distinct)
  source:   what you checked that did not settle it
```

Drop an entry the moment a source or an earlier answer settles it.

## Weight

Score each entry 1 to 5 on three things and multiply:

- **Reversal cost**: how expensive it is to change this later (5: it shapes the data
  model or the whole layout; 1: a label).
- **Unlocks**: how many other questions or decisions this one settles or changes
  (5: most of a gate hangs on it; 1: none).
- **Uncertainty**: how many plausible options there are and how unsure your own
  recommendation is (5: several good options, no clear winner; 1: obvious).

Order by weight, highest first. Ties go to the question that blocks others. This is a
starting formula: if a real grill shows it puts things in a wrong order, adjust it and
say so in the file.

## Dependencies

A question that depends on another is not asked until the other is answered, and never
in the same batch. Typical chains: purpose before content, content before layout, layout
before states, states before data. When you cannot tell whether two are independent,
treat them as dependent.

## Composing a batch

- At most four questions per call (the ask-user tool's limit). Fewer is fine: three
  sharp questions beat four padded ones.
- Highest weights whose dependencies are met. Mix rather than stack: if the top four
  are all about layout, still fine, but prefer four different decisions over four
  variants of one.
- A multi-select only when the choices are not mutually exclusive (which extras to
  include). Everything else is single-select.
- After the batch, say in one line what is settled and what comes next, then ask.

## Writing a good question

1. **One decision.** "Where does it live, and who can edit it?" is two questions.
2. **Distinct options.** Two to four, different in kind. Never pad with a fake option
   to reach a number. Never include a "something else" option: the tool provides free
   text.
3. **Recommendation first, marked** "(Recommended)", with the reason in its
   description. The reason names what it buys for the person in the brief.
4. **Say what each choice costs** that person: taps, reading, risk, effort, reversibility.
5. **Show, do not describe, visual choices.** The user compares things, not words.
   - **Copy** (a label, a line of text): put a sample in the option's preview.
   - **A layout or any visual design:** build it, do not draw it. If the repo has a
     component library, make the options from the real components on static sample data
     (a page that renders them, each option labelled), start it where the user can
     open it, and point the question at it by URL. ASCII wireframes are hard to read and
     never look like the thing: use them only when there is nothing to build with, and
     say so. The ask tool's previews are text; they cannot show a layout.
6. **Header** is a short label (12 characters) naming the decision.
7. **Plain words.** No jargon the user has not used. Their names for things.
8. **Do not ask what you can find out.** Read first. If it is in the code, the docs or
   an earlier decision, it is a fact, not a question.

## Reading answers

- A chosen option settles that question.
- Free text may settle several questions, add new ones, or contradict an earlier
  decision. Re-derive the frontier from it; do not treat it as one answer.
- "You decide" settles the question at your recommendation, recorded as assumed.
- A skipped question stays on the frontier and drops in weight for this session unless
  it blocks others.
- An answer that contradicts a locked decision becomes a reversal question, not a
  silent override.

## Knowing when to stop

A gate is finished when every entry with weight in the top half is answered or
deferred on purpose. The remainder are taken at their recommended option and listed
as assumed. The grill is finished when every gate is, or the user says they are done.
If the user says done mid-gate, stop asking at once, assume the rest, and write the spec.
