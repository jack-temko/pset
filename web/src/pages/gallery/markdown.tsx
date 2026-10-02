import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { parseInline, parseMarkdown } from './parse-markdown'

/** A line of text with its `code`, **bold**, *italic* and links drawn. A
 *  link is followed only when it goes off the page: a relative one names a
 *  file in the repo, which this page can't open. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((s, i) => {
        switch (s.k) {
          case 'code':
            return (
              <code key={i} className="rounded-sm bg-muted px-1 font-mono text-xs">
                {s.text}
              </code>
            )
          case 'strong':
            return <strong key={i}>{s.text}</strong>
          case 'em':
            return <em key={i}>{s.text}</em>
          case 'link':
            return /^https?:/.test(s.href) ? (
              <a key={i} href={s.href} className="text-primary underline underline-offset-2">
                {s.text}
              </a>
            ) : (
              <span key={i}>{s.text}</span>
            )
          default:
            return <span key={i}>{s.text}</span>
        }
      })}
    </>
  )
}

const HEADING = [
  'font-heading text-2xl',
  'border-t pt-6 font-heading text-xl',
  'text-lg font-semibold',
  'text-base font-semibold',
  'text-base font-semibold',
  'text-base font-semibold',
]

/** A README or spec, drawn at reading measure in the app's own type: the
 *  page you check it against is the page it describes. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const out: ReactNode[] = parseMarkdown(source).map((b, i) => {
    switch (b.t) {
      case 'h': {
        const Tag = `h${Math.min(b.level + 1, 6)}` as 'h2'
        return (
          <Tag key={i} className={cn('first:border-t-0 first:pt-0', HEADING[b.level - 1])}>
            <Inline text={b.text} />
          </Tag>
        )
      }
      case 'p':
        return (
          <p key={i} className="text-base">
            <Inline text={b.text} />
          </p>
        )
      case 'list': {
        const List = b.ordered ? 'ol' : 'ul'
        return (
          <List key={i} className={cn('space-y-1 pl-6 text-base', b.ordered ? 'list-decimal' : 'list-disc')}>
            {b.items.map((it, j) => (
              <li key={j} className={cn(it.depth > 0 && 'ml-6')}>
                <Inline text={it.text} />
              </li>
            ))}
          </List>
        )
      }
      case 'code':
        return (
          <pre key={i} className="overflow-x-auto rounded-md border bg-card p-card font-mono text-xs">
            {b.text}
          </pre>
        )
      case 'quote':
        return (
          <blockquote key={i} className="border-l-2 pl-4 text-base text-muted-foreground">
            <Inline text={b.text} />
          </blockquote>
        )
      case 'table':
        return (
          <div key={i} className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-card-header">
                <tr>
                  {b.head.map((c, j) => (
                    <th key={j} className="border-b px-3 py-2 font-medium">
                      <Inline text={c} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j} className="border-b border-border-muted last:border-b-0">
                    {r.map((c, k) => (
                      <td key={k} className="px-3 py-2 align-top">
                        <Inline text={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
    }
  })
  return <div className={cn('max-w-layout-reading space-y-4', className)}>{out}</div>
}
