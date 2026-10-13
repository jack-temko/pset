// Throwaway (ideas/theme-mocks.md): static mocks of palette x type set x
// contrast x figure style, for the theme grill. Deleted before the pull request.
import { type CSSProperties, type ReactNode, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import './mock.css';
import {
  ACCENT,
  ACCENT_SOLID,
  ATTENTION,
  DANGER,
  FONTS_HREF,
  type Kind,
  ON_ACCENT,
  PAGE_INK,
  PALETTES,
  SANS,
  SERIF,
  type Sheet,
  SHEETS,
} from './palettes';

const KINDS: Kind[] = ['ink', 'half', 'neutral', 'warmgrey'];
const SHEET_KEYS: Sheet[] = ['cream', 'grey', 'cool'];

function Segments({ done, muted }: { done: number; muted?: boolean }) {
  return (
    <span className="tm-bar6" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="tm-seg"
          data-done={i < done}
          data-muted={muted}
        />
      ))}
    </span>
  );
}

function Chevron() {
  return (
    <svg
      className="tm-chev"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function Top({ crumb }: { crumb?: boolean }) {
  return (
    <header className="tm-top">
      <div className="tm-top-in">
        <span className="tm-mark">PSet</span>
        {crumb && (
          <span className="tm-crumb">
            <span>Circuits I</span>
            <span>/</span>
            <span>Problem set 4</span>
          </span>
        )}
        <a className="tm-top-link" href="#settings">
          Settings
        </a>
      </div>
    </header>
  );
}

type Course = {
  name: string;
  mats: number;
  work: string;
  done: number;
  kind: 'due' | 'plain' | 'turned' | 'failed';
  date: string;
};

const COURSES: Course[] = [
  {
    name: 'Circuits I',
    mats: 7,
    work: 'Problem set 4',
    done: 2,
    kind: 'due',
    date: 'due Fri',
  },
  {
    name: 'Signals and Systems',
    mats: 5,
    work: 'Problem set 7',
    done: 4,
    kind: 'plain',
    date: 'due Mon 20',
  },
  {
    name: 'Differential Equations',
    mats: 4,
    work: 'Problem set 2',
    done: 0,
    kind: 'plain',
    date: 'no date',
  },
  {
    name: 'Linear Algebra',
    mats: 6,
    work: 'Problem set 5',
    done: 6,
    kind: 'turned',
    date: 'turned in',
  },
  {
    name: 'Thermodynamics',
    mats: 3,
    work: 'Could not read the assignment',
    done: 0,
    kind: 'failed',
    date: '',
  },
];

function Glyph({ d }: { d: ReactNode }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {d}
    </svg>
  );
}

const CLOCK = (
  <>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </>
);
const CHECK = <path d="M3 8.5l3.5 3.5L13 4.5" />;

function CourseRow({ c }: { c: Course }) {
  const failed = c.kind === 'failed';
  return (
    <div className="tm-row">
      <span className="tm-row-name">{c.name}</span>
      <span className="tm-small tm-muted tm-tab">{c.mats} materials</span>
      {failed ? (
        <span className="tm-failed">
          <span className="tm-small" style={{ color: 'var(--danger)' }}>
            {c.work}
          </span>
          <button type="button" className="tm-textbtn">
            Try again
          </button>
        </span>
      ) : (
        <>
          <span className="tm-small">{c.work}</span>
          <span className="tm-prog">
            <Segments done={c.done} muted={c.kind === 'turned'} />
            <span className="tm-date tm-small tm-tab">
              {c.kind === 'due' && (
                <span className="tm-tag tm-tag-attention">
                  <Glyph d={CLOCK} />
                  {c.date}
                </span>
              )}
              {c.kind === 'turned' && (
                <span className="tm-muted tm-inline">
                  <Glyph d={CHECK} />
                  {c.date}
                </span>
              )}
              {c.kind === 'plain' && <span className="tm-muted">{c.date}</span>}
            </span>
          </span>
        </>
      )}
    </div>
  );
}

function HomeScreen({ vars }: { vars: CSSProperties }) {
  return (
    <div className="tm-root tm-home" style={vars}>
      <Top />
      <main className="tm-main">
        <h1 className="tm-greeting">Welcome back, Jack</h1>
        <p className="tm-sub">
          Two of six done in Problem set 4. It is due Friday.
        </p>
        <section className="tm-band">
          <div>
            <div className="tm-band-title">Problem set 4</div>
            <div className="tm-small tm-muted">
              Circuits I · problem 4.27 · 2 of 6
            </div>
          </div>
          <button type="button" className="tm-btn tm-btn-primary">
            Continue
          </button>
        </section>
        <section className="tm-sec">
          <div className="tm-sec-head">
            <h2 className="tm-h2">Courses</h2>
            <span className="tm-small tm-muted tm-tab">5</span>
          </div>
          {COURSES.map((c) => (
            <CourseRow key={c.name} c={c} />
          ))}
          <a className="tm-add" href="#add">
            + Add a course
          </a>
        </section>
        <p className="tm-week tm-small tm-muted">This week 6 h 20 m</p>
      </main>
    </div>
  );
}

const PARA = [100, 100, 96, 100, 92, 100, 58];
const PARA2 = [100, 98, 100, 94, 100, 100, 90, 44];

function Lines({ widths }: { widths: number[] }) {
  return (
    <div className="tm-lines">
      {widths.map((w, i) => (
        <div key={i} className="tm-line" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function HomeworkScreen({ vars }: { vars: CSSProperties }) {
  return (
    <div className="tm-root tm-hw" style={vars}>
      <Top crumb />
      <div className="tm-cols">
        <div className="tm-left">
          <div className="tm-stage">
            <div className="tm-sheet">
              <div className="tm-line tm-line-head" />
              <Lines widths={PARA} />
              <div className="tm-figbox">Fig.&nbsp;4.109</div>
              <Lines widths={PARA2} />
              <div className="tm-foot">142</div>
            </div>
          </div>
        </div>
        <div className="tm-right">
          <div className="tm-rhead">
            <span className="tm-small tm-muted">Problem 4.27</span>
            <span className="tm-rhead-r">
              <Segments done={2} />
              <span className="tm-small tm-muted">2 of 6</span>
            </span>
          </div>
          <div className="tm-scroll">
            <p className="tm-statement">
              For the circuit in Fig. 4.109, find the current i through the 8 Ω
              resistor and the power it absorbs.
            </p>
            <div className="tm-help">
              <div className="tm-help-row">
                <div className="tm-help-head">
                  <b>Hint</b>
                  <span className="tm-tag">generated</span>
                  <a className="tm-pg tm-small" href="#p142">
                    p. 142
                  </a>
                </div>
                <p className="tm-help-text">
                  Replace everything except the 8 Ω resistor with its Thevenin
                  equivalent, then the current follows from one loop.
                </p>
              </div>
              {[
                ['Approach', 'The method in steps, no numbers'],
                ['Solution', 'Full working and the answer'],
              ].map(([t, d]) => (
                <div key={t} className="tm-help-row">
                  <div className="tm-help-head">
                    <b>{t}</b>
                    <span className="tm-small tm-muted">{d}</span>
                    <Chevron />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="tm-rfoot">
            <button type="button" className="tm-btn tm-btn-primary">
              Next problem
            </button>
            <button type="button" className="tm-btn tm-btn-quiet">
              Skip
            </button>
            <button type="button" className="tm-btn tm-btn-quiet">
              Ask about this
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThemeMock() {
  const { screen = 'home' } = useParams();
  const [q, setQ] = useSearchParams();
  const k = KINDS.find((x) => x === q.get('k')) ?? 'neutral';
  const p = SHEET_KEYS.find((x) => x === q.get('p')) ?? 'cream';

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.append(link);
    return () => {
      link.remove();
    };
  }, []);

  const pal = PALETTES[k];
  const vars = {
    '--bg': pal.bg,
    '--bg-raised': pal.raised,
    '--bg-inset': pal.inset,
    '--border': pal.border,
    '--border-muted': pal.borderMuted,
    '--fg': pal.fg,
    '--fg-muted': pal.fgMuted,
    '--accent': ACCENT,
    '--accent-solid': ACCENT_SOLID,
    '--on-accent': ON_ACCENT,
    '--attention': ATTENTION,
    '--danger': DANGER,
    '--attention-soft': pal.attentionSoft,
    '--danger-soft': pal.dangerSoft,
    '--page': SHEETS[p],
    '--page-ink': PAGE_INK,
    '--font-serif': SERIF,
    '--font-sans': SANS,
  } as CSSProperties;

  const pick = (key: string, value: string) => () => {
    const next = new URLSearchParams(q);
    next.set(key, value);
    setQ(next, { replace: true });
  };
  const group = (label: string, key: string, cur: string, values: string[]) => (
    <div className="tm-bar-group">
      <span className="tm-bar-label">{label}</span>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={cur === v}
          onClick={pick(key, v)}
        >
          {v}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="tm-bar">
        {group('palette', 'k', k, KINDS)}
        {group('page', 'p', p, SHEET_KEYS)}
        <div className="tm-bar-group">
          <span className="tm-bar-label">screen</span>
          {['home', 'homework'].map((s) => (
            <Link
              key={s}
              to={{ pathname: `/theme-mock/${s}`, search: q.toString() }}
              aria-current={screen === s ? 'page' : undefined}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>
      {screen === 'homework' ? (
        <HomeworkScreen vars={vars} />
      ) : (
        <HomeScreen vars={vars} />
      )}
    </>
  );
}
