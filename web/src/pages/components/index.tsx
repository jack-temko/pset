import type { ReactNode } from 'react'
import { BookOpen, Plus, Settings } from 'lucide-react'

import { AppShell, PageShell } from '@/components/app-shell'
import { BrandLockup, Mark } from '@/components/brand'
import { Box, BoxBody, BoxFooter, BoxHeader, BoxRow, Counter, RowValue } from '@/components/ui/box'
import { Button, IconButton } from '@/components/ui/button'

/**
 * Every component and every variant, on one page, in the app itself.
 *
 * Not in the nav and not part of the product's three screens — it is the
 * page you open to see what a change did. Add a component here the moment
 * you build one; anything missing from this page is unreviewed.
 */

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="space-y-1 border-b pb-3">
        <h2 className="font-heading text-xl">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

/** One labelled shelf of specimens. The label is mono so it never reads as
 *  part of the thing being shown. */
function Shelf({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] items-start gap-6">
      <div className="pt-2 font-mono text-xs text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

export function Components() {
  return (
    <AppShell middle={<span className="text-muted-foreground">Components</span>}>
      <PageShell>
        <div className="space-y-3">
          <h1 className="font-heading text-3xl">Components</h1>
          <p className="font-heading text-lg text-muted-foreground italic">
            Every part of the interface, and every variant of it, on one page.
          </p>
        </div>

        <Section title="Button" note="Five variants, three sizes. 32px by default; all radius-md.">
          <Shelf label="variant">
            <Button variant="primary">New homework</Button>
            <Button variant="outline">Try again</Button>
            <Button variant="secondary">Start over</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Remove book</Button>
          </Shelf>
          <Shelf label="size">
            <Button size="sm">Small · 28</Button>
            <Button>Default · 32</Button>
            <Button size="lg">Large · 40</Button>
          </Shelf>
          <Shelf label="with icon">
            <Button>
              <Plus />
              New homework
            </Button>
            <Button variant="outline">
              <BookOpen />
              Open reader
            </Button>
          </Shelf>
          <Shelf label="icon only">
            <IconButton variant="ghost" aria-label="Settings">
              <Settings className="size-5" />
            </IconButton>
            <IconButton variant="outline" aria-label="Settings">
              <Settings className="size-4" />
            </IconButton>
            <IconButton variant="outline" size="sm" aria-label="Add">
              <Plus className="size-4" />
            </IconButton>
          </Shelf>
          <Shelf label="disabled">
            <Button disabled>New homework</Button>
            <Button variant="outline" disabled>
              Try again
            </Button>
          </Shelf>
        </Section>

        <Section
          title="Box"
          note="The one container: header band, rows, body, footer. Hairline border, no shadow — never nested."
        >
          <Shelf label="header + rows">
            <div className="w-full max-w-xl">
              <Box>
                <BoxHeader>
                  <span>
                    Due
                    <Counter>9</Counter>
                  </span>
                  <Button variant="outline" size="sm">
                    New homework
                  </Button>
                </BoxHeader>
                <BoxRow
                  leading={<BookOpen />}
                  title="Problem set 4"
                  description="Linear Algebra Done Right · 8 questions"
                  trailing={<RowValue className="text-warning">today</RowValue>}
                />
                <BoxRow
                  leading={<BookOpen />}
                  title="Chapter 3 exercises"
                  description="Nonlinear Dynamics and Chaos · 5 questions"
                  trailing={<RowValue>tomorrow</RowValue>}
                />
                <BoxFooter>
                  <span>Showing 2 of 9</span>
                </BoxFooter>
              </Box>
            </div>
          </Shelf>
          <Shelf label="rows, no description">
            <div className="w-full max-w-xl">
              <Box>
                <BoxRow title="1 · Vector Spaces" trailing={<RowValue>1</RowValue>} />
                <BoxRow title="2 · Finite-Dimensional Spaces" trailing={<RowValue>27</RowValue>} />
                <BoxRow title="3 · Linear Maps" trailing={<RowValue>51</RowValue>} selected />
              </Box>
            </div>
          </Shelf>
          <Shelf label="body">
            <div className="w-full max-w-xl">
              <Box>
                <BoxHeader>About this book</BoxHeader>
                <BoxBody>
                  Prepared yesterday from a 312-page digital PDF. Sections came from the PDF&apos;s
                  own outline.
                </BoxBody>
                <BoxFooter>
                  <RowValue>sha256:4f1a9c2e</RowValue>
                  <RowValue>18.4 MB</RowValue>
                </BoxFooter>
              </Box>
            </div>
          </Shelf>
          <Shelf label="tone">
            <div className="flex w-full max-w-xl flex-col gap-4">
              <Box tone="warning">
                <BoxBody>Not ready · reading the pages, 62%.</BoxBody>
              </Box>
              <Box tone="destructive">
                <BoxBody>Couldn&apos;t prepare this book — the PDF has no extractable text.</BoxBody>
              </Box>
            </div>
          </Shelf>
        </Section>

        <Section title="Brand" note="The mark is fixed-color and never recolored for a theme.">
          <Shelf label="mark">
            <Mark />
            <Mark className="size-12" />
          </Shelf>
          <Shelf label="lockup">
            <BrandLockup />
          </Shelf>
        </Section>

        <Section title="Type" note="Nine steps. 14px is the floor — nothing in the product is smaller.">
          <Shelf label="display">
            <div className="space-y-2">
              <p className="font-heading text-4xl">Good evening, Jack.</p>
              <p className="font-heading text-3xl">Settings</p>
              <p className="font-heading text-2xl">Problem set 4</p>
              <p className="font-heading text-xl">Due this week</p>
              <p className="font-heading text-lg text-muted-foreground italic">
                Three books, one due tomorrow.
              </p>
            </div>
          </Shelf>
          <Shelf label="text">
            <div className="space-y-2">
              <p className="text-lg font-semibold">Linear Algebra Done Right</p>
              <p className="max-w-layout-reading text-reading">
                A vector space is a set V along with an addition on V and a scalar multiplication on
                V such that the following properties hold.
              </p>
              <p className="text-base">Default UI copy — descriptions, list rows, settings labels.</p>
              <p className="text-sm">Dense · buttons, rail rows, tabs, table cells.</p>
              <p className="text-xs text-muted-foreground">12 pages · prepared yesterday</p>
            </div>
          </Shelf>
          <Shelf label="mono">
            <div className="space-y-2">
              <p className="font-mono text-sm">https://api.example.com/v1</p>
              <p className="font-mono text-xs text-muted-foreground">v0.5.0 · p. 142</p>
            </div>
          </Shelf>
        </Section>

        <Section
          title="Color"
          note="Every token, on its own ground. Status colors are ink; each has one soft tint."
        >
          <Shelf label="surfaces">
            <Swatch name="background" className="bg-background" />
            <Swatch name="card" className="bg-card" />
            <Swatch name="card-header" className="bg-card-header" />
            <Swatch name="rail" className="bg-rail" />
            <Swatch name="muted" className="bg-muted" />
            <Swatch name="accent" className="bg-accent" />
          </Shelf>
          <Shelf label="ink on background">
            <Ink name="foreground" className="text-foreground" />
            <Ink name="muted-foreground" className="text-muted-foreground" />
            <Ink name="primary" className="text-primary" />
            <Ink name="success" className="text-success" />
            <Ink name="warning" className="text-warning" />
            <Ink name="destructive" className="text-destructive" />
          </Shelf>
          <Shelf label="ink on its tint">
            <Ink name="primary" className="bg-primary-soft px-2 text-primary" />
            <Ink name="success" className="bg-success-soft px-2 text-success" />
            <Ink name="warning" className="bg-warning-soft px-2 text-warning" />
            <Ink name="destructive" className="bg-destructive-soft px-2 text-destructive" />
          </Shelf>
          <Shelf label="lines">
            <Swatch name="border" className="bg-border" />
            <Swatch name="border-muted" className="bg-border-muted" />
            <Swatch name="input" className="bg-input" />
            <Swatch name="ring" className="bg-ring" />
          </Shelf>
          <Shelf label="charts">
            <Swatch name="chart-1" className="bg-chart-1" />
            <Swatch name="chart-2" className="bg-chart-2" />
            <Swatch name="chart-3" className="bg-chart-3" />
            <Swatch name="chart-4" className="bg-chart-4" />
            <Swatch name="chart-5" className="bg-chart-5" />
          </Shelf>
        </Section>

        <Section
          title="Geometry"
          note="Every spacing step and radius that exists. A gap in this row is a token that doesn't compile."
        >
          <Shelf label="spacing">
            <div className="flex flex-wrap items-end gap-3">
              {/* Literal classes on purpose: this row proves the UTILITY
                  compiles, which is what app code depends on. A step whose
                  token is missing renders no bar. */}
              <Step label="1" className="h-1" />
              <Step label="2" className="h-2" />
              <Step label="3" className="h-3" />
              <Step label="4" className="h-4" />
              <Step label="5" className="h-5" />
              <Step label="6" className="h-6" />
              <Step label="7" className="h-7" />
              <Step label="8" className="h-8" />
              <Step label="9" className="h-9" />
              <Step label="10" className="h-10" />
              <Step label="11" className="h-11" />
              <Step label="12" className="h-12" />
              <Step label="14" className="h-14" />
              <Step label="16" className="h-16" />
              <Step label="20" className="h-20" />
              <Step label="24" className="h-24" />
            </div>
          </Shelf>
          <Shelf label="semantic">
            <div className="flex flex-wrap items-end gap-3">
              <Step label="card" className="h-card" />
              <Step label="page" className="h-page" />
              <Step label="section" className="h-section" />
              <Step label="mark" className="h-mark" />
              <Step label="control-sm" className="h-control-sm" />
              <Step label="control" className="h-control" />
              <Step label="control-lg" className="h-control-lg" />
              <Step label="row" className="h-row" />
              <Step label="topbar" className="h-topbar" />
            </div>
          </Shelf>
          <Shelf label="radius">
            <div className="flex flex-wrap items-end gap-4">
              <Radius label="sm" className="rounded-sm" />
              <Radius label="md" className="rounded-md" />
              <Radius label="lg" className="rounded-lg" />
              <Radius label="full" className="rounded-full" />
            </div>
          </Shelf>
        </Section>
      </PageShell>
    </AppShell>
  )
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`size-12 rounded-md border ${className}`} />
      <span className="font-mono text-xs text-muted-foreground">{name}</span>
    </div>
  )
}

function Ink({ name, className }: { name: string; className: string }) {
  return <span className={`rounded-md py-1 text-sm ${className}`}>{name}</span>
}

function Step({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-4 bg-primary ${className}`} />
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function Radius({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`size-12 border bg-card ${className}`} />
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
