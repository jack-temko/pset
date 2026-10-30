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
