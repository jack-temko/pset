import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Moon, Settings, Sun, SwatchBook } from 'lucide-react'

import { BrandLockup } from '@/components/brand'
import { buttonVariants, IconButton } from '@/components/button'
import { applyTheme, isDark } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * The one piece of chrome on every screen: 56px on `background` with a
 * hairline beneath, in three zones — brand, where-you-are, status.
 *
 * The middle is the caller's: nothing on Home, the book on the workspace,
 * "Settings" on settings. It never repeats a page's h1, and no actions live
 * up here — the page or panel owns those.
 */
/** Dev only: flip between wherever you are and /components, and back. */
function ComponentsToggle() {
  const location = useLocation()
  const there = location.pathname === '/components'
  return (
    <Link
      to={there ? ((location.state as { from?: string } | null)?.from ?? '/') : '/components'}
      state={there ? undefined : { from: location.pathname }}
      aria-label={there ? 'Back to the app' : 'Components'}
      className={cn(
        buttonVariants({ variant: 'ghost' }),
        'w-control px-0',
        there && 'bg-muted/50 text-foreground',
      )}
    >
      <SwatchBook className="size-5" />
    </Link>
  )
}

export function TopBar({ middle }: { middle?: ReactNode }) {
  const [dark, setDark] = useState(isDark)

  return (
    <header className="h-topbar shrink-0 border-b bg-background">
      <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center px-4">
        <div className="flex items-center">
          <Link to="/" className="rounded-md" aria-label="PSet home">
            <BrandLockup />
          </Link>
        </div>

        <div className="flex items-center gap-2 text-base">{middle}</div>

        <div className="flex items-center justify-end gap-2 text-muted-foreground">
          {import.meta.env.DEV && <ComponentsToggle />}
          <IconButton
            variant="ghost"
            aria-label={dark ? 'Switch to the paper theme' : 'Switch to the night theme'}
            onClick={() => {
              const next = dark ? 'light' : 'dark'
              applyTheme(next)
              setDark(next === 'dark')
            }}
          >
            {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
          </IconButton>
          <Link
            to="/settings"
            aria-label="Settings"
            className={cn(buttonVariants({ variant: 'ghost' }), 'w-control px-0')}
          >
            <Settings className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  )
}
