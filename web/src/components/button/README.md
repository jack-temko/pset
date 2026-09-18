# Button

The one control for every action. Five variants, three sizes, 32px by
default.

| Variant | When |
|---|---|
| `primary` | The single primary action of a screen region. |
| `outline` | A secondary action beside a primary one; Retry in error states. |
| `secondary` | A quiet alternative — Start over, Import another. |
| `ghost` | Toolbar and icon actions that must not draw the eye. |
| `destructive` | Removals only — `destructive` ink on `destructive-soft`, never a solid red. Always confirmed. |

Sizes are Primer's: `sm` 28px at `text-xs`, default 32px at `text-sm`, `lg`
40px at `text-base`. All `radius-md`. Every variant carries a 1px
transparent border so outline and filled buttons share a box.

`IconButton` is a square of the same height with a **mandatory**
`aria-label` — it is the only name the control has.

**What the caller provides:** a sentence-case, verb-first label ("Import a
PDF"), an optional leading `lucide-react` icon, `onClick`.

**Don't:** put two buttons for the same action on one screen; stack two
`primary` buttons; use `destructive` for anything reversible; shrink below
`sm`.

## Changes from baseline

- **No `link` variant and no `xs` size.** Both were dropped in the v2
  baseline itself; recorded here because the v1 code had them.
- **Focus is not defined here.** The baseline gives each variant a focus
  ring; the app defines one `:focus-visible` ring in the base layer so every
  focusable thing matches, so the variants carry none.
- **Hover is a colour-mix, not a second token.** `primary` darkens by
  mixing 8% `foreground` in, `secondary` by 5%, rather than adding
  hover-specific tokens to the palette.
- A link that should look like a button applies `buttonVariants(...)` to
  the `Link` — there is no `asChild` yet, because one call site needed it
  and a polymorphic wrapper wasn't worth it.

## Open

- `ButtonGroup` (related buttons joined at `spacing-2`, primary last) is
  specified in the baseline but not built — nothing needs it yet.
