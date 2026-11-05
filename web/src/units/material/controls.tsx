import { Maximize, Minus, Plus } from 'lucide-react';

import { STEPS } from './zoom';

/** What the controls read and call, all kept by the pane. */
export interface Api {
  /** The printed page the view is on; none for a page without a number. */
  printed?: number;
  pdf: number;
  max: number;
  zoom: number;
  goTo: { text: string } | null;
  /** The page box was entered. */
  edit: () => void;
  type: (text: string) => void;
  leave: () => void;
  /** Goes to the typed page, or the nearest one; true when the field may
   *  close. */
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

/** The page number, always a field sized to the widest page number. */
function PageField({ api }: { api: Api }) {
  if (api.printed === undefined)
    return (
      <span className="ds-small ds-tabular px-[6px]">{`PDF ${String(api.pdf)}`}</span>
    );
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
      className={`ds-small ds-tabular box-border h-6 min-w-0 rounded-(--ds-radius-tag) border bg-transparent px-1 text-center text-(--ds-fg) outline-none ${focusRing} border-transparent hover:border-b-(--ds-fg-muted) focus:border-(--ds-accent) focus:bg-(--ds-bg-inset)`}
    />
  );
}

const total = (max: number, joiner: string) => (
  <span className="ds-small ds-tabular text-(--ds-fg-muted)">{`${joiner} ${String(max)}`}</span>
);

/** The page and zoom controls (material-d19): a small pill at the bottom
 *  centre of the pages. The pane decides when it shows. */
export function Controls({
  api,
  shown,
  onHover,
}: {
  api: Api;
  shown: boolean;
  /** The pointer entered or left the pill. */
  onHover: (over: boolean) => void;
}) {
  const atMin = api.zoom <= STEPS[0] / 100 + 0.004;
  const atMax = api.zoom >= (STEPS[STEPS.length - 1] ?? 400) / 100 - 0.004;
  return (
    <div
      data-pill
      onPointerEnter={() => {
        onHover(true);
      }}
      onPointerLeave={() => {
        onHover(false);
      }}
      className={`absolute bottom-4 left-1/2 z-10 -translate-x-1/2 transition-opacity duration-200 ${shown ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="relative flex items-center gap-1 rounded-full border border-(--ds-border) bg-(--ds-bg-raised) p-1 pl-3 text-(--ds-fg-muted) shadow-sm">
        <PageField api={api} />
        {api.printed !== undefined && total(api.max, '/')}
        <span
          aria-hidden
          className="mx-[6px] h-4 w-px bg-(--ds-border-muted)"
        />
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
      </div>
    </div>
  );
}
