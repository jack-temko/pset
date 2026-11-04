import { ChevronDown, Maximize, Minus, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Menu } from '@/units/menu';
import { STEPS } from './zoom';

/** Which set of page and zoom controls the top line has. */
export type Controls = 'now' | 'chrome' | 'firefox' | 'pill' | 'quiet';

/** What the controls read and call, all kept by the pane. */
export interface Api {
  /** The printed page the view is on; none for a page without a number. */
  printed?: number;
  pdf: number;
  max: number;
  zoom: number;
  /** The zoom at which a whole page fits the height. */
  fitPage: number;
  goTo: { text: string; error?: string } | null;
  /** The page box was entered. */
  edit: () => void;
  type: (text: string) => void;
  leave: () => void;
  /** Goes to the typed page; true when it went. */
  commit: () => boolean;
  zoomTo: (zoom: number) => void;
  step: (dir: 1 | -1) => void;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.005;
const pct = (z: number) => `${String(Math.round(z * 100))}%`;

const iconButton =
  'flex size-7 shrink-0 items-center justify-center rounded-(--ds-radius-tag) text-(--ds-fg-muted) hover:bg-(--ds-hover) hover:text-(--ds-fg) active:bg-(--ds-pressed) disabled:pointer-events-none disabled:opacity-40';

const focusRing =
  'focus:outline-(length:--ds-focus-width) focus:outline-(--ds-accent) focus:outline-solid focus:outline-offset-(--ds-focus-offset)';

/** The page number, always a field sized to the widest page number. The
 *  message for a page that is not there hangs below it (see `Missing`). */
function PageField({ api, look }: { api: Api; look: 'box' | 'quiet' }) {
  if (api.printed === undefined)
    return (
      <span className="ds-small ds-tabular px-1.5">{`PDF ${String(api.pdf)}`}</span>
    );
  const style =
    look === 'box'
      ? 'border-(--ds-border-muted) hover:border-(--ds-border) focus:border-(--ds-accent) focus:bg-(--ds-bg-inset)'
      : 'border-transparent hover:border-b-(--ds-fg-muted) focus:border-(--ds-accent) focus:bg-(--ds-bg-inset)';
  return (
    <input
      inputMode="numeric"
      aria-label="Go to printed page"
      value={api.goTo ? api.goTo.text : String(api.printed)}
      style={{ width: `calc(${String(String(api.max).length)}ch + 16px)` }}
      onFocus={(e) => {
        api.edit();
        e.currentTarget.select();
      }}
      onChange={(e) => {
        api.type(e.target.value);
      }}
      onBlur={api.leave}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && api.commit()) e.currentTarget.blur();
        if (e.key === 'Escape') {
          e.stopPropagation();
          e.currentTarget.blur();
        }
      }}
      className={`ds-small ds-tabular box-border h-6 min-w-0 rounded-(--ds-radius-tag) border bg-transparent px-1 text-center text-(--ds-fg) outline-none ${focusRing} ${style}`}
    />
  );
}

/** The line about a page that is not there, over the pages and beside the
 *  control, so nothing moves. */
function Missing({
  api,
  above,
}: {
  api: Api;
  /** Opens upward (the pill at the bottom). */
  above?: boolean;
}) {
  if (!api.goTo?.error) return null;
  return (
    <span
      role="alert"
      className={`ds-small absolute right-0 z-20 whitespace-nowrap rounded-(--ds-radius-control) border border-(--ds-danger) bg-(--ds-bg-raised) px-2 py-1 text-(--ds-danger) ${above ? 'bottom-full mb-2' : 'top-full mt-1.5'}`}
    >
      {api.goTo.error}
    </span>
  );
}

const total = (max: number, joiner: string) => (
  <span className="ds-small ds-tabular text-(--ds-fg-muted)">{`${joiner} ${String(max)}`}</span>
);

/** A: the page is always a box, zoom is "- 100% +" and the percent resets. */
export function ChromeControls({ api }: { api: Api }) {
  const atMin = api.zoom <= STEPS[0] / 100 + 0.004;
  const atMax = api.zoom >= (STEPS[STEPS.length - 1] ?? 400) / 100 - 0.004;
  return (
    <div className="relative flex shrink-0 items-center gap-1.5">
      <PageField api={api} look="box" />
      {api.printed !== undefined && total(api.max, '/')}
      <span aria-hidden className="mx-1.5 h-4 w-px bg-(--ds-border-muted)" />
      <button
        type="button"
        aria-label="Zoom out"
        disabled={atMin}
        onClick={() => {
          api.step(-1);
        }}
        className={iconButton}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        title="Fit to width"
        onClick={() => {
          api.zoomTo(1);
        }}
        className="ds-small ds-tabular h-7 w-12 rounded-(--ds-radius-tag) text-center text-(--ds-fg) hover:bg-(--ds-hover) active:bg-(--ds-pressed)"
      >
        {pct(api.zoom)}
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        disabled={atMax}
        onClick={() => {
          api.step(1);
        }}
        className={iconButton}
      >
        <Plus className="size-4" aria-hidden />
      </button>
      <Missing api={api} />
    </div>
  );
}

