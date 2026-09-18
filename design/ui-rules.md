# UI style rules

Global rules every page follows. Page specs (`web/src/pages/*/README.md`)
defer to these; they win over page-local habits. New rules land here so
they survive page rewrites.

## One door per action

Never render two buttons that do the same thing on one screen. When an
empty-state hero carries the page's primary action, the header action
hides for that state — the hero is the only door:

```tsx
const empty = !loading && !error && list.length === 0
// ...
<PageShell
  actions={!empty && <Button onClick={openThing}>New thing</Button>}
>
```

When real content shows, the header action is the only door (empty
states are gone by definition, so nothing to coordinate). While loading
or in an error state the header action stays visible — only the true
empty state swaps the doors.

Existing examples: library (`actions={!empty && <Button>Import</Button>}`
with the hero's "Import a PDF"), homework (header "New homework" hides
while the "No homework yet." card shows its own).
