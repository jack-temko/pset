# Memory: log

Mocks of four layouts (A one list with a filter, B two lists, C chips, D one list where
Ask's saves need a Keep) were shown on `/design/component/memory`. Jack's verdict,
2026-10-30, word for word:

> lets go with D, drop the search bar. Make it hide past a certain amount with a button to expand like our other lists. Also all dropdowns are broken right now as the card shows up far away from the button for some reason.

Built from it: only D is kept (`memory-d1`); the search field is gone and the list is capped
at five with "Show all" (`memory-d3`). New memories from Ask are always shown above the cap.
The dropdown remark was a bug in Menu, fixed in the same change.

Then, on the same day, word for word:

> Also make these memories be multi line editable, editing a saved memory that wraps opens a super smalle inline textblock that sucks to edit

Built from it (`memory-d4`): rows wrap, and Edit and Add are multi-line text fields (a new
`multiline` mode of the text-field unit) that grow with their text.

## 2026-11-04: on the list pattern

Jack: "also redo memory D with our new list changes and having the list page please". The
All, Yours and From Ask control becomes the list's header switch (Yours, From Ask; L11 of
`ideas/list-pattern-grill.md`), the list shows five rows and a "Show all N" foot to the list
page's memories, and what Ask just saved waits in its own "New from Ask" box above, never
hidden by the switch or the cap (A1). Delete is Forget, with Undo, and the words follow the
word list (memory, not preference). Decision memory-d5.

Then, the same day: "On D, i dont love having two separte lists when something is new. Either
make that a cetegory that can be selected to filter, or just have it show at the top or
something." New became the first side of the switch, there only while Ask has saved something
not yet kept, and the list opens on it (memory-d6).
