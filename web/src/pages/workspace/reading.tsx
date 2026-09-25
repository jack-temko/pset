import { Box, BoxBody, BoxHeader } from '@/components/box'
import { Button } from '@/components/button'
import type { Question } from '@/api/homework'
import { EditableLines } from './editable-lines'

/**
 * How a question's figure reads, one fact a line: the words its guide is
 * written from. A misread figure is the likeliest reason a guide is
 * wrong, so the reading is out in the open, and the student can correct
 * it: saving writes the guide again from their lines. A question whose
 * guide came before readings, or whose reading failed, can have its
 * figure read. Spec: design/workspace.md, "The figure, as read".
 */
export function FigureReading({
  q,
  onCorrect,
  onReread,
}: {
  q: Question
  onCorrect: (lines: string[]) => void
  onReread: () => void
}) {
  const lines = q.reading ?? []
  // Saving rewrites a guide that's there or on its way; a guide that
  // hasn't started just waits for the new lines.
  const rewrites = q.state !== 'located'

  if (lines.length === 0) {
    // Only a guide already written without one offers a reading: while a
    // question is on its way, its reading is still to come.
    if (q.state !== 'ready') return null
    return (
      <Box>
        <BoxHeader>The figure, as read</BoxHeader>
        <BoxBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This guide was written without the figure read out first. Reading it takes a minute or two, then
            the guide is written again from what it says, and you can check every line.
          </p>
          <Button variant="outline" size="sm" onClick={onReread}>
            Read the figure
          </Button>
        </BoxBody>
      </Box>
    )
  }

  return (
    <EditableLines
      title="The figure, as read"
      lines={lines}
      edited={q.readingEdited ? 'Corrected' : undefined}
      editLabel="Correct"
      editHint="One fact a line. The guide is written from these lines, so fixing one fixes the guide."
      saveLabel={rewrites ? 'Save and rewrite the guide' : 'Save'}
      onSave={onCorrect}
      extra={(stop) => (
        // Throwing the lines away for a fresh look sits apart from the
        // pair that saves or leaves.
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            stop()
            onReread()
          }}
        >
          Read it again
        </Button>
      )}
    />
  )
}
