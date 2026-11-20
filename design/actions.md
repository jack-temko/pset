<!-- Generated from the action catalog (internal/action) by tools/actioncatalog. Do not edit. -->

# Actions

Everything a student can do, as the catalog declares it. Each runs through `POST /api/actions/{action}`; the undoable ones are taken back by `POST /api/undo`. A key is corrected in the action's declaration, and this table follows.

26 actions.

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
| `material.textbook` | Move between Textbooks and Materials |  |  | yes |  |
| `question.add` | Add problems |  |  | yes |  |
| `question.done` | Mark done |  |  | yes |  |
| `question.move` | Move problem |  |  | yes |  |
| `question.notes` | Edit notes |  |  | yes |  |
| `question.remove` | Remove problem |  |  | yes |  |
| `question.reveal` | Show help |  |  | yes |  |
| `read.dismiss` | Dismiss |  |  | yes |  |
| `read.import` | Add the homework |  |  | yes |  |
| `read.start` | Read an assignment |  |  |  |  |
| `set.add` | Add assignment |  |  | yes |  |
| `set.due` | Change due date |  |  | yes |  |
| `set.remove` | Remove assignment |  |  | yes |  |
| `set.rename` | Rename assignment |  |  | yes |  |
| `set.turn_in` | Turn in |  |  | yes |  |
| `time.clear` | Forget time spent |  |  |  |  |
