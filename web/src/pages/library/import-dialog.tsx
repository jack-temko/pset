import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, FileUp, LoaderCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMutation } from '@/hooks/use-mutation'
import { api, ApiError } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import type { Book } from '@/lib/types'
import { cn } from '@/lib/utils'

function looksLikePdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '')
}

function ErrorAlert({ error }: { error: Error }) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/[0.06] px-4 py-3"
    >
      <Badge variant="destructive">Import failed</Badge>
      <p className="text-sm font-medium text-destructive">{error.message}</p>
      {error instanceof ApiError && error.detail.length > 0 && (
        <ul className="space-y-1 font-mono text-xs text-muted-foreground">
          {error.detail.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** What preparing a book involves, in the words Tasks uses. Kept short on
 *  purpose: the live plan lives in one place, and this is only a promise
 *  about what happens next. */
const NEXT_STEPS = [
  'Examine the pages',
  'Read the pages',
  'Index the sections',
  'Build search',
]

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <ImportDialogBody onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}

// The body mounts fresh each time the dialog opens (Radix unmounts closed
// content), so every open starts idle: the import's life from acceptance
// onward lives on the grid, in toasts, and in Tasks — never in this dialog.
function ImportDialogBody({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [dragging, setDragging] = useState(false)
  const [zoneError, setZoneError] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [duplicate, setDuplicate] = useState<Book | null>(null)
  const [accepted, setAccepted] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = useMutation((file: File) => api.importUpload(file))
  const uploading = upload.state === 'loading'

  const backToIdle = () => {
    setAccepted(null)
  }

  const beginUpload = (file: File) => {
    setZoneError(null)
    setDuplicate(null)
    setUploadingFile(file)
    void upload
      .mutate(file)
      .then((result) => {
        if (!result) return // upload error — the alert below covers it
        if (result.duplicated && result.book) {
          setDuplicate(result.book)
          return
        }
        setAccepted(result.task?.title ?? baseName(file.name))
      })
      .finally(() => setUploadingFile(null))
  }

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (!looksLikePdf(file)) {
      setZoneError('That doesn’t look like a PDF. Try again with a .pdf file.')
      return
    }
    beginUpload(file)
  }

  if (accepted !== null) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success/10">
            <Check className="size-5 text-success" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-heading text-lg">Added to the queue</p>
            <p className="max-w-full truncate text-sm font-medium" title={accepted}>
              {accepted}
            </p>
          </div>
        </div>
        <div className="space-y-2 rounded-xl bg-muted/50 px-4 py-3">
          <p className="text-sm font-medium">What happens next</p>
          <ol className="space-y-2">
            {NEXT_STEPS.map((step, i) => (
              <li key={step} className="flex items-baseline gap-2 text-sm text-muted-foreground">
                <span className="font-mono text-xs">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="pt-1 text-xs text-muted-foreground">
            Tasks tracks every step, so this window can close whenever.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tasks" onClick={() => onOpenChange(false)}>
              View task
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={backToIdle}>
            Import another
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  if (duplicate) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="font-heading text-lg">Already in your library</p>
          <p className="text-sm text-muted-foreground">
            You imported this exact file before as “{duplicate.title}”.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
          <Button size="sm" asChild>
            <Link to={`/library/${duplicate.sha256}`} onClick={() => onOpenChange(false)}>
              <BookOpen /> Open book
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Import a textbook</DialogTitle>
        <DialogDescription>
          Add a PDF and its pages become searchable and ready to study.
        </DialogDescription>
      </DialogHeader>
      <div
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-primary bg-primary/[0.04]' : 'border-border',
          uploading && 'pointer-events-none opacity-80',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files[0])
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label="Choose a PDF to upload"
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {uploading && uploadingFile ? (
          <div className="flex max-w-full flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <LoaderCircle className="size-5 animate-spin text-primary" />
            </div>
            <p className="max-w-full truncate font-medium" title={uploadingFile.name}>
              {uploadingFile.name}
            </p>
            <p className="text-sm text-muted-foreground" role="status">
              Uploading {formatBytes(uploadingFile.size)}…
            </p>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full flex-col items-center gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileUp className="size-5" />
            </div>
            <div>
              <p className="font-heading text-lg font-medium">Drop a PDF here</p>
              <p className="mt-1 text-sm text-muted-foreground">or click to browse.</p>
            </div>
          </button>
        )}
      </div>

      {zoneError && (
        <p className="text-center text-sm text-destructive" role="alert">
          {zoneError}
        </p>
      )}

      {upload.state === 'error' && upload.error && !uploading && <ErrorAlert error={upload.error} />}
    </div>
  )
}
