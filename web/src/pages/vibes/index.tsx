// Throwaway: four vibes for the vision grill. Deleted before the pull request.
import { Link, Navigate, useParams } from 'react-router-dom';

import './vibes.css';

const COURSES = [
  {
    name: 'Circuits I',
    mat: 7,
    work: 'Problem set 4',
    done: 2,
    due: 'due Friday',
  },
  {
    name: 'Signals and Systems',
    mat: 5,
    work: 'Problem set 2',
    done: 4,
    due: 'due Mon 20',
  },
  {
    name: 'Differential Equations',
    mat: 4,
    work: 'Problem set 1',
    done: 0,
    due: '',
  },
];
const STMT =
  'For the circuit in Fig. 4.109, find the current i through the 8 Ω resistor and the power it absorbs.';
const HINT =
  'Replace everything except the 8 Ω resistor with its Thevenin equivalent, then the current follows from one loop.';

function Page() {
  return (
    <div className="page">
      {[90, 100, 96, 70, 100, 88].map((w, i) => (
        <i key={i} style={{ width: `${w}%` }} />
      ))}
      <div className="fig">Fig. 4.109</div>
      {[100, 94, 100, 62, 98, 100, 80].map((w, i) => (
        <i key={i} style={{ width: `${w}%` }} />
      ))}
      <div className="pn">p. 142</div>
    </div>
  );
}

