import type { Failure } from '@/api/homework';
import type { Scenario, ScenarioContext, Session } from '@/views/mock/scenario';
import { homeworkRoutes } from './routes';
import {
  World,
  makeQuestion,
  makeRead,
  makeSet,
  READ_ASSIGNMENT,
  type QuestionInit,
} from './world';

type QInit = Omit<QuestionInit, 'homeworkId' | 'position'>;

/** A set and its questions, in order, added to the world. */
function addSet(
  w: World,
  title: string,
  dueOffset: number | null,
  questions: QInit[],
  turnedIn = false,
) {
  const h = makeSet(
    title,
    dueOffset,
    turnedIn ? { turnedInAt: new Date().toISOString() } : {},
  );
  w.addSet(
    h,
    questions.map((q, i) =>
      makeQuestion({ ...q, homeworkId: h.id, position: i + 1 }),
    ),
  );
  return {
    id: h.id,
    questions: w.questions.filter((q) => q.homeworkId === h.id),
  };
}

/** Puts every question the engine still owes work on to work, in order. */
function startEngine(w: World, setId: string) {
  for (const q of w.questions.filter((x) => x.homeworkId === setId)) {
    if (
      ['pending', 'locating', 'located', 'reading', 'writing'].includes(q.state)
    )
      w.work(q.id);
  }
}

function session(
  ctx: ScenarioContext,
  build: (w: World) => Partial<Session> & { engine?: string[] },
): Session {
  const w = new World(ctx);
  const { engine = [], play, ...rest } = build(w);
  return {
    routes: homeworkRoutes(w),
    ...rest,
    play: () => {
      engine.forEach((id) => startEngine(w, id));
      play?.();
    },
  };
}

/** Problem set 4, as a student mid-evening has it: some guides written,
 *  one being written, one waiting. */
function problemSet4(w: World) {
  return addSet(w, 'Problem set 4', 1, [
    {
      label: '4.27',
      state: 'ready',
      done: true,
      revealed: ['hint', 'walkthrough', 'answers'],
      difficulty: 2,
      seconds: 1080,
    },
    {
      label: '4.25',
      state: 'ready',
      revealed: ['hint'],
      notes: [[{ t: 'no PSpice or MultiSim' }]],
      difficulty: 2,
      seconds: 840,
    },
    { label: '4.32', state: 'writing', activity: 'Thinking…', difficulty: 4 },
    { label: '3.12', state: 'pending', difficulty: 3 },
  ]);
}

const happy: Scenario = {
  id: 'happy',
  title: 'Happy path',
  note: 'Two sets on the list. Problem set 4 has guides written, one being written and one queued behind it; open it and watch them land.',
  start: (ctx) =>
    session(ctx, (w) => {
      const s4 = problemSet4(w);
      addSet(w, 'Chapter 3 exercises', 6, [
        { label: '3.12', state: 'ready' },
        { label: '3.14', state: 'ready' },
      ]);
      addSet(
        w,
        'Problem set 3',
        -3,
        [{ label: '2.31', state: 'ready', done: true }],
        true,
      );
      return { engine: [s4.id] };
    }),
};

const handoffIn: Scenario = {
  id: 'handoff-in',
  title: 'Arriving from Home',
  note: 'Home’s due list opens a set straight in its walkthrough (the URL names it): the panel opens on the first question not yet complete.',
  start: (ctx) =>
    session(ctx, (w) => {
      const s4 = problemSet4(w);
      return { engine: [s4.id], props: { initialSet: s4.id } };
    }),
};

const empty: Scenario = {
  id: 'empty',
  title: 'Nothing yet',
  note: 'A book with no homework: the first thing a student sees after importing it.',
  start: (ctx) => session(ctx, () => ({})),
};

const slow: Scenario = {
  id: 'slow',
  title: 'Slow server',
  note: 'Every answer takes a second and a half, and four questions wait in line with nothing found yet. What does the student see while nothing has arrived?',
  start: (ctx) =>
    session(ctx, (w) => {
      const s = addSet(w, 'Problem set 5', 2, [
        { label: '4.27', state: 'pending' },
        { label: '4.25', state: 'pending' },
        { label: '4.32', state: 'pending' },
        { label: '3.12', state: 'pending' },
      ]);
      return { latency: 1500, engine: [s.id], props: { initialSet: s.id } };
    }),
};

