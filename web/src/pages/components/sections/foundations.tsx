import { BrandLockup, Mark } from '@/components/brand'
import type { ComponentEntry } from './types'
import { Shelf } from './shared'

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

export const foundationsSections: ComponentEntry[] = [
  {
    id: 'brand',
    title: 'Brand',
    group: 'Foundations',
    note: 'The mark is fixed-color and never recolored for a theme.',
    docs: ['brand'],
    Demo: () => (
      <>
        <Shelf label="mark">
          <Mark />
          <Mark className="size-12" />
        </Shelf>
        <Shelf label="lockup">
          <BrandLockup />
        </Shelf>
      </>
    ),
  },
  {
    id: 'type',
    title: 'Type',
    group: 'Foundations',
    note: 'Nine steps. 15px is the floor. Nothing in the product is smaller.',
    Demo: () => (
      <>
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
            <p className="text-base">Default UI copy: descriptions, list rows, settings labels.</p>
            <p className="text-sm">Dense · buttons, rail rows, tabs, table cells.</p>
            <p className="text-xs text-muted-foreground">12 pages · prepared yesterday</p>
          </div>
        </Shelf>
        <Shelf label="mono: copyable ids, and data figures">
          <div className="space-y-2">
            <p className="font-mono text-sm">https://api.example.com/v1</p>
            <p className="font-mono text-xs text-muted-foreground">openai/gpt-6-luna · v0.5.0</p>
            <p className="figure text-xs text-muted-foreground">$0.0031 · 4,210 tokens</p>
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'color',
    title: 'Color',
    group: 'Foundations',
    note: 'Every token, on its own ground. Status colors are ink; each has one soft tint.',
    Demo: () => (
      <>
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
      </>
    ),
  },
  {
    id: 'geometry',
    title: 'Geometry',
    group: 'Foundations',
    note: "Every spacing step and radius that exists. A gap in this row is a token that doesn't compile.",
    Demo: () => (
      <>
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
      </>
    ),
  },
]
