# Finding problems

## Status

**Planned** · phase 1, after [Book structure](book-structure.md) (the
reference parser needs the book's numbering style) and with the [finder
test set](finder-tests.md) in place to measure it.

## Information

### Why it misses today (investigated 2026-09-25)

In *Elementary Differential Equations* every reference like "Chapter 3.1
Problem 7" failed or found the wrong problem. Four causes, from the
code, the call log and the page text:

1. **The reference isn't understood.** Only a question that is just a
   number ("3.36", "Problem 3.36", "3.1.7") is read as a label. "Chapter
   3.1 Problem 7" and "Page 33 Problem 7" aren't, so the exact label
   scan, memory and the chapter sweep never run; the raw text goes to
   search, which matches pages that mention "Problem 7" or "Section 3.1"
   in passing. Even "3.1.7" fails: the label scan looks for a line
   starting "3.1.7" (the book prints "7."), and the sweep reads the last
   16 pages of chapter 3, which are sections 3.7 and 3.8.
2. **The model can't tell which section a page is.** Problems restart
   at 1 each section, and a problems page never says which section it
   is. The model sees pages with no printed number and no section, and
   three times it transcribed the right problem and still answered
   "not here" (3.1 #6, 3.2 #4, 2.2 #2). The wider round then excludes
   those pages, so it can only pick a wrong one: a spring problem from
   3.7 for "3.1 Problem 6", a mortgage problem for "Page 33 Problem 7".
3. **The page offset is wrong in chapters 1 and 2** (see [Book
   structure](book-structure.md)), and a cited page is shown alone, so
   the problem's page never came up.
4. **Nothing checks the pick** against the section the student named,
   though the contents know section 3.1 is PDF 117–123.

### Decided (2026-09-25)

- Finding is hardened before importing is built; the importer feeds this
  same finder.
- References are parsed on the server, one parser, in Go. There was no
  preference on a live preview in the Add dialog; with the import
  review screen coming, the parse shows on the question (and in that
  review), not as you type.

### How

1. **Read a reference into parts**: book, chapter or section, problem,
   part, cited page, and any note. Accept how people write it: "Chapter
   3.1 Problem 7", "Section 3.1 #7", "3.1 #7", "3.1.7", "§3.1 7a", "1.1:
   1, 7" (a list), "Problem 2.1.4, p. 57", "p. 33 #7", "7 on page 33",
   "4.27 (no PSpice)". The book's numbering style decides what bare
   digits mean. Stored on the question, shown in its header ("Section
   3.1 · problem 7"), correctable there.
2. **Go where the book keeps it.** With the style and the contents, a
   section's problems are the pages from its "Problems" heading to the
   section's end, plus one page for slack. Find the problem's number
   opening a line after that heading in the text; most finds then need
   the model only to confirm and copy the statement.
3. **Tell the model what it's looking at.** Each image carries its
   printed page and section: "p. 112, the end of Section 3.1; the
   problems after its Problems heading are Section 3.1's." Show
   consecutive pages, not scattered search hits. A cited page comes
   with the pages either side.
4. **Check the pick.** Named a section: reject a page outside it (plus
   one). Cited a page: reject one more than a page away. A round whose
   picks are all rejected says "couldn't find it", with what it
   searched, rather than accepting a confident wrong answer.
5. **Memory keyed the book's way**: Boyce's problems remembered as
   "3.1.7", so memory's ranges predict where a section's other problems
   are.

Search stays, as the last tier, for references that name no number.

### Weight

- Parser ~200 lines plus many small tests; a question migration for the
  parsed parts.
- Section scoping ~150 lines; image labels ~20; the check ~40; memory
  keys ~50.

### Risks and later

- Every new way of writing a reference is a parser change; the test set
  catches regressions.
- The check depends on the contents and the page ranges being right; a
  wrong contents entry would reject good finds, so it needs slack and a
  way out ([boxing the problem](boxing-on-the-page.md)).
- Parts ("do c") belong to the question, not the find: they ride along
  to the guide as [professor's notes](professor-notes.md).
