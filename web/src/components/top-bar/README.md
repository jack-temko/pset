# TopBar

The one piece of chrome on every screen: 64px on `background` with a
border hairline beneath. It replaces v1's sidebar and shell header
together.

Three zones on a `1fr auto 1fr` grid:

- **Left: the brand.** The lockup, linking home.
- **Middle: where you are.** The caller's slot. Nothing on Home; the book
  in the workspace; "Settings" on settings. It never repeats a page's `h1`.
- **Right: status and system.** The theme toggle and the gear, as 40px ghost
  icon buttons with 24px icons, in `muted-foreground`.

**Don't:** put actions in the top bar: the page or panel owns its actions;
add a search box; show a Tasks entry when nothing is happening.

## Changes from baseline

- **The activity indicator is not built yet.** The baseline's right zone
  leads with a pill that appears only while something is running or needs a
  decision, opening an activity sheet. It arrives with the task store; until
  then the right zone is the toggle and the gear.
- **The middle's book treatment is not built**: it needs the workspace.
- The bar is fixed chrome inside `AppShell`: the shell owns the viewport
  and the scroll region starts beneath the bar, so it never moves.
- **A dev-only components toggle** (`SwatchBook`, DEV builds only) sits
  first in the right zone: it flips to `/components` and back to wherever
  you were. It does not exist in production bundles.

## Open

- The brand sits 20px from the edge, per the baseline, while page content
  starts at the 40px page gutter, so they do not line up on Home. It will
  read correctly in the workspace, where the rail runs to the edge.
  Unresolved: align to the gutter, or keep the bar full-bleed.
