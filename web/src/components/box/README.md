# Box

The one container: a bordered `card` surface with an optional header band,
rows or a body, and an optional footer. Everything that lists, lists in a
Box.

- **Frame**: `card` fill, 1px `border`, `radius-md`. No shadow.
- **`BoxHeader`**: a `card-header` band with a border under it, 40px
  minimum, `spacing-card` padding; the title at `text-base` 600, an
  optional `Counter`, actions right-aligned as `sm` buttons.
- **`BoxRow`**: 40px minimum, divided by `border-muted`. A row is
  ActionList-shaped: an optional leading visual, a title with an optional
  description, something trailing. A row with a description is 59px. A row
  with an `href` **or `onClick`** washes `muted/50` on hover (150ms fade)
  and takes the pointer cursor; a `selected` row is `primary-soft`.
- **`BoxBody`**: `spacing-card` padding, `text-base`, for prose and forms.
- **`BoxFooter`**: a `card-header` band with a border above it, for totals,
  counts, facts in mono. A truncated list ends in a `Door` instead.
- **`Counter`**: the count beside a title.
- **`RowValue`**: a trailing value in mono, at the floor size, figures
  aligned.

**Tone.** A Box carrying a state takes the status ink as its frame and the
status tint as its ground: `warning` for a not-ready book, `destructive`
for a failed one.

**Composition.** A Box never sets its own margin: the parent's stack does.
Children are Box parts only: put a Button *inside* a row, never beside one.

**Don't:** nest a Box in a Box; add a shadow; give it a coloured left
border; pad a row by hand.

## Changes from baseline

- **`Counter` is filled with translucent ink (`foreground/20`), not
  `muted`.** It usually sits on the `card-header` band, where `muted`
  measured 1.07:1: the pill was invisible while its digit sat at 13.9:1.
  Ink at 20% darkens whatever ground it lands on (1.50:1 light, 1.74:1
  dark) and inverts with the theme without a second token. This held even
  after `muted` was corrected system-wide, because the header band is where
  `muted` is still weakest (1.24:1).
- **`Counter` and `RowValue` sit at 14px, not 12px.** The baseline's
  preview uses 12px, which contradicts the system's own type floor.
- **Rows own their description spacing.** The baseline's row grows to 56px
  with a description; ours is 59px, because the line-heights already supply
  the gap and adding a margin on top pushed it to 63px.
- **Row hover is `muted/50`, not full `muted`.** After `muted` was darkened
  system-wide, a full-strength hover (1.43:1 on card) read as selection
  rather than a pointer wash. Hover only signals (the cursor already marks
  the row) so it doesn't need the 1.3:1 shape floor; half strength lands
  at 1.19:1 light / 1.20:1 dark.
- **`BoxRow` takes slots as props** (`leading`, `title`, `description`,
  `trailing`) rather than free children, so a caller cannot pad a row by
  hand: the composition rule is enforced by the API rather than by
  documentation.

## Open

- `onSelect`: rows are links or inert; nothing needs a selectable,
  non-navigating row yet.
- The baseline's `ActionList` proper (gaps instead of dividers, groups,
  nesting, danger items, `kbd` hints) is not built. `BoxRow` implements its
  anatomy inside a Box; the standalone list arrives with the contents rail.
