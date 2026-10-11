import type { Question } from '@/api/homework';
import { EditableLines } from './editable-lines';

/**
 * The professor's instructions for a problem: parts to do, what not to
 * use, numbers changed. Read from the reference as it was added ("4.25
 * (no PSpice)"), or written here; the guide follows them over the book,
 * so changing them writes it again. Spec: design/workspace.md, "The
 * professor's notes".
 *
 * Shown read-only when there are any, and nothing when there are none:
 * the one way to add or change them is the question's menu, which sets
 * `editing`. The box opens with the lines as they are.
 */
export function ProfessorNotes({
  q,
  editing,
  onStop,
  onSave,
}: {
  q: Question;
  editing: boolean;
  onStop: () => void;
  onSave: (lines: string[]) => void;
}) {
  const notes = q.notes;
  // A guide on its way or written is written again; one not started just
  // reads them when it does.
  const rewrites = q.state === 'writing' || q.state === 'ready';

  if (notes.length === 0 && !editing) return null;
  return (
    <EditableLines
      key={editing ? 'editing' : 'notes'}
      title="From your professor"
      lines={notes}
      editLabel="Edit"
      editHint="One instruction a line: the parts to do, what not to use, numbers changed. The guide follows these over the book."
      saveLabel={rewrites ? 'Save and rewrite the guide' : 'Save'}
      readOnly
      editing={editing}
      onCancel={onStop}
      onSave={(lines) => {
        onStop();
        onSave(lines);
      }}
    />
  );
}
