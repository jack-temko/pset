import { Check, Clock, TriangleAlert } from 'lucide-react'
import { Box, BoxRow } from '@/components/box'
import { Button } from '@/components/button'
import { Flash } from '@/components/flash'
import { HomeworkStatusLabel } from '@/components/homework-status'
import { Label } from '@/components/label'
import { ProgressBar } from '@/components/progress-bar'
import { Spinner } from '@/components/spinner'
import { Skeleton } from '@/components/skeleton'
import { UsageLine, UsageText } from '@/components/usage'
import type { Usage } from '@/api/gen/usage'
import type { ComponentEntry } from './types'
import { Shelf } from './shared'

/** What one walkthrough cost, as the server reports it: rows ordered by
 *  tokens, the headline model first. */
const USAGE: Usage = {
  rows: [
    { model: 'openai/gpt-6-luna', ms: 4000, tokens: 21034, cost: 0.0009, calls: 3 },
    { model: 'deepseek/deepseek-v4.1-flash', ms: 7900, tokens: 18554, cost: 0.0018, calls: 2 },
    { model: 'z-ai/perceptron-mk1.5', ms: 2100, tokens: 9412, cost: 0.0004, calls: 1 },
  ],
  total: { ms: 14000, tokens: 49000, cost: 0.0031, calls: 6 },
  failed: 0,
}

/** The same, when one call errored (the provider still bills what it wrote,
 *  and doesn't say how much) and one model reported no usage at all: the
 *  figures are a minimum, marked ≥, and a model with nothing counted is a
 *  dash, never a zero. */
const USAGE_FAILED: Usage = {
  rows: [
    { model: 'openai/gpt-6-luna', ms: 4000, tokens: 21034, cost: 0.0009, calls: 2, uncounted: 1 },
    { model: 'qwen/qwen4-235b', ms: 9300, calls: 1, uncounted: 1 },
  ],
  total: { ms: 13300, tokens: 21034, cost: 0.0009, calls: 3, uncounted: 2 },
  failed: 1,
}

/** The widest it gets: the longest model name, seven-digit tokens, minutes
 *  and dollars, and a paid call too small for four decimals (which must not
 *  read as free). The card grows to fit; it never spills out of itself. */
const USAGE_WIDE: Usage = {
  rows: [
    { model: 'deepseek/deepseek-v4.1-flash', ms: 187000, tokens: 1234567, cost: 12.3456, calls: 9 },
    { model: 'perceptron/perceptron-mk1.5', ms: 2100, tokens: 9412, cost: 0.0004, calls: 1 },
    { model: 'openai/gpt-6-luna', ms: 21000, tokens: 21034, cost: 0.00003, calls: 3 },
    { model: 'local/qwen', ms: 900, tokens: 310, cost: 0, calls: 1 },
  ],
  total: { ms: 211000, tokens: 1265323, cost: 12.34603, calls: 14 },
  failed: 0,
}

