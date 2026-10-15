// What the audit does, one scenario at a time. A scenario is a name, a start
// URL and steps: each step is a click, found by role and name, by exact text,
// or by CSS. The last step is the one measured (t0 is just before it); the
// steps before it are setup, waited out. With no steps, the page load is what
// is measured. Nothing here clicks a confirming or destructive action: menus
// and popovers are opened, measured and left.

const click = (role, name) => ({ role, name });
const tab = (name) => ({ role: 'button', name });
const item = (name) => ({ role: 'menuitem', name });

/** The book and homework set the scenarios use, from the running app: the
 *  book with the most homework, and its set with the most questions. */
export async function discover(app) {
  const get = async (path) => {
    const r = await fetch(app + path);
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  };
  const { books } = await get('/api/books');
  let best = null;
  // The set that shows every question state is told apart by its title: the
  // other scenarios avoid it, since its queued and working questions show a
  // spinner in the Questions menu for good.
  const everyState = (h) => /every state/i.test(h.title);
  const sets = [];
  const listsOf = [];
  for (const b of books) {
    const { homework } = await get(`/api/books/${b.id}/homework`);
    listsOf.push([b, homework]);
    for (const h of homework) sets.push(h);
    if (!best || homework.length > best.homework.length)
      best = { book: b, homework };
  }

  // The first question that has finished with a usage line, for the
  // "Usage details" scenarios: its set, and its place in the Questions menu.
  let usageQuestion = null;
  for (const h of sets) {
    if (everyState(h)) continue;
    const { questions } = await get(`/api/homework/${h.id}`);
    const i = (questions ?? []).findIndex(
      (q) => q.usage && (q.state === 'ready' || q.state === 'unwritten'),
    );
    if (i >= 0) {
      usageQuestion = { set: h, index: i, label: questions[i].label };
      break;
    }
  }
  // The first book with an answered Ask turn that has a usage line.
  let askBook = null;
  for (const b of books) {
    const { turns } = await get(`/api/books/${b.id}/turns`);
    if ((turns ?? []).some((t) => t.usage && t.state !== 'running')) {
      askBook = b;
      break;
    }
  }

  // One of each variant the views have (src/variants.ts), where the library
  // holds it.
  const setOf = (pick) => sets.find(pick) ?? null;
  const inProgressSet = setOf(
    (h) => !h.turnedInAt && h.done < h.total && !everyState(h),
  );
  const finishedSet = setOf(
    (h) => !h.turnedInAt && h.total > 0 && h.done === h.total,
  );
  const turnedInSet = setOf((h) => !!h.turnedInAt);
  const emptySet = setOf((h) => h.total === 0);
  // The every-state set: each question's place in the Questions menu, by the
  // question variant its state is drawn as.
  const statesSet = setOf(everyState);
  const questionAt = {};
  if (statesSet) {
    const { questions } = await get(`/api/homework/${statesSet.id}`);
    const kinds = {
      queued: ['pending', 'located'],
      working: ['locating', 'reading', 'writing'],
      ready: ['ready'],
      unwritten: ['unwritten'],
      failed: ['failed'],
    };
    for (const [kind, states] of Object.entries(kinds)) {
      const i = (questions ?? []).findIndex((q) => states.includes(q.state));
      if (i >= 0)
        questionAt[kind] = {
          set: statesSet,
          index: i,
          label: questions[i].label,
        };
    }
  }
  let noContentsBook = null;
  let noTurnsBook = null;
  for (const b of books) {
    if (b.state?.kind !== 'ready') continue;
    const c = await get(`/api/books/${b.id}/contents`);
    if (!noContentsBook && !(c.entries ?? []).length) noContentsBook = b;
    const { turns } = await get(`/api/books/${b.id}/turns`);
    if (!noTurnsBook && !(turns ?? []).length) noTurnsBook = b;
  }
  // The Homework tab's list: a book with no sets, one with sets and none
  // turned in, one with a turned-in set.
  const lists = { empty: null, active: null, turnedIn: null };
  for (const [book_, homework] of listsOf) {
    if (homework.length === 0) lists.empty ??= book_;
    else if (homework.some((h) => h.turnedInAt)) lists.turnedIn ??= book_;
    else lists.active ??= book_;
  }

  const book = best?.book ?? null;
  // The set the homework scenarios use: one with a finished, costed
  // question if there is one, else the one with the most questions.
  const set =
    usageQuestion?.set ??
    best?.homework
      .filter((h) => !everyState(h))
      .sort((a, b) => b.total - a.total)[0] ??
    null;
  return {
    book,
    set,
    home: books[0] ?? null,
    usageQuestion,
    askBook,
    inProgressSet,
    finishedSet,
    turnedInSet,
    emptySet,
    questionAt,
    lists,
    noContentsBook,
    noTurnsBook,
  };
}

