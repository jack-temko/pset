# httpx

How a route answers. Features own their routes and handlers; this package
owns the shape of the answer.

- **One error shape** (`wire.go`, generated into TS):
  `{code, message, field?, id?}`. `code` is the stable enum the UI
  switches on, `message` is display-ready copy (no em dashes), `field`
  names the input at fault, `id` points at a resource (the existing book
  for `duplicate_book`). Status comes from the code.
- `H(fn)`: a handler returns its error. An `*Error` answers as itself;
  anything else is logged and answered `internal` with a generic message,
  so nothing internal leaks.
- `Decode` refuses unknown fields: a misspelt field is a client bug, and
  says so when a body is over 1 MB rather than reporting it cut off.
- `Reply`, `Send`, `Take` and `Act` are the handlers most routes are, each a
  function of the request and its decoded body that returns a value and an
  error: `Reply` answers 200, `Send` answers the status it is given,
  `Take` and `Act` answer 204. A route that streams, uploads or sets its
  own headers stays an `H`.
- `NotFoundAPI` keeps `/api/*` JSON even when nothing matches; `SPA` serves
  the embedded build with an `index.html` fallback for client routes.
