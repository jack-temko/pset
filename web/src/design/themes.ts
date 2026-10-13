export interface Theme {
  id: string;
  label: string;
  /** The class that scopes the theme's tokens to an element. */
  scope: string;
}

/** The themes that exist. The page's Theme control lists these and shows
 *  each inside the example only. A new theme is one line here and its
 *  scope class in `index.css`. */
export const THEMES: readonly Theme[] = [
  { id: 'paper', label: 'Paper', scope: 'theme-paper' },
  { id: 'night', label: 'Night', scope: 'dark' },
];
