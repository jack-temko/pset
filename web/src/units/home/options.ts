export type Span = 'six-months' | 'year';
export type Tiles = 'two' | 'one';
export type Layout = 'beside' | 'stacked';

/** The weeks each span shows at most (home-info-grill D2). */
export const SPAN_WEEKS: Record<Span, number> = { 'six-months': 26, year: 53 };