/** B: "112 of 640", and zoom as a dropdown with a menu. */
export function FirefoxControls({ api }: { api: Api }) {
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const fitW = near(api.zoom, 1);
  const fitP = !fitW && near(api.zoom, api.fitPage);
  const r = open ? button?.getBoundingClientRect() : undefined;
  const words = fitW ? 'Fit width' : fitP ? 'Fit page' : pct(api.zoom);
  return (
    <div className="relative flex shrink-0 items-center gap-2">
      <PageField api={api} look="box" />
      {api.printed !== undefined && total(api.max, 'of')}
      <button
        ref={setButton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={r !== undefined}
        aria-label="Zoom"
        data-menu-trigger
        onClick={() => {
          setOpen((o) => !o);
        }}
        className="ds-small ds-tabular flex h-7 w-28 items-center justify-between gap-1 rounded-(--ds-radius-tag) border border-(--ds-border-muted) pr-1.5 pl-2.5 text-(--ds-fg) hover:border-(--ds-border) hover:bg-(--ds-hover)"
      >
        <span>{words}</span>
        <ChevronDown className="size-4 text-(--ds-fg-muted)" aria-hidden />
      </button>
      {r && (
        <Menu
          at={{ x: r.right - 160, y: r.bottom + 4 }}
          width={160}
          label="Zoom"
          groups={[
            {
              items: [
                { id: 'fit-width', label: 'Fit width', checked: fitW },
                { id: 'fit-page', label: 'Fit page', checked: fitP },
              ],
            },
            {
              items: STEPS.map((s) => ({
                id: String(s),
                label: `${String(s)}%`,
                checked: !fitW && !fitP && near(api.zoom, s / 100),
              })),
            },
          ]}
          onPick={(id) => {
            setOpen(false);
            api.zoomTo(
              id === 'fit-width'
                ? 1
                : id === 'fit-page'
                  ? api.fitPage
                  : Number(id) / 100,
            );
          }}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
      <Missing api={api} />
    </div>
  );
}

/** D: "p. 112 of 640" with no visible box until hover, and a chip only when
 *  zoomed. The chip sits left of the page, so the page never moves. */
export function QuietControls({ api }: { api: Api }) {
  return (
    <div className="relative flex shrink-0 items-center gap-3">
      {!near(api.zoom, 1) && (
        <button
          type="button"
          title="Back to fit width"
          onClick={() => {
            api.zoomTo(1);
          }}
          className="ds-small ds-tabular flex h-6 items-center gap-1 rounded-full bg-(--ds-hover) pr-1.5 pl-2.5 text-(--ds-fg) hover:bg-(--ds-pressed)"
        >
          {pct(api.zoom)}
          <X className="size-3.5" aria-hidden />
        </button>
      )}
      <div className="flex items-center gap-1 text-(--ds-fg-muted)">
        {api.printed === undefined ? (
          <PageField api={api} look="quiet" />
        ) : (
          <>
            <span className="ds-small">p.</span>
            <PageField api={api} look="quiet" />
            {total(api.max, 'of')}
          </>
        )}
      </div>
      <Missing api={api} />
    </div>
  );
}

/** C: a small pill at the bottom centre over the pages. The pane decides when
 *  it shows. */
export function PillControls({ api, shown }: { api: Api; shown: boolean }) {
  const atMin = api.zoom <= STEPS[0] / 100 + 0.004;
  const atMax = api.zoom >= (STEPS[STEPS.length - 1] ?? 400) / 100 - 0.004;
  return (
    <div
      data-pill
      className={`absolute bottom-4 left-1/2 z-10 -translate-x-1/2 transition-opacity duration-200 ${shown ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="relative flex items-center gap-1 rounded-full border border-(--ds-border) bg-(--ds-bg-raised) p-1 pl-3 text-(--ds-fg-muted) shadow-sm">
        <PageField api={api} look="quiet" />
        {api.printed !== undefined && total(api.max, '/')}
        <span aria-hidden className="mx-1.5 h-4 w-px bg-(--ds-border-muted)" />
        <button
          type="button"
          aria-label="Zoom out"
          disabled={atMin}
          onClick={() => {
            api.step(-1);
          }}
          className={`${iconButton} rounded-full`}
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={atMax}
          onClick={() => {
            api.step(1);
          }}
          className={`${iconButton} rounded-full`}
        >
          <Plus className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          title={`Fit to width (${pct(api.zoom)})`}
          aria-label="Fit to width"
          disabled={near(api.zoom, 1)}
          onClick={() => {
            api.zoomTo(1);
          }}
          className={`${iconButton} rounded-full`}
        >
          <Maximize className="size-4" aria-hidden />
        </button>
        <Missing api={api} above />
      </div>
    </div>
  );
}
