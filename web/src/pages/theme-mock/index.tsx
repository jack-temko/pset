// Throwaway (ideas/theme-mocks.md): static mocks of palette x type set x
// contrast x figure style, for the theme grill. Deleted before the pull request.
import { type CSSProperties, type ReactNode, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import './mock.css';
import {
  type Contrast,
  FONTS_HREF,
  type Kind,
  PAGE,
  PALETTES,
  STRONG,
  TYPE_SETS,
} from './palettes';

const KINDS: Kind[] = ['ink', 'warm', 'slate'];
const CONTRASTS: Contrast[] = ['normal', 'strong'];

function Fig({ children }: { children: ReactNode }) {
  return <span className="tm-fig">{children}</span>;
}

function Segments({ done }: { done: number }) {
  return (
    <span className="tm-bar6" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="tm-seg" data-done={i < done} />
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

const COURSES = [
  {
    name: 'Circuits I',
    mats: 7,
    work: 'Problem set 4',
    done: 2,
    date: 'due Fri',
  },
  {
    name: 'Signals and Systems',
    mats: 5,
    work: 'Problem set 7',
    done: 4,
    date: 'due Mon 20',
  },
  {
    name: 'Differential Equations',
    mats: 4,
    work: 'Problem set 2',
    done: 0,
    date: 'no date',
  },
];

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
              Circuits I · problem <Fig>4.27</Fig> · <Fig>2</Fig> of{' '}
              <Fig>6</Fig>
            </div>
          </div>
          <button type="button" className="tm-btn tm-btn-primary">
            Continue
          </button>
        </section>
        <section className="tm-sec">
          <div className="tm-sec-head">
            <h2 className="tm-h2">Courses</h2>
            <span className="tm-small tm-muted">
              <Fig>3</Fig>
            </span>
          </div>
          {COURSES.map((c) => (
            <div key={c.name} className="tm-row">
              <span className="tm-row-name">{c.name}</span>
              <span className="tm-small tm-muted">
                <Fig>{c.mats}</Fig> materials
              </span>
              <span className="tm-small">{c.work}</span>
              <span className="tm-prog">
                <Segments done={c.done} />
                <span className="tm-date tm-small tm-muted">
                  <Fig>{c.date}</Fig>
                </span>
              </span>
            </div>
          ))}
          <a className="tm-add" href="#add">
            + Add a course
          </a>
        </section>
        <p className="tm-week tm-small tm-muted">
          This week <Fig>6</Fig> h <Fig>20</Fig> m
        </p>
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
              <div className="tm-figbox">
                Fig.&nbsp;<Fig>4.109</Fig>
              </div>
              <Lines widths={PARA2} />
              <div className="tm-foot">
                <Fig>142</Fig>
              </div>
            </div>
          </div>
        </div>
        <div className="tm-right">
          <div className="tm-rhead">
            <span className="tm-small tm-muted">
              Problem <Fig>4.27</Fig>
            </span>
            <span className="tm-rhead-r">
              <Segments done={2} />
              <span className="tm-small tm-muted">
                <Fig>2</Fig> of <Fig>6</Fig>
              </span>
            </span>
          </div>
          <div className="tm-scroll">
            <p className="tm-statement">
              For the circuit in Fig. <Fig>4.109</Fig>, find the current i
              through the 8 Ω resistor and the power it absorbs.
            </p>
            <div className="tm-help">
              <div className="tm-help-row">
                <div className="tm-help-head">
                  <b>Hint</b>
                  <span className="tm-tag">generated</span>
                  <a className="tm-pg tm-small" href="#p142">
                    <Fig>p. 142</Fig>
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
  const k = KINDS.find((x) => x === q.get('k')) ?? 'ink';
  const t =
    q.get('t') === '2' || q.get('t') === '3' ? (q.get('t') ?? '1') : '1';
  const c = CONTRASTS.find((x) => x === q.get('c')) ?? 'normal';
  const f = q.get('f') === 'sans' ? 'sans' : 'mono';

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.append(link);
    return () => {
      link.remove();
    };
  }, []);

  const pal = { ...PALETTES[k], ...(c === 'strong' ? STRONG[k] : {}) };
  const set = TYPE_SETS[t];
  const page = PAGE[c];
  const vars = {
    '--bg': pal.bg,
    '--bg-raised': pal.raised,
    '--bg-inset': pal.inset,
    '--border': pal.border,
    '--border-muted': pal.borderMuted,
    '--fg': pal.fg,
    '--fg-muted': pal.fgMuted,
    '--accent': pal.accent,
    '--accent-solid': pal.accentSolid,
    '--on-accent': pal.onAccent,
    '--page': page.page,
    '--page-ink': page.ink,
    '--font-serif': set.serif,
    '--font-sans': set.sans,
    '--font-fig': f === 'mono' ? set.mono : set.sans,
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
        {group('type', 't', t, ['1', '2', '3'])}
        {group('contrast', 'c', c, CONTRASTS)}
        {group('figures', 'f', f, ['mono', 'sans'])}
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
