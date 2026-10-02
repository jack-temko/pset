# Running, driving and checking a view

## Run it

From the worktree's `web/` (never the repo root):

```sh
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
npm ci                                   # once per fresh worktree
PSET_API_TARGET=http://127.0.0.1:9 npx vite --port 5198 --strictPort
```

- **Port 8420 is the user's own PSet** and its library. Never proxy to it and never
  use it. The dead `PSET_API_TARGET` above means nothing can reach a real server
  even by mistake; `/views` and `/components` need none.
- Open `/views/<name>?scenario=<id>&speed=4&wide=1`. Scenario, speed and width are
  in the URL, so a state can be linked and reloaded.
- Stop Vite by PID (`ss -ltnp | grep 5198`, then `kill <pid>`). Do not `pkill -f` a
  pattern that appears in your own command: it kills your shell.

If the change needs a real server (a backend change), use a scratch one:
`go build -o <scratch>/pset ./cmd/pset && <scratch>/pset -addr 127.0.0.1:8499 -data <scratch>/data`,
and Vite with `PSET_API_TARGET=http://127.0.0.1:8499`. Importing a book needs a
model key, so the real workspace cannot always be exercised; say so if it was not.

## Drive it with Playwright

Chromium and a matching Playwright are already on the machine; require it by path
from a scratch script kept outside the repo:

```js
const { chromium } = require(process.env.HOME + '/.npm/_npx/e41f203b7505f1fb/node_modules/playwright')
```

(If that path is gone, `npx playwright install chromium` in a scratch directory.)

- **Save every screenshot outside the repo**: give an explicit path in a scratch
  directory. Tools default to the working directory; never let them.
- Themes: `browser.newContext({ colorScheme: 'light' | 'dark', viewport: { width: 1440, height: 1000 } })`.
  The app follows the system, so this is Paper and Night.
- Scope selectors to the view's frame. On `/views` the homework panel is
  `aside.w-panel`; the page has other `aside` elements.
- Buttons are found by accessible name (`getByRole('button', { name: 'Next question' })`);
  the Complete checkbox by its text (`getByText('Complete', { exact: true })`); a
  veil by `Show walkthrough`. A stage already revealed has no button.
- The handoff log and API-call log are on the page: assert on them
  (`getByText('Ask about this question → Ask')`, `getByText('PATCH /api/questions')`).
- Fail loudly: collect `pageerror` and `console` errors; a run with any is not done.
- Photo framing: at 1440x1000 a handoff log falls below the fold. Use a viewport about
  1500 tall and clip to the panel plus the log, so a phone shows the panel and what it did.
- Keyboard-only pass: use `page.keyboard.press('Tab')` and count the stops to the
  main action; that number goes in the friction log.
- Wait for the timeline, not a fixed guess: at `speed=4` a question is written
  in about five seconds.

## The checklist (step 8)

- [ ] Every scenario of the view loads with no console errors, in Paper and in Night.
- [ ] The main flow works with the keyboard alone; tab stops to the main action counted.
- [ ] The flow meets its `budget`, counted again after the change.
- [ ] Each handoff out shows in the log with its context, and Back returns as
      designed (also after a reload).
- [ ] Text is at or above the 15px floor and readable in Night; targets are at least
      the control height.
- [ ] `make test` passes (Go tests, `tsc`, `vitest`, `oxlint`). Type-check by hand with
      `npx tsc -b`, never `tsc --noEmit -p .` (it checks nothing here).
- [ ] Lint: oxlint warnings never fail the build and about forty already exist, so
      compare the warning count on the files you touched before and after.
- [ ] `cd web && npm run build` passes: it fails on fractional or off-scale
      utilities and on theme utilities missing from the CSS.
- [ ] No screenshots, logs or traces in the repo (`git status` shows source only).
- [ ] The spec (with its friction log), component READMEs and any design doc
      were updated in the same change.
- [ ] Anything not verified is said so in the report (a real server, a real book).

## Reporting

If you cannot write a report file (a subagent often cannot), return the report as text
and let the caller file it.

Say what changed and why in the student's terms; list the friction rows closed
and opened; show before and after screenshots when the look changed; name what
you did not verify. Photos go where the user can see them (a published page or a
file), not in the repo.
