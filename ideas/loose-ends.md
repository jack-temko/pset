# Loose ends

## Status

**Idea** · any time. Small things noticed along the way, each a short
branch of its own. Move one into its own file if it grows.

## Information

- **"Read it again" discards a guide without asking.** In the figure
  reading's editor it throws away the reading and the guide. Every
  delete asks first now (design/workspace.md); this probably should too.
- **Readings sometimes rename the figure's own labels.** 4.62's reading
  called terminal a's node "Node B". Correct, but confusing to check
  against the figure.
- **`\textit{PSpice}` shows as raw LaTeX** in 4.25's statement: text
  commands outside math aren't rendered.
- **A guide can look up the answer key.** The 4.43 guide read Appendix D
  to confirm its answer, against its brief's "don't recall this
  problem's answer".
- **Figure crops take in text around the figure.** 4.62's crop includes
  its caption and the next problem's first line.
- **Figure crops can cut the figure off.** 4.27's crop stops at "40"
  on the right: the figure box the finder's model gave is too tight.
  Boxing it by hand fixes one question; the padding could grow for
  figures near a column's edge.

### From the finished ideas

What was still open in the files marked Done, moved here so each is a
short branch of its own. The file it came from keeps its decisions and
says where the rest went.

- **Should the assignment vote on how a book numbers its problems?** The
  Math 220 sheet's `1.1: 1, 7` says "per section" as plainly as the book
  does. (`book-structure.md`)
- **Boxing: two answers to confirm.** Built as: a box's kind (words or
  figure) is chosen, with the bar's Words or Figure for the next box and a
  click on its label to switch, not read by the model; and boxing adds one
  problem at a time (Done ends the session). Both were decisions made for
  Jack to confirm. (`boxing-on-the-page.md`)
- **A photographed assignment has no "retake" in the review**, and reading
  one is untested on a real photo. More useful for screenshots than for
  photos of the board. (`importing-assignments.md`)
- **A problem the professor renumbers** (4.27 became 4.28) shows in an
  updated assignment as a new line and a removal, not as a change.
  (`importing-assignments.md`)
- **Ask's prompt is untested.** GLM-5.3-Flash answered an Ask partly in
  plain prose between tool calls and reached for guide-only blocks (hint,
  answer): the repair loop rewrote it in four calls, and a first sentence
  still showed as a raw block. The guide prompt got an A/B; Ask's needs
  one. DeepSeek V4.1 Flash's Ask came out clean. (`structured-guides.md`)
- **Gemini through OpenRouter stops mid-guide.** Gemini 3.8 Flash wrote two
  of four guides and stopped without an answer on the other two, nudge
  included: likely its tool loop wants `reasoning_details` handed back, not
  the plain `reasoning` PSet sends. (`structured-guides.md`)
- **Does an Ask answer with parts want an Answers veil?** None, as
  decided. Revisit if one does. (`structured-guides.md`)
- **Where answers render inside a walkthrough**: in place at each part's
  end, with the card again at the end, or only in place. The page did
  both. (`structured-guides.md`)
- **A plot's marks** could be computed (the crossing of two series) rather
  than given as numbers. Not decided; given numbers are simpler.
  (`structured-guides.md`)
- **The book shelf's usage line.** Usage is recorded per call for a book's
  import, but only the shelf row's UI is owed. (`model-usage.md`)
- **Model usage, deferred by design**: live totals while a job runs (the
  working lines already say how it's going), per-call detail with the
  cached and reasoning token split and the host (in the calls table and
  the JSONL, not on the card), and totals across jobs (per book, per
  month, all-time; each is a query on the calls table, with no UI decided).
  (`model-usage.md`)
- **The usage sink writes on the model call's own path.** One insert is
  about 90 µs uncontended, so it stays synchronous. Under a long write (the
  database is one writer) a call's return waits up to the 5 s busy timeout,
  and then its row is lost with only a log line. A buffered writer would
  decouple them, at the price of a flush at shutdown and at Reset.
  (`model-usage-fixes`)
