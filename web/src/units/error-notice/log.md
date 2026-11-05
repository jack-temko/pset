# Error notice: log

## Asked (2026-11-05)

Jack: "how do we show errors across the app? I definelty want an error component with
variants so all errors across the app look uniform."

Before it, the design units drew errors five ways: a red hint under a field, a red line with
a button in Ask, a red bordered box in Problem, a smaller one in Material for a damaged
file, and a page-filling red box in Material for a page that did not draw.

- Variants? Field, line, card, pane (Recommended) / Field, card, pane / Field and card only.
  **"The smallest subset that covers our use cases completley"**: line and block.
- Card look? **"Red icon + title, no border (Recommended)"**
- Details? **"Card and pane only (Recommended)"**
- Buttons when a fix comes first? **"Only the one that works (Recommended)"**

Prior art: PSet's own `ErrorNotice` in the old app (#34), which takes the catalog's View, and
GitHub Primer's inline messages.