export const feedbackSections: ComponentEntry[] = [
  {
    id: 'flash',
    title: 'Flash',
    group: 'Feedback',
    note: 'A full-width strip under the top bar: one sentence about the whole screen, at most one action.',
    docs: ['flash'],
    Demo: () => (
      <>
        <Shelf label="warning">
          <div className="w-full max-w-xl overflow-hidden rounded-md border">
            <Flash tone="warning">Lost touch with PSet. Reconnecting…</Flash>
          </div>
        </Shelf>
        <Shelf label="default, with action">
          <div className="w-full max-w-xl overflow-hidden rounded-md border">
            <Flash
              onDismiss={() => {}}
              action={
                <Button variant="outline" size="sm">
                  Edit the title
                </Button>
              }
            >
              This book is named after its file.
            </Flash>
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'usage',
    title: 'Usage',
    group: 'Feedback',
    note: 'What a finished job spent, on one quiet line: model · time, a light popover behind it that informs rather than asks. One row per model, a Total with the call count, a footnote when a call failed.',
    docs: ['usage'],
    Demo: () => (
      <>
        <Shelf label="the line">
          <div className="py-1">
            <UsageLine usage={USAGE} />
          </div>
        </Shelf>
        <Shelf label="as plain text (a question's page)">
          <div className="space-y-2 py-1">
            <UsageText usage={USAGE} />
            <UsageText usage={USAGE_FAILED} />
          </div>
        </Shelf>
        <Shelf label="open">
          <div className="h-64">
            <UsageLine usage={USAGE} defaultOpen />
          </div>
        </Shelf>
        <Shelf label="a failed call, and one the provider didn't count">
          <div className="py-1">
            <UsageLine usage={USAGE_FAILED} />
          </div>
        </Shelf>
        <Shelf label="open: a minimum">
          <div className="h-64">
            <UsageLine usage={USAGE_FAILED} defaultOpen />
          </div>
        </Shelf>
        <Shelf label="open: the widest">
          <div className="h-64">
            <UsageLine usage={USAGE_WIDE} defaultOpen />
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'skeleton',
    title: 'Skeleton',
    group: 'Feedback',
    note: "The shape of what's coming, at its real size, so nothing moves when it lands. It doesn't pulse: the Spinner is the only loop.",
    docs: ['skeleton'],
    Demo: () => (
      <>
        <Shelf label="row">
          <Box className="w-full">
            <BoxRow
              leading={<Skeleton className="size-4 rounded-full" />}
              title="Database"
              description={<Skeleton className="h-3 w-48" />}
            />
          </Box>
        </Shelf>
        <Shelf label="prose">
          <div className="w-panel space-y-1 text-base">
            <p><Skeleton className="h-3 w-full" /></p>
            <p><Skeleton className="h-3 w-full" /></p>
            <p><Skeleton className="h-3 w-2/3" /></p>
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'spinner',
    title: 'Spinner',
    group: 'Feedback',
    note: "The one looping animation in the system. A repeating motion means ‘waiting’, so nothing that isn't waiting may borrow it.",
    docs: ['spinner'],
    Demo: () => (
      <>
        <Shelf label="spinner">
          <Spinner />
          <Spinner className="size-3 text-warning" />
          <Spinner className="size-5 text-muted-foreground" />
        </Shelf>
      </>
    ),
  },
  {
    id: 'label',
    title: 'Label',
    group: 'Feedback',
    note: 'Outlined by default: border and text share one ink. A status label always carries a word.',
    docs: ['label'],
    Demo: () => (
      <>
        <Shelf label="tone">
          <Label>Scanned</Label>
          <Label tone="primary">Due Sep 21</Label>
          <Label tone="success">
            <Check />
            Turned in
          </Label>
          <Label tone="warning">
            <Clock />
            Due today
          </Label>
          <Label tone="danger">Overdue · Sep 12</Label>
        </Shelf>
        <Shelf label="filled">
          <Label tone="danger" filled>
            <TriangleAlert />
            Needs you
          </Label>
          <Label tone="success" filled>
            Ready
          </Label>
        </Shelf>
        <Shelf label="homework status">
          <HomeworkStatusLabel status="soon" />
          <HomeworkStatusLabel status="overdue" />
          <HomeworkStatusLabel status="turned-in" />
        </Shelf>
      </>
    ),
  },
  {
    id: 'progress-bar',
    title: 'ProgressBar',
    group: 'Feedback',
    note: 'How far along a set is, as a slim bar cut into its questions, each as wide as it is hard. It says; the count beside it is the control.',
    docs: ['progress-bar'],
    Demo: () => (
      <>
        <Shelf label="weighted by difficulty">
          <div className="w-panel space-y-2">
            <ProgressBar
              label="2 of 8 done"
              segments={[
                { mark: 'done', weight: 2 },
                { mark: 'done', weight: 2 },
                { mark: 'current', weight: 4 },
                { mark: 'waiting', weight: 3 },
                { mark: 'waiting', weight: 1 },
                { mark: 'failed', weight: 1 },
                { mark: 'waiting', weight: 3 },
                { mark: 'waiting', weight: 2 },
              ]}
            />
            <p className="text-xs text-muted-foreground">Done, current, waiting and failed; wider means harder.</p>
          </div>
        </Shelf>
        <Shelf label="no weights">
          <div className="w-panel">
            <ProgressBar label="3 of 6 done" segments={['done', 'done', 'done', 'current', 'waiting', 'waiting'].map((mark) => ({ mark: mark as 'done' }))} />
          </div>
        </Shelf>
      </>
    ),
  },
]
