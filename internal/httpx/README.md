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
- `Decode` refuses unknown fields: a misspelt field is a client bug.
- `NotFoundAPI` keeps `/api/*` JSON even when nothing matches; `SPA` serves
  the embedded build with an `index.html` fallback for client routes.
- `LocalOnly(addr, handler)` wraps the whole server: a Host that is not a
  local name (localhost, an IP address, or the name in `-addr`) is refused
  `forbidden`, which stops DNS rebinding from reading the settings and key,
  and so is a change that names a non-local Origin, which stops another
  site's page from posting `/api/reset`. Requests with no Origin (curl, the
  dev tools) pass.
