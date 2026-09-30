import type { Route } from './server'

/**
 * A view's sample situation: what the server would answer, and, if the
 * situation changes by itself (a question being found, then written), when.
 * Each view ships the happy path and the tired paths: `empty`, `slow`,
 * `failed`, `mid-flow-reload`, `return-after-break`, and `handoff-in` where
 * the view can be sent to.
 */
export interface Scenario {
  /** Kebab-case: it is the scenario's URL (`?scenario=`). */
  id: string
  title: string
  /** What the student is in the middle of, in a sentence. */
  note: string
  start: (ctx: ScenarioContext) => Session
}

/** What a scenario is handed to play with. */
export interface ScenarioContext {
  /** Runs an event as the server's stream would, into the view's cache. */
  emit: (type: string, data: unknown) => void
  /** Runs `fn` after `ms` of scenario time (scaled by the speed the page
   *  is set to). Cancelled when the scenario ends or replays. */
  after: (ms: number, fn: () => void) => void
  /** How many times faster than real time the page is set to. */
  speed: number
}

export interface Session {
  routes: Route[]
  /** Milliseconds every answer waits: the `slow` scenario's whole point. */
  latency?: number
  /** Called once the view is mounted: starts the timeline. */
  play?: () => void
  /** What the view's stage is told about the situation (a set to open on). */
  props?: Record<string, unknown>
}
