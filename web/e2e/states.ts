import { fileURLToPath } from 'node:url'

import type { RunCtx, StateDef } from './types.ts'
import { readerSha } from './seeds/reader.ts'
import { preparingBook, books } from './seeds/library.ts'
import { askSha } from './seeds/ask.ts'
import { bookHomeSha } from './seeds/book-detail.ts'

/** The book the mixed shelf shows as failed preparation. */
const failedSha = books[2].sha256

/** The book the library: shelf shows mid-preparation; the reader's
 *  not-ready state opens it by its sha. */
const preparingSha = preparingBook.sha256

export const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
export const samplePdf = `${repoRoot}/testdata/sample-flat.pdf`
export const notAPdf = fileURLToPath(new URL('./fixtures/not-a-pdf.txt', import.meta.url))

const cards = (ctx: RunCtx) => ctx.page.locator('a[href^="/library/"]')

/** Open the import dialog from a populated shelf. */
async function openImport(ctx: RunCtx) {
  await ctx.goto('/')
  await cards(ctx).first().waitFor()
  await ctx.page.getByRole('button', { name: 'Import', exact: true }).click()
  await ctx.page.getByText('Drop a PDF here').waitFor()
}

async function dropFile(ctx: RunCtx, file: string) {
  await ctx.page.locator('input[type="file"]').setInputFiles(file)
}

/** The checked-in inventory of UI states. This list is the acceptance
 *  checklist: the gallery renders every entry, and anything missing from it
 *  simply does not exist for review purposes. */
