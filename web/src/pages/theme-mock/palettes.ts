// Throwaway (see ideas/theme-mocks.md). Values are given by the spec; the
// contrast of every pair was computed (normal: all >= 4.5:1, nothing moved).

export type Kind = 'ink' | 'warm' | 'slate';
export type Contrast = 'normal' | 'strong';

export interface Palette {
  bg: string;
  raised: string;
  inset: string;
  border: string;
  borderMuted: string;
  fg: string;
  fgMuted: string;
  accent: string;
  accentSolid: string;
  onAccent: string;
}

function p(
  bg: string,
  raised: string,
  inset: string,
  border: string,
  borderMuted: string,
  fg: string,
  fgMuted: string,
  accent: string,
  accentSolid: string,
  onAccent: string,
): Palette {
  return {
    bg,
    raised,
    inset,
    border,
    borderMuted,
    fg,
    fgMuted,
    accent,
    accentSolid,
    onAccent,
  };
}

export const PALETTES: Record<Kind, Palette> = {
  ink: p(
    '#0d1117',
    '#151b23',
    '#010409',
    '#3d444d',
    '#2a313c',
    '#f0f6fc',
    '#9198a1',
    '#4493f8',
    '#1f6feb',
    '#ffffff',
  ),
  warm: p(
    '#171512',
    '#1f1c18',
    '#110f0d',
    '#3a352e',
    '#2a2621',
    '#ece6da',
    '#a39b8c',
    '#9db7f5',
    '#6d8fe0',
    '#11100e',
  ),
  slate: p(
    '#10151c',
    '#171e27',
    '#0b0f14',
    '#2f3a48',
    '#222b36',
    '#e6edf3',
    '#93a1b0',
    '#5ec4b6',
    '#2fa397',
    '#071412',
  ),
};

/** Strong contrast changes only these four colours (computed: muted 7:1 on
 *  raised, border 3:1 and border-muted 2:1 on bg, accent 7:1 on bg; warm and
 *  slate accents already pass and stay). */
export const STRONG: Record<
  Kind,
  Pick<Palette, 'fgMuted' | 'border' | 'borderMuted' | 'accent'>
> = {
  ink: {
    fgMuted: '#a0a6ae',
    border: '#57616d',
    borderMuted: '#3c4756',
    accent: '#5ba0f9',
  },
  warm: {
    fgMuted: '#ada698',
    border: '#6b6255',
    borderMuted: '#4f483e',
    accent: '#9db7f5',
  },
  slate: {
    fgMuted: '#9ca9b6',
    border: '#51647c',
    borderMuted: '#3a4a5d',
    accent: '#5ec4b6',
  },
};

/** The textbook page is a scan, dimmed so it does not glare. */
export const PAGE: Record<Contrast, { page: string; ink: string }> = {
  normal: { page: '#e8e4db', ink: '#2b2823' },
  strong: { page: '#f2efe8', ink: '#2b2823' },
};

export interface TypeSet {
  serif: string;
  sans: string;
  mono: string;
}

export const TYPE_SETS: Record<string, TypeSet> = {
  '1': {
    serif: "'Newsreader', Georgia, serif",
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  '2': {
    serif: "'Source Serif 4', Georgia, serif",
    sans: "'IBM Plex Sans', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
  },
  '3': {
    serif: "'Literata', Georgia, serif",
    sans: "'Geist', system-ui, sans-serif",
    mono: "'Geist Mono', ui-monospace, monospace",
  },
};

export const FONTS_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400' +
  '&family=Inter:wght@400;500' +
  '&family=JetBrains+Mono:wght@400;500' +
  '&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;1,8..60,400' +
  '&family=IBM+Plex+Sans:wght@400;500' +
  '&family=IBM+Plex+Mono:wght@400;500' +
  '&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;1,7..72,400' +
  '&family=Geist:wght@400;500' +
  '&family=Geist+Mono:wght@400;500' +
  '&display=swap';
