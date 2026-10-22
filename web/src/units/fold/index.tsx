import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/** A line that unfolds what is under it: a chevron and a label, such as
 *  "Done (6)" (fold-d1). The label carries any count, so the closed line
 *  says what is inside. */
export function Fold({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  /** Opens it at first. */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="ds-small inline-flex h-8 max-w-full items-center gap-1 rounded-(--ds-radius-control) pr-2 text-(--ds-fg-muted) hover:text-(--ds-fg)"
      >
        <Chevron className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{label}</span>
      </button>
      {open && <div className="min-w-0">{children}</div>}
    </div>
  );
}
