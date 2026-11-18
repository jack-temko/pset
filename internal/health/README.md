# health

What PSet depends on, checked and kept as conditions (spec:
`ideas/actions-conditions-place-grill.md`, A2 and A3).

## Checks

Run as PSet starts and each time Settings opens (`GET /api/health`), in the
order of `condition.All`:

- the PDF reader (Poppler's `pdftoppm`) and the scan reader (Tesseract)
  installed, with the version found and how to install one that is missing;
- the data folder there and writable;
- the store's database sound (`quick_check`);
- Ollama running with the search model, when embeddings are on.

A check that passes tells the runner the condition holds (`Holds`: whatever
waited on it runs); one that fails tells it the condition does not
(`Lacks`), with the catalog error that says why and the action that fixes it,
if PSet can. An action that needs it is then refused before the student
tries. Checking again with nothing changed logs no change. The key, credit,
the provider and disk space are learned from calls and writes, never
checked: their rows are listed as they stand.

## Fixes

Each is an action, not undoable: `health.make_data_folder` and
`health.get_embeddings` (Ollama downloads the model, about 270 MB). Each
checks its condition again once it is done.

A passing check heals only the failures it disproves (`disprovable`): a
program found disproves it missing, Ollama listing the model disproves it
unreachable or without the model. An open incident waiting on the condition
for anything else (Ollama answering an embedding with an error, a write
refused inside the data folder) keeps it lacking, and its Try again is the way
back. Each passing check's `Holds` counts a heal even when nothing was broken,
so a step failing for want of it at that moment runs once more instead of
waiting: once per Settings open, as before.
