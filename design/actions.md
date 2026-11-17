<!-- Generated from the action catalog (internal/action) by tools/actioncatalog. Do not edit. -->

# Actions

Everything a student can do, as the catalog declares it. Each runs through `POST /api/actions/{id}`; the undoable ones are taken back by `POST /api/undo`. A key is corrected in the action's declaration, and this table follows.

7 actions.

| Id | Name | Key | Needs | Undoable | Costs |
|---|---|---|---|---|---|
| `course.add` | Add course |  |  | yes |  |
| `course.remove` | Remove course |  |  | yes |  |
| `course.rename` | Rename course |  |  | yes |  |
| `material.add` | Add material |  | `pdf_reader` | yes | yes |
| `material.remove` | Remove material |  |  | yes |  |
| `material.rename` | Rename material |  |  | yes |  |
| `material.textbook` | Make it the textbook |  |  | yes |  |
