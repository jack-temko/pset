import { createElement, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Settings } from 'lucide-react'

import { BrandLockup, Mark } from '@/components/brand'
import { PageShell } from '@/components/app-shell'
import { TopBar } from '@/components/top-bar'
import { Button, IconButton } from '@/components/ui/button'
import { Home } from '@/pages/home'

/**
 * The workboard's entry: every component the canvas can mount, and the one
 * function that mounts it. Bundled to an IIFE and inlined into each artboard,
 * so the canvas runs the same code the app runs — not a copy of it.
 *
 * Add a component here the moment the app grows one; an artboard can only
 * show what this registry exposes.
 */
/** Every variant and size at once, built from the real Button — a specimen
 *  sheet, not a state machine. Seeing them side by side is the point; there
 *  is nothing here to step through. */
function ButtonSpecimen() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary">New homework</Button>
        <Button variant="outline">Try again</Button>
        <Button variant="secondary">Start over</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="destructive">Remove book</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Small · 28</Button>
        <Button>Default · 32</Button>
        <Button size="lg">Large · 40</Button>
        <IconButton variant="outline" aria-label="Settings">
          <Settings className="size-4" />
        </IconButton>
        <Button disabled>Disabled</Button>
      </div>
    </div>
  )
}

const registry: Record<string, ComponentType<Record<string, unknown>>> = {
  Home,
  TopBar,
  PageShell,
  ButtonSpecimen,
  Button,
  IconButton,
  BrandLockup,
  Mark,
} as unknown as Record<string, ComponentType<Record<string, unknown>>>

const roots = new WeakMap<Element, Root>()

function mount(
  el: Element,
  { component, props, theme }: { component: string; props?: Record<string, unknown>; theme?: string },
) {
  // Set the theme on the document directly rather than through applyTheme:
  // an artboard runs on an opaque origin where localStorage throws, and the
  // canvas has no preference to remember anyway.
  const dark = theme === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'

  const Component = registry[component]
  if (!Component) {
    el.textContent = `workboard: no component named "${component}" — add it to workboard/entry.tsx`
    return
  }

  let root = roots.get(el)
  if (!root) {
    root = createRoot(el)
    roots.set(el, root)
  }
  // MemoryRouter because anything with a Link needs a router, and the canvas
  // has no history of its own.
  root.render(createElement(MemoryRouter, null, createElement(Component, props ?? {})))
}

declare global {
  interface Window {
    PSetUI: { mount: typeof mount; components: string[] }
  }
}

window.PSetUI = { mount, components: Object.keys(registry) }
