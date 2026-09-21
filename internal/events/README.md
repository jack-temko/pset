# events

The in-process bus and `GET /api/events`, the one SSE stream the UI
listens on.

- Features publish `Publish(type, payload)` with small typed payloads
  declared in their own `wire.go`. The bus knows no event types.
- Every event gets a monotonic id. The last 4096 stay in a ring, so a
  reconnecting `EventSource` (which resends `Last-Event-ID` by itself)
  gets exactly what it missed. A gap older than the ring gets a `reset`
  event first, and the client refetches everything.
- A subscriber that falls too far behind is dropped rather than blocking
  publishers; it reconnects and replays.
- A fresh connection is told the current id straight away, so its first
  reconnect replays from there.
