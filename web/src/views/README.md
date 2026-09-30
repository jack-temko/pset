# Views

The product's separable, important views (the homework panel, and next the
Ask panel, the contents rail, the scan, Home's sections), each standing on
its own at `/views/<name>`: the real view on sample data, every action
working, its spec beside it. Not in the nav. The frame is `pages/gallery`,
shared with `/components`.

```
views/<name>/index.tsx     the view, extracted from its screen; the screen imports it
views/<name>/spec.md       what it is, who it is for, its states, data, handoffs, friction
views/<name>/scenarios.ts  the situations it can be shown in
views/<name>/stage.tsx     where it sits in the product, with the providers its screen gives it
views/registry.ts          the list /views shows
views/mock/                the stand-in server all of it runs on
```

## How a view runs with nothing behind it

Mocking is at the fetch layer. Every call goes through `api()` in
`api/client.ts`; while a view is mounted, `mock/install.ts` answers `/api/*`
from a `MockServer` (`mock/server.ts`) in the server's own shapes. The real
hooks and views run, so mutations, optimistic updates and animations are
real. Three guarantees:

- **A call nothing answers is a 404** in the server's error shape. It is never
  forwarded: a view cannot reach a real server or anyone's library. The gallery
  routes don't even open the live stream (`App.tsx`).
- **Pictures load by URL, not `fetch`**, so `assets.url` in `api/client.ts` maps
  figures, page scans and the worksheet to samples (`mock/assets.ts`).
- **Each play has its own cache.** Replay unmounts it: timers stop, the mock
  comes out, the cache goes.

A **scenario** (`mock/scenario.ts`) is what the server would answer, plus a
timeline: `ctx.emit(type, data)` plays an event into the view's cache exactly
as `/api/events` would (`emit` in `api/events.ts`), and `ctx.after(ms, fn)`
schedules on scenario time, which the page's 4x speed compresses. Each view
ships the happy path and the tired paths: `empty`, `slow`, `failed`,
`mid-flow-reload`, `return-after-break`, and `handoff-in` where the view can be
sent to.

A view's **handoffs** (where it sends the student, and what travels) are props,
never a router call inside it. The stage wires them to `harness.handoff`, and
the page logs them beside the view, with the API calls it made: a spec's
`handoffs` and `data` are checked against that log.

## Wireframes

A redesign's layouts are looked at, not described. `views/<name>/wireframes.tsx`
(exported as the view's `wireframes` in `registry.ts`) builds them from the real
component library on static sample data, in the pane at its real width, and `/views/<name>`
shows them under its **Wireframes** mode (`?mode=wireframes`). They are live: veils lift,
menus open. A part that doesn't exist yet is a local stand-in built from tokens and existing
components; it becomes a component when the view is built. See the `pset-view` skill's
`grill-stages.md`, gate 2.

## Adding a view

1. Extract it from its screen into `views/<name>/`: the view takes its exits as
   props; the screen imports it and passes real ones.
2. Write its `stage.tsx` (the providers its screen gives it, exits wired to the
   harness), its mock routes over a small world, its scenarios, its `spec.md`.
3. Add it to `registry.ts`.

Spec: `ideas/views-gallery.md`. The `pset-view` skill works on views one by one.
