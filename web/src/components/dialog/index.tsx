import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { IconButton } from '@/components/button'
import { cn } from '@/lib/utils'

/**
 * The system's one modal. A native `<dialog>` opened with `showModal()`,
 * which is where Esc, the focus trap and the inertness of everything
 * behind come from for free — and, importantly, where a backdrop click
 * does *not* close: the scrim is a signal, not a control, so a dialog
 * holding half a pasted assignment cannot vanish to a stray click.
 *
 * Three parts, always in this order: a header with the title and the X, a
 * body, and a footer band carrying Cancel and the one primary action.
 * The body is the app's single sanctioned vertical inner scroll — a
 * dialog is its own screen, and the footer must stay reachable however
 * many rows the body grows.
 *
 * Spec: design/workspace.md.
 */
export function Dialog({
  open,
  onClose,
  title,
  width = 'default',
  footer,
  className,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  /** 400 for a couple of fields, 560 for a stack of rows. No third size. */
  width?: 'default' | 'wide'
  footer?: ReactNode
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      // Esc fires `cancel`; letting it through would close the element
      // without telling the caller, so the caller closes it instead.
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className={cn(
        'm-auto max-h-[80vh] rounded-lg border bg-card p-0 text-card-foreground shadow-floating',
        'backdrop:bg-foreground/25 backdrop:backdrop-blur-[2px]',
        width === 'wide' ? 'w-dialog-wide' : 'w-dialog',
        className,
      )}
    >
      {/* max-h on the element, flex inside it: the header and footer are
          shrink-0 and the body takes what's left. */}
      <div className="flex max-h-[80vh] flex-col">
        <div className="flex min-h-row shrink-0 items-center justify-between gap-3 border-b px-card py-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton variant="ghost" size="sm" aria-label="Close" onClick={onClose}>
            <X />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-card">{children}</div>

        {footer && (
          <div className="flex min-h-row shrink-0 items-center justify-end gap-2 border-t bg-card-header px-card py-2">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  )
}