function AHome() {
  return (
    <div className="vb v-a">
      <header>
        <b>PSet</b>
        <span>Courses</span>
        <span className="mut">Settings</span>
        <span className="sp" />
        <span className="mono mut">jack</span>
      </header>
      <main>
        <h1>Courses</h1>
        <div className="tbl">
          <div className="row h">
            <span>Course</span>
            <span>Materials</span>
            <span>Next work</span>
            <span>Progress</span>
            <span>Due</span>
          </div>
          {COURSES.map((c) => (
            <div className="row" key={c.name}>
              <span className="lnk">{c.name}</span>
              <span className="mono">{c.mat}</span>
              <span>{c.work}</span>
              <span className="mono">{c.done}/6</span>
              <span className="mono mut">{c.due || 'none'}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: '16px 0', display: 'flex', gap: 8 }}>
          <button className="btn p">Continue Problem set 4</button>
          <button className="btn">Add course</button>
        </p>
        <p className="mut mono">This week: 6h 20m</p>
      </main>
    </div>
  );
}

function AHw() {
  return (
    <div className="vb v-a">
      <header>
        <b>PSet</b>
        <span className="mut">Circuits I /</span>
        <span>Problem set 4</span>
      </header>
      <div className="split" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <Page />
        <div className="pane">
          <div className="mono mut">2 of 6 done</div>
          <h1 style={{ margin: 0 }}>
            <span className="mono">4.27</span>
          </h1>
          <p>{STMT}</p>
          <div className="box">
            <div>
              <b>Hint</b> <span className="tag">Generated</span>
              <p style={{ margin: '6px 0' }}>{HINT}</p>
              <a className="lnk mono" href="#p142">
                p. 142
              </a>
            </div>
            <div className="mut">
              Approach · the method, in steps, no numbers
            </div>
            <div className="mut">
              Solution · the full working and the answer
            </div>
          </div>
          <p style={{ display: 'flex', gap: 8 }}>
            <button className="btn p">Next problem</button>
            <button className="btn">Skip</button>
            <button className="btn">Ask about this</button>
          </p>
        </div>
      </div>
    </div>
  );
}

function BHome() {
  return (
    <div className="vb v-b">
      <main>
        <h1>Good evening, Jack.</h1>
        <div className="course" style={{ gap: 14 }}>
          <span className="mut">Where you left off</span>
          <p className="ser" style={{ fontSize: 26 }}>
            Circuits I, Problem set 4. Two of six done.
          </p>
          <div>
            <button className="btn">Continue</button>
          </div>
        </div>
        {COURSES.map((c) => (
          <div className="course" key={c.name}>
            <h2>{c.name}</h2>
            <span className="mut">
              {c.mat} materials · {c.work}, {c.done} of 6 done
              {c.due ? `, ${c.due}` : ''}
            </span>
          </div>
        ))}
        <button className="btn q" style={{ alignSelf: 'flex-start' }}>
          Add a course
        </button>
        <p className="mut ser" style={{ fontStyle: 'italic' }}>
          Six hours and twenty minutes this week.
        </p>
      </main>
    </div>
  );
}

function BHw() {
  return (
    <div className="vb v-b">
      <div className="split" style={{ minHeight: '100vh' }}>
        <Page />
        <div className="pane">
          <span className="mut">Problem set 4 · 2 of 6</span>
          <h1 style={{ fontSize: 34 }}>Problem 4.27</h1>
          <p className="stmt">{STMT}</p>
          <div className="step">
            <h3>Hint</h3>
            <p className="ser" style={{ fontSize: 19 }}>
              {HINT}
            </p>
            <span className="mut" style={{ fontSize: 13 }}>
              Written by the tutor · see <a href="#p142">p. 142</a>
            </span>
          </div>
          <div className="step mut">
            <h3>Approach</h3>
            <span>The method laid out, when you want it.</span>
          </div>
          <div className="step mut">
            <h3>Solution</h3>
            <span>The full working, last.</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn">Next problem</button>
            <button className="btn q">Skip</button>
            <button className="btn q">Ask about this</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CHome() {
  return (
    <div className="vb v-c">
      <main>
        <h1>Hey Jack! Ready for round two? 👋</h1>
        <div className="card hero">
          <div className="g">
            <b>Nice, two down. Four to go.</b>
            <br />
            Circuits I · Problem set 4
          </div>
          <button className="btn w">Keep going</button>
        </div>
        {COURSES.map((c) => (
          <div className="card" key={c.name}>
            <div className="g">
              <b>{c.name}</b>
              <br />
              {c.work} · {c.done} of 6 done
            </div>
            <span className="pill">{c.mat} materials</span>
            {c.due && <span className="pill">{c.due}</span>}
          </div>
        ))}
        <div>
          <button className="btn s">+ Add a course</button>
        </div>
        <p>You studied 6h 20m this week. That is real progress.</p>
      </main>
    </div>
  );
}

function CHw() {
  return (
    <div className="vb v-c">
      <div className="split">
        <Page />
        <div className="pane">
          <span
            className="pill"
            style={{ alignSelf: 'flex-start', background: '#ffe3d3' }}
          >
            Nice, two down. Four to go.
          </span>
          <h1 style={{ fontSize: 30 }}>Problem 4.27</h1>
          <p style={{ fontSize: 20 }}>{STMT}</p>
          <div className="bubble">
            Here is a nudge. Try swapping everything but the 8 Ω resistor for a
            Thevenin equivalent. After that it is a single loop! I checked page{' '}
            <a href="#p142">142</a> for you.
            <div style={{ fontSize: 13, opacity: 0.6, marginTop: 6 }}>
              Generated by your tutor
            </div>
          </div>
          <div className="bubble shut">
            <b>Approach</b>
            <span>I can talk you through the method</span>
          </div>
          <div className="bubble shut">
            <b>Solution</b>
            <span>The whole thing, when you are ready</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn">Next problem</button>
            <button className="btn s">Skip</button>
            <button className="btn s">Ask about this</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DHome() {
  return (
    <div className="vb v-d">
      <header>
        <span className="logo">PSet</span>
        <span className="sp" />
        <span className="mut">Settings</span>
      </header>
      <main>
        <h1>Welcome back, Jack</h1>
        <p className="lede">Two of six in Problem set 4. It is due Friday.</p>
        <div className="cont">
          <div className="t">
            <b>Continue Problem set 4</b>
            <span className="mono mut">Circuits I · problem 4.27 · 2/6</span>
          </div>
          <button className="btn p">Continue</button>
        </div>
        <div className="sec">
          <h2>Courses</h2>
          <span className="mono mut">{COURSES.length}</span>
        </div>
        {COURSES.map((c) => (
          <div className="row" key={c.name}>
            <span className="n">{c.name}</span>
            <span className="mono mut">{c.mat} materials</span>
            <span>{c.work}</span>
            <span className="ticks" title={`${c.done} of 6`}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <i key={i} className={i < c.done ? 'on' : ''} />
              ))}
            </span>
            <span className="mono mut">{c.due || 'no date'}</span>
          </div>
        ))}
        <a className="add" href="#add">
          + Add a course
        </a>
        <div className="foot">
          <span className="mono mut">This week 6h 20m</span>
        </div>
      </main>
    </div>
  );
}

function DHw() {
  return (
    <div className="vb v-d">
      <div className="split">
        <Page />
        <div className="pane">
          <div className="bar">
            <span className="mut">Circuits I /</span>
            <b>Problem set 4</b>
            <span className="sp" />
            <span className="ticks" style={{ display: 'flex', gap: 2 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <i
                  key={i}
                  style={{
                    width: 14,
                    height: 6,
                    background: i < 2 ? '#1d4ed8' : '#ddd5c4',
                  }}
                />
              ))}
            </span>
            <span className="mono">2/6</span>
          </div>
          <div className="read">
            <span className="mono mut">PROBLEM 4.27</span>
            <p className="stmt">{STMT}</p>
          </div>
          <div className="help">
            <div className="hstep">
              <div className="hd">
                <span className="mono mut">1</span>
                <b>Hint</b>
                <span className="tag mono">generated</span>
                <span className="sp" />
                <a className="lnk mono" href="#p142">
                  p. 142
                </a>
              </div>
              <p className="body">{HINT}</p>
            </div>
            <div className="hstep">
              <div className="hd">
                <span className="mono mut">2</span>
                <b>Approach</b>
                <span className="mut">The method in steps, no numbers</span>
                <span className="sp" />
                <span className="mono mut">closed</span>
              </div>
            </div>
            <div className="hstep">
              <div className="hd">
                <span className="mono mut">3</span>
                <b>Solution</b>
                <span className="mut">Full working and the answer</span>
                <span className="sp" />
                <span className="mono mut">closed</span>
              </div>
            </div>
          </div>
          <div className="acts">
            <button className="btn p">Next problem</button>
            <button className="btn">Skip</button>
            <button className="btn">Ask about this</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SCREENS = {
  a: { home: AHome, homework: AHw },
  b: { home: BHome, homework: BHw },
  c: { home: CHome, homework: CHw },
  d: { home: DHome, homework: DHw },
} as const;

export function Vibes() {
  const { vibe, screen } = useParams();
  if (
    (vibe !== 'a' && vibe !== 'b' && vibe !== 'c' && vibe !== 'd') ||
    (screen !== 'home' && screen !== 'homework')
  ) {
    return <Navigate to="/vibes/d/home" replace />;
  }
  const Screen = SCREENS[vibe][screen];
  return (
    <>
      <div className="vb-bar">
        <span>
          {(['a', 'b', 'c', 'd'] as const).map((v) => (
            <Link
              key={v}
              to={`/vibes/${v}/${screen}`}
              className={v === vibe ? 'on' : ''}
            >
              {v.toUpperCase()}
            </Link>
          ))}
        </span>
        <span>
          {(['home', 'homework'] as const).map((s) => (
            <Link
              key={s}
              to={`/vibes/${vibe}/${s}`}
              className={s === screen ? 'on' : ''}
            >
              {s === 'home' ? 'Home' : 'Homework'}
            </Link>
          ))}
        </span>
      </div>
      <Screen />
    </>
  );
}