const failedKinds: { label: string; failure: Failure; reason: string }[] = [
  {
    label: '4.27',
    failure: 'generation',
    reason: 'The guide was cut off before its last part.',
  },
  {
    label: '4.25',
    failure: 'not_found',
    reason: 'It isn’t under 4.25 in this book’s Problems lists.',
  },
  {
    label: '4.32',
    failure: 'unavailable',
    reason: 'OpenRouter didn’t answer in time.',
  },
  { label: '3.12', failure: 'setup', reason: 'OpenRouter refused the key.' },
];

const failed: Scenario = {
  id: 'failed',
  title: 'Everything failed',
  note: 'One question of each failure kind. Trying the unavailable one again fails once more before it works.',
  start: (ctx) =>
    session(ctx, (w) => {
      const s = addSet(
        w,
        'Problem set 6',
        3,
        failedKinds.map((k) => ({
          label: k.label,
          state: 'failed' as const,
          failure: k.failure,
          reason: k.reason,
        })),
      );
      w.retryFails = 'unavailable';
      w.retryReason = 'OpenRouter didn’t answer in time, again.';
      return { props: { initialSet: s.id } };
    }),
};

const midFlow: Scenario = {
  id: 'mid-flow-reload',
  title: 'Mid-flow, after a reload',
  note: 'The tab was reloaded with the third question half written, the first two done and the first one’s guide fully revealed. Where does the student land?',
  start: (ctx) =>
    session(ctx, (w) => {
      const s = addSet(w, 'Problem set 4', 1, [
        {
          label: '4.27',
          state: 'ready',
          done: true,
          revealed: ['hint', 'walkthrough', 'answers'],
        },
        {
          label: '4.25',
          state: 'ready',
          done: true,
          revealed: ['hint', 'walkthrough'],
        },
        { label: '4.32', state: 'writing', activity: 'Computing…' },
        { label: '3.12', state: 'pending' },
      ]);
      return { engine: [s.id], props: { initialSet: s.id } };
    }),
};

const returnAfterBreak: Scenario = {
  id: 'return-after-break',
  title: 'Back after a break',
  note: 'Hour seven. Three sets: one overdue, one due today with most of it done, one next week. Nothing is being written. What says where to pick up?',
  start: (ctx) =>
    session(ctx, (w) => {
      addSet(w, 'Lab 2 prelab', -1, [
        { label: '2.31', state: 'ready', done: true },
        { label: '3.12', state: 'ready' },
      ]);
      addSet(w, 'Problem set 4', 0, [
        {
          label: '4.27',
          state: 'ready',
          done: true,
          difficulty: 2,
          seconds: 1080,
        },
        {
          label: '4.25',
          state: 'ready',
          done: true,
          difficulty: 2,
          seconds: 840,
        },
        {
          label: '4.32',
          state: 'ready',
          done: true,
          difficulty: 4,
          seconds: 2460,
        },
        { label: '3.12', state: 'ready', revealed: ['hint'], difficulty: 3 },
      ]);
      addSet(w, 'Chapter 5 exercises', 7, [
        { label: '4.27', state: 'ready' },
        { label: '4.25', state: 'ready' },
      ]);
      return {};
    }),
};

const importing: Scenario = {
  id: 'importing',
  title: 'Assignments being read',
  note: 'The professor’s pages, read in the background: one reading, one ready to review, one that failed. Review it to see the import dialog.',
  start: (ctx) =>
    session(ctx, (w) => {
      addSet(w, 'Problem set 4', 1, [
        { label: '4.27', state: 'ready' },
        { label: '4.25', state: 'ready' },
      ]);
      const reading = makeRead({
        state: 'reading',
        source: 'https://people.example.edu/~prof/202/homework.htm',
        activity: 'Thinking it over…',
      });
      w.reads = [
        reading,
        makeRead({
          state: 'ready',
          source: 'Assignment 3.pdf',
          assignment: READ_ASSIGNMENT,
        }),
        makeRead({
          state: 'failed',
          source: 'https://canvas.example.edu/courses/461/assignments',
          error:
            'That page answered 401. A page behind a login can be pasted or photographed instead.',
        }),
      ];
      return { play: () => w.playRead(reading.id) };
    }),
};

