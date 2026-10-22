/** STAND-INS (pane-stub-d1): these exist so the workspace can be driven. The
 *  real material and Ask panes are their own grills. */

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
}

const frame = 'mx-auto w-full max-w-[640px] px-6 py-6';

/** A material: its name, the page number and a page-shaped block. */
export function MaterialStub({
  name,
  page,
  boxed,
}: {
  name: string;
  page: number;
  /** The problem whose box is outlined for a moment (P11); `n` restarts it. */
  boxed?: { problem: string; n: number };
}) {
  return (
    <div className={frame}>
      <p className="ds-label text-(--ds-fg-muted)">Stand-in for the material</p>
      <h2 className="ds-heading mt-1 [overflow-wrap:anywhere]">{name}</h2>
      <p className="ds-body ds-tabular mt-1 text-(--ds-fg-muted)">
        Page {page}
      </p>
      <div className="relative mt-6 aspect-[8.5/11] w-full rounded-(--ds-radius-control) border border-(--ds-border-muted) bg-(--ds-bg-raised)">
        {boxed && (
          <span
            key={boxed.n}
            data-box={boxed.problem}
            className="box-flash absolute inset-x-6 top-[22%] h-[18%] rounded-(--ds-radius-control) outline-2 outline-(--ds-accent)"
          />
        )}
      </div>
    </div>
  );
}

export function MaterialStubSkeleton() {
  return (
    <div className={frame}>
      <p className="ds-label flex h-[18px] items-center">
        <Bar className="h-3 w-36" />
      </p>
      <p className="ds-heading mt-1 flex h-(--ds-heading-line) items-center">
        <Bar className="h-5 w-40" />
      </p>
      <p className="ds-body mt-1 flex h-(--ds-body-line) items-center">
        <Bar className="h-4 w-16" />
      </p>
      <div className="mt-6 aspect-[8.5/11] w-full">
        <Bar className="h-full w-full" />
      </div>
    </div>
  );
}

/** Ask: the problem it is about, and an empty input. */
export function AskStub({ about }: { about?: string }) {
  return (
    <div className={frame}>
      <p className="ds-label text-(--ds-fg-muted)">Stand-in for Ask</p>
      <h2 className="ds-heading mt-1">Ask</h2>
      <p className="ds-small mt-2 text-(--ds-fg-muted) [overflow-wrap:anywhere]">
        {about ? `About: ${about}` : 'About nothing yet'}
      </p>
      <textarea
        rows={3}
        placeholder="Ask about this"
        className="ds-body mt-4 block w-full resize-none rounded-(--ds-radius-control) border border-(--ds-border) bg-transparent px-3 py-2 text-(--ds-fg) placeholder:text-(--ds-fg-muted)"
      />
    </div>
  );
}

export function AskStubSkeleton() {
  return (
    <div className={frame}>
      <p className="ds-label flex h-[18px] items-center">
        <Bar className="h-3 w-24" />
      </p>
      <p className="ds-heading mt-1 flex h-(--ds-heading-line) items-center">
        <Bar className="h-5 w-12" />
      </p>
      <p className="ds-small mt-2 flex h-(--ds-small-line) items-center">
        <Bar className="h-3 w-48" />
      </p>
      <div className="mt-4 h-[78px]">
        <Bar className="h-full w-full" />
      </div>
    </div>
  );
}
