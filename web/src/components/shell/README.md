# Shell

Two wrappers, both layout and nothing else.

**`AppShell`** is every screen: the top bar, then the screen. It owns no
layout below the bar — a page-shell page centers its own column, and the
workspace runs full-bleed with its rail and panel. It takes the top bar's
`middle` slot and passes it through.

**`PageShell`** is the centered column shared by Home and Settings:
`layout-page` (72rem) wide, `page` gutters, `section` rhythm between
children, and nothing else. The workspace does not use it.

**Don't:** put a max-width on a page's own content — `PageShell` owns the
measure; add padding to a page that already sits in one.

## Changes from baseline

- **The two live in one file.** The baseline treats the page container as
  part of its `Workspace` / page-shell guidance rather than as a named
  component; splitting them into separate folders was not worth it for two
  wrappers of four lines each.
- `PageShell` uses `py-12`, which the baseline does not specify — the
  greeting needs more air above it than the 40px section rhythm gives.

## Open

- The workspace shell (rail + page scan + panel, with the Focus toggle) is
  the other half of this and is not built.
