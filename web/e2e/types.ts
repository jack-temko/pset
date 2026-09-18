import type { Page } from 'playwright'

export type Theme = 'light' | 'dark'
export type Mode = 'mock' | 'live'

/** Extra response shaping on top of what the seed data already provides.
 *  `books: 'fail'` turns GET /api/books into a 500; `importMode` scripts the
 *  import dialog's upload path; `events: 'fail'` kills the SSE stream before
 *  the snapshot; `snapshotDelayMs` holds the snapshot back to freeze the
 *  loading state; `config*` scripts the settings page's connection card. */
export interface MockScript {
  books?: 'ok' | 'fail'
  booksDelayMs?: number
  importMode?: 'accept' | 'duplicate' | 'error' | 'hang'
  /** `fail` destroys /api/events on connect (never connected); `drop` also
   *  closes any live stream, so a page that was already connected goes
   *  honest at once — the lost-touch card with its stale stamp. */
  events?: 'fail' | 'drop'
  snapshotDelayMs?: number
  /** POST /api/config/test verdicts. Default 'pass'. */
  configTest?: 'pass' | 'fail-chat' | 'fail-embed'
  /** GET /api/config answers 500 (connection load error). */
  config?: 'fail'
  /** GET /api/config is held back this long (loading skeleton). */
  configDelayMs?: number
  /** PUT /api/config answers 500 (inline save error). */
  configSave?: 'fail'
  /** GET /api/homework answers 500 (dashboard load error). */
  homeworks?: 'fail'
  /** POST /api/homework is held back this long (creating spinner). */
  homeworkCreateDelayMs?: number
  /** POST /api/homework answers 500 (create toast error). */
  homeworkCreate?: 'fail'
  /** ms after apply when every generating homework settles to ready and its
   *  job completes, emitting the job event the dashboard refetches off. */
  homeworkSettleMs?: number
  /** Shapes the doctor report. Default 'healthy'; 'fail' answers 500. */
  doctor?: 'healthy' | 'warnings' | 'failed' | 'fixed' | 'fail'
  /** The POST (Repair) report; defaults to the GET shape. */
  doctorFix?: 'healthy' | 'warnings' | 'failed' | 'fixed' | 'fail'
  /** Both doctor endpoints are held back this long (repairing spinner). */
  doctorDelayMs?: number
  /** GET /api/books/{sha} answers 500 (reader load error). */
  book?: 'fail'
  /** GET /api/books/{sha}/sections answers 500. */
  sections?: 'fail'
  /** GET /api/books/{sha}/pages/{n} answers 500. */
  pageText?: 'fail'
  /** The scan endpoint answers 404 (reader's no-scan state). */
  scan?: 'missing'
  /** The scripted POST /api/books/{sha}/ask SSE. 'streaming' holds
   *  mid-thought forever (skeleton shot); 'fail' answers 500 pre-stream. */
  ask?: 'answer' | 'envelopes' | 'tools' | 'streaming' | 'fail'
  /** The scripted POST /api/homework/{id}/chat SSE. 'tools' runs a calc
   *  round trip; 'correction' pins an understanding note and offers the
   *  rewrite; 'streaming' holds mid-thought forever (skeleton shot);
   *  'fail' answers 500 pre-stream. */
  homeworkChat?: 'answer' | 'tools' | 'correction' | 'streaming' | 'fail'
  /** The scripted rewrite/relocate task. 'stages' leaves it running mid
   *  phase (the in-progress shot); 'fail' settles it failed. */
  repair?: 'done' | 'stages' | 'fail'
  /** How long a repair task takes to settle. Default 400ms. */
  repairMs?: number
}

/** Network conditioning, applied via Playwright routing in both modes. */
export interface NetworkCondition {
  kind: 'slow' | 'offline' | 'error' | 'hang'
  /** URL glob; default `**\/api\/**` */
  pattern?: string
  delayMs?: number
  status?: number
}

export interface RunCtx {
  page: Page
  base: string
  mode: Mode
  /** Navigates relative to the runner's origin (page.goto cannot resolve '/'). */
  goto(path: string): Promise<null | import('playwright').Response>
}

/** One actuation step: either an action or a screenshot marker. Actions are
 *  code (not a mini-DSL) so states can use the full Playwright API and do
 *  their own readiness waits. */
export type Step = { run: (ctx: RunCtx) => Promise<void> } | { shot: string }

export interface LiveSeed {
  /** Server-side file paths imported through the real API, in order. */
  importPaths: string[]
}

export interface StateDef {
  id: string
  page: string
  title: string
  note: string
  tags?: string[]
  modes?: Mode[]
  /** Console classification: 'state' gets a Capture button, 'flow' gets
   *  Replay. Default 'state'. */
  kind?: 'state' | 'flow'
  /** Where the console navigates when loading this entry. Default '/'. */
  entry?: string
  /** Mock data scenario id from the seed registry. */
  seed: string
  mock?: MockScript
  network?: NetworkCondition
  liveSeed?: LiveSeed
  steps: Step[]
}

export interface ShotResult {
  name: string
  theme: Theme
  file: string
}

export interface StateResult {
  stateId: string
  page: string
  title: string
  note: string
  tags: string[]
  seed: string
  mock: MockScript
  network?: NetworkCondition
  modes: Mode[]
  theme: Theme
  mode: Mode
  shots: ShotResult[]
  error?: string
  consoleErrors: string[]
  durationMs: number
}
