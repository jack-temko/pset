# db

Opens the one SQLite database and keeps the migration ledger. It knows no
feature's tables.

- `Open(path)`: WAL, a 5s busy timeout, and **foreign keys on**, which is
  what lets a book's removal cascade to everything that hangs off it.
- `Migrate(ctx, db, migs)`: applies each `Migration{Name, SQL}` not yet in
  `schema_migrations`, in the order given, one transaction each. Names are
  `feature/N` and never change once shipped.
- `Pending`: what Health's database check reports.
- `Wipe`: drops every table and migrates afresh. Reset's database half.

Each feature exports `Migrations()`; `cmd/pset` concatenates them parents
first.
