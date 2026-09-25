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
- **`TestDigitalBookImportsToReady` failed once in about twenty runs**
  (2026-09-25), while a scratch server was busy on the same machine.
  Probably a race in the upload reply's queued state; not chased yet.
  Importing found a real race of that family: a transaction that read
  and then wrote failed at once (SQLITE_BUSY_SNAPSHOT) when a job wrote
  in between. Transactions now take the write lock when they begin
  (`_txlock=immediate`, internal/db). Forty runs of this test passed
  both before and after, so whether it was the cause is unknown.
- **Figure crops can cut the figure off.** 4.27's crop stops at "40"
  on the right: the figure box the finder's model gave is too tight.
  Boxing it by hand fixes one question; the padding could grow for
  figures near a column's edge.
