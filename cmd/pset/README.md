# cmd/pset

Server entrypoint. With no arguments it runs migrations, starts the job
runner, and serves the API + embedded SPA; `pset` is a web server, there is
no command tree.

## Flags

- `--addr` — listen address, default `127.0.0.1:8420`
- `--db` — database path; empty resolves `$PSET_DB`, then `~/.pset/pset.db`
- `--verbose` — slog debug trace on stderr; default is quiet
- `--version` — print and exit

## Lifecycle

Migrations run before listening so a broken database is an exit code, not a
broken server. SIGINT/SIGTERM pauses the running job at its next page or
stage boundary (status returns to `queued`; the spooled source is kept so
the restart resumes it), waits up to 30s for the runner, then shuts the
HTTP server down gracefully. `--version` is injected at build time via
`-ldflags`.
