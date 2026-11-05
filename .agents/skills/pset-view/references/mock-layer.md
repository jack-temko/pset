# How a view runs on /views, and adding one

Read `web/src/views/README.md` first; it is the reference. This is the working
summary and the procedure.

## What runs

`/views/<name>` mounts the view's **stage** inside a fresh `QueryClient`, with the
mock installed under the API layer for as long as it is mounted:

- `api()` and `postForm()` (`web/src/api/client.ts`) are the only doors to the
  server. `views/mock/install.ts` replaces `fetch` for `/api/*` with a
  `MockServer` (`views/mock/server.ts`). **An unanswered call is a 404 and is
  never forwarded**: a view cannot reach a real server.
- Pictures are `<img src>`, not `fetch`. They go through `assets.url` in
  `client.ts`; the mock maps them to samples (`views/mock/assets.ts`). Any new
  URL helper for a picture or document must wrap `assets.url`.
- Events: the app's cache is patched by handlers registered with `on()` in the
  `api/*.ts` files. A scenario plays an event with `ctx.emit(type, data)`, which
  calls `emit(type, data, queryClient)` from `api/events.ts`, so the same handler
  code runs as in production.
- Time: `ctx.after(ms, fn)` runs on scenario time; the page's 4x speed divides it.

## Pieces of a view

```
views/<name>/index.tsx     the view; exits are props, never a router call
views/<name>/stage.tsx     the frame it sits in + the providers its screen gives it;
                           wires each exit prop to harness.handoff({to, what, carries})
views/<name>/world.ts      an in-memory "server state" with mutators that emit events
views/<name>/routes.ts     [method, '/api/path/:param', handler] for each call the view makes
views/<name>/scenarios.ts  Scenario[]: { id, title, note, start(ctx) => Session }
views/<name>/spec.md
```

`Session` is `{ routes, latency?, play?, props? }`. `props` reaches the stage as
`harness.props` (a set to open on). `play` starts the timeline once the view is on
screen. `views/homework/` is the worked example; copy its shape.

## Extracting a view from a screen (`extract`)

1. Move the view's components out of the screen file verbatim (an AST or careful
   cut, not a rewrite), fixing imports. Behaviour must not change.
2. Anything the view does that leaves it (`navigate`, `window.open` to another
   screen) becomes a prop the screen fills in. The homework panel's
   `onOpenSettings` is the model.
3. List what the view fetches: read the hooks it and its children call. Write a
   route for each, answering in the wire types from `web/src/api/gen/`, with
   the events the server would send.
4. Write the stage: the providers the screen gave it (`Pages`, `BookHereContext`,
   `BoxingProvider` for the workspace), the frame at its real width, exits wired
   to the harness.
5. Write scenarios: the happy path and the tired paths (`empty`, `slow`,
   `failed`, `mid-flow-reload`, `return-after-break`, `handoff-in`, and any state
   particular to this view).
6. Add the entry to `views/registry.ts` (`id`, `title`, `group`, `note`,
   `scenarios`, `spec`, `Stage`, optional `wideLabel`).
7. Write `spec.md` from the code and the harness log, then run the read-only audit (`tweak` with no target).

## The stage swaps the view the way the screen does

A log that only records a handoff "out" can never show that the way back is broken.
Where the real screen swaps the view out (the workspace panel's Ask | Homework tabs
unmount each other), the stage must swap it too: a stand-in for the other side (a stub
Ask pane showing the question's chip) and the real way back. Logic both the screen and
the stage need (what the panel remembers across a swap) lives in the view's folder and
is imported by both, never copied into the stage, so the harness runs the real code.

Make state survive what a student does: sample ids are deterministic per play (`set-1`,
not a counter that keeps counting), and a stage that keeps state across a reload uses a
`sessionStorage` key that Replay clears, so a reload can be tested for real.

## Keeping the simulator honest

- Mirror the server's behaviour that a screen depends on, not all of it: a
  question's `rev` goes up on every change (the higher `rev` wins in the cache),
  a retry forces the question back to pending, a PATCH returns the new snapshot.
  Read `internal/<feature>/` when unsure how the real server answers.
- Fixtures are typed against `web/src/api/gen/`, so a contract change breaks the
  build here first. Keep sample content realistic (real-looking labels, math as
  runs, a figure) so layout is judged on real content.
- A scenario's mock must send what the real server sends. A kinder sentence in the mock
  than the server's hides the very problem the scenario exists to show.
- When a route the view needs is missing, the view shows an error and the log
  shows a 404: that is the signal to add the route, not to loosen the mock.
