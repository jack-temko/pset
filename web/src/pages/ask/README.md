# Ask

Route `/ask`. This doc is the spec: the page renders exactly what's
described here, and nothing else.

**Purpose:** ask anything about your books and get a streamed answer with
structured blocks that cites the exact pages it came from.

**Decisions from the grill (2026-09-16):**

- Full rewrite scope, but the layout survived the re-grill: rail, hero,
  thread. The page had already received the shared chat-component pass;
  the rework fixes debts rather than reinventing.
- The page anchor is real: `POST /api/books/{sha}/ask` carries
  `page: number | null`. The stored question is the clean text — the old
  `(About page N.)` prefix is gone from the wire and from history.
- One door per action: the thread top bar owns New conversation; the
  rail is pure history (its header button is gone).
- The rail stays; the hero stays.

## Layout

Full-height two-pane: history rail (left) and the thread column. The app
header stays.

1. **History rail** (~272px, collapsible via the top bar's toggle):
   Pinned and Recent sections; a row shows the book dot, the title,
   the book label and relative time; hover actions pin / rename / delete
   (delete keeps its confirm dialog). Empty state explains what lives
   here.
2. **Top bar**: rail toggle, then book chip + title (the thread's own
   book and title once one is selected; the picked book's title while
   landing; `New conversation` before a pick), then New conversation
   (Plus) — the one door back to the hero.
3. **Hero landing** (no thread selected): serif headline, one italic
   explainer line, and the centered composer with its book slot. The
   book picker exists only here — a new conversation gets its book by
   picking; an existing thread is locked to its own book (picking a
   book from the reader's Ask link counts as the pick).
4. **Thread**: user bubbles right, assistant bubbles left with the
   shared chrome; envelope cards (equation / steps / theorem /
   definition / note), streaming skeletons with the writing and
   repairing labels; a failed envelope degrades to its raw text as a
   code block; `Pages cited` strip with the preview dialog and
   `Open in reader`.
5. **Composer**: bottom-docked in a thread (single row), three rows in
   the hero. The page anchor shows as a removable `Asking about page N`
   chip before sending. `Enter` sends, `Shift+Enter` breaks a line.
6. **Quiet states**: `Ask needs a connection` (link to Settings),
   `No books are ready yet` / `No books yet` (link to import).

## Behavior

- `?book=`, `?page=`, `?c=` deep links behave as before: the params
  prefill the hero composer, `?c=` opens the thread, and navigating
  updates the URL (`?c=` set once a conversation exists; `book` rides
  along; `page` cleared after the anchored send).
- Send gates on a picked book, a configured connection, and a non-empty
  draft. The question goes out clean; the page rides in the request's
  `page` field.
- Streaming folds into the trailing assistant bubble; the meta event
  names the conversation (a new thread's URL is replaced in place) and
  the pages being read (`Reading pages 12, 13…`).
- After a clean finish the thread settles from the server (ids,
  citations). After an abort (Stop) or a mid-stream error the streamed
  content stays exactly as shown, and the error card offers Retry,
  which resends the same question with the same anchor.
- Rail actions: open, pin/unpin, rename (inline, Enter commits,
  Escape cancels), delete (confirm dialog; deleting the open thread
  returns to the hero).

## Backend surface

- `POST /api/books/{sha}/ask` — SSE; body `{question, conversationId?,
  page?}`; the engine anchors a positive page (it leads the context and
  is named to the model) and stores the question as asked.
- `GET /api/books/{sha}/conversations`, `GET /api/conversations/{id}`,
  `PATCH /api/conversations/{id}` (title, pinned),
  `DELETE /api/books/{sha}/conversations/{id}`.

## Deliberately not here

- Multiple books per conversation, conversation search, message-level
  edit/regenerate.
- Live-model visual states — the visual suite runs Ask over the mock's
  scripted SSE; a live mode waits for the runner's `-fake-llm` flag.
- Mobile (desktop-only rule).

## E2e manifest (web/e2e/states.ts)

`ask/hero` (landing with composer), `ask/thread` (answered thread with
envelope cards and citations), `ask/streaming` (mid-flight skeleton),
`ask/page-anchored` (chip + anchored answer), `ask/no-connection`,
`ask/no-books` — mock only, over the scripted `/api/books/{sha}/ask`
SSE and the conversations routes.
