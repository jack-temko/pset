# UsageModal and BookUsageDialog

What one job spent, in full, behind the [usage line](../usage/README.md); and
what a whole book has spent, from the book menu's Usage item. Both are a
[Dialog](../dialog/README.md) at its `table` width, closed with Close (or
Esc), and both hold [Tables](../table/README.md).

## UsageModal

The totals' values, the numeric cells, the time of day and the model ids (with "asked X") are mono; the labels, stage names and kind names are Inter, as the rule is in `design-system.md`, Type.

Titled "Usage · " and the job's name ("Problem 3.14", "Ask answer"). From the top:

1. **Totals**, two rows of four: time, calls, failed, cost; then tokens in,
   tokens out, and cached and reasoning tokens when the provider counted
   any (reasoning is often most of a thinking model's cost), with no hole
   where one is missing.
2. **Stages**: stage, attempts (runs that made calls in it), calls, time,
   tokens in and out, cost. A question's are Find (Boxed read when the
   student boxed it), Figures, Guide and Rank; an Ask answer's are its tool
   rounds; a read's is Read. **Rank is shared**: a set's difficulty ranking
   belongs to no one question, so each takes an even share, marked "Shared
   with N questions", and the shares add up to the whole.
3. **Calls**, one table for each run when the job ran more than once (a
   retry, a rewrite after notes), else one: when it started (At, time of
   day), stage (with the tools a round called, or the error), model (the one
   that answered, with "asked X" under it when a fallback served, never
   wrapped mid-name), time (seconds to the hundredth, "6.37s"), tokens in,
   out and reasoning (the column only when some call counted it), cost. The
   tables are `dense` with the same fixed column widths, so the runs line up
   and Cost is never cut off at the dialog's 960; sideways scroll is only the
   fallback. A failed call is a soft red row with its reason and a
   dash for what it did not report.

A question's total is everything it ever cost, every run included: the money
was really spent. A `≥` marks a minimum when a call reported nothing.

The detail is fetched when it opens and not kept, since a retry adds calls.
While it loads there is a Spinner; if it can't, "Couldn't load the details";
a job with no calls, "No model calls were made".

## BookUsageDialog

Titled "Usage · " and the book. The book's totals; **By kind**, a row each
for questions, difficulty ranking, Ask answers, assignment reads and import
(items, calls, time, tokens, cost), the ranking counted once; then the
**Import** section: its stages (Naming, Contents) and its calls.

**Don't:** show prompts or replies here (they stay in the log); add a
second way to close; fetch before it opens.
