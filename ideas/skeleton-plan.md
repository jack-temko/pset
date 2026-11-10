# Loading skeletons: the plan

- date: 2026-11-09
- status: a plan for the skeleton grill (fable-review-grill D11). No code changed, nothing committed.
- read from: `origin/design` at ab0c3a0 (the local `design` branch is 8 commits behind it and has no `ask`, `list-page` or `memory` units), in a scratch worktree at `/tmp/fable-design`
- measured in: that branch's own app at http://localhost:5180/design, Chromium 1440 wide. Numbers in `/tmp/fable-skeleton/probe/heights.json`, pictures in `/tmp/fable-skeleton/*.png`

## 1. Summary

A unit that waits on data keeps one component and one layout. It takes its data, or `loading` with its **shape**: the few facts of the data that decide a box size (how many rows, which side of a switch, empty or not, one line or two). In loading the same code draws the same frame; what is already known is drawn real (the top bar, headings, button labels, the crumb and title carried by the link that was clicked); every unknown value is a bar from one primitive, `Bone`, which sits in the real line box and has no height of its own. A composite never draws a bar: it passes `loading` down, so a screen is its units' loading forms laid out by the screen's own layout, with no skeleton components and no measured heights. The shape comes from the link that was clicked, else from the last visit; with neither, nothing is guessed. Reveal is per data read, never per row, on the grace, fade and reveal train the old standard settled. A check draws every unit in every state it can land in, both ways, in a real browser, and fails on any box that differs by any amount.

Why now: today's skeletons are separate components that match one state each. Measured against the loaded state, Home's is 1.8px short, Course's fits 1 of 5 states (203px off when empty, 610px when failed), Settings fits none of 8 (24 to 827px off), the list page fits 1 of 7 (up to 366px, and 15,372px at "many").

## 2. The contract

### Five rules

1. **One layout.** A unit that waits has one component and one return. `loading` swaps values for bars, never the layout. No `*Skeleton` components.
2. **A bar has no size of its own.** `Bone` is one line of the text style it sits in; its width is in `ch`. A block bone fills a box the real layout already sized. No pixel heights in loading code.
3. **Size depends on the shape only.** Every fact of the data that changes a box is in the unit's `Shape`, and `shapeOf(data)` computes it. Loaded and loading, drawn from the same shape, have the same boxes. Unknown text never decides a height: it truncates, or its line count is part of the shape.
4. **Known is real, unknown is a bar, remembered is only shape.** A value from the last visit sizes the skeleton and is never printed (loading-standard D5, honest-waits).
5. **Only `Bone` draws a bar.** Composites pass `loading` down. Each leaf designs its own loading form once (a tag is a pill, a progress bar an empty track), so the same thing loads the same way on every screen.

