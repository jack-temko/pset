import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { LoaderCircle } from 'lucide-react'

import { BookSelect } from '@/components/book-chip'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useBooks } from '@/hooks/use-books'
import { api } from '@/lib/api'

const fieldLabel =
  'text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase'

export function NewHomeworkDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { books, loading: booksLoading } = useBooks()
  const [bookSha, setBookSha] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [source, setSource] = useState('')
  const [creating, setCreating] = useState(false)

  // Arriving from a book's page (?book=…) opens with that book pre-picked.
  const requestedBook = searchParams.get('book')
  useEffect(() => {
    if (open && requestedBook) setBookSha(requestedBook)
  }, [open, requestedBook])

  const picked = books?.find((b) => b.sha256 === bookSha) ?? null
  const noBooks = books !== null && books.length === 0
  const canCreate = picked !== null && source.trim().length > 0 && !creating

  const create = () => {
    if (!picked) return
    setCreating(true)
    api
      .createHomework({
        bookSha256: picked.sha256,
        title: title.trim() || undefined,
        dueDate: dueDate || null,
        sourceText: source,
      })
      .then(({ homework }) => {
        onOpenChange(false)
        navigate(`/homework/${homework.id}`)
      })
      .catch((e: Error) => {
        setCreating(false)
        toast.error(e.message)
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">New homework</DialogTitle>
          <DialogDescription>
            Paste the assignment, pick the book it comes from, and PSet builds the walkthrough and
            the template you hand in.
          </DialogDescription>
        </DialogHeader>
        {noBooks ? (
          <div className="space-y-2 py-4 text-sm">
            <p className="font-medium">No books yet.</p>
            <p className="text-muted-foreground">
              Import a textbook first and come back. Homework is built from a book&rsquo;s pages.{' '}
              <Link to="/library" className="text-primary underline-offset-4 hover:underline">
                Go to the library
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="min-w-0 space-y-2">
              <span className={fieldLabel}>Book</span>
              <BookSelect books={books} loading={booksLoading} picked={picked} onPick={setBookSha} />
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_10rem]">
              <label className="min-w-0 space-y-2">
                <span className={fieldLabel}>Title (optional)</span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Problem set 3"
                />
              </label>
              <label className="min-w-0 space-y-2">
                <span className={fieldLabel}>Due (optional)</span>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
            </div>
            <label className="block min-w-0 space-y-2">
              <span className={fieldLabel}>Assignment text</span>
              <Textarea
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Paste the assignment here. Every question it finds gets a walkthrough and a page of working space."
                className="max-h-64 min-h-36 resize-none overflow-y-auto"
              />
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!noBooks && (
            <Button onClick={create} disabled={!canCreate}>
              {creating && <LoaderCircle className="animate-spin" />}
              Create homework
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
