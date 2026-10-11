import type {
  Box,
  Draft,
  Question,
  QuestionPatch,
  Retry,
} from '@/api/homework';
import type { ErrorId } from '@/api/gen/errors';
import { MockError, type Route } from '@/views/mock/server';
import { BOOK_ID, World, makeQuestion, makeRead, makeSet } from './world';

const runs = (line: string) => [{ t: line }];

/** A typed line's label: the reference it holds, or the line cut short. */
const labelOf = (text: string) =>
  /\d+(?:\.\d+)+/.exec(text)?.[0] ??
  (text.length > 28 ? `${text.slice(0, 27)}…` : text);

const notFound = (what: 'question' | 'homework set' | 'read') =>
  new MockError(
    404,
    {
      question: 'homework.question_not_found',
      'homework set': 'homework.set_not_found',
      read: 'homework.assignment_not_found',
    }[what] as ErrorId,
  );

/** The server's homework routes over a `World`: what the view's hooks call,
 *  answered the way the server answers, with the events it would send. */
export function homeworkRoutes(w: World): Route[] {
  const question = (id: string) =>
    w.questions.find((q) => q.id === id) ??
    (() => {
      throw notFound('question');
    })();
  const set = (id: string) =>
    w.sets.find((s) => s.id === id) ??
    (() => {
      throw notFound('homework set');
    })();

  /** Questions for drafts, appended to a set and put to work. */
  const addDrafts = (setId: string, drafts: Draft[]): Question[] => {
    const start = w.questions.filter((q) => q.homeworkId === setId).length;
    const added = drafts.map((d, i) =>
      makeQuestion({
        homeworkId: setId,
        position: start + i + 1,
        label: d.inBook ? labelOf(d.text) : d.text,
        text: d.text,
        state: 'pending',
        inBook: d.inBook,
      }),
    );
    w.questions.push(...added);
    added.forEach((q) => {
      w.work(q.id);
    });
    w.ctxEmitSet(setId);
    return added;
  };

  /** A question sent back to the start of its production. */
  const restart = (
    id: string,
    change: Partial<Question> = {},
    fail?: Parameters<World['work']>[1],
  ) => {
    w.patch(id, {
      state: 'pending',
      error: undefined,
      activity: undefined,
      hint: [],
      walkthrough: [],
      usage: undefined,
      ...change,
    });
    w.work(id, fail);
  };

  return [
    [
      'GET',
      '/api/books/:bookId/homework',
      () => ({
        homework: w.sets
          .filter((s) => s.bookId === BOOK_ID)
          .map((s) => w.summary(s.id)),
      }),
    ],
    [
      'GET',
      '/api/homework/:id',
      ({ params }) => (set(params.id), w.detail(params.id)),
    ],
    [
      'POST',
      '/api/books/:bookId/homework',
      ({ body: raw }) => {
        const body = raw as { title?: string; dueDate?: string };
        if (!String(body.title ?? '').trim())
          throw new MockError(422, 'homework.title_empty', 'title');
        return w.addSet(
          makeSet((body.title ?? '').trim(), null, {
            dueDate: body.dueDate ?? '',
          }),
        );
      },
    ],
    [
      'PATCH',
      '/api/homework/:id',
      ({ params, body: raw }) => {
        const body = raw as {
          title?: string;
          dueDate?: string;
          turnedIn?: boolean;
        };
        const h = set(params.id);
        if (body.title !== undefined) h.title = body.title;
        if (body.dueDate !== undefined) h.dueDate = body.dueDate;
        if (body.turnedIn !== undefined)
          h.turnedInAt = body.turnedIn ? new Date().toISOString() : '';
        w.ctxEmitSet(h.id);
        return w.summary(h.id);
      },
    ],
    [
      'DELETE',
      '/api/homework/:id',
      ({ params }) => {
        const h = set(params.id);
        w.sets = w.sets.filter((s) => s.id !== h.id);
        w.questions = w.questions.filter((q) => q.homeworkId !== h.id);
        w.emit('homework.removed', { id: h.id, bookId: h.bookId });
      },
    ],
    [
      'POST',
      '/api/homework/:id/questions',
      ({ params, body }) => (
        set(params.id),
        {
          questions: addDrafts(params.id, (body as { drafts: Draft[] }).drafts),
        }
      ),
    ],
    [
      'POST',
      '/api/homework/:id/boxed',
      ({ params, body: raw }) => {
        const body = raw as { boxes: Box[] };
        set(params.id);
        const page = body.boxes[0]?.page ?? 1;
        const [q] = addDrafts(params.id, [
          { text: `Boxed on p. ${page - 16}`, inBook: true },
        ]);
        w.patch(q.id, { boxes: body.boxes });
        return question(q.id);
      },
    ],
    [
      'PATCH',
      '/api/questions/:id',
      ({ params, body }) => {
        const p = body as QuestionPatch;
        const q = question(params.id);
        const change: Partial<Question> = {};
        if (p.reveal && !q.revealed.includes(p.reveal))
          change.revealed = [...q.revealed, p.reveal];
        if (p.done !== undefined) change.done = p.done;
        if (p.notes) change.notes = p.notes.map(runs);
        if (p.position !== undefined) {
          const mates = w.questions
            .filter((x) => x.homeworkId === q.homeworkId)
            .sort((a, b) => a.position - b.position);
          const [moved] = mates.splice(
            mates.findIndex((x) => x.id === q.id),
            1,
          );
          mates.splice(
            Math.max(0, Math.min(p.position - 1, mates.length)),
            0,
            moved,
          );
          mates.forEach(
            (x, i) =>
              x.position !== i + 1 && w.patch(x.id, { position: i + 1 }, true),
          );
        }
        if (p.reading || p.reread)
          Object.assign(change, {
            reading: (p.reading ?? []).map(runs),
            readingEdited: !!p.reading,
            readingDoubts: [],
          });
        w.patch(q.id, change);
        // A new reading, or new instructions, write the guide again.
        if ((p.reading || p.reread || p.notes) && q.state === 'ready')
          restart(q.id, { state: 'located' });
        w.ctxEmitSet(q.homeworkId);
        return question(q.id);
      },
    ],
    [
      'DELETE',
      '/api/questions/:id',
      ({ params }) => {
        const q = question(params.id);
        w.questions = w.questions.filter((x) => x.id !== q.id);
        w.emit('question.removed', { id: q.id, homeworkId: q.homeworkId });
        w.ctxEmitSet(q.homeworkId);
      },
    ],
    [
      'POST',
      '/api/questions/:id/guide',
      ({ params }) => {
        restart(params.id, { state: 'located' });
        return question(params.id);
      },
    ],
    [
      'POST',
      '/api/questions/:id/retry',
      ({ params, body }) => {
        const r = body as Retry;
        const q = question(params.id);
        // A scenario can make the first retry fail again, so the student
        // sees a second failure before the guide lands.
        const error = w.retryError;
        w.retryError = undefined;
        w.patch(
          q.id,
          { attempts: (q.attempts ?? 0) + 1, failedAt: undefined },
          true,
        );
        restart(
          q.id,
          r.text
            ? {
                inBook: false,
                text: r.text,
                statement: runs(r.text),
                page: undefined,
              }
            : r.page
              ? { page: r.page }
              : {},
          error && { fail: { at: 'writing', error } },
        );
        return question(q.id);
      },
    ],
    [
      'POST',
      '/api/questions/:id/boxes',
      ({ params, body }) => {
        restart(params.id, {
          boxes: (body as { boxes: Box[] }).boxes,
          page: undefined,
          figures: [],
          reading: [],
        });
        return question(params.id);
      },
    ],

    ['GET', '/api/books/:bookId/assignments/reads', () => ({ reads: w.reads })],
    ['GET', '/api/books/:bookId/assignments/source', () => ({ url: '' })],
    [
      'POST',
      '/api/books/:bookId/references',
      ({ body }) => ({
        lines: (body as { lines: string[] }).lines.map((line) => {
          const labels = line.match(/\d+(?:\.\d+)+/g) ?? [];
          const notes = [...line.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
          return labels.length
            ? { labels, notes }
            : { labels: [], notes: [], unread: true };
        }),
      }),
    ],
    [
      'POST',
      '/api/books/:bookId/assignments/read',
      ({ body: raw, form }) => {
        const body = raw as { url?: string; setId?: string } | undefined;
        const source = form
          ? ((form.get('file') as File | null)?.name ?? 'Assignment.pdf')
          : (body?.url ?? 'pasted');
        const read = makeRead({
          state: 'reading',
          source,
          activity: 'Thinking it over…',
          setId:
            body?.setId ?? (form?.get('setId') as string | null) ?? undefined,
        });
        w.reads = [read, ...w.reads];
        w.playRead(read.id);
        return read;
      },
    ],
    [
      'POST',
      '/api/assignment-reads/:id/retry',
      ({ params }) => {
        const read =
          w.reads.find((r) => r.id === params.id) ??
          (() => {
            throw notFound('read');
          })();
        const next = {
          ...read,
          state: 'reading' as const,
          error: undefined,
          activity: 'Thinking it over…',
          updatedAt: new Date().toISOString(),
        };
        w.reads = w.reads.map((r) => (r.id === read.id ? next : r));
        w.playRead(read.id);
        return next;
      },
    ],
    [
      'DELETE',
      '/api/assignment-reads/:id',
      ({ params }) => {
        w.reads = w.reads.filter((r) => r.id !== params.id);
        w.emit('assignment.removed', { id: params.id, bookId: BOOK_ID });
      },
    ],
    [
      'POST',
      '/api/books/:bookId/assignments',
      ({ body: raw }) => {
        const body = raw as {
          readId?: string;
          groups: {
            title: string;
            due: string;
            rows: Draft[];
            setId?: string;
          }[];
        };
        const made = (
          body.groups as {
            title: string;
            due: string;
            rows: Draft[];
            setId?: string;
          }[]
        ).map((g) => {
          const h = g.setId
            ? set(g.setId)
            : w.addSet(makeSet(g.title, null, { dueDate: g.due }));
          addDrafts(h.id, g.rows);
          return w.summary(h.id);
        });
        if (body.readId) {
          w.reads = w.reads.filter((r) => r.id !== body.readId);
          w.emit('assignment.removed', { id: body.readId, bookId: BOOK_ID });
        }
        return { homework: made };
      },
    ],

    ['GET', '/api/books/:bookId/memories', () => ({ memories: [] })],
    ['DELETE', '/api/memories/:id', () => undefined],
  ];
}
