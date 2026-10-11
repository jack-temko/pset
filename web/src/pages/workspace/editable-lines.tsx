import { useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';

import { Box, BoxBody, BoxHeader } from '@/components/box';
import { Button } from '@/components/button';
import { Door } from '@/components/door';
import { AutoTextarea } from '@/components/input';
import { Label } from '@/components/label';
import type { Run } from '@/api/gen/doc';
import { Runs } from '@/components/document';
import { runsSource } from '@/components/document/runs';

/** A value keeps its unit on its line: "9 Ω" never breaks after the 9. */
const keepUnits = (runs: Run[]): Run[] =>
  runs.map((r) =>
    r.t === undefined
      ? r
      : {
          ...r,
          t: r.t.replace(/(\d) (?=[kmMµ]?(Ω|A|V|W|F|H|s)\b|[kmMµ]?Ω)/g, '$1 '),
        },
  );

/**
 * A question's lines that the guide is written from and the student can
 * correct: how its figure reads, or the professor's notes. A Box of
 * lines, the first few shown and the rest behind a Door; the edit button
 * in its header turns it into a text box, a line each, where saving
 * writes the guide again from the new lines. Spec: design/workspace.md,
 * "The figure, as read" and "The professor's notes".
 */
export function EditableLines({
  title,
  lines,
  closed = 4,
  edited,
  flag,
  note,
  editLabel,
  editHint,
  saveLabel,
  extra,
  onSave,
  editing: startEditing = false,
  readOnly = false,
  onCancel,
}: {
  title: string;
  /** Each line as runs; editing shows their source, and saving sends it back as text. */
  lines: Run[][];
  /** How many lines show before the Door. */
  closed?: number;
  /** A Label in the header, saying the student changed them. */
  edited?: string;
  /** A Label in the header, saying the lines want a look. */
  flag?: ReactNode;
  /** Above the lines, and above the text box while editing: what the
   *  flag is about. */
  note?: ReactNode;
  /** The header button that starts editing ("Correct", "Edit"). */
  editLabel: string;
  /** A line above the text box, saying what saving does. */
  editHint: string;
  saveLabel: string;
  /** Another way out while editing, apart from Cancel and Save. */
  extra?: (stopEditing: () => void) => ReactNode;
  onSave: (lines: string[]) => void;
  /** Opens straight into editing, with the lines as they are (none, when
   *  adding the first). */
  editing?: boolean;
  /** No edit button in the header: something else starts the editing. */
  readOnly?: boolean;
  onCancel?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const source = () => lines.map((l) => `- ${runsSource(l)}`).join('\n');
  const [draft, setDraft] = useState<string | null>(
    startEditing ? source() : null,
  );
  const [error, setError] = useState('');

  const stop = () => {
    setDraft(null);
    setError('');
    onCancel?.();
  };

  if (draft !== null) {
    const save = () => {
      const next = draft
        .split('\n')
        .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean);
      if (next.length === 0 && lines.length === 0) {
        setError('Write at least one line.');
        return;
      }
      onSave(next);
      setDraft(null);
    };
    return (
      <Box>
        <BoxHeader>{title}</BoxHeader>
        <BoxBody className="space-y-3">
          {note}
          <p className="text-xs text-muted-foreground">{editHint}</p>
          <AutoTextarea
            aria-label={title}
            autoFocus
            value={draft}
            className="py-2 text-sm"
            onChange={(e) => {
              setDraft(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') stop();
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            {extra?.(stop)}
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={stop}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              {saveLabel}
            </Button>
          </div>
        </BoxBody>
      </Box>
    );
  }

  const shown = open ? lines : lines.slice(0, closed);
  return (
    <Box>
      <BoxHeader>
        <span className="flex items-center gap-2">
          {title}
          {edited && <Label>{edited}</Label>}
          {flag}
        </span>
        {/* Each line keeps its dash in the box, so a line that wraps still
            reads as one. */}
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(source());
            }}
          >
            <Pencil />
            {editLabel}
          </Button>
        )}
      </BoxHeader>
      <BoxBody className="space-y-3 text-sm">
        {note}
        <ul className="list-disc space-y-1 pl-5">
          {shown.map((l, i) => (
            <li key={i}>
              <Runs runs={keepUnits(l)} />
            </li>
          ))}
        </ul>
      </BoxBody>
      {lines.length > closed && (
        <Door
          open={open}
          total={lines.length}
          onToggle={() => {
            setOpen(!open);
          }}
          className="border-t border-border-muted"
        />
      )}
    </Box>
  );
}
