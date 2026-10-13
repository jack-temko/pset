// Throwaway (see ideas/theme-mocks.md). Values are given by the spec; the
// muted greys are lifted to 7:1 on raised, the status hues checked at 4.5:1.

export type Kind = 'ink' | 'half' | 'neutral' | 'warmgrey';
export type Sheet = 'cream' | 'grey' | 'cool';

export interface Palette {
  bg: string;
  raised: string;
  inset: string;
  border: string;
  borderMuted: string;
  fg: string;
  fgMuted: string;
  attentionSoft: string;
  dangerSoft: string;
}

export const PALETTES: Record<Kind, Palette> = {
  ink: {
    bg: '#0d1117',
    raised: '#151b23',
    inset: '#010409',
    border: '#3d444d',
    borderMuted: '#2a313c',
    fg: '#f0f6fc',
    fgMuted: '#9da6b1',
    attentionSoft: '#312e23',
    dangerSoft: '#372329',
  },
  half: {
    bg: '#0f1114',
    raised: '#16191d',
    inset: '#08090b',
    border: '#3a3f46',
    borderMuted: '#282c32',
    fg: '#f0f3f6',
    fgMuted: '#9da4ad',
    attentionSoft: '#322c1e',
    dangerSoft: '#382124',
  },
  neutral: {
    bg: '#111111',
    raised: '#191919',
    inset: '#0a0a0a',
    border: '#3d3d3d',
    borderMuted: '#2a2a2a',
    fg: '#f2f2f2',
    fgMuted: '#a4a4a4',
    attentionSoft: '#352c1a',
    dangerSoft: '#3a2120',
  },
  warmgrey: {
    bg: '#121110',
    raised: '#1a1918',
    inset: '#0b0a0a',
    border: '#3e3c39',
    borderMuted: '#2b2927',
    fg: '#f2f0ec',
    fgMuted: '#a7a49f',
    attentionSoft: '#362c1a',
    dangerSoft: '#3b211f',
  },
};

export const ACCENT = '#4493f8';
export const ACCENT_SOLID = '#1f6feb';
export const ON_ACCENT = '#ffffff';
// Both pass 4.5:1 on every bg and raised above, unadjusted.
export const ATTENTION = '#d29922';
export const DANGER = '#f85149';

/** The textbook page is a scan, dimmed so it does not glare. */
export const SHEETS: Record<Sheet, string> = {
  cream: '#e8e4db',
  grey: '#e6e6e3',
  cool: '#e4e7ea',
};
export const PAGE_INK = '#2b2823';

export const SERIF = "'Source Serif 4', Georgia, serif";
export const SANS = "'IBM Plex Sans', system-ui, sans-serif";

export const FONTS_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;1,8..60,400' +
  '&family=IBM+Plex+Sans:wght@400;500' +
  '&family=IBM+Plex+Mono:wght@400;500' +
  '&display=swap';
