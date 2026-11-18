<!-- Generated from the action catalog (internal/action) by tools/actioncatalog. Do not edit. -->

# Actions

Everything a student can do, as the catalog declares it. Each runs through `POST /api/actions/{action}`; the undoable ones are taken back by `POST /api/undo`. A key is corrected in the action's declaration, and this table follows.

11 actions.

| Id | Name | Key | Needs | Undoable | Costs |
|---|---|---|---|---|---|
| `course.add` | Add course |  |  | yes |  |
| `course.remove` | Remove course |  |  | yes |  |
| `course.rename` | Rename course |  |  | yes |  |
| `health.get_embeddings` | Download the search model |  |  |  |  |
| `health.make_data_folder` | Make the data folder |  |  |  |  |
| `incident.dismiss` | Dismiss |  |  | yes |  |
| `incident.try_again` | Try again |  |  |  | yes |
| `material.add` | Add material |  | `pdf_reader` | yes | yes |
| `material.remove` | Remove material |  |  | yes |  |
| `material.rename` | Rename material |  |  | yes |  |
| `material.textbook` | Make it the textbook |  |  | yes |  |
