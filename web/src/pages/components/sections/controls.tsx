import { useState } from 'react'
import { BookOpen, Plus, Settings } from 'lucide-react'
import { Button, IconButton } from '@/components/button'
import { ResizeHandle } from '@/components/resize-handle'
import { RadioRows } from '@/components/radio-rows'
import { SegmentedControl } from '@/components/segmented-control'
import { Checkbox } from '@/components/checkbox'
import { AutoTextarea, Field, Input } from '@/components/input'
import type { Run } from '@/api/gen/pagenum'
import { PageNumbersField } from '@/pages/workspace/page-numbers'
import { anchorsOf, choiceOf } from '@/pages/workspace/book-numbering'
import { ProblemStyleField } from '@/pages/workspace/problem-style'
import type { Style } from '@/api/gen/probnum'
import type { ComponentEntry } from './types'
import { Shelf } from './shared'

/** Two panes and the seam between them, live: the left one sizes. */
function ResizeDemo() {
  const [width, setWidth] = useState(200)
  return (
    <div className="flex h-40 w-full max-w-layout-reading overflow-hidden rounded-md border">
      <div style={{ width }} className="shrink-0 border-r bg-rail p-card text-sm text-muted-foreground">
        {width}px
      </div>
      <ResizeHandle
        label="Resize the demo pane"
        pane="before"
        value={width}
        min={120}
        max={400}
        onChange={setWidth}
        onCommit={() => {}}
        onReset={() => setWidth(200)}
      />
      <div className="min-w-0 flex-1 bg-background p-card text-sm text-muted-foreground">
        Drag the grip, or tab to it and use the arrows. Double-click or Enter puts it back.
      </div>
    </div>
  )
}

/** The Book dialog's page numbers, live: one run, or a scan that lost a
 *  page (Boyce's printed 85). */
function PageNumbersDemo({ runs }: { runs: Run[] }) {
  const [anchors, setAnchors] = useState(() => anchorsOf(runs))
  return <PageNumbersField anchors={anchors} pageCount={640} onChange={setAnchors} />
}

/** The Book dialog's problem numbering, live, from what import found. */
function ProblemStyleDemo({ style }: { style: Style | undefined }) {
  const [value, setValue] = useState(() => choiceOf(style))
  const [touched, setTouched] = useState(false)
  return (
    <ProblemStyleField
      style={style}
      value={value}
      confirmed={touched}
      onChange={(v) => {
        setValue(v)
        setTouched(true)
      }}
      onConfirm={() => setTouched(true)}
    />
  )
}

function SegmentedDemo() {
  const [v, setV] = useState<'light' | 'dark' | 'system'>('system')
  return (
    <SegmentedControl
      label="Theme"
      value={v}
      onChange={setV}
      options={[
        { value: 'light', label: 'Paper' },
        { value: 'dark', label: 'Night' },
        { value: 'system', label: 'System' },
      ]}
    />
  )
}

/** Radio rows, live: a choice that needs explaining, and one not made
 *  yet. The Book dialog's numbering is the real one, above. */
function RadioRowsDemo({ start }: { start: 'section' | 'chapter' | '' }) {
  const [v, setV] = useState<'section' | 'chapter' | ''>(start)
  return (
    <RadioRows
      label="Where the problems are"
      value={v}
      onChange={setV}
      options={[
        { value: 'section', label: 'After each section', hint: 'A short Problems list closes every section.' },
        {
          value: 'chapter',
          label: "At the chapter's end",
          hint: "One long list after the chapter's last section, headed by section.",
        },
      ]}
    />
  )
}

function CheckboxDemo() {
  const [on, setOn] = useState(true)
  return (
    <Checkbox checked={on} onChange={() => setOn((v) => !v)}>
      In this book
    </Checkbox>
  )
}

export const controlsSections: ComponentEntry[] = [
  {
    id: 'button',
    title: 'Button',
    group: 'Controls',
    note: 'Five variants, three sizes. 32px by default; all radius-md.',
    docs: ['button'],
    Demo: () => (
      <>
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
      </>
    ),
  },
  {
    id: 'resize-handle',
    title: 'ResizeHandle',
    group: 'Controls',
    note: 'The seam between two panes, made draggable. A grip at its middle says the edge moves; hover, a drag or focus turn it to ring.',
    docs: ['resize-handle'],
    Demo: () => (
      <>
        <Shelf label="pane before">
          <ResizeDemo />
        </Shelf>
      </>
    ),
  },
  {
    id: 'form-controls',
    title: 'Form controls',
    group: 'Controls',
    note: "A darker `input` border, because a field has to look like something you can type into. The date picker is the browser's.",
    docs: ['input', 'checkbox', 'radio-rows', 'segmented-control'],
    Demo: () => (
      <>
        <Shelf label="input">
          <div className="w-80 space-y-4">
            <Field label="Title">
              <Input placeholder="Problem set 4" />
            </Field>
            <Field label="Due date" hint="Optional.">
              <Input type="date" />
            </Field>
            <Field label="API key" error="The endpoint refused this key (401)">
              <Input defaultValue="sk-wrong" className="font-mono" />
            </Field>
            <Field label="Question" hint="Grows as you type; never scrolls.">
              <AutoTextarea placeholder="A reference like 3.B.4, or paste the question" />
            </Field>
          </div>
        </Shelf>
        <Shelf label="page numbers">
          <div className="w-dialog">
            <PageNumbersDemo runs={[{ from: 1, offset: 16 }]} />
          </div>
        </Shelf>
        <Shelf label="lost page">
          <div className="w-dialog">
            <PageNumbersDemo
              runs={[
                { from: 1, offset: 12 },
                { from: 97, offset: 11 },
              ]}
            />
          </div>
        </Shelf>
        <Shelf label="problems, sure">
          <div className="w-dialog">
            <ProblemStyleDemo
              style={{
                form: 'local',
                where: 'section',
                heading: 'Problems',
                example: { label: '3.1 #7', page: 139 },
                sure: true,
                confirmed: false,
              }}
            />
          </div>
        </Shelf>
        <Shelf label="problems, unsure">
          <div className="w-dialog">
            <ProblemStyleDemo style={{ form: 'section', where: 'chapter', sure: false, confirmed: false }} />
          </div>
        </Shelf>
        <Shelf label="problems, unknown">
          <div className="w-dialog">
            <ProblemStyleDemo style={undefined} />
          </div>
        </Shelf>
        <Shelf label="radio rows">
          <div className="w-dialog">
            <RadioRowsDemo start="section" />
          </div>
        </Shelf>
        <Shelf label="radio rows, unanswered">
          <div className="w-dialog">
            <RadioRowsDemo start="" />
          </div>
        </Shelf>
        <Shelf label="segmented">
          <SegmentedDemo />
        </Shelf>
        <Shelf label="checkbox">
          <CheckboxDemo />
          <Checkbox checked={false} onChange={() => {}}>
            Unchecked
          </Checkbox>
          <Checkbox checked disabled onChange={() => {}}>
            Disabled
          </Checkbox>
        </Shelf>
      </>
    ),
  },
]
