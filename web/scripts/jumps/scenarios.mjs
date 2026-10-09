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
  const sets = [];
  for (const b of books) {
    const { homework } = await get(`/api/books/${b.id}/homework`);
    for (const h of homework) sets.push(h);
    if (!best || homework.length > best.homework.length)
      best = { book: b, homework };
  }

  // The first question that has finished with a usage line, for the
  // "Usage details" scenarios: its set, and its place in the Questions menu.
  let usageQuestion = null;
  for (const h of sets) {
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

  // One of each variant the views have, where the library holds it.
  const setOf = (pick) => sets.find(pick) ?? null;
  const inProgressSet = setOf((h) => !h.turnedInAt && h.done < h.total);
  const finishedSet = setOf(
    (h) => !h.turnedInAt && h.total > 0 && h.done === h.total,
  );
  const turnedInSet = setOf((h) => !!h.turnedInAt);
  let noContentsBook = null;
  let noTurnsBook = null;
  for (const b of books) {
    if (b.state !== 'ready') continue;
    const c = await get(`/api/books/${b.id}/contents`);
    if (!noContentsBook && !(c.entries ?? []).length) noContentsBook = b;
    const { turns } = await get(`/api/books/${b.id}/turns`);
    if (!noTurnsBook && !(turns ?? []).length) noTurnsBook = b;
  }

  const book = best?.book ?? null;
  // The set the homework scenarios use: one with a finished, costed
  // question if there is one, else the one with the most questions.
  const set =
    usageQuestion?.set ??
    best?.homework.slice().sort((a, b) => b.total - a.total)[0] ??
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
    { name: 'Home, cold load', url: '/', variant: 'home/books' },
    {
      name: 'Home, empty library, cold load',
      url: '/',
      variant: 'home/empty',
      skip: 'the fixture library has books; an empty library needs its own data',
    },
    {
      name: 'Settings, cold load',
      url: '/settings',
      variant: 'settings/key-missing',
    },
    {
      name: 'Settings, key saved, cold load',
      url: '/settings',
      variant: 'settings/key-present',
      skip: 'the fixture library holds no key; one would need saving through the API',
    },
    {
      name: 'Book, cold load',
      url: b,
      variant: 'book/contents',
      skip: noBook,
    },
    {
      name: 'Book without contents, cold load',
      url: noContentsBook && `/books/${noContentsBook.id}`,
      variant: 'book/no-contents',
      skip: noContentsBook ? undefined : 'no book lacks a table of contents',
    },
    { name: 'Homework set, cold load', url: hw, skip: noSet },
    ...[
      ['in-progress', 'in progress', inProgressSet],
      ['finished', 'finished', finishedSet],
      ['turned-in', 'turned in', turnedInSet],
    ].map(([id, words, h]) => ({
      name: `Homework set, ${words}, cold load`,
      url: h && `/books/${h.bookId}/homework/${h.id}`,
      variant: `homework-set/${id}`,
      skip: h ? undefined : `no homework set is ${words}`,
    })),
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
      url: b,
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
