import { Button } from '@/units/button';
import { Link } from '@/units/link';

/** STAND-INS (pane-stub-d1): these exist so the workspace can be driven. The
 *  real work, material and Ask panes are their own grills. */

export interface StubProblem {
  id: string;
  title: string;
  text: string;
  /** The page of the material it is on. */
  page: number;
}

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
}

const frame = 'mx-auto w-full max-w-[640px] px-6 py-6';

/** The work: the set's name, a few problems, each with a link to its page and
 *  "Ask about this". */
export function WorkStub({
  name,
  material,
  problems,
  onPage,
  onAsk,
}: {
  name: string;
  /** The material the page links point into. */
  material: string;
  problems: readonly StubProblem[];
  onPage: (page: number) => void;
  onAsk: (problem: string) => void;
}) {
  return (
    <div className={frame}>
      <p className="ds-label text-(--ds-fg-muted)">Stand-in for the work</p>
      <h2 className="ds-heading mt-1 [overflow-wrap:anywhere]">{name}</h2>
      <ol className="mt-6 space-y-6">
        {problems.map((p) => (
          <li key={p.id}>
            <p className="ds-body font-medium">{p.title}</p>
            <p className="ds-reading mt-1 min-h-14 [overflow-wrap:anywhere]">
              {p.text}
            </p>
            <p className="ds-small mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link
                href="#"
                title={`${material}, page ${String(p.page)}`}
                onClick={(e) => {
                  e.preventDefault();
                  onPage(p.page);
                }}
              >
                p. {p.page}
              </Link>
              <Button
                variant="quiet"
                onPress={() => {
                  onAsk(p.id);
                }}
              >
                Ask about this
              </Button>
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function WorkStubSkeleton() {
  return (
    <div className={frame}>
      <p className="ds-label flex h-[18px] items-center">
        <Bar className="h-3 w-32" />
      </p>
      <p className="ds-heading mt-1 flex h-(--ds-heading-line) items-center">
        <Bar className="h-5 w-48" />
      </p>
      <div className="mt-6 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <p className="ds-body flex h-(--ds-body-line) items-center">
              <Bar className="h-4 w-24" />
            </p>
            <div className="mt-1 flex h-14 items-center">
              <Bar className="h-12 w-full" />
            </div>
            <p className="ds-small mt-2 flex h-(--ds-control) items-center">
              <Bar className="h-3 w-40" />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A material: its name, the page number and a page-shaped block. */
export function MaterialStub({ name, page }: { name: string; page: number }) {
  return (
    <div className={frame}>
      <p className="ds-label text-(--ds-fg-muted)">Stand-in for the material</p>
      <h2 className="ds-heading mt-1 [overflow-wrap:anywhere]">{name}</h2>
      <p className="ds-body ds-tabular mt-1 text-(--ds-fg-muted)">
        Page {page}
      </p>
      <div className="mt-6 aspect-[8.5/11] w-full rounded-(--ds-radius-control) border border-(--ds-border-muted) bg-(--ds-bg-raised)" />
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
