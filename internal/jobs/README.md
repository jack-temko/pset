# jobs

The durable queue. A job is a kind, a lane, a subject, an optional key and
a JSON payload, in the `jobs` table. It publishes nothing: features do
that from inside their handlers.

- **Lanes** bound concurrency (`import` 1, `question` 2, `turn` many).
  Jobs sharing a **key** never run together (one turn per book).
- **Priority** orders a lane's queue: higher starts first, oldest first
  among equals, default 0. It never stops a running job. Homework's finds
  run at 1, so they start ahead of every queued guide, even guides queued
  before the question was added.
- `Enqueue(ctx, execer, spec)` takes a `*sql.Tx`, so a row and the job that
  fills it commit together. The scheduler can't see the job until then,
  so call `Wake` after the commit; a 2s poll is only the backstop.
- **States:** queued → running → done | failed | cancelled.
  - `Stop` cancels a queued job at once, or cancels a running one's
    context; it settles `cancelled`. `Stopped(ctx)` tells a handler it
    was the user, not a shutdown.
  - Shutdown and `Pause` put running jobs back to `queued`; the next
    start resumes them (`attempts` counts runs).
  - A panic is a failed job, not a dead server.
- `Retry` requeues a failed or cancelled job with its payload unchanged.
- Finished jobs older than a week are pruned at start.