export function scenarios({
  book,
  set,
  usageQuestion,
  askBook,
  inProgressSet,
  finishedSet,
  turnedInSet,
  emptySet,
  questionAt = {},
  lists = {},
  noContentsBook,
  noTurnsBook,
}) {
  const noBook = book ? undefined : 'the library has no book';
  const noSet = !book
    ? 'the library has no book'
    : set
      ? undefined
      : 'no book has a homework set';
  const noQuestions =
    noSet ?? (set.total > 0 ? undefined : 'the homework set has no questions');
  const b = book && `/books/${book.id}`;
  const hw = set && `/books/${set.bookId}/homework/${set.id}`;
  const bookMenu = click('button', 'Book actions');
  const hwMenu = click('button', 'Homework actions');

  return [
    { name: 'Home, cold load', url: '/', variant: 'home/library' },
    {
      name: 'Home, empty library, cold load',
      url: '/',
      variant: 'home/firstRun',
      skip: 'the fixture library has books; an empty library needs its own data',
    },
    {
      name: 'Settings, cold load',
      url: '/settings',
      variant: 'settingsKey/missing',
    },
    {
      name: 'Settings, key saved, cold load',
      url: '/settings',
      variant: 'settingsKey/saved',
      skip: 'the fixture library holds no key; one would need saving through the API',
    },
    { name: 'Book, cold load', url: b, variant: 'rail/contents', skip: noBook },
    {
      name: 'Book without contents, cold load',
      url: noContentsBook && `/books/${noContentsBook.id}`,
      variant: 'rail/none',
      skip: noContentsBook ? undefined : 'no book lacks a table of contents',
    },
    { name: 'Homework set, cold load', url: hw, skip: noSet },
    ...[
      ['empty', 'no sets', lists.empty],
      ['active', 'sets, none turned in', lists.active],
      ['turnedIn', 'a turned-in set', lists.turnedIn],
    ].map(([id, words, bk]) => ({
      name: `Homework list, ${words}`,
      url: bk && `/books/${bk.id}`,
      steps: [tab('Homework')],
      variant: `homeworkList/${id}`,
      skip: bk ? undefined : `no book has ${words}`,
    })),
    ...[
      ['question', 'in progress', inProgressSet],
      ['finish', 'finished', finishedSet],
      ['turnedIn', 'turned in', turnedInSet],
      ['empty', 'with no questions', emptySet],
    ].map(([id, words, h]) => ({
      name: `Homework set, ${words}, cold load`,
      url: h && `/books/${h.bookId}/homework/${h.id}`,
      variant: `homeworkSet/${id}`,
      skip: h ? undefined : `no homework set is ${words}`,
    })),
    // A question in each state, picked from the Questions menu. A queued or
    // working one is waiting on work that never comes in the fixture, so its
    // skeleton or spinner is expected to be on screen at the end.
    ...['queued', 'working', 'ready', 'unwritten', 'failed'].map((kind) => {
      const q = questionAt[kind];
      return {
        name: `Question, ${kind}`,
        url: q && `/books/${q.set.bookId}/homework/${q.set.id}`,
        steps: [
          click('button', 'Questions'),
          { css: '[role=menuitem]', nth: q?.index, label: q?.label },
        ],
        waits: kind === 'queued' || kind === 'working',
        skip: q ? undefined : `no question is ${kind}`,
      };
    }),
    {
      name: 'Ask, with turns',
      url: askBook && `/books/${askBook.id}`,
      steps: [tab('Ask')],
      variant: 'ask/turns',
      skip: askBook ? undefined : 'no book has an answered Ask turn',
    },
    {
      name: 'Ask, empty',
      url: noTurnsBook && `/books/${noTurnsBook.id}`,
      steps: [tab('Ask')],
      variant: 'ask/empty',
      skip: noTurnsBook ? undefined : 'every book has Ask turns',
    },

    {
      name: 'Home to a book',
      url: '/',
      steps: [{ css: `a[href="/books/${book?.id}"]` }],
      skip: noBook,
    },
    {
      name: 'Homework list to a set',
      url: set && `/books/${set.bookId}`,
      steps: [tab('Homework'), { text: set?.title }],
      skip: noSet,
    },

    { name: 'Book actions menu', url: b, steps: [bookMenu], skip: noBook },
    {
      name: 'Edit book',
      url: b,
      steps: [bookMenu, item('Edit book')],
      skip: noBook,
    },
    { name: 'Memory', url: b, steps: [bookMenu, item('Memory')], skip: noBook },
    {
      name: 'New homework',
      url: b,
      steps: [tab('Homework'), click('button', 'New homework')],
      skip: noBook,
    },
    { name: 'Homework actions menu', url: hw, steps: [hwMenu], skip: noSet },
    {
      name: 'Edit homework',
      url: hw,
      steps: [hwMenu, item('Edit homework')],
      skip: noSet,
    },
    {
      name: 'Add questions',
      url: hw,
      steps: [hwMenu, item('Add questions')],
      skip: noSet,
    },
    {
      name: 'Questions menu',
      url: hw,
      steps: [click('button', 'Questions')],
      skip: noQuestions,
    },
    {
      name: 'Question actions menu',
      url: hw,
      steps: [click('button', 'Question actions')],
      skip: noQuestions,
    },
    // The usage line under a finished question and under an answered Ask turn,
    // each opened twice (the second open is its own row).
    {
      name: 'Usage details (homework set)',
      url:
        usageQuestion &&
        `/books/${usageQuestion.set.bookId}/homework/${usageQuestion.set.id}`,
      steps: [
        click('button', 'Questions'),
        {
          css: '[role=menuitem]',
          nth: usageQuestion?.index,
          label: usageQuestion?.label,
        },
        { css: 'button[aria-label^="Usage details for"]' },
      ],
      twice: true,
      skip: usageQuestion
        ? undefined
        : 'no homework question has a finished usage line',
    },
    {
      name: 'Usage details (Ask answer)',
      url: askBook && `/books/${askBook.id}`,
      steps: [
        tab('Ask'),
        { css: 'button[aria-label="Usage details for Ask answer"]' },
      ],
      twice: true,
      skip: askBook
        ? undefined
        : 'no book has an answered Ask turn with a usage line',
    },
    {
      name: 'Clear history popover',
      url: '/settings',
      steps: [click('button', 'Clear history')],
    },
    {
      name: 'Reset everything popover',
      url: '/settings',
      steps: [click('button', 'Reset everything')],
    },
  ];
}

/** The locator a step names. */
export function locate(page, step) {
  if (step.css)
    return step.nth === undefined
      ? page.locator(step.css).filter({ visible: true }).first()
      : page.locator(step.css).nth(step.nth);
  if (step.text) return page.getByText(step.text, { exact: true }).first();
  return page.getByRole(step.role, { name: step.name, exact: true }).first();
}
