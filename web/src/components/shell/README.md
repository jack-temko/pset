# Shell

Two wrappers, both layout and nothing else.

**`AppShell`** is every screen: the top bar as fixed chrome, then the screen
below it. The window never scrolls: the shell is exactly the viewport, the
bar takes its 56px, and what's left is the scroll region, so a scrollbar
begins under the bar instead of running past it.

It takes two kinds of screen, and the screen decides how scrolling works,
never the components inside it:

- `scroll="page"` (default): a document that scrolls as one, like Home
  and Settings. Nothing inside gets its own vertical scrollbar; long content
  truncates with a door instead.
- `scroll="fill"`: a screen that is exactly the remaining height and never
  scrolls as a whole, like the book workspace. Its panes scroll themselves,
  each being a separate stream of content.

**`PageShell`** is the centered column shared by Home and Settings:
`layout-page` (72rem) wide, `page` gutters, `section` rhythm between
children, and nothing else. The workspace does not use it.

**Don't:** put a max-width on a page's own content: `PageShell` owns the
measure; add padding to a page that already sits in one.

## Changes from baseline

- **Scrolling moved off the window.** The bar was `sticky top-0`, which
  pinned it correctly but left the window as the scroll container, so the
  scrollbar ran the bar's full height and content slid beneath a bar that
  was merely stuck. The shell is now the viewport and owns the scroll
  region.
- **The two live in one file.** The baseline treats the page container as
  part of its `Workspace` / page-shell guidance rather than as a named
  component; splitting them into separate folders was not worth it for two
  wrappers of four lines each.
- `PageShell` uses `py-12`, which the baseline does not specify: the
  greeting needs more air above it than the 40px section rhythm gives.

## Open

- The workspace shell (rail + page scan + panel, with the Focus toggle) is
  the other half of this and is not built.
