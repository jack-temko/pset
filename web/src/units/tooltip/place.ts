/** Where a tooltip goes: pure, so it is tested without a browser. */

export type TooltipSide = 'below' | 'above' | 'right' | 'left';

/** How far the tooltip sits from its control, and from the viewport's edge. */
const GAP = 4;
const MARGIN = 8;

const OPPOSITE: Record<TooltipSide, TooltipSide> = {
  below: 'above',
  above: 'below',
  right: 'left',
  left: 'right',
};

/** Where the tooltip goes for a control: the wanted side if it fits inside
 *  the viewport, else the opposite, then right, then left; then shifted along
 *  its edge so it never comes closer than 8 to the viewport. */
export function place(
  anchor: DOMRect,
  size: { width: number; height: number },
  view: { width: number; height: number },
  side: TooltipSide,
): { left: number; top: number; side: TooltipSide } {
  const at = (s: TooltipSide) => ({
    left:
      s === 'right'
        ? anchor.right + GAP
        : s === 'left'
          ? anchor.left - GAP - size.width
          : anchor.left + anchor.width / 2 - size.width / 2,
    top:
      s === 'below'
        ? anchor.bottom + GAP
        : s === 'above'
          ? anchor.top - GAP - size.height
          : anchor.top + anchor.height / 2 - size.height / 2,
  });
  const fits = (s: TooltipSide) => {
    const p = at(s);
    return s === 'below' || s === 'above'
      ? p.top >= MARGIN && p.top + size.height <= view.height - MARGIN
      : p.left >= MARGIN && p.left + size.width <= view.width - MARGIN;
  };
  const order = [side, OPPOSITE[side], 'right', 'left'] as const;
  const chosen = order.find(fits) ?? side;
  const p = at(chosen);
  const clamp = (v: number, size: number, room: number) =>
    Math.max(MARGIN, Math.min(v, room - MARGIN - size));
  return {
    side: chosen,
    left:
      chosen === 'below' || chosen === 'above'
        ? clamp(p.left, size.width, view.width)
        : p.left,
    top:
      chosen === 'right' || chosen === 'left'
        ? clamp(p.top, size.height, view.height)
        : p.top,
  };
}
