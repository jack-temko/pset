import type { ReactNode } from 'react';

import {
  BORDER,
  COLOURS,
  contrast,
  colour,
  FOCUS,
  LAYOUT,
  RADII,
  READING_MEASURE,
  ROOM,
  SPACING,
  TYPE,
  FONTS,
} from '@/design/tokens';
import '@/design/tokens.css';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-16">
      <h2 className="ds-heading mb-4">{title}</h2>
      {children}
    </section>
  );
}

/** The measured contrast of a text colour on one of its grounds. */
function Ratio({
  text,
  ground,
  floor,
}: {
  text: string;
  ground: string;
  floor: number;
}) {
  const r = contrast(colour(text), colour(ground));
  const ok = r >= floor;
  return (
    <li
      className="ds-small ds-tabular flex items-center gap-2 text-(--ds-fg-muted)"
      data-ground={ground}
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-(--ds-radius-tag) border border-(--ds-border-muted)"
        style={{ background: colour(ground), color: colour(text) }}
      >
        Aa
      </span>
      <span>
        on {ground}: {r.toFixed(1)}:1, needs {floor}:1,{' '}
        <span className={ok ? 'text-(--ds-success)' : 'text-(--ds-danger)'}>
          {ok ? 'passes' : 'fails'}
        </span>
      </span>
    </li>
  );
}

function Colours() {
  return (
    <ul className="divide-y divide-(--ds-border-muted) rounded-(--ds-radius-panel) border border-(--ds-border-muted) bg-(--ds-bg-raised)">
      {COLOURS.map((c) => (
        <li
          key={c.name}
          data-colour={c.name}
          className="flex items-start gap-4 px-4 py-3"
        >
          <span
            aria-hidden
            className="size-12 shrink-0 rounded-(--ds-radius-control) border border-(--ds-border)"
            style={{ background: c.value }}
          />
          <div className="w-56 shrink-0">
            <p className="ds-body font-medium">{c.name}</p>
            <p className="ds-code text-(--ds-fg-muted)">{c.value}</p>
          </div>
          <p className="ds-body w-64 shrink-0">{c.use}</p>
          <ul className="min-w-0 flex-1 space-y-1">
            {c.on.map((a) => (
              <Ratio key={a.ground} text={c.name} {...a} />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function Type() {
  return (
    <ul className="divide-y divide-(--ds-border-muted) rounded-(--ds-radius-panel) border border-(--ds-border-muted) bg-(--ds-bg-raised)">
      {TYPE.map((t) => (
        <li key={t.id} data-step={t.id} className="space-y-2 px-4 py-4">
          <p className="ds-small ds-tabular text-(--ds-fg-muted)">
            <span className="ds-code">{t.id}</span> {t.size} / {t.line},{' '}
            {FONTS[t.face].split(',')[0].replaceAll("'", '')} {t.weight}:{' '}
            {t.use}
          </p>
          <p className={`ds-${t.id}`}>{t.sample}</p>
        </li>
      ))}
      <li className="ds-small px-4 py-3 text-(--ds-fg-muted)">
        Reading text runs at most {READING_MEASURE} characters wide. Columns of
        figures use tabular numbers.
      </li>
    </ul>
  );
}

function Space() {
  return (
    <div className="space-y-2">
      {SPACING.map((s) => (
        <div
          key={s}
          data-space={s}
          className="ds-small ds-tabular flex items-center gap-4"
        >
          <span className="w-8 shrink-0 text-right text-(--ds-fg-muted)">
            {s}
          </span>
          <span
            className="h-4 rounded-(--ds-radius-tag) bg-(--ds-accent-solid)"
            style={{ width: s }}
          />
        </div>
      ))}
      <p className="ds-small pt-2 text-(--ds-fg-muted)">
        Page gutter {LAYOUT.gutter}. Rows {LAYOUT.row} high, controls{' '}
        {LAYOUT.control}.
      </p>
    </div>
  );
}

function Shape() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6">
        {RADII.map((r) => (
          <div key={r.name} data-radius={r.name} className="space-y-2">
            <div
              className="h-16 w-28 border border-(--ds-border) bg-(--ds-bg-raised)"
              style={{ borderRadius: r.px }}
            />
            <p className="ds-small ds-tabular text-(--ds-fg-muted)">
              {r.name}, {r.px}
            </p>
          </div>
        ))}
      </div>
      <p className="ds-small text-(--ds-fg-muted)">
        Borders {BORDER}px. No shadows.
      </p>
      <div className="space-y-2">
        <button
          type="button"
          className="ds-body h-(--ds-control) rounded-(--ds-radius-control) border border-(--ds-border) px-3"
          style={{
            outline: `${String(FOCUS.width)}px solid var(--ds-${FOCUS.colour})`,
            outlineOffset: FOCUS.offset,
          }}
        >
          A focused control
        </button>
        <p className="ds-small text-(--ds-fg-muted)">
          Focus ring {FOCUS.width}px {FOCUS.colour}, offset {FOCUS.offset}.
        </p>
      </div>
    </div>
  );
}

function Room() {
  return (
    <div className="ds-small ds-tabular space-y-1 text-(--ds-fg-muted)">
      <p>
        Display: {ROOM.display.above} above, {ROOM.display.below} below.
      </p>
      <p>
        Heading: {ROOM.heading.above} above, {ROOM.heading.below} below.
      </p>
    </div>
  );
}

/** The Foundations tab: the tokens of `tokens.ts`, drawn under the `ds`
 *  class, so it looks the same whatever the app's own theme is. */
export function Foundations() {
  return (
    <div className="ds rounded-(--ds-radius-panel) border border-(--ds-border-muted) p-10 pb-16">
      <header className="space-y-2">
        <h1 className="ds-display">Foundations</h1>
        <p className="ds-reading ds-measure text-(--ds-fg-muted)">
          One dark theme: Source Serif 4 to read, IBM Plex Sans to act, one blue
          and three status colours.
        </p>
      </header>
      <Section title="Colour">
        <Colours />
      </Section>
      <Section title="Type">
        <Type />
      </Section>
      <Section title="Space">
        <Space />
      </Section>
      <Section title="Shape">
        <Shape />
      </Section>
      <Section title="Room around big type">
        <Room />
      </Section>
    </div>
  );
}