export const states: StateDef[] = [
  {
    id: 'library/loading',
    page: 'library',
    title: 'Books fetch in flight',
    note: 'Skeleton grid while GET /api/books is pending (mocked 800ms delay).',
    modes: ['mock'],
    seed: 'library:shelf',
    mock: { booksDelayMs: 800 },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/')
          await ctx.page.getByText('Your library').waitFor()
        },
      },
      { shot: 'skeleton' },
    ],
  },
  {
    id: 'library/empty',
    page: 'library',
    title: 'Empty library',
    note: 'No books yet: the shared EmptyState card owns the import CTA; header Import button and toolbar are hidden.',
    seed: 'library:empty',
    liveSeed: { importPaths: [] },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/')
          await ctx.page.getByText('Add your first textbook').waitFor()
        },
      },
      { shot: 'hero' },
    ],
  },
  {
    id: 'library/populated',
    page: 'library',
    title: 'Shelf with books',
    note: 'Four covers, mixed Scanned and Digital kinds, a running ingest badge on one card; second shot shows the hover lift.',
    seed: 'library:shelf',
    liveSeed: {
      importPaths: [
        `${repoRoot}/testdata/sample-flat.pdf`,
        `${repoRoot}/testdata/sample-digital.pdf`,
        `${repoRoot}/testdata/sample-scanned.pdf`,
      ],
    },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/')
          const min = ctx.mode === 'live' ? 3 : 4
          await ctx.page.waitForFunction(
            (n) => document.querySelectorAll('a[href^="/library/"]').length >= n,
            min,
          )
          if (ctx.mode === 'mock') await cards(ctx).locator('.animate-spin').waitFor()
        },
      },
      { shot: 'grid' },
      {
        run: async (ctx) => {
          await cards(ctx).first().hover()
          await ctx.page.waitForTimeout(350)
        },
      },
      { shot: 'card-hover' },
    ],
  },
  {
    id: 'library/error',
    page: 'library',
    title: 'Books fetch failed',
    note: 'GET /api/books answers 500; inline error card with the server message and a Retry button.',
    modes: ['mock'],
    seed: 'library:shelf',
    mock: { books: 'fail' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/')
          await ctx.page.getByText('load your library').waitFor()
        },
      },
      { shot: 'error-card' },
    ],
  },
  {
    id: 'library/no-match',
    page: 'library',
    title: 'Search finds nothing',
    note: 'Filtered to a query no book matches: quiet line plus Clear search, no import CTA.',
    seed: 'library:shelf',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/')
          await cards(ctx).first().waitFor()
          await ctx.page.getByRole('textbox', { name: 'Search library' }).fill('zzzz no such book')
          await ctx.page.getByText('No books match').waitFor()
        },
      },
      { shot: 'no-match' },
    ],
  },
  {
    id: 'library/dialog-idle',
    kind: 'flow',
    page: 'library',
    title: 'Import dialog, idle',
    note: 'Intake view: dashed drop zone, browse affordance, no progress UI.',
    tags: ['flow:import'],
    modes: ['mock'],
    seed: 'library:shelf',
    steps: [
      { run: (ctx) => openImport(ctx) },
      { shot: 'idle' },
    ],
  },
  {
    id: 'library/dialog-zone-error',
    kind: 'flow',
    page: 'library',
    title: 'Import rejects a non-PDF',
    note: 'Client-side guard keeps the file local: inline alert, no upload attempted.',
    tags: ['flow:import'],
    modes: ['mock'],
    seed: 'library:shelf',
    steps: [
      { run: (ctx) => openImport(ctx) },
      {
        run: async (ctx) => {
          await dropFile(ctx, notAPdf)
          await ctx.page.getByRole('alert').waitFor()
        },
      },
      { shot: 'zone-error' },
    ],
  },
  {
    id: 'library/dialog-uploading',
    kind: 'flow',
    page: 'library',
    title: 'Import upload in flight',
    note: 'POST /api/import held open: spinner, filename, byte count, zone disabled.',
    tags: ['flow:import'],
    modes: ['mock'],
    seed: 'library:shelf',
    mock: { importMode: 'hang' },
    steps: [
      { run: (ctx) => openImport(ctx) },
      {
        run: async (ctx) => {
          await dropFile(ctx, samplePdf)
          await ctx.page.getByRole('status').waitFor()
        },
      },
      { shot: 'uploading' },
    ],
  },
  {
    id: 'library/dialog-upload-error',
    kind: 'flow',
    page: 'library',
    title: 'Import upload failed',
    note: 'Server answered 500: destructive alert with the message and the detail chain.',
    tags: ['flow:import'],
    modes: ['mock'],
    seed: 'library:shelf',
    mock: { importMode: 'error' },
    steps: [
      { run: (ctx) => openImport(ctx) },
      {
        run: async (ctx) => {
          await dropFile(ctx, samplePdf)
          await ctx.page.getByText('Import failed').waitFor()
        },
      },
      { shot: 'upload-error' },
    ],
  },
  {
    id: 'library/dialog-accepted',
    kind: 'flow',
    page: 'library',
    title: 'Import accepted',
    note: '202 with a queued job: success roundel, next-steps panel, View task link; the task pill pulses once.',
    tags: ['flow:import'],
    modes: ['mock'],
    seed: 'library:shelf',
    mock: { importMode: 'accept' },
    steps: [
      { run: (ctx) => openImport(ctx) },
      {
        run: async (ctx) => {
          await dropFile(ctx, samplePdf)
          await ctx.page.getByText('Added to the queue').waitFor()
        },
      },
      { shot: 'accepted' },
    ],
  },
  {
    id: 'library/dialog-duplicate',
    kind: 'flow',
    page: 'library',
    title: 'Import duplicate',
    note: '200 duplicated: own heading, Open book points at the stored copy.',
    tags: ['flow:import'],
    modes: ['mock'],
    seed: 'library:shelf',
    mock: { importMode: 'duplicate' },
    steps: [
      { run: (ctx) => openImport(ctx) },
      {
        run: async (ctx) => {
          await dropFile(ctx, samplePdf)
          await ctx.page.getByText('Already in your library').waitFor()
        },
      },
      { shot: 'duplicate' },
    ],
  },
  {
    id: 'library/deeplink',
    entry: '/?import=1',
    page: 'library',
    title: 'Deep link opens the dialog',
    note: '/?import=1 over an empty library (the path Ask sends people); the param is consumed on load.',
    tags: ['flow:import'],
    modes: ['mock'],
    seed: 'library:empty',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/?import=1')
          await ctx.page.getByText('Drop a PDF here').waitFor()
        },
      },
      { shot: 'deeplink-dialog' },
    ],
  },
  {
    id: 'tasks/loading',
    entry: '/tasks',
    page: 'tasks',
    title: 'Tasks stream connecting',
    note: 'Skeleton rows while the SSE snapshot is held back (mocked 1200ms delay).',
    modes: ['mock'],
    seed: 'tasks:board',
    mock: { snapshotDelayMs: 1200 },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/tasks')
          await ctx.page.getByText('Books being prepared').waitFor()
        },
      },
      { shot: 'skeleton' },
    ],
  },
  {
    id: 'tasks/empty',
    entry: '/tasks',
    page: 'tasks',
    title: 'Nothing to do',
    note: 'Empty board: roundel, one-liner, Import a PDF action. With nothing running the panel sinks back into the Tasks nav item, leaving just a quiet row.',
    seed: 'tasks:empty',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/tasks')
          await ctx.page.getByText('Nothing to do.').waitFor()
          if (await ctx.page.getByRole('button', { name: 'Stop' }).count()) {
            throw new Error('the idle card offered a Stop button')
          }
        },
      },
      { shot: 'empty' },
    ],
  },
  {
    id: 'tasks/board',
    entry: '/tasks',
    kind: 'flow',
    page: 'tasks',
    title: 'The board: every resting state',
    note: 'Needs you, Running (live phase bar + time left), Waiting, Paused, Done. Every row carries its whole plan inline — four phases at most, so nothing hides behind a chevron.',
    seed: 'tasks:board',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/tasks')
          await ctx.page.getByRole('heading', { name: /Needs you/ }).waitFor()
          await ctx.page.getByRole('heading', { name: /Running/ }).waitFor()
          await ctx.page.getByRole('heading', { name: /Done/ }).waitFor()
        },
      },
      { shot: 'board' },
      {
        run: async (ctx) => {
          // The two failure shapes side by side: an environment failure that
          // offers Try again, and a corrupt file that offers only Remove —
          // retrying it would fail identically, so no door is shown.
          await ctx.page.getByText('Can’t be prepared').scrollIntoViewIfNeeded()
          await ctx.page.waitForTimeout(200)
        },
      },
      { shot: 'board-failure-shapes' },
    ],
  },
  {
    id: 'tasks/history',
    entry: '/tasks',
    page: 'tasks',
    title: 'A long history stays legible',
    note: 'Fourteen finished tasks. History prunes itself to the newest 25 as tasks settle, so there is no Clear finished button and nothing to sweep by hand.',
    seed: 'tasks:history',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/tasks')
          await ctx.page.getByRole('heading', { name: /Done/ }).waitFor()
          if (await ctx.page.getByRole('button', { name: 'Clear finished' }).count()) {
            throw new Error('Clear finished survived; history prunes itself')
          }
        },
      },
      { shot: 'history' },
    ],
  },
  {
    id: 'tasks/error',
    entry: '/tasks',
    page: 'tasks',
    title: 'Task stream failed',
    note: 'SSE connection killed before the snapshot: error card with the stream message and a Retry button.',
    modes: ['mock'],
    seed: 'tasks:board',
    mock: { events: 'fail' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/tasks')
          await ctx.page.getByText('load tasks').waitFor()
        },
      },
      { shot: 'error-card' },
    ],
  },
  {
    id: 'tasks/card',
    page: 'tasks',
    title: 'The sidebar panel',
    note: 'Grows upward out of the Tasks nav item, wrapping the task in the rail\'s dark space: what is happening in plain words, a phase bar with its count, the pip strip, time left, and Stop. The nav item stays put underneath, so the history on /tasks is always one click away.',
    seed: 'tasks:board',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/')
          await ctx.page.getByText('Reading Organic Chemistry').first().waitFor()
          await ctx.page.getByRole('button', { name: 'Stop' }).waitFor()
          // The panel grows above the nav item, never in place of it.
          await ctx.page.getByRole('link', { name: 'Tasks', exact: true }).waitFor()
        },
      },
      { shot: 'card-working' },
    ],
  },

  // --- settings -------------------------------------------------------------

  {
    id: 'settings/connection',
    page: 'settings',
    title: 'Connection: save, then verdicts',
    note: 'An edit enables Save & test; one action saves the patch, tests the saved settings, and renders the chat/search verdicts.',
    tags: ['settings'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/settings',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/settings')
          await ctx.goto('/settings')
          await ctx.page.getByText('API address').waitFor()
        },
      },
      { shot: 'idle' },
      {
        run: async (ctx) => {
          await ctx.page.getByLabel('Search model').fill('nomic-embed-text-v1.5')
          await ctx.page.getByRole('button', { name: 'Save & test' }).click()
          await ctx.page.getByText('Semantic search').waitFor()
        },
      },
      { shot: 'verdicts' },
    ],
  },
  {
    id: 'settings/loading',
    page: 'settings',
    title: 'Connection settings loading',
    note: 'The connection card pulses while GET /api/config is held back; the rest of the page renders normally.',
    tags: ['settings'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/settings',
    mock: { configDelayMs: 800 },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/settings')
          await ctx.goto('/settings')
          await ctx.page.getByText('Connection').waitFor()
        },
      },
      { shot: 'loading' },
    ],
  },
  {
    id: 'settings/connection-error',
    page: 'settings',
    title: 'Connection settings failed to load',
    note: 'GET /api/config answers 500: inline destructive message with the server text and a Retry button.',
    tags: ['settings'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/settings',
    mock: { config: 'fail' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/settings')
          await ctx.goto('/settings')
          await ctx.page.getByText('load the connection settings').waitFor()
        },
      },
      { shot: 'error' },
    ],
  },
  {
    id: 'settings/save-error',
    page: 'settings',
    title: 'Connection save rejected',
    note: 'PUT /api/config answers 500: inline destructive alert, the test never runs.',
    tags: ['settings'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/settings',
    mock: { configSave: 'fail' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/settings')
          await ctx.goto('/settings')
          await ctx.page.getByText('API address').waitFor()
          await ctx.page.getByLabel('API key').fill('sk-new-key')
          await ctx.page.getByRole('button', { name: 'Save & test' }).click()
          await ctx.page.getByRole('alert').waitFor()
        },
      },
      { shot: 'save-error' },
    ],
  },
  {
    id: 'settings/connection-fail-embed',
    page: 'settings',
    title: 'Connection: search failing, chat fine',
    note: 'Mirror of the failing chat: the search verdict shows its mono detail while chat passes.',
    tags: ['settings'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/settings',
    mock: { configTest: 'fail-embed' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/settings')
          await ctx.page.getByText('API address').waitFor()
          await ctx.page.getByLabel('API key').fill('sk-new-key')
          await ctx.page.getByRole('button', { name: 'Save & test' }).click()
          await ctx.page.getByText('isn’t working').waitFor()
        },
      },
      { shot: 'fail-verdicts' },
    ],
  },

  // --- homework --------------------------------------------------------------

  {
    id: 'homework/empty',
    page: 'homework',
    title: 'Homework: nothing yet',
    note: 'No assignments at all: the empty card carries the pitch and the New homework door.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/homework',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework')
          await ctx.page.getByText('No homework yet.').waitFor()
        },
      },
      { shot: 'empty' },
    ],
  },
  {
    id: 'homework/dashboard',
    page: 'homework',
    title: 'Homework: the week',
    note: 'Due soon strip (overdue first, still-generating excluded) over the complete list — every state of an assignment in one shot.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:week',
    entry: '/homework',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework')
          await ctx.page.getByText('Due soon').waitFor()
        },
      },
      { shot: 'dashboard' },
    ],
  },
  {
    id: 'homework/filters',
    page: 'homework',
    title: 'Homework: status and search',
    note: 'Open hides turned-in work; a search with no hits offers the clear-filters way back.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:week',
    entry: '/homework',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework')
          await ctx.page.getByText('Due soon').waitFor()
          await ctx.page.getByRole('button', { name: 'Open' }).click()
          await ctx.page.getByText('Problem Set 2').waitFor({ state: 'hidden' })
        },
      },
      { shot: 'open' },
      {
        run: async (ctx) => {
          await ctx.page.getByLabel('Search homework').fill('zzz')
          await ctx.page.getByText('Nothing matches.').waitFor()
        },
      },
      { shot: 'no-match' },
    ],
  },
  {
    id: 'homework/dialog',
    page: 'homework',
    title: 'New homework: empty dialog',
    note: 'Book picker, optional title and due date, and the assignment textarea; Create stays disabled.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:week',
    entry: '/homework',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework')
          await ctx.page.getByRole('button', { name: 'New homework' }).click()
          await ctx.page.getByText('Assignment text').waitFor()
        },
      },
      { shot: 'dialog' },
    ],
  },
  {
    id: 'homework/dialog-filled',
    page: 'homework',
    title: 'New homework: ready to create',
    note: 'Book picked, title, due date and the pasted assignment in; Create homework arms.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:week',
    entry: '/homework',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework')
          await ctx.page.getByRole('button', { name: 'New homework' }).click()
          await ctx.page.getByText('Assignment text').waitFor()
          await ctx.page.getByRole('button', { name: 'Choose a book' }).click()
          await ctx.page
            .getByRole('button', { name: /Calculus: Early Transcendentals/ })
            .click()
          await ctx.page.getByRole('button', { name: /Organic Chemistry/ }).waitFor({ state: 'hidden' })
          await ctx.page.getByLabel('Title (optional)').fill('Problem Set 4')
          await ctx.page.getByLabel('Due (optional)').fill('2026-09-21')
          await ctx.page
            .getByLabel('Assignment text')
            .fill('1. Differentiate f(x) = x^2 sin(x).\n2. Evaluate the integral of 1/x.')
        },
      },
      { shot: 'filled' },
    ],
  },
  {
    id: 'homework/dialog-no-books',
    page: 'homework',
    title: 'New homework: no books yet',
    note: 'With an empty library the dialog points at the import flow instead of showing fields.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/homework',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework')
          await ctx.page.getByRole('button', { name: 'New homework' }).click()
          await ctx.page.getByText('No books yet.').waitFor()
        },
      },
      { shot: 'no-books' },
    ],
  },
  {
    id: 'homework/creating',
    page: 'homework',
    title: 'New homework: create in flight',
    note: 'POST /api/homework held back: Create shows its spinner and stays disabled while the build is accepted.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:week',
    entry: '/homework',
    mock: { homeworkCreateDelayMs: 900 },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework')
          await ctx.page.getByRole('button', { name: 'New homework' }).click()
          await ctx.page.getByText('Assignment text').waitFor()
          await ctx.page.getByRole('button', { name: 'Choose a book' }).click()
          await ctx.page
            .getByRole('button', { name: /Calculus: Early Transcendentals/ })
            .click()
          await ctx.page.getByRole('button', { name: /Organic Chemistry/ }).waitFor({ state: 'hidden' })
          await ctx.page
            .getByLabel('Assignment text')
            .fill('1. Differentiate f(x) = x^2 sin(x).')
          await ctx.page.getByRole('button', { name: 'Create homework' }).click()
          await ctx.page.waitForFunction(() => {
            const button = [...document.querySelectorAll('button')].find((b) =>
              b.textContent?.includes('Create homework'),
            )
            return button?.disabled === true
          })
        },
      },
      { shot: 'creating' },
    ],
  },
  {
    id: 'homework/create-fail',
    page: 'homework',
    title: 'New homework: create rejected',
    note: 'POST /api/homework answers 500: a toast carries the server message and the draft stays open.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:week',
    entry: '/homework',
    mock: { homeworkCreate: 'fail' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework')
          await ctx.page.getByRole('button', { name: 'New homework' }).click()
          await ctx.page.getByText('Assignment text').waitFor()
          await ctx.page.getByRole('button', { name: 'Choose a book' }).click()
          await ctx.page
            .getByRole('button', { name: /Calculus: Early Transcendentals/ })
            .click()
          await ctx.page.getByRole('button', { name: /Organic Chemistry/ }).waitFor({ state: 'hidden' })
          await ctx.page
            .getByLabel('Assignment text')
            .fill('1. Differentiate f(x) = x^2 sin(x).')
          await ctx.page.getByRole('button', { name: 'Create homework' }).click()
          await ctx.page.getByText('the model never answered').waitFor()
        },
      },
      { shot: 'fail-toast' },
    ],
  },
  {
    id: 'homework/live',
    page: 'homework',
    title: 'Homework: a build settles live',
    note: 'Vectors Worksheet counts its walkthroughs as they land; when its task finishes on the stream the list refetches and the row flips to 3 questions, joining the strip. An assignment is a list, so the row says how far along it is rather than calling anything short of finished broken.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:week',
    entry: '/homework',
    mock: { homeworkSettleMs: 1200 },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework')
          await ctx.page.getByText('3 of 8 walkthroughs').waitFor()
        },
      },
      { shot: 'generating' },
      {
        run: async (ctx) => {
          await ctx.page.getByText('3 of 8 walkthroughs').waitFor({ state: 'hidden' })
          await ctx.page.waitForFunction(
            () =>
              (document.body.innerText.match(/Vectors Worksheet/g) ?? []).length >= 2,
          )
        },
      },
      { shot: 'settled' },
    ],
  },
  {
    id: 'homework/error',
    page: 'homework',
    title: 'Homework: load failed',
    note: 'GET /api/homework answers 500: the destructive error card with the server text and Retry.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:week',
    entry: '/homework',
    mock: { homeworks: 'fail' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework')
          await ctx.page.getByText('Couldn’t load your homework.').waitFor()
        },
      },
      { shot: 'error' },
    ],
  },

  {
    id: 'homework/workspace',
    page: 'homework',
    title: 'Workspace: outline, question, tutor',
    note: 'The three panes: the outline on the left, one question in the middle, the assignment’s tutor chat on the right with its composer armed once a message is typed. The command bar is gone — its verbs are the outline’s own buttons.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:workspace',
    entry: '/homework/hw-pset3',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework/hw-pset3')
          await ctx.page.getByRole('heading', { name: 'Tutor' }).waitFor()
          await ctx.page.getByRole('navigation', { name: 'Questions' }).first().waitFor()
        },
      },
      { shot: 'workspace' },
      {
        run: async (ctx) => {
          await ctx.page.getByLabel('Message the tutor').fill('Why does the 6 Ω carry both mesh currents?')
        },
      },
      { shot: 'composer-armed' },
    ],
  },

  {
    id: 'homework/add-question',
    page: 'homework',
    title: 'Workspace: adding a question by hand',
    note: 'The door the command bar used to be. The outline’s Add question opens a small dialog — the question as printed, and the page if you already know it — then the new question takes the centre pane while it is found and written, streaming the same stages a rewrite does.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:eecs',
    entry: '/homework/hw-eecs202',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework/hw-eecs202')
          await ctx.page.getByRole('heading', { name: 'Tutor' }).waitFor()
          await ctx.page
            .getByRole('navigation', { name: 'Questions' })
            .getByRole('button', { name: 'Add question' })
            .click()
          await ctx.page.getByLabel('The question').fill('3.41')
          await ctx.page.getByLabel('Page', { exact: true }).fill('143')
        },
      },
      { shot: 'dialog' },
      {
        run: async (ctx) => {
          await ctx.page.getByRole('button', { name: 'Add question', exact: true }).last().click()
          await ctx.page.getByText('How I read this').waitFor()
        },
      },
      { shot: 'added' },
    ],
  },

  {
    id: 'homework/chat-tools',
    page: 'homework',
    title: 'Workspace chat: tool cards',
    note: 'A turn that reached for tools: the calc card carries the exact value it computed, the search card its page chips, and the prose that follows cites the page as prose. The card is the model showing its working, so it sits quieter than the answer.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:eecs',
    entry: '/homework/hw-eecs202',
    mock: { homeworkChat: 'tools' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework/hw-eecs202')
          await ctx.page.getByRole('heading', { name: 'Tutor' }).waitFor()
          await ctx.page.getByLabel('Message the tutor').fill('What is the mesh current?')
          await ctx.page.getByRole('button', { name: 'Send message' }).click()
          await ctx.page.getByText('5.99385').waitFor()
        },
      },
      { shot: 'tool-cards' },
    ],
  },

  {
    id: 'homework/chat-thinking',
    page: 'homework',
    title: 'Workspace chat: a tool in flight',
    note: 'Held mid-turn: the running tool card spins with the expression it was handed, so a two-minute turn is never a bare spinner.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:eecs',
    entry: '/homework/hw-eecs202',
    mock: { homeworkChat: 'streaming' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework/hw-eecs202')
          await ctx.page.getByRole('heading', { name: 'Tutor' }).waitFor()
          await ctx.page.getByLabel('Message the tutor').fill('What is the mesh current?')
          await ctx.page.getByRole('button', { name: 'Send message' }).click()
          await ctx.page.getByText('Calculating…').waitFor()
        },
      },
      { shot: 'tool-running' },
    ],
  },

  {
    id: 'homework/correction',
    page: 'homework',
    title: 'Workspace: a correction landing',
    note: 'The loop this whole system exists for. The student says the source is the other way; the note pins on Q3, the walkthrough goes out of date, and the reply carries the one-click rewrite. The reading box above is what made the misread visible in the first place.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:eecs',
    entry: '/homework/hw-eecs202',
    mock: { homeworkChat: 'correction' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework/hw-eecs202')
          await ctx.page.getByRole('heading', { name: 'Tutor' }).waitFor()
          await ctx.page.getByRole('navigation', { name: 'Questions' }).first()
            .getByRole('button', { name: /^3/ })
            .click()
          await ctx.page.getByText('How I read this').waitFor()
        },
      },
      { shot: 'reading-box' },
      {
        run: async (ctx) => {
          await ctx.page
            .getByLabel('Message the tutor')
            .fill('The 2 A source arrow points up in the figure, not down.')
          await ctx.page.getByRole('button', { name: 'Send message' }).click()
          await ctx.page
            .getByRole('button', { name: 'Rewrite the walkthrough', exact: true })
            .waitFor()
        },
      },
      { shot: 'note-landed' },
    ],
  },

  {
    id: 'homework/stale-rewrite',
    page: 'homework',
    title: 'Workspace: out of date, and rewriting',
    note: 'The state after a correction, restored from history: Q3 stale in the outline, its notes under the question, the thread that got it there on the right — then the rewrite running as that question’s own task, its phase note live in the outline row instead of the assignment sitting silent.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:eecs-corrected',
    entry: '/homework/hw-eecs202',
    mock: { repair: 'stages' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework/hw-eecs202')
          await ctx.page.getByRole('heading', { name: 'Tutor' }).waitFor()
          await ctx.page.getByRole('navigation', { name: 'Questions' }).first()
            .getByRole('button', { name: /^3/ })
            .click()
          await ctx.page.getByText('This walkthrough is out of date.').waitFor()
        },
      },
      { shot: 'stale' },
      {
        run: async (ctx) => {
          await ctx.page.getByRole('button', { name: 'Rewrite it' }).click()
          await ctx.page
            .getByRole('navigation', { name: 'Questions' })
            .getByText('Writing the walkthrough…')
            .waitFor()
        },
      },
      { shot: 'rewriting' },
    ],
  },

  {
    id: 'homework/question-tasks',
    page: 'homework',
    title: 'Workspace: a question being worked',
    note: 'Each question is its own task, so the outline says what is happening to each one right now — the phase note of the running question, live, instead of a single assignment-wide spinner. This is what made a long walkthrough look like a hang.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:eecs',
    entry: '/homework/hw-eecs202',
    mock: { repair: 'stages' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework/hw-eecs202')
          await ctx.page.getByRole('heading', { name: 'Tutor' }).waitFor()
          const outline = ctx.page.getByRole('navigation', { name: 'Questions' })
          await outline.getByRole('button', { name: /^3/ }).click()
          await ctx.page.getByText('How I read this').waitFor()
          await ctx.page.getByRole('button', { name: /^Rewrite the walkthrough for/ }).click()
          await outline.getByText('Writing the walkthrough…').waitFor()
        },
      },
      { shot: 'question-working' },
    ],
  },

  {
    id: 'homework/print-scales',
    page: 'homework',
    title: 'Template PDF: print layout',
    note: 'The Template PDF tab carries the assignment print knobs; picking a figure size saves to the assignment and the select reflects it.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:workspace',
    entry: '/homework/hw-pset3',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework/hw-pset3')
          await ctx.page.getByRole('heading', { name: 'Tutor' }).waitFor()
          await ctx.page.getByRole('tab', { name: 'Template PDF' }).click()
          await ctx.page.getByText('Print layout').waitFor()
        },
      },
      { shot: 'idle' },
      {
        run: async (ctx) => {
          await ctx.page.getByLabel('Figure size').click()
          await ctx.page.getByRole('option', { name: '150%' }).click()
          await ctx.page.getByLabel('Figure size').getByText('150%').waitFor()
        },
      },
      { shot: 'figure-150' },
    ],
  },

  // --- doctor ----------------------------------------------------------------

  {
    id: 'homework/workspace-eecs',
    page: 'homework',
    title: 'Workspace: the EECS assignment',
    note: 'The real eight-question run against the circuits ebook, one question at a time: the reading box first, then the crop with its figure thumbs, then the walkthrough — LaTeX-bearing equation titles, four nudges, steps and answer behind their gates. The outline carries the other seven.',
    tags: ['homework'],
    modes: ['mock'],
    seed: 'homework:eecs',
    entry: '/homework/hw-eecs202',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/homework/hw-eecs202')
          await ctx.page.getByRole('heading', { name: 'Tutor' }).waitFor()
          await ctx.page.getByText('How I read this').waitFor()
        },
      },
      { shot: 'guide-top' },
      {
        run: async (ctx) => {
          // Deterministic scroll: the Nudges label and the first equation
          // cards must sit in frame together.
          await ctx.page
            .locator('.overflow-y-auto')
            .nth(1)
            .evaluate((el) => {
              el.scrollBy(0, 700)
            })
          await ctx.page.waitForTimeout(250)
        },
      },
      { shot: 'guide-mid' },
      {
        run: async (ctx) => {
          const card = ctx.page.locator('article').first()
          await card.getByRole('button', { name: 'Show the work' }).click()
          await card.getByRole('button', { name: 'Show the answer' }).click()
          await card.getByText('Worked steps').waitFor()
        },
      },
      { shot: 'guide-revealed' },
      {
        run: async (ctx) => {
          await ctx.page.getByRole('navigation', { name: 'Questions' }).first()
            .getByRole('button', { name: /^4/ })
            .click()
          await ctx.page.getByRole('img', { name: /^Question 4/ }).waitFor()
        },
      },
      { shot: 'guide-next' },
      {
        run: async (ctx) => {
          await ctx.page.getByRole('tab', { name: 'Template PDF' }).click()
          await ctx.page.getByText('Sheet 1 · Q1').waitFor()
        },
      },
      { shot: 'template-pdf' },
    ],
  },

  {
    id: 'doctor/healthy',
    page: 'doctor',
    title: 'Doctor: all checks passed',
    note: 'Six readiness checks, every one ok — banner success, rows with their info findings.',
    tags: ['doctor'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/doctor',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/doctor')
          await ctx.page.getByText('All checks passed').waitFor()
        },
      },
      { shot: 'healthy' },
    ],
  },
  {
    id: 'doctor/warnings',
    page: 'doctor',
    title: 'Doctor: usable, with warnings',
    note: 'Missing tesseract warns (install copy, not a link) while everything else passes.',
    tags: ['doctor'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/doctor',
    mock: { doctor: 'warnings' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/doctor')
          await ctx.page.getByText('Usable, with warnings').waitFor()
        },
      },
      { shot: 'warnings' },
    ],
  },
  {
    id: 'doctor/failed',
    page: 'doctor',
    title: 'Doctor: needs attention',
    note: 'Chat and semantic search hard-fail with links to Settings, where their fixes live.',
    tags: ['doctor'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/doctor',
    mock: { doctor: 'failed' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/doctor')
          await ctx.page.getByText('Needs attention').waitFor()
        },
      },
      { shot: 'failed' },
      {
        // The six-row list outgrows the viewport; scroll the bottom rows
        // (semantic search's finding and its Settings link) into frame.
        run: async (ctx) => {
          await ctx.page.mouse.wheel(0, 600)
          await ctx.page.getByText('Check it in Settings').waitFor()
        },
      },
      { shot: 'failed-bottom' },
    ],
  },
  {
    id: 'doctor/fixed',
    page: 'doctor',
    title: 'Doctor: repair applies',
    note: 'Repair runs the checks with fixes; the replaced report shows the data dir and database as fixed.',
    tags: ['doctor'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/doctor',
    mock: { doctor: 'warnings', doctorFix: 'fixed' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/doctor')
          await ctx.page.getByText('Usable, with warnings').waitFor()
          await ctx.page.getByRole('button', { name: 'Repair' }).click()
          await ctx.page.getByText('All checks passed').waitFor()
        },
      },
      { shot: 'fixed' },
    ],
  },
  {
    id: 'doctor/repairing',
    page: 'doctor',
    title: 'Doctor: repair in flight',
    note: 'POST held back: the status line appears, Repair spins as Repairing… and both actions disable.',
    tags: ['doctor'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/doctor',
    mock: { doctorDelayMs: 900 },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/doctor')
          await ctx.page.getByText('All checks passed').waitFor()
          await ctx.page.getByRole('button', { name: 'Repair' }).click()
          await ctx.page.getByText('Running every check and applying safe repairs…').waitFor()
        },
      },
      { shot: 'repairing' },
    ],
  },
  {
    id: 'doctor/load-error',
    page: 'doctor',
    title: 'Doctor: check failed to load',
    note: 'GET /api/doctor answers 500: the destructive error card with the server text and Retry.',
    tags: ['doctor'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/doctor',
    mock: { doctor: 'fail' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/doctor')
          await ctx.page.getByText('Couldn’t run the doctor.').waitFor()
        },
      },
      { shot: 'error' },
    ],
  },

  {
    id: 'reader/read',
    page: 'reader',
    title: 'Reader: the scan is the page',
    note: 'The scan fills the reading column at its own width; the contents sidebar tracks the chapter. ArrowRight flips, and reopening the book lands where you left off.',
    tags: ['reader'],
    modes: ['mock'],
    seed: 'reader:book',
    entry: `/library/${readerSha}/read`,
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto(`/library/${readerSha}/read`)
          await ctx.page.getByRole('img', { name: 'Page 1 of Calculus: Early Transcendentals' }).waitFor()
        },
      },
      { shot: 'scan' },
      {
        run: async (ctx) => {
          await ctx.page.keyboard.press('ArrowRight')
          await ctx.page.getByRole('img', { name: 'Page 2 of Calculus: Early Transcendentals' }).waitFor()
        },
      },
      { shot: 'scan-flipped' },
      {
        // Resume: a fresh open without a deep link lands on the last page.
        run: async (ctx) => {
          await ctx.goto(`/library/${readerSha}/read`)
          await ctx.page.getByRole('img', { name: 'Page 2 of Calculus: Early Transcendentals' }).waitFor()
        },
      },
    ],
  },
  {
    id: 'reader/text',
    page: 'reader',
    title: 'Reader: text mode',
    note: 'The Scan | Text switch swaps the image for the serif prose pane, selectable for copying; mode sticks while flipping.',
    tags: ['reader'],
    modes: ['mock'],
    seed: 'reader:book',
    entry: `/library/${readerSha}/read`,
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto(`/library/${readerSha}/read`)
          await ctx.page.getByRole('img', { name: 'Page 1 of Calculus: Early Transcendentals' }).waitFor()
          await ctx.page.getByRole('button', { name: 'Text' }).click()
          await ctx.page.getByText('The tangent problem is the oldest question').waitFor()
        },
      },
      { shot: 'text' },
    ],
  },
  {
    id: 'reader/no-scan',
    page: 'reader',
    title: 'Reader: a page with no scan',
    note: 'The scan endpoint answers 404: the explicit empty state offers the text instead of pretending.',
    tags: ['reader'],
    modes: ['mock'],
    seed: 'reader:book',
    entry: `/library/${readerSha}/read`,
    mock: { scan: 'missing' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto(`/library/${readerSha}/read`)
          await ctx.page.getByText('This page has no scan.').waitFor()
        },
      },
      { shot: 'no-scan' },
    ],
  },
  {
    id: 'reader/not-ready',
    page: 'reader',
    title: 'Reader: a book still being prepared',
    note: 'No toolbar, no pager: a card explains and hands you to the book page, and the reader refreshes itself when preparation settles.',
    tags: ['reader'],
    modes: ['mock'],
    seed: 'library:mixed',
    entry: `/library/${preparingSha}/read`,
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto(`/library/${preparingSha}/read`)
          await ctx.page.getByText('Still being prepared.').waitFor()
        },
      },
      { shot: 'not-ready' },
    ],
  },

  {
    id: 'book/home',
    page: 'book',
    title: 'Book home: a ready book',
    note: 'Cover hero with the read/ask/homework doors, chapters as doors into the reader, and real activity: this book’s asks and homework over the quiet file details.',
    tags: ['book'],
    modes: ['mock'],
    seed: 'book:home',
    entry: `/library/${bookHomeSha}`,
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto(`/library/${bookHomeSha}`)
          await ctx.page.getByRole('link', { name: /Open reader/ }).waitFor()
          await ctx.page.getByText('1 Limits and Rates of Change').waitFor()
        },
      },
      { shot: 'home' },
      {
        run: async (ctx) => {
          await ctx.page.getByText('Why does the loop rule hold?').waitFor()
          await ctx.page.mouse.wheel(0, 900)
          await ctx.page.getByText('File details').waitFor()
          // Let the compositor settle so the shot never catches mid-scroll.
          await ctx.page.waitForTimeout(300)
        },
      },
      { shot: 'below' },
    ],
  },
  {
    id: 'book/not-ready',
    page: 'book',
    title: 'Book home: still being prepared',
    note: 'No hero doors: the readiness card owns the actions, the chapters wait, and Remove stays reachable.',
    tags: ['book'],
    modes: ['mock'],
    seed: 'library:mixed',
    entry: `/library/${preparingSha}`,
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto(`/library/${preparingSha}`)
          await ctx.page.getByText('Not ready').waitFor()
          // Bring the pending-chapters state into frame for the shot.
          await ctx.page.getByText('Not worked out yet.').waitFor()
          await ctx.page.mouse.wheel(0, 400)
          await ctx.page.waitForTimeout(300)
        },
      },
      { shot: 'not-ready' },
    ],
  },
  {
    id: 'book/failed',
    page: 'book',
    title: 'Book home: preparation failed',
    note: 'The failed book shows what went wrong and keeps Try again and Remove side by side.',
    tags: ['book'],
    modes: ['mock'],
    seed: 'library:mixed',
    entry: `/library/${failedSha}`,
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto(`/library/${failedSha}`)
          await ctx.page.getByText('Not ready').waitFor()
        },
      },
      { shot: 'failed' },
    ],
  },

  {
    id: 'ask/hero',
    page: 'ask',
    title: 'Ask: the landing',
    note: 'Hero headline, one-line explainer, centered composer with the book slot; the history rail beside it.',
    tags: ['ask'],
    modes: ['mock'],
    seed: 'ask:shelf',
    entry: '/ask',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/ask')
          await ctx.page.getByText('What do you want to learn?').waitFor()
        },
      },
      { shot: 'hero' },
    ],
  },
  {
    id: 'ask/thread',
    page: 'ask',
    title: 'Ask: an answered thread',
    note: 'Prose, an equation card and the consulted-pages strip with previews; the top bar carries the book chip and title, the rail is pure history with one New door. Citations read as prose now — no extracted pills.',
    tags: ['ask'],
    modes: ['mock'],
    seed: 'ask:shelf',
    entry: '/ask?c=conv-1',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/ask?c=conv-1')
          await ctx.page.getByText('The loop rule is energy conservation in disguise').waitFor()
        },
      },
      { shot: 'thread' },
    ],
  },
  {
    id: 'ask/streaming',
    page: 'ask',
    title: 'Ask: mid-stream',
    note: 'Picked a book, asked, and the answer is arriving: the reading-pages line, the first prose, and the composer showing Stop.',
    tags: ['ask'],
    modes: ['mock'],
    seed: 'ask:shelf',
    entry: '/ask',
    mock: { ask: 'streaming' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/ask')
          await ctx.page.getByText('What do you want to learn?').waitFor()
          await ctx.page.getByRole('button', { name: 'Choose a book' }).click()
          const item = ctx.page
            .getByRole('button', { name: /Calculus: Early Transcendentals/ })
            .first()
          await item.click()
          await ctx.page.locator('[data-radix-popper-content-wrapper]').waitFor({ state: 'hidden' })
          await ctx.page.getByLabel('Ask a question').fill('What makes a gavel ring?')
          await ctx.page.getByRole('button', { name: 'Send question' }).click()
          await ctx.page.getByText('Let me read the pages first').waitFor()
        },
      },
      { shot: 'streaming' },
    ],
  },
  {
    id: 'ask/tool-cards',
    page: 'ask',
    title: 'Ask: the model showing its working',
    note: 'The study chat has the same tools as the tutor: a calc card with the exact value, a search card with its page chips, and the consulted strip fed by what actually happened rather than by parsing the prose.',
    tags: ['ask'],
    modes: ['mock'],
    seed: 'ask:shelf',
    entry: '/ask',
    mock: { ask: 'tools' },
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/ask')
          await ctx.page.getByText('What do you want to learn?').waitFor()
          await ctx.page.getByRole('button', { name: 'Choose a book' }).click()
          const item = ctx.page
            .getByRole('button', { name: /Calculus: Early Transcendentals/ })
            .first()
          await item.click()
          await ctx.page.locator('[data-radix-popper-content-wrapper]').waitFor({ state: 'hidden' })
          await ctx.page.getByLabel('Ask a question').fill('What is the impulse of a gavel strike?')
          await ctx.page.getByRole('button', { name: 'Send question' }).click()
          await ctx.page.getByText('Pages consulted').last().waitFor()
        },
      },
      { shot: 'tool-cards' },
    ],
  },
  {
    id: 'ask/page-anchored',
    page: 'ask',
    title: 'Ask: anchored to a page',
    note: 'Arriving from the reader with a page: the composer wears the removable "Asking about page 12" chip; the question itself stays clean.',
    tags: ['ask'],
    modes: ['mock'],
    seed: 'ask:shelf',
    entry: `/ask?book=${askSha}&page=12`,
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto(`/ask?book=${askSha}&page=12`)
          await ctx.page.getByText('Asking about page 12').waitFor()
          await ctx.page.getByLabel('Ask a question').fill('Why does the loop rule hold here?')
        },
      },
      { shot: 'anchored' },
    ],
  },
  {
    id: 'ask/no-connection',
    page: 'ask',
    title: 'Ask: no connection',
    note: 'The model service is not set up: the quiet state hands you to Settings instead of a composer that cannot answer.',
    tags: ['ask'],
    modes: ['mock'],
    seed: 'ask:unconfigured',
    entry: '/ask',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/ask')
          await ctx.page.getByText('Ask needs a connection').waitFor()
        },
      },
      { shot: 'no-connection' },
    ],
  },
  {
    id: 'ask/no-books',
    page: 'ask',
    title: 'Ask: no books',
    note: 'Nothing to ask about yet: the quiet state points at import.',
    tags: ['ask'],
    modes: ['mock'],
    seed: 'library:empty',
    entry: '/ask',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/ask')
          await ctx.page.getByText('No books yet').waitFor()
        },
      },
      { shot: 'no-books' },
    ],
  },

  {
    id: 'library/not-ready',
    page: 'library',
    title: 'A shelf that doesn’t lie',
    note: 'One book being prepared and one that failed, both visible and both dimmed. The old shelf showed a failed import as a normal card — it simply lost its spinner.',
    seed: 'library:mixed',
    entry: '/',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/')
          await ctx.page.getByText('Reading Organic Chemistry').first().waitFor()
          await ctx.page.getByText(/couldn.t be read/).first().waitFor()
        },
      },
      { shot: 'shelf' },
    ],
  },
  {
    id: 'tasks/stream-lost',
    page: 'tasks',
    title: 'Losing the server',
    note: 'A dead connection never looks like progress. The moment the stream falls, the sidebar card stops pretending: the numbers stay put under an "as of" stamp, and it says it is reconnecting. When the server returns the card recovers by itself and picks the import up where it stopped. No reload, no click.',
    modes: ['mock'],
    seed: 'tasks:board',
    entry: '/',
    steps: [
      {
        run: async (ctx) => {
          await ctx.goto('/')
          await ctx.page.getByText('Reading Organic Chemistry').first().waitFor()
        },
      },
      {
        run: async (ctx) => {
          // A page.route abort cannot end a stream that is already
          // established, and the heartbeat would keep the card honest
          // forever. The mock's drop conditioning closes the live socket and
          // refuses the retries, which is what actually happens when the
          // server dies under an open stream.
          await ctx.page.request.post(`${ctx.base}/__mock/control`, {
            data: { script: { events: 'drop' } },
          })
          await ctx.page.getByText('Lost touch with pset').waitFor()
          // A breath so the shot reads as a real outage, not a flash.
          await ctx.page.waitForTimeout(2_000)
        },
      },
      { shot: 'card-stale' },
      {
        run: async (ctx) => {
          await ctx.page.request.post(`${ctx.base}/__mock/control`, {
            data: { script: {} },
          })
          // The app chases the stream itself; recovery is its own doing.
          await ctx.page.getByRole('button', { name: 'Stop' }).waitFor({ timeout: 20_000 })
        },
      },
      { shot: 'card-reconnected' },
    ],
  },
]
