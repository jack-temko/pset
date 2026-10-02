# tools

Programs that live with the code but aren't the app.

| Tool | What it is |
|---|---|
| `dev` | `make dev`: the Go server rebuilt on save, the TS types regenerated when a `wire.go` changes, and Vite with `/api` proxied to the server, on its own data in `.dev/data`. |
| `findertest` | Measures finding: Jack's real misses, the professors' references and the typed forms, run against his books, checked against known pages. |
| `assignmenttest` | Measures reading assignments: ten made-up documents built as they'd arrive (PDFs, web pages it serves, pasted text), scored on due dates, labels, notes and the problems written out. |
| `samplegen` | Generates the sample books in `testdata/`, byte for byte (`tools/samplegen/README.md`). |
| `release` | `make release VERSION=x.y.z`: every release file in `dist/` (Linux and macOS tarballs, `install.sh`, `SHA256SUMS`). `tools/release/README-linux.txt` and `README-macos.txt` are what a user reads. |
| `verify-classes.mjs` | After `npm run build`, checks every theme utility used in `web/src` exists in the built CSS (the Tailwind theme is locked down, so a wrong class fails silently). |

## findertest and assignmenttest

Both drive a running PSet over HTTP with its real chat model, so they cost
a few model calls each, and they run on Jack's machine against his library,
not in CI: the books and the professors' documents are copyrighted and stay
out of the repo. Start the app (`make dev`, or the app itself), then:

```sh
go run ./tools/findertest -addr http://127.0.0.1:8420 [-book title] [-cases file] [-wait 20m]
go run ./tools/assignmenttest -addr http://127.0.0.1:8420 [-doc name] [-keep] [-out dir] [-wait 20m]
```

`findertest` reads `tools/findertest/cases.json`: for each book (by
sha256) it makes a homework set, adds the references, waits for each to be
found, compares the page with the known answer, and removes the set, so no
guide is written. `assignmenttest -keep` leaves the reads in the Homework
list to look over in the app; `-out` writes each document out; `-doc`
(like `findertest`'s `-book`) runs only those whose name contains it.
Reads are otherwise dismissed afterwards, so nothing is added.
Why they exist and what they hold: `ideas/finder-tests.md`.
