# PSet

A study app for textbooks you own as PDFs. Put a book on the shelf and
PSet reads it, page by page (OCR included, for scans). Then, beside the
page scan:

- **Ask** about the book. The tutor searches and reads the pages, looks at
  figures, checks its arithmetic, and answers with page citations you can
  click to jump the scan there. Theorems, worked derivations, plots and
  tables come back as cards, and math renders properly.
- **Work through homework.** Add the problems your professor assigned ("3.B.4",
  or paste the text). PSet finds each one in the book, crops its figure,
  and writes a hint and a walkthrough, both hidden until you ask for them.
  Tick each problem off as you finish it, and print a clean worksheet to
  work on paper.
- **Keep track.** Home shows what's due and how your week went: time spent
  on homework, reading and asking, by book.

It runs on your machine as one small server with the web app built in.
Your books, notes and conversations stay in a local folder; the only
things that leave it are the requests PSet makes to the chat and
embeddings endpoints you configure.

PSet is built for laptops and desktops: below a 1024px-wide window it
asks you to come back on a bigger screen.

## What you need

- **Go 1.26** or newer, and **Node.js 24** with npm, to build it.
- **poppler-utils** (`pdfinfo`, `pdftotext`, `pdftoppm`, `pdftohtml`), to read and
  render PDFs.
- **Tesseract**, to read scanned books.
- **A chat model** behind an OpenAI-compatible API, and it must accept
  images: PSet shows the model page images when it locates a problem. The
  default is Z.ai's `glm-5.3-flash`; any vision-capable model on an
  OpenAI-compatible endpoint works.
- **An embeddings server**, for searching a book. The default is
  [Ollama](https://ollama.com) on this machine with `nomic-embed-text`.

On Debian or Ubuntu:

```bash
sudo apt install poppler-utils tesseract-ocr
```

On macOS:

```bash
brew install poppler tesseract
```

For the default embeddings, install Ollama, then:

```bash
ollama pull nomic-embed-text
```

## Install

**On a Mac**, skip building: download `pset-<version>-macos.tar.gz` from
the [Releases](https://github.com/jack-temko/pset/releases) page, open
it, and run `bash setup.sh` in that folder. It installs the dependencies
with Homebrew (and Homebrew itself, if needed), pulls the embeddings
model, and picks the binary for your Mac. Then double-click
`PSet.command`. `make release VERSION=x.y.z` builds that tarball.

To build it yourself:

```bash
git clone https://github.com/jack-temko/pset.git
```

```bash
cd pset/web && npm ci && npm run build && cd ..
```

```bash
go build -o pset ./cmd/pset
```

The web app is embedded in the binary, so build the web first: a binary
built without it serves a "not built" notice instead of the app. The
result is one file, `pset`, which you can put anywhere on your `PATH`.

## Run

```bash
./pset
```

Then open <http://127.0.0.1:8420>.

| Flag | Default | |
|---|---|---|
| `-addr` | `127.0.0.1:8420` | Where to listen. |
| `-data` | `$PSET_DATA`, else `~/.local/share/pset` | Where your library lives. |
| `-verbose` | off | Debug logging. |
| `-version` | | Print the version and exit. |

Flags go straight after `pset`; there are no subcommands. Stop it with
Ctrl+C: work in progress (a book being read, a walkthrough being written)
picks up where it left off on the next start.

## First run

1. **Open Settings** (the gear, top right) and fill in **Connections**:
   - **Chat**: the endpoint, your API key and the model.
   - **Embeddings**: the endpoint and the model.

   **Test** tries the values on screen without saving them. **Save** tests
   first and only keeps values that work. A book can't be prepared until
   both are saved: the chat model reads the book's contents, and the
   embeddings build its search.
2. **Check Health** on the same page. It confirms the data folder, the
   database, poppler and tesseract, and offers a fix where it can.
3. Optionally, **add your name** under You. The greeting and the tutor
   use it.

## Using it

**Add a book.** Press **+** on Home's shelf and pick a PDF. It shows on
the shelf at once while PSet reads it; a scanned book takes longer, since
every page is OCR'd. Open the book when it's ready.

**The workspace.** The book's contents are on the left (click to jump),
the page scan in the middle, and the panel on the right. Pinch or
Ctrl+scroll to zoom the scan; the floating bar at the bottom shows the
page and zoom, and clicking the zoom resets to fit. Page numbers are the
ones printed in the book; hover one to see the PDF page. If the printed
numbers are off, fix the offset with the pencil beside the book's title.
**Focus** (top right of the panel) folds the contents away to widen the
panel.

**Ask.** Type a question and press Enter. You'll see each step as the tutor
takes it ("Searched…", "Read p. 137"), in place between the paragraphs of
its answer. Click a page chip to jump there. Stop ends an answer early.

**Homework.** In the panel's Homework tab, add **New homework**, then **Add
questions**, one per row. Untick **In this book** for a problem that isn't
from this book; its guide is written from your text alone. Each question
gets a hidden hint and a hidden walkthrough; click to reveal either. **Ask
about this** takes a question over to Ask as context. The **⋯** menu
prints a worksheet and marks the set turned in. When PSet can't find a
problem, it asks for the page, or lets you paste the problem instead.

**Memory.** The tutor keeps short notes per book: where results live, how
the book is laid out, and how you like answers ("Use SI units"). Open
**Memory** from the book's title bar to see, add or delete them. Every
note says who saved it: you, the tutor, or PSet.

## Your data

Everything is under the data folder (`~/.local/share/pset` by default):
`pset.db` (SQLite, including your settings and API key), `books/` (your
PDFs), `cache/` (rendered pages), and `logs/llm.jsonl`, which records
every request made to the chat model, with the model's reply. Back up or
move the folder to take your library with you. **Settings → Reset** erases
all of it, settings included.

## Development

```bash
make dev
```

This runs the Go server (rebuilt on save) and the Vite dev server with
hot reload, and regenerates the TypeScript wire types whenever a Go
`wire.go` changes. It keeps its own data in `.dev/data`, apart from your
real library.

```bash
make test
```

This runs `go test ./...` and the TypeScript type check. `cd web && npm
run test` runs the frontend unit tests. No test calls a real model: model
calls are tested against a fake server.

### Layout

```
cmd/pset/        the server: wiring, flags, lifecycle
internal/        one package per feature (library, homework, ask, settings,
                 activity, memory) plus shared plumbing (db, jobs, events,
                 llm, agent, cards, pdf, ocr, mathx, httpx)
web/             the React app, embedded into the binary
design/          the specs: the design system and each screen, as decided
testdata/        generated sample books the tests read
tools/           the dev loop, the sample-book generator
```

Features never import each other; each package's README covers its
contracts. Start with `design/backend.md` for the backend and
`design/design-system.md` for the UI.
