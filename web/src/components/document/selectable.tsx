import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import type { Block } from '@/api/gen/doc';
import { cn } from '@/lib/utils';

import { nounOf, type Sel } from './selection';

/**
 * The pieces a document that selects is wired with. Hover washes an
 * element, a click picks it, and a small toolbar on the outline asks
 * about it; the selection itself lives above the tree (the outline and
 * the composer's chip are one state), so it arrives here as a prop and
 * a document without wiring renders inert. Spec:
 * ideas/asking-about-a-selection.md.
 */

/** What a document is told about the ask, and the ways it talks back:
 *  a click's pick, the toolbar's button, and letting go. The pick lives
 *  above every document (a page shows two: a hint and a walkthrough),
 *  so at most one element is outlined at a time. */
export type AskWiring = {
  /** The pending selection when it belongs to this document: a pick
   *  not yet asked about, or what stays outlined while its chip rides
   *  the composer. */
  selected: Sel | null;
  /** A click picked this element. */
  onPick: (sel: Sel) => void;
  /** The toolbar's button: compose the About and hand it up. */
  onAsk: (sel: Sel) => void;
  /** The one way out: ✕ on the toolbar, Esc, clicking the outlined
   *  element again, or the chip's own ✕. Drops the selection and its
   *  chip. */
  onClear: () => void;
};

/** What every selectable thing in one document shares: the wiring, the
 *  element under the pointer, the one outlined, and the way a click
 *  picks. The document's root owns the pointer and hands each element
 *  its slice. */
export type Scope = {
  ask?: AskWiring;
  hover: Sel | null;
  outlined: Sel | null;
};

export type SelState = 'washed' | 'outlined' | undefined;

/** An element's state from the document's scope. */
export function selState(scope: Scope, sel: Sel): SelState {
  if (scope.outlined === sel) return 'outlined';
  if (scope.hover === sel) return 'washed';
  return undefined;
}

/** The classes a state wears. Hover is a quiet wash with a hairline
 *  (the reading stays untouched until the pointer arrives); the pick is
 *  the app's selection pair, `primary-soft` under a `primary` outline.
 *  Both are instant: a hover that fades reads as lag. */
export function selLook(state: SelState): string | undefined {
  if (state === 'outlined')
    return 'relative cursor-pointer rounded-sm bg-primary-soft outline-1 -outline-offset-1 outline-primary';
  if (state === 'washed')
    return 'relative cursor-pointer rounded-sm bg-muted/50 outline-1 -outline-offset-1 outline-border-muted';
  return undefined;
}

/**
 * The toolbar on an outlined element, the boxing toolbar's shape (the
 * Menu's card, floating): the ask, its button naming what it asks about,
 * and a way to let go.
 */
export function SelToolbar({
  sel,
  noun,
  scope,
  place = 'above',
}: {
  sel: Sel;
  noun: string;
  scope: Scope;
  /** Where it floats: `above` the element, down to the leading of its
   *  first line (the toolbar must not sit on the words it asks about);
   *  `rule`, straddling the border above a line of a card; `inside`,
   *  for the card's first line, whose top edge clips what floats. */
  place?: 'above' | 'rule' | 'inside';
}) {
  const ask = scope.ask;
  if (!ask) return null;
  return (
    <div
      data-sel-toolbar
      className={cn(
        'absolute right-0 z-10 flex h-control-sm w-max items-center gap-1 rounded-md border bg-card pr-1 pl-1 text-xs text-foreground shadow-floating',
        // A card with its own rounded frame (a derivation) clips what
        // floats above its top edge, so its first line's toolbar sits
        // inside it; every other line's straddles the rule above it,
        // off the math. A block's floats above, its bottom edge in the
        // leading above its first line (about 6px of the reading size).
        place === 'inside' && 'top-1',
        place === 'rule' && 'top-0 -translate-y-1/2',
        place === 'above' && 'top-0 -translate-y-[calc(100%-6px)]',
      )}
    >
      <button
        type="button"
        onClick={() => ask.onAsk(sel)}
        className="flex h-full cursor-pointer items-center rounded-sm px-2 font-medium text-primary hover:bg-primary/10"
      >
        Ask about {noun}
      </button>
      <span aria-hidden className="h-4 w-px bg-border-muted" />
      <button
        type="button"
        aria-label={`Let go of ${noun}`}
        onClick={() => ask.onClear()}
        className="grid size-6 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** One selectable thing: a block, a heading with its whole group, or a
 *  derivation line (whose wrapper the card itself carries, through
 *  `inside`). It only wears its state; the document's root owns the
 *  pointer. */
export function Selectable({
  sel,
  scope,
  block,
  className,
  children,
}: {
  sel: Sel;
  scope: Scope;
  /** The block, for the noun the toolbar names it by. */
  block?: Block;
  className?: string;
  children: ReactNode;
}) {
  const state = selState(scope, sel);
  const noun = nounOf(sel, block);
  return (
    <div data-sel={sel} className={cn(className, selLook(state))}>
      {children}
      {state === 'outlined' && (
        <SelToolbar sel={sel} noun={noun} scope={scope} />
      )}
    </div>
  );
}
