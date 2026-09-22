# cmd/pset

The server. `main.go` is wiring only: open the database, run every
feature's migrations (parents first), build the features, start the job
queue, serve the API and the embedded SPA. Layering and contracts:
`design/backend.md`.

## Flags

- `-addr`: listen address, default `127.0.0.1:8420`
- `-data`: data directory; empty means `$PSET_DATA`, then
  `$XDG_DATA_HOME/pset` or `~/.local/share/pset`
- `-verbose`: debug logging
- `-version`: print and exit

## Lifecycle

Migrations run before listening, so a broken database is an exit code.
SIGINT/SIGTERM puts running jobs back to queued (they resume on the next
start), ends the event streams, and shuts the server down. Every model
call is logged to `logs/llm.jsonl` in the data directory.

## Adapters

Features never import each other. Where one needs another's data it
declares an interface in its own types, and the small adapters at the
bottom of `main.go` (`homeworkLibrary`, `askLibrary`) translate.
