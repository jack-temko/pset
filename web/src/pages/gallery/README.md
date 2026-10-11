# Gallery

The frame both dev routes share: `/components` (every component and
variant) and, next, `/views` (separable views with sample data and a spec).
Neither is in the product's nav. The product dropped its sidebar; this is a
dev tool and doesn't share the rule.

- **`GalleryShell`** (`shell.tsx`) is a filled screen: a left index and one
  entry's page, each scrolling on its own under the fixed top bar. The index
  has the workspace rail's shape (full-width rows, the current one
  `primary-soft`). A filter sits above it: `/` focuses it from anywhere
  that isn't a field, Enter opens the first match, Esc clears it.
- **`registry.ts`** is what an entry is (`id`, `title`, `group`, `note`) and
  how the index groups and filters them. The registry's order is the
  sidebar's. A route extends the entry with what it draws.
- **`markdown.tsx`** draws a README or spec at reading measure, in the app's
  own type (`parse-markdown.ts` is the parser, tested). It handles what the
  repo's Markdown uses: headings, paragraphs, lists, fences, tables,
  quotes, and `code`, bold, italic and links inline. A relative link is
  drawn as text, since it names a repo file the page can't open.

**What the caller provides:** a `label` ("Components"), a `basePath`, the
entries, the current one, and optionally a `toolbar` beside the title (the
Demo | Docs switch).

**Don't:** put anything the product needs here; add a dependency for the
Markdown; give an entry an `id` that isn't kebab-case, since it is the URL.

Spec: `ideas/views-gallery.md`. What `/views` adds to the frame (the runner, the
scenario picker, the log): `web/src/views/README.md`.
