export type Theme = 'light' | 'dark' | 'system'

const KEY = 'pset-theme'

/** Storage can throw outright: a private window, blocked site data, or a
 *  sandboxed frame with an opaque origin. The theme is a preference, so
 *  losing it is never worth an exception. */
function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function write(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, value)
  } catch {
    /* ignore */
  }
}

export function getTheme(): Theme {
  const stored = read()
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

/** The single setter. `index.html` runs the same resolution before first
 *  paint, so the two must agree: anything but an explicit choice follows the
 *  OS. Sets `color-scheme` too, so native scrollbars and form controls follow. */
export function applyTheme(theme: Theme) {
  write(theme === 'system' ? null : theme)

  const dark =
    theme === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

/** "System" is a promise to keep following the OS, not a one-time read at
 *  load. Called once at startup; an explicit choice ignores the change. */
export function followSystem() {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme('system')
  })
}
