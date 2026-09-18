import { AppShell, PageShell } from '@/components/app-shell'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Home. The greeting, then — as they are built — what's due across every
 * book, the shelf, and this week's numbers. The top bar's middle is empty
 * here: you are home, and the greeting says so.
 */
export function Home() {
  return (
    <AppShell>
      <PageShell>
        <h1 className="font-heading text-4xl">{greeting(new Date().getHours())}.</h1>
      </PageShell>
    </AppShell>
  )
}
