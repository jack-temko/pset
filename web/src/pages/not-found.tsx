import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center md:py-32">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass className="size-6" />
      </div>
      <h1 className="mt-6 font-heading text-4xl font-medium tracking-tight">Lost page</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">
        This page isn’t in the library. Head back to your books and pick up from there.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back to the library</Link>
      </Button>
    </div>
  )
}
