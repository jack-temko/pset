import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'

/**
 * The only door in the app that throws work away.
 *
 * Stopping a preparation keeps its pages; a failure keeps them too. Removing
 * a book is the deliberate choice to undo an import, so it is confirmed, it
 * says plainly what goes, and it is offered in every state.
 */
export function RemoveBookButton({
  bookId,
  title,
  onRemoved,
}: {
  bookId: string
  title?: string
  onRemoved?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const remove = async () => {
    setBusy(true)
    try {
      await api.removeBook(bookId)
      toast.success(title ? `Removed ${title}` : 'Removed the book')
      setOpen(false)
      if (onRemoved) onRemoved()
      else navigate('/')
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Couldn’t remove this book')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Remove book
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {title ?? 'this book'}?</DialogTitle>
          <DialogDescription>
            The PDF, its pages, its chapters and anything written about it go for good. Stopping a
            task instead keeps everything it has already done.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep it</Button>
          </DialogClose>
          <Button variant="destructive" disabled={busy} onClick={remove}>
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
