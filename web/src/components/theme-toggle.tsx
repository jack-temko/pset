import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type ThemeMode = 'light' | 'dark' | 'system'

export function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('pset-theme', mode)
}

export function currentTheme(): ThemeMode {
  const stored = localStorage.getItem('pset-theme')
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function ThemeToggle() {
  const toggle = () => {
    applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  )
}