const finish: Scenario = {
  id: 'finish',
  title: 'Every question done',
  note: 'Problem set 4 with all six questions done and timed: it opens on the finish page. Mark one incomplete from the count’s list, then finish it again.',
  start: (ctx) =>
    session(ctx, (w) => {
      const s = addSet(w, 'Problem set 4', 1, [
        {
          label: '4.27',
          state: 'ready',
          done: true,
          difficulty: 2,
          seconds: 1080,
        },
        {
          label: '4.25',
          state: 'ready',
          done: true,
          difficulty: 2,
          seconds: 840,
        },
        {
          label: '4.32',
          state: 'ready',
          done: true,
          difficulty: 4,
          seconds: 2460,
        },
        {
          label: '3.12',
          state: 'ready',
          done: true,
          difficulty: 3,
          seconds: 1980,
        },
        {
          label: '2.31',
          state: 'ready',
          done: true,
          difficulty: 1,
          seconds: 540,
        },
        {
          label: '3.14',
          state: 'ready',
          done: true,
          difficulty: 1,
          seconds: 720,
        },
      ]);
      return { props: { initialSet: s.id } };
    }),
};

const finishUntimed: Scenario = {
  id: 'finish-untimed',
  title: 'Every question done, none timed',
  note: 'All done, but no time was kept (done before time was counted): the finish page is the line and the way out, centered in the pane.',
  start: (ctx) =>
    session(ctx, (w) => {
      const s = addSet(w, 'Homework due Sep 30', 0, [
        { label: '4.27', state: 'ready', done: true },
        { label: '4.25', state: 'ready', done: true },
        { label: '4.32', state: 'ready', done: true },
      ]);
      return { props: { initialSet: s.id } };
    }),
};

const noGuide: Scenario = {
  id: 'no-guide',
  title: 'A question with no guide',
  note: 'The second question was written before guides were kept as documents: it says it has none and offers Write the guide. Its button is Skip for now.',
  start: (ctx) =>
    session(ctx, (w) => {
      const s = addSet(w, 'Problem set 4', 1, [
        {
          label: '4.27',
          state: 'ready',
          done: true,
          difficulty: 2,
          seconds: 1080,
        },
        { label: '4.25', state: 'unwritten', difficulty: 2 },
        { label: '4.32', state: 'ready', difficulty: 4 },
      ]);
      return { props: { initialSet: s.id } };
    }),
};

const longSet: Scenario = {
  id: 'long-set',
  title: 'A long set',
  note: 'Twenty-four questions, nine done. The bar’s segments get thin and the count’s list scrolls; the count, bar and time left never move.',
  start: (ctx) =>
    session(ctx, (w) => {
      const s = addSet(
        w,
        'Chapter 4 exercises',
        2,
        Array.from({ length: 24 }, (_, i) => ({
          label: `4.${String(i + 1).padStart(2, '0')}`,
          state: 'ready' as const,
          done: i < 9,
          difficulty: (i % 5) + 1,
          seconds: i < 9 ? 600 + ((i * 317) % 900) : undefined,
        })),
      );
      return { props: { initialSet: s.id } };
    }),
};

const longTitle: Scenario = {
  id: 'long-title',
  title: 'A long set title',
  note: 'The title is cut to make room: the count, the time left and the menu stay where they are.',
  start: (ctx) =>
    session(ctx, (w) => {
      const s = addSet(
        w,
        'Chapter 3 exercises: nodal analysis, mesh analysis and superposition, with the lab prelab',
        2,
        [
          {
            label: '4.27',
            state: 'ready',
            done: true,
            difficulty: 2,
            seconds: 1080,
          },
          {
            label: '4.25',
            state: 'ready',
            done: true,
            difficulty: 2,
            seconds: 840,
          },
          { label: '4.32', state: 'ready', difficulty: 4 },
        ],
      );
      return { props: { initialSet: s.id } };
    }),
};

export const SCENARIOS: Scenario[] = [
  happy,
  handoffIn,
  empty,
  slow,
  failed,
  midFlow,
  returnAfterBreak,
  importing,
  finish,
  finishUntimed,
  noGuide,
  longSet,
  longTitle,
];