One more, found while measuring: **nothing known hangs off an unknown width.** A tag after a title of unknown length is not drawn until the title is; a column that labels align to takes its width from the shape (the figure's character count, in tabular figures).

### Types (sketch)

```ts
// web/src/design/loading.ts
export interface Loads<D, S> {
  /** The props that are data. Every other prop is known before it. */
  data: readonly (keyof D & string)[];
  /** Every fact of the data that sizes a box, and nothing else. */
  shapeOf: (data: D) => S;
}

/** With nothing known (a first visit, no link): the unit draws only what
 *  every shape shares, and leaves the rest quiet. Never a guess. */
export const UNKNOWN = 'unknown';

/** Props of a unit that waits: what is always known (K), then all its data
 *  (D), or `loading` with its shape. While loading, a data prop that is
 *  passed is drawn real (the name from the clicked link, a read that has
 *  already answered); every other value is a bar. */
export type Waits<K, D, S> = K &
  (
    | (D & { loading?: undefined })
    | (Partial<D> & { loading: S | typeof UNKNOWN })
  );

/** Wraps a unit that waits: keeps its `loads` for the checks, and lets the
 *  design page and the proof force it into loading with `shapeOf` of the
 *  data an example gave it, so no skeleton example is written by hand. */
export function waits<K, D, S>(
  loads: Loads<D, S>,
  unit: (p: Waits<K, D, S>) => ReactNode,
);
```

```tsx
// web/src/units/bone/index.tsx: the only place a bar is drawn
/** A bar where text will be. Widths are in ch; a list of widths is a rhythm,
 *  picked by `row`, so rows differ but a row always draws the same. */
export function Bone(p: {
  ch: number | readonly number[];
  row?: number;
  pill?: boolean;
  still?: boolean;
});
/** A value, or the bar that holds its place. A value that replaces a bar the
 *  student saw fades in over 150ms. */
export function Fill(p: {
  ch: number | readonly number[];
  row?: number;
  children: ReactNode | undefined;
});
/** For what is not text (a chart, a page): fills the box its parent made. */
export function BoneBlock(p: { still?: boolean });
```

```css
/* tokens.css. Tested in every type step: the line box stays exactly the
   text's (48, 28, 28, 22, 20, 18, 20), and a row of bars is 60px like the
   real row. `overflow: hidden` on the bone itself grows the line by 5 to
   10px: it must not be added. */
.ds .ds-bone {
  display: inline-block;
  position: relative;
  height: 1lh;
  max-width: 100%;
  vertical-align: top;
}
.ds .ds-bone::before {
  content: '';
  position: absolute;
  inset-inline: 0;
  top: 50%;
  height: 0.7em;
  translate: 0 -50%;
  border-radius: var(--ds-radius-tag);
  background: var(--ds-bone);
  /* The grace and the fade-in are CSS: no timer per skeleton. */
  animation:
    ds-bone-in 150ms ease-out var(--ds-grace, 300ms) both,
    ds-bone-pulse 2s ease-in-out calc(var(--ds-grace, 300ms) + 150ms) infinite;
}
```

### One unit, end to end: the assignment row on Home

```tsx
// list-row: the row shape. One return; the slots are the same either way.
export interface RowShape { row: number; lines: 1 | 2 }

export function ListRow({ loading, title, meta = [], status, aside, asideWidth = 120, ...rest }: ListRowProps) {
  const two = loading ? loading.lines === 2 : meta.length > 0;
  return (
    <div data-unit="list-row" className={`min-w-0 ${two ? 'min-h-14' : ''}`}>
      <div className="flex min-w-0 items-center gap-4 px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-h-6 min-w-0 items-center gap-2">
            <span className="ds-body block truncate font-medium text-(--ds-fg)">
              <Fill ch={[22, 16, 28]} row={loading?.row}>{title /* a Link when loaded, as today */}</Fill>
            </span>
            {/* label: only when loaded. It hangs off the title's width. */}
          </div>
          {two && (
            <p className="ds-small ds-tabular min-h-5 truncate text-(--ds-fg-muted)">
              {loading ? <Bone ch={[30, 24, 34]} row={loading.row} /> : joined(meta)}
            </p>
          )}
        </div>
        {status !== undefined && <div className="ds-small flex h-6 shrink-0 items-center">{status}</div>}
        {aside !== undefined && <div style={{ width: asideWidth }} className="shrink-0">{aside}</div>}
      </div>
    </div>
  );
}

// assignment-row: `loading` is its place in the list. Same slots, same widths.
export function AssignmentRow(p: Waits<RowLinks, AssignmentData, number>) {
  const on = p.loading !== undefined;
  return (
    <ListRow
      loading={on ? { row: Number(p.loading) || 0, lines: 2 } : undefined}
      rowLink={!on} title={p.set} href={p.href}
      label={on ? undefined : dueBadge(p.due, p.today)}
      status={<DueStatus loading={on} due={p.due} today={p.today} />}
      meta={on ? [] : metaOf(p)}
      aside={<ProgressBar loading={on} done={p.done} total={p.total} />}
      asideWidth={ASIDE_WIDTH}
    />
  );
}

// list: the frame, the header, the cap and the foot run on the shape.
export interface ListShape { count: number; counts?: Record<string, number> }

export function List({ loading, row, cap, showAllHref, children, ...header }: ListProps) {
  const all = loading ? Array.from({ length: loading.count }, (_, i) => row(i)) : Children.toArray(children);
  const rows = cap === undefined ? all : all.slice(0, cap);
  // ... the same frame, header band, empty box and rules as today ...
  // foot, when rows.length < all.length: Show all <Fill ch={2}>{loading ? undefined : all.length}</Fill>
}

// home: no HomeSkeleton, no h-[346px]. The headings are real.
interface HomeData { name: string; sets: readonly GreetingSet[]; study: readonly StudyDay[]; courses: readonly CourseSummary[] }
interface HomeShape { greetingLines: 1 | 2; assignments: ListShape; courses: ListShape; figures: readonly [number, number] }

export const homeLoads: Loads<HomeData, HomeShape> = {
  data: ['name', 'sets', 'study', 'courses'],
  shapeOf: (d) => ({ assignments: { count: listAssignments(d.sets).length }, courses: { count: d.courses.length } /* ... */ }),
};

export const Home = waits(homeLoads, function Home({ loading, name, sets, study, courses, ...known }) {
  const shape = loading === UNKNOWN ? undefined : loading;
  return (
    <HomeFrame {...known}
      greeting={<Greeting loading={loading && (shape?.greetingLines ?? UNKNOWN)} name={name} sets={sets} />}
      info={<Beside heatmap={<Heatmap loading={study === undefined} days={study} />} week={/* Fill per figure */} />}>
      <SectionHeading count={/* an empty pill, or none, from the shape */}>Assignments</SectionHeading>
      <List cap={LIST_CAP} showAllHref={known.workHref} loading={sets ? undefined : shape?.assignments}
            row={(i) => <AssignmentRow loading={i} />}>
        {sets && listAssignments(sets).map((a) => <AssignmentRow key={a.set} {...a} />)}
      </List>
      {/* Courses: the same, with CourseRow */}
    </HomeFrame>
  );
});

// The route, when Home is wired (not built now; this is where real data plugs in):
function HomeRoute() {
  const got = useLoaded(homeLoads, 'home', { name: useMe(), sets: useAssignments(), study: useStudy(), courses: useCourses() });
  return <Home homeHref="/" settingsHref="/settings" workHref="/assignments" coursesHref="/courses" {...got} />;
}
```

`useLoaded(loads, key, reads, seed?)` returns the reads that have answered as real props, plus `loading: shape` until all have. The shape is the seed from the link, else what `key` saved last time, else `UNKNOWN`. It saves `shapeOf(data)` whenever the data changes, so the event stream keeps it right while the app is open. It owns the reveal train and each read's failure. `examples.tsx` loses `skeletons`: the Loading render of a state is the same example, forced.

### What is real, what is a bar

| Drawn real at once                                                   | A bar until its data                                                          | Not drawn until its data                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Top bar, wordmark, Settings link, tab rows (side-d1)                 | Names, dates, counts, figures, statuses                                       | Anything that hangs off an unknown width (a tag after a title) |
| Static page titles and section headings ("Assignments", "Settings")  | A tag as a pill, a counter as an empty pill, a progress bar as an empty track | A banner or notice whose presence is not in the shape          |
| Button and link labels ("Add material", "Show all"), help row labels | Chart bars and heat cells (the grid, weekdays and months are real)            |                                                                |
| The crumb and title carried by the clicked link (the course's name)  |                                                                               |                                                                |
| The filter bar, the composer, list frames, rules, header bands       |                                                                               |                                                                |

Bar widths are never random. Each slot has a rhythm of three widths in `ch` (title 22, 16, 28; second line 30, 24, 34), picked by row number, capped at the slot's width so stress widths truncate as text does. Figures take their character count from the shape. The bone unit exports the common rhythms so a title bar is the same on every screen.

Row counts: the shape's count, cut by the same cap code as the loaded list. Past 20 rows a row keeps its frame and height and drops its bars, so a 300 row list page holds its full height (for keep-the-place) without 1,200 pulsing bars.

### Where the shape comes from (where real data plugs in)

| Screen        | From the link that was clicked                                                         | From the last visit                                                    | From the route |
| ------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------- |
| Home          | nothing                                                                                | both list counts, greeting line count, figure widths                   |                |
| Course        | name, assignments to do, materials (Home's course row has all three)                   | Done count, a material reading in, memories fold present               | course id      |
| List page     | which list, the course, the side, the count ("Show all 14" carries it)                 | count per side, sort                                                   | kind, filters  |
| Work pane     | name, problems done and total (the row has them): strip length, and problem or summary | the problem you were on (work `remembers`), its statement's line count | assignment id  |
| Material pane | name, page count (the materials row)                                                   | exact scroll spot (M8), page sizes                                     | material id    |
| Ask pane      | course                                                                                 | empty or has turns                                                     |                |
| Settings      | nothing; its sections are fixed                                                        | key or no key, update or not, errors kept                              |                |

A link carries its seed as router state; the list's cached row is the source, as loading-standard D11 ("navigation carries the summary") already decided. Remembered shapes live in localStorage under `pset.shape.v1:<unit>:<key>`, pruned to the newest 200.

### How it reveals

1. **Chrome at once.** The top bar and tab rows never wait.
2. **Grace, 300ms.** The body is laid out at its shape but not drawn. Data inside the grace appears with no bars and no fade (loading-standard D2, D3, kept).
3. **After the grace** the known text and the bars fade in together over 150ms; bars pulse.
4. **One reveal per data read**, never per row or per component. Reads that answer within 300ms of each other reveal in the same frame (the reveal train, kept). A read is one entry of the spec's `data`.
5. **Parts arriving apart:** a read that answered is passed as real props while `loading` stays for the rest. Each part's box comes from the shape, so the order does not matter.
6. **Failure mid-load:** the failed part keeps its box. The bars stay as an invisible sizer and the Error notice (block form, with Retry) lies over them in the same grid cell. A whole view that fails drops only what is below the notice. The old Loaded's one line "is not the skeleton's size"; this one is.
7. **Empty:** empty is a shape (count 0): the list's empty box, with a bar where its line will be. The sentence is not printed until it is true.
8. **Wrong shape** (something changed while PSet was closed): the content takes its real size in the reveal frame, no animation (D9 stays dropped), the new shape is saved. A shape that came from a link and was wrong warns in development.
9. **Not a load:** switching the side of a switch, sorting, or searching loaded rows. A refetch keeps the last data (old rule, kept). Work in progress (Finding, Reading, Thinking) is not loading either: it keeps `ds-shimmer` and `Bone still`.
10. **Overlays** prefetch on intent and set `--ds-grace: 0ms` (D1, kept).

### Lists

The real List frame, always. Header band real: a title is real text; a switch draws "To do" and "Done" real with an empty pill each, as wide as its digits last time. Rows are the row unit's own loading form at the chosen side's count, with the list's real rules between them. Cap 5: at most five rows, and when the shape's count passes the cap, the "Show all" foot at its real height with the number as a bar. The counter beside a section heading follows list-d5 from the shape: shown from 1 to the cap as an empty pill, absent otherwise. Count 0 is the empty box. With no count known, the list and everything under it stay quiet (decision 2).

## 3. Each unit and screen

Offsets are loaded height minus skeleton height, per state, at the unit's example width.

| Unit                                                                                                                                                                   | How it loads today                                                                                                                                                                      | What changes                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| home (view)                                                                                                                                                            | `HomeSkeleton`: real top bar; greeting and stats as bars; each list a heading bar over a 346px slab. 1.8px short                                                                        | `waits`. Headings real, lists as real frames at the shape. `HomeSkeleton`, `RowSkeleton`, `h-[346px]` go                                               |
| course (view)                                                                                                                                                          | `CourseSkeleton`: a fake crumb "Course", a title bar, slabs at `SECTIONS = [103, 184]` measured from one sample. Fits 1 of 5 states: 203px off empty, 63px reading in, 610px failed     | Name and crumb from the link. Headings and Add buttons real. Lists by shape. Stats box as on Home. Fold present or not from the shape. `SECTIONS` goes |
| settings (view)                                                                                                                                                        | Title "Settings" as a bar; four slabs at 145, 372, 235, 135. Fits none of 8 states (24 to 827px off)                                                                                    | Title, section headings and row labels real (they are fixed); values as bars. No key, update and kept errors are shape                                 |
| list-page (view)                                                                                                                                                       | Crumb always "Assignments" (wrong for Memories and Courses, and it gains the course crumb on load); title bar; filter bar slab; 408px slab. Fits 1 of 7 (up to 366px; 15,372px at many) | Kind, course and side from the link: real crumbs, real title, real filter bar (not ready). List at the count the "Show all N" link carried             |
| work (pane)                                                                                                                                                            | `WorkSkeleton`: two header bars, 8 chips, `ProblemSkeleton`; `opens` picked by hand. 45px short at 440 wide                                                                             | Strip length and problem-or-summary from the clicked row's done and total. Header line as its real 44px frame                                          |
| ask (pane)                                                                                                                                                             | `AskSkeleton`: a made-up message and answer as bars, the composer as a slab. Same for all 17 states                                                                                     | Composer real, not ready. Conversation bars only when the last visit had turns, anchored to the bottom as the real one is                              |
| material (pane)                                                                                                                                                        | `MaterialSkeleton`: a top line bar, one still page box (M9), a pill slab                                                                                                                | Top line real with the name from the tab; page boxes at the real count and size; pill frame real. M9 stays: still, no pulse                            |
| side (pane), workspace (view)                                                                                                                                          | Tab rows real; each side picks `WorkSkeleton`, `MaterialSkeleton` or `AskSkeleton`                                                                                                      | Same picture of the chrome; they pass each pane its `loading` shape                                                                                    |
| greeting                                                                                                                                                               | Two bars in hand-set line heights. 48px short when the greeting wraps to two lines                                                                                                      | `Fill` inside the real `h1` and `p`; line count in the shape                                                                                           |
| heatmap                                                                                                                                                                | A heading bar over one slab; 22px off in the narrow state                                                                                                                               | The real grid: months and weekdays real, cells empty, heading a `Fill`                                                                                 |
| bar-chart                                                                                                                                                              | Seven stub bars at made-up heights, label bars                                                                                                                                          | Weekday labels and tracks real; bars come with the data                                                                                                |
| problem, problem-strip, summary                                                                                                                                        | `ProblemSkeleton`, `ProblemStripSkeleton`, `SummarySkeleton`; problem also draws bars in place for Finding and Queued                                                                   | One path each. Help row labels and action buttons real, not ready. Statement lines from the shape. Finding and Queued use `Bone still`                 |
| memory                                                                                                                                                                 | Its skeletons are `() => null` (50px against 238 to 601)                                                                                                                                | `MemoryList` loads through List; rows wrap, so line counts are shape                                                                                   |
| list, list-row                                                                                                                                                         | None: screens draw a slab instead                                                                                                                                                       | `loading` and `row` on List; `loading` on ListRow (above)                                                                                              |
| assignment-row, course-row; Course's work and material rows; memory rows                                                                                               | None                                                                                                                                                                                    | A loading form each, through ListRow                                                                                                                   |
| home's figure rows                                                                                                                                                     | `RowSkeleton`                                                                                                                                                                           | `Fill`; the figure column's width from the shape, since labels align to it                                                                             |
| tag, counter, progress-bar, set-line (DueStatus), sparkline, meter                                                                                                     | None                                                                                                                                                                                    | A designed loading form each: pill, empty pill, empty track with a count bar, bar, flat line                                                           |
| button, icon-button, link, section-heading, top-bar, tabs, text-field, menu, tooltip, fold, divider, confirm, danger-dialog, segmented-control, help-row, error-notice | Wait on nothing                                                                                                                                                                         | No loading form. Inside a loading unit a button is real and not ready (button-d4)                                                                      |
| nine private `Bar` helpers, plus inline `animate-pulse` in work, material, problem-strip, bar-chart, summary                                                           | Copies of one span; six lack the reduced-motion class                                                                                                                                   | All become `Bone`                                                                                                                                      |
| sample-row, sample-screen (fixtures)                                                                                                                                   | `SampleRowSkeleton`, `SampleScreenSkeleton`                                                                                                                                             | Converted first, as the reference and the checks' fixtures                                                                                             |
| `components/loaded`, `components/skeleton` (old app)                                                                                                                   | The old standard                                                                                                                                                                        | Untouched; they retire with the old app. `reveal.ts` is reused                                                                                         |

## 4. Proof

| Layer                                                                                              | What it proves                                                                                                                                                                                                                                                                                                                                                                                           | Where it runs                                                                                                                 | Cost                                                              |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A. Checks in `checks.ts` (jsdom)                                                                   | No unit exports a `*Skeleton`; `animate-pulse` and `ds-bone` appear only in `units/bone`; a spec with `data` is a `waits` unit; every unit root has `data-unit`; every text shown while loading is also on screen once loaded (catches the fake "Course" crumb, a printed "Nothing here yet", leaked sample text); every `data-unit` drawn while loading exists once loaded                              | `make check`, every PR                                                                                                        | Seconds                                                           |
| B. Box proof (`make loading-check`, Chromium over `/design/proof/<id>`, sample data, no Go server) | For every unit with data, every landing state, Normal and Stress, at its example width (views at 1280 and 1440): the root boxes are equal, and every `data-unit` box drawn while loading is at the same place and size once loaded, to 0.01px. Then, in the same page, the unit goes from loading to loaded in one tree and no `data-unit` box moves. An `UNKNOWN` render must pass the second rule only | Its own CI step on PRs that touch `web/`; `/change` before a UI PR                                                            | About 2 minutes (below)                                           |
| C. The jump guard on the real app (`make jumps-check`)                                             | Real arrival order, the reveal train, fonts, images                                                                                                                                                                                                                                                                                                                                                      | Comes back screen by screen as each is wired: slow mode only, one run, hand-written scenarios; the full profile stays nightly | About 1 to 1.5 minutes once screens are wired; nothing until then |

B is stricter than the old guard, which allowed a skeleton to be 2px off its content: more than Home's 1.8px. It needs no server because the units run on sample data, and one tree means loading and loaded can be compared element by element.

Cost of B, from what I measured: Chromium starts in 0.4s; a `/design` page on the dev server takes 2.0s (40 pages in 82s). One proof page per unit is about 90s locally on the dev server. A built bundle should be faster and CI adds the Chromium install (the old guard cached it); neither is measured. During migration B carries a list of units that still fail, which may only shrink.

The old guard stays off until C: its scenarios open the old app's screens (`/books/:id`), which the redesign replaces.

**What `/design` shows.** Load keeps Loaded, Loading and Both, and gains First visit (`UNKNOWN`). Loading is the forced render of the same example, so it cannot be a different picture. Both prints the match under the stage ("14 boxes, 0 off", or each offender with its offset) from the same function B uses. A Play button runs the real sequence slowly: grace, bars, reveal. Under the stage: the state's shape, and what is known before the data and from where. A new page, `/design/loading`, is the board: every unit by every landing state, green or red, worst offset first. The `bone` unit has its own page.

## 5. Migration

Each change lands on its own. Changes 4 to 12 change what a screen looks like while loading, so each waits for Jack's try.

| #   | Change                                                                                                                                                                                                                                                                        | Touches                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | The skeleton grill: this plan's decisions, as `ideas/skeleton-grill.md`                                                                                                                                                                                                       | `ideas/`                                                                                                                                                     |
| 1   | The `bone` unit: `Bone`, `Fill`, `BoneBlock`, the `--ds-bone` token, grace and pulse keyframes                                                                                                                                                                                | `units/bone/*`, `design/tokens.css`, `tokens.ts`, `tokens.test.ts`                                                                                           |
| 2   | The contract: `Loads`, `Waits`, `waits`, forced loading; `skeletons` becomes optional and derived; `data-unit` on every unit root; spec fields `UnitState.loads` and `DataRead.before` (decision 7); layer A's checks with a shrinking allow-list; the two fixtures converted | `design/loading.ts`, `examples.ts`, `spec.ts`, `checks.ts` and tests, `design/sample/*`, one attribute in each `units/*/index.tsx`, `pages/design/stage.tsx` |
| 3   | The box proof and the board: `/design/proof/:id`, `/design/loading`, the Playwright script, `make loading-check`, the CI step, one line in AGENTS.md                                                                                                                          | `pages/design/*`, `web/scripts/loading/*`, `Makefile`, `.github/workflows/ci.yml`, `AGENTS.md`                                                               |
| 4   | Leaves: tag, counter, progress-bar, set-line, sparkline, meter get their loading form and a Loading example                                                                                                                                                                   | those six units                                                                                                                                              |
| 5   | Lists: list, list-row, assignment-row, course-row, memory's list and rows, Course's two rows                                                                                                                                                                                  | `units/list*`, `assignment-row`, `course-row`, `memory`, `course` (rows only)                                                                                |
| 6   | Stats: greeting, heatmap, bar-chart, home's figure rows                                                                                                                                                                                                                       | those units, `home/layouts.tsx`                                                                                                                              |
| 7   | Home: `waits`; `HomeSkeleton` and `RowSkeleton` deleted                                                                                                                                                                                                                       | `units/home`, `assignment-row/home.tsx`                                                                                                                      |
| 8   | Course: `CourseSkeleton` and `SECTIONS` deleted; name and crumb from the seed                                                                                                                                                                                                 | `units/course`                                                                                                                                               |
| 9   | List page: `ListPageSkeleton` deleted; real crumbs, title and filter bar                                                                                                                                                                                                      | `units/list-page`                                                                                                                                            |
| 10  | Settings: `SettingsSkeleton` deleted                                                                                                                                                                                                                                          | `units/settings`                                                                                                                                             |
| 11  | Work pane: problem, problem-strip, summary, work                                                                                                                                                                                                                              | those four units                                                                                                                                             |
| 12  | Ask, material, side, workspace                                                                                                                                                                                                                                                | those four units                                                                                                                                             |
| 13  | Close: the allow-lists are empty and removed; `skeletons` leaves `Examples`; a `nothing-jumps` rule in `rules.ts`, enforced by B; "Nothing jumps" in `design/design-system.md` rewritten for the units                                                                        | `design/*`, `design/design-system.md`                                                                                                                        |
| 14  | Later, with each screen's wiring: `useShape`, `useLoaded`, link seeds, that screen's scenario in the jump guard (layer C)                                                                                                                                                     | `web/src/design` or `lib`, routes, `web/scripts/jumps`                                                                                                       |

## 6. Open decisions

1. **On a repeat visit, what fills a screen before fresh data?**
   - Bars at the remembered shape (Recommended): honest, and inside a session the cache already shows real data at once, so this is only the first second after a restart.
   - The last data at once, refreshed in place: no bars on any repeat visit, but a stale due date reads as true. Reverses the beat of loading-standard D5 ("keep and show the last data") and bends honest-waits.
   - The last data, dimmed until fresh.
2. **With nothing known (a first visit, a cold link), what does a screen draw?**
   - Chrome, the title and a quiet body (Recommended): the only choice where nothing drawn ever moves; a tired student sees less for a moment, never a lurch. Extends loading-standard D10 (the neutral skeleton) and reverses D5's "3 the first time".
   - A usual shape, three rows a list: fuller, and settles once when the guess is wrong (D5 as it stands).
   - The empty state's shape.
3. **How do bars move?**
   - A slow pulse, all bars together (Recommended): it is what the new units already draw, and it keeps the shimmer meaning one thing, "PSet is working" (`ds-shimmer`, Ask's Thinking).
   - The old shimmer sweep. This is what Jack asked for in the old Skeleton ("a still one read as a broken layout", `components/skeleton/README.md`); picking pulse sets that aside.
   - Still.
4. **Buttons and links on a loading screen?**
   - Drawn real; a link that needs only what is known works; the rest are not ready, with "Still loading" in the tooltip (Recommended): the page keeps its shape and the student can leave at once. Follows button-d4.
   - Everything inert until loaded (the old Loaded's `inert` layer).
   - Buttons hidden until loaded: they would appear late, beside headings that are already there.
5. **A read fails mid-load: what happens to its box?**
   - The Error notice in the box, which keeps its size, with Retry (Recommended): nothing else on the page moves while the student reads what went wrong.
   - One line, and the box closes up (the old Loaded: "It is not the skeleton's size").
6. **How is it enforced?**
   - Checks in `make check`, the box proof on every PR that touches `web/` (about 2 minutes, blocks the merge), and the real-app jump guard back per screen as it is wired (Recommended): the proof is exact where the old guard allowed 2px, and costs about half as much. Keeps loading-standard D4 and D6; ends the 2026-11-04 pause in a new form.
   - Also turn the old jump guard back on now: about 4 more minutes, measuring screens the redesign replaces.
   - The proof nightly only: PRs stay fast and a jump can sit on `design` for a day. Reverses D4.
7. **Does the spec format change?**
   - Yes, two optional fields, and hand-written skeleton examples go (Recommended): `UnitState.loads: false` marks a state reached only by acting (a menu open, a hover), so 17 identical Ask skeletons are not needed; `DataRead.before` lists what is known before the read and from where, which is where real data plugs in. F3 of spec-format-grill ("the required skeleton render per state is the spec") stays true but the render is derived; F5 wants a format change to go through its own grill, which this is.
   - Derived skeletons only, no new spec fields: every state is proven, and action states need their overlays kept out of the measured box by hand.
   - Keep hand-written skeletons per state.
8. **Text of unknown length that wraps (a memory, a greeting with a long name, a problem's statement)?**
   - Remember its line count per thing, and draw that many bars (Recommended): a revisit is exact, and only the first sight of a thing can settle.
   - Hold it to a fixed number of lines until loaded, then let it grow: always moves what is under long text.
   - Clamp such text for good and open it on a press. Reverses the wrap in memory rows and the greeting.

Also touched, not asked: `HomeSkeleton`, `CourseSkeleton` and the rest are deleted, so course-d13 and settings-d12 ("a skeleton shaped like each section, revealed together", both assumed) are kept in meaning and change in mechanism. side-d1 and material's M9 stand as they are.

## 7. Risks and what I could not determine

- **Real timings.** The units run on sample data, so I could not see how often bars would show at all. The server is local; most reads may land inside the grace.
- **The types.** `waits` makes a unit's props a union, and `defineExamples` checks props against the spec's inputs with `keyof`, which sees only shared keys of a union. It needs a small change I did not try.
- **Views that hold state.** Course copies its sample lists into `useState`. Taking `loading` means its state starts empty and fills on arrival; I did not size that work.
- **Wrapped text on a first sight** cannot be exact under any option of decision 8 except the clamp.
- **Fonts.** A late web font moves every line. The old app preloads its fonts with metric-matched fallbacks (loading-standard A1); I did not check that Source Serif 4 and IBM Plex have the same in the `ds` theme. Layer C would catch it; A and B would not.
- **Images.** Material pages and problem figures need their sizes in the data, before the image. I did not check the wire types.
- **Browser support.** The bar uses the `lh` unit. I tested Chromium only. A variant without `lh` (a transparent space as its content, baseline aligned) measured the same.
- **CI cost** is an estimate from local numbers on the dev server.
- **Why Home is 1.8px short** I did not trace; it goes away with the hand-built skeleton.
- **Pane insides.** Ask, material, side and workspace are fixed-height panes, so my height probe shows 0 for them; I did not measure positions inside them.
- **Action states.** Heatmap's hover (160px off), memory's editing and bar-chart's midweek differ because their examples open something; they are the reason for `loads: false`, not loading bugs.
- **Two systems for a while.** The old app keeps `components/loaded` until it retires.
