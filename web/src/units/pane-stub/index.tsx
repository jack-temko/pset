/** STAND-IN (pane-stub-d1): this exists so the workspace can be driven. The
 *  real Ask pane is its own grill. */

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
}

const frame = 'mx-auto w-full max-w-[640px] px-6 py-6';

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
