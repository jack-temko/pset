# probnum

How a book numbers its problems, which decides what a reference like
"3.1 #7" means in it. Detected from the book's text and contents at
import (and for older books at startup); the student can confirm or
correct it. Spec: `ideas/book-structure.md`, part 2, and `design/import.md`.

- **`Style`** (`wire.go`, generated to TS): `Form`, `Where`, the `Heading`
  over a problem set, an `Example` problem for the student to check against,
  `Sure` (false when the text didn't make it plain), `Confirmed` (the
  student's word, never overwritten).
- **`Form`**: `chapter` ("4.27" is chapter 4's problem 27), `section`
  ("2.1.4" is section 2.1's problem 4), `local` (problems restart at 1 in
  every section and print as just "7.", under the section's Problems
  heading).
- **`Where`**: problems come `section` by section or together at the end of
  a `chapter`.
- **`Detect(pages, parts)`** reads a style from the pages' text (index i is
  PDF page i+1) and the numbered chapters and sections of the contents;
  `ok` is false when the book shows no numbered problems at all.
  **`PartNumber(title)`** is the number a contents title opens with.
- Consumers: the library stores it in `books.problem_style`; homework's
  `reference.go` and `scope.go` read a question's reference by it and look
  only where it can be.
