export type Theme = 'light' | 'dark' | 'system'

const KEY = 'pset-theme'

export function getTheme(): Theme {
  const stored = localStorage.getItem(KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

/** The single setter. `index.html` runs the same resolution before first
 *  paint, so the two must agree: anything but an explicit choice follows the
 *  OS. Sets `color-scheme` too, so native scrollbars and form controls follow. */
export function applyTheme(theme: Theme) {
  if (theme === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, theme)

  const dark =
    theme === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark')
}
