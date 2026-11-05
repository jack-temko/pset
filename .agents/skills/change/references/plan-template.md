# <What the change does>

## Status

In progress, branch `<topic>`.

## Information

**Why.** One or two lines: the problem in Jack's or the student's terms.

**Decisions.** What is settled, with the reason. Link the grill file if there was one.

### Files

Every file the builder will touch, with what changes in it:

- `path/to/file.go`: what changes
- `path/to/file_test.go`: the test that proves it

### Steps

Numbered, each small enough to commit on its own. The last step is always the docs:
`design/<screen>.md` for what shipped, a component README and `/components` section
for a new or changed component, and this file's Status.

### Tests

The tests that must pass, new ones named. For a UI change, the states to photograph
(URL paths on `/views` or `/components`).

### Acceptance

What done looks like, checkable by someone who did not write it.

### Out of scope

What this change does not do, so the builder does not widen it.
