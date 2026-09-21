import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Settings, SwatchBook } from 'lucide-react'

import { BrandLockup } from '@/components/brand'
import { buttonVariants } from '@/components/button'
import { cn } from '@/lib/utils'

/**
 * The one piece of chrome on every screen: 56px on `background` with a
 * hairline beneath, in three zones — brand, where-you-are, status.
 *
 * The middle is the caller's: the book on the workspace, and nothing on a
 * document page (Home, Settings), whose h1 already says where you are. It
 * never repeats a page's h1, and no actions live
 * up here — the page or panel owns those. The right zone is Settings alone
 * (plus the dev-only components toggle): the theme lives in Settings, not
 * here, because one preference doesn't earn permanent chrome.
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
