---
name: grill
description: Interview the user until a decision, design or plan is ironed out, then write a one-page spec they can read at a glance. Asks in weighted batches (highest-stakes questions first, four to a batch, recommended option first), regenerates the list of open questions after every batch, and stops when the important ones are answered or the user says done. Use for redesigns, new features, functionality, what to remove, architecture choices, positioning and marketing, or any time the user says "grill me" or a task has decisions only they can make.
---

# grill

Ask the user the questions that decide the outcome, in the order that makes the
rest cheap, until the spec is ironed out. Then write it down once, so it can be read
in a minute and acted on without asking again.

This is a **procedure to follow**, not a program. The asking uses the harness's own
ask-user tool (see `references/fallback.md` if there is none). Nothing runs; you keep
the state in the grill file.

## When to grill, and when not

Grill when the answer is the user's to give: what to build, what to cut, which of two
designs, who it is for, what "done" means. Do not grill for anything you can read out
of the code, the docs, the data or an earlier decision: look it up, and if you must
assume, say so. A question the sources answer wastes the user's time and shows you
did not look.

## What you need before you start (the brief)

You may be called by another skill, or directly by the user. Either way settle these,
asking only for what is missing:

- **Topic**: one line. What is being decided.
- **Output**: where the grill file goes. A caller names it; otherwise ask, defaulting
  to `ideas/<topic>-grill.md` if the repo has an `ideas/` folder, else the working
  directory.
- **Stage plan** (optional): the gates to work through, each with question seeds, the
  artifact the user confirms at its end, and its exit test. A caller supplies it (for
  example `pset-view`'s view gates). With none, use the default plan in
  `references/packs.md` that fits the topic (redesign, feature, removal, architecture,
  positioning), or one gate if none fits.
- **Locked decisions** to respect, and where they are written.
- **Point of view**: whose experience is being designed for (the tired student, the
  reader, the buyer). Every recommendation is judged from there.

## The loop

1. **Audit alone (Gate 0).** Read what exists: code, docs, earlier grills, data. Write
   a short brief of what is true today, what you could not determine, and what looks
   wrong. Show it to the user in one message; they correct facts only. Ask no design
   questions yet.
2. **Build the frontier.** List every open decision as a question: an id, its gate, the
   question, two to four options with the recommended one first and why, a weight, and
   what it depends on. Drop what the sources already answer. See
   `references/frontier.md` for weighting, dependencies and how to write a question.
3. **Ask a batch.** Take the highest-weight questions whose dependencies are settled,
   at most four, and ask them in a single call of the ask-user tool. Recommended option
   first and marked "(Recommended)". One decision per question. Show layouts and other
   visual options as previews. Do not batch a question with one that depends on it.
4. **Fold in the answers.** Log the batch verbatim. Turn each answer into a decision
   (`D<n>`: what, why, what it beat). Read free text carefully: it can settle several
   questions at once, add new ones, or reopen an earlier decision (mark it reopened,
   never silently overwrite). If an answer contradicts a locked decision, do not obey or
   refuse it: ask it as an explicit reversal (see below).
5. **Regenerate the frontier** from what you now know, drop what is settled, add what
   the answers exposed, re-weight, and go to 3.
6. **End a gate** when its high-weight questions are answered or deliberately deferred.
   Write the gate's artifact, show it in a short recap, and let the user confirm or
   amend it before the next gate. A later answer that contradicts a confirmed gate
   reopens that gate.
7. **Stop** when every gate has ended, or when the user says they are done ("done",
   "that's enough", "wrap up"). Whatever is left takes the recommended default and is
   listed under **Assumed**, so the user can overrule it at a glance. Never keep asking
   past "done".
8. **Write the spec** in the format of `references/grill-file.md`: the one-page summary
   on top, the full log below. Save it at the output path. Then **stop and hand it
   back for the user's OK.** Grilling does not build anything unless the brief says so.

## Rules that keep it useful

- **Recommend first.** Every question carries your recommendation and one line of why.
  The user should be able to confirm a whole batch by agreeing. Judge each option from
  the point of view in the brief, and say what it costs that person.
- **Push back once.** If an answer looks worse for that person than your
  recommendation, say why in one or two lines and ask once more. Then record their
  choice, note the disagreement in the file, and never argue it again.
- **Reversals are questions.** "This reverses <decision>, written <date> in <file>.
  Reverse it?" If yes, record the reversal and its reason in the grill file and in the
  document that held the decision. If no, choose the next best option.
- **Let the user delegate.** An answer of "you decide" or "your call" settles the
  question at your recommendation, recorded as assumed. Do not ask twice.
- **Be short.** The user may be tired. Questions fit two lines, option descriptions one
  or two sentences, batches at most four. No preamble before a batch beyond the
  frontier's state in a line or two.
- **Do not lead.** Options are distinct, not variants of one idea, and the ones you do
  not recommend get their strongest honest case.
- **Never invent the user's answers.** An assumption is labelled assumed. A decision
  exists only because the user made it or delegated it.
- **Style.** No em dashes. Plain words. Name things as the user does.

## References

- `references/frontier.md`: weighting, dependencies, batching, writing a good question.
- `references/grill-file.md`: the grill file, heading by heading.
- `references/packs.md`: default gates and question seeds for redesign, feature or
  functionality, removal, architecture, and positioning or marketing.
- `references/fallback.md`: grilling without an ask-user tool.
