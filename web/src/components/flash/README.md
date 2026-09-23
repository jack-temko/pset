# Flash

A full-width strip directly under the top bar: one sentence about the
whole screen, not about any one thing on it. "Lost touch with PSet.
Reconnecting…", "This book is named after its file."

- **40px minimum** (`row`), a hairline under it, the sentence centred in
  `text-sm`.
- **Tones.** `warning` is status ink as text, icon and border, on
  `warning-soft`, with a leading `CircleAlert`, and it announces itself
  (`role="status"`). `default` is the Box header's `card-header` band
  with muted ink, for something worth saying that isn't wrong.
- **`action`**: at most one `sm` Button, the act the sentence asks for.
- **`onDismiss`**: a ghost X for a strip you can wave away. The caller
  owns remembering that it was dismissed. A strip that clears itself
  (the stream reconnecting) takes no X.

**Composition.** A Flash sits between the top bar and the screen, at
full width, never inside a Box, a pane or a dialog. One at a time.

**Don't:** use it for a failure that belongs to one thing (that thing
says it, where it lives); stack two; add a second action.

## Changes from baseline

- **New in the app.** The baseline's component set names Flash (Primer's
  banner) but it wasn't built until two strips needed it: the lost-touch
  banner in the shell and the workspace's filename-title prompt. Only
  the full-width form exists; nothing needs an inset one.
