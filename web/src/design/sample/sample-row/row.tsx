import { CircleAlert, MoreHorizontal } from 'lucide-react';

/** A fixture for the design page, not a product component: a list row with
 *  a title, a second line and a menu. */
export function SampleRow({
  title,
  detail,
  menuOpen,
  failed,
}: {
  title: string;
  detail: string;
  menuOpen?: boolean;
  failed?: boolean;
}) {
  return (
    <div className="rounded-(--ds-radius-panel) border border-(--ds-border-muted) bg-(--ds-bg-raised)">
      <div className="flex min-h-(--ds-row) items-center gap-3 px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="ds-body truncate font-medium">{title}</p>
          <p
            className={
              failed
                ? 'ds-small flex items-center gap-1 text-(--ds-danger)'
                : 'ds-small truncate text-(--ds-fg-muted)'
            }
          >
            {failed && <CircleAlert className="size-4 shrink-0" aria-hidden />}
            <span className="truncate">{detail}</span>
          </p>
        </div>
        <button
          type="button"
          aria-label="More"
          className="flex size-(--ds-control) shrink-0 items-center justify-center rounded-(--ds-radius-control) text-(--ds-fg-muted) hover:bg-(--ds-border-muted)"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
      {menuOpen && (
        <ul className="ds-body border-t border-(--ds-border-muted) px-4 py-1">
          <li className="py-1">Open</li>
          <li className="py-1 text-(--ds-danger)">Delete</li>
        </ul>
      )}
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
}

/** The row while its item loads: the same two lines and the button. */
export function SampleRowSkeleton() {
  return (
    <div className="rounded-(--ds-radius-panel) border border-(--ds-border-muted) bg-(--ds-bg-raised)">
      <div className="flex min-h-(--ds-row) items-center gap-3 px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="ds-body flex h-(--ds-body-line) items-center">
            <Bar className="h-4 w-1/2" />
          </p>
          <p className="ds-small flex h-(--ds-small-line) items-center">
            <Bar className="h-3 w-1/3" />
          </p>
        </div>
        <Bar className="size-(--ds-control)" />
      </div>
    </div>
  );
}
