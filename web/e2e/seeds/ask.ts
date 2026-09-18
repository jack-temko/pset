import { acceptTask, books, type MockConversation, type MockData } from './library.ts'

/** The books ask answers from must be ready (ask fuses text + vector search,
 *  so a book without a finished search index is not offered). */
export const askSha = books[0].sha256

const T0 = '2026-09-15T09:00:00Z'

/** A finished exchange: prose, an equation card, prose — with citations. */
export const askConversation: MockConversation = {
  id: 'conv-1',
  title: 'Why does the loop rule hold?',
  messageCount: 2,
  createdAt: T0,
  pinned: true,
  lastActivityAt: '2026-09-15T10:05:00Z',
  bookId: books[0].id,
  bookSha256: askSha,
  bookTitle: books[0].title,
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Why does the loop rule hold?',
      segments: [],
      citations: null,
      createdAt: T0,
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: '',
      segments: [
        {
          type: 'prose',
          text: 'The loop rule is energy conservation in disguise. Walk a charge around any closed loop and the potential gains and drops must cancel, exactly as they do in the calculus example on page 3.',
        },
        {
          type: 'envelope',
          kind: 'equation',
          payload: {
            title: 'Kirchhoff loop rule',
            equations: ['\\sum_k V_k = 0'],
            note: 'Every closed loop, every time [p. 12].',
          },
        },
        {
          type: 'prose',
          text: 'If the sum were not zero you could pump energy from nothing by looping forever. Page 12 works the one-loop circuit as a check.',
        },
      ],
      citations: [3, 12],
      createdAt: '2026-09-15T10:04:00Z',
    },
  ],
}

/** A second thread so the rail shows an unpinned row too. */
export const askRecent: MockConversation = {
  id: 'conv-2',
  title: 'When can I swap a sum and an integral?',
  messageCount: 2,
  createdAt: '2026-09-14T08:00:00Z',
  pinned: false,
  lastActivityAt: '2026-09-14T08:30:00Z',
  bookSha256: books[1].sha256,
  bookTitle: books[1].title,
  messages: [
    {
      id: 'msg-3',
      role: 'user',
      content: 'When can I swap a sum and an integral?',
      segments: [],
      citations: null,
      createdAt: '2026-09-14T08:28:00Z',
    },
    {
      id: 'msg-4',
      role: 'assistant',
      content: '',
      segments: [
        {
          type: 'prose',
          text: 'When the series converges uniformly and the terms are integrable. Page 5 states it with the dominating function spelled out.',
        },
      ],
      citations: [5],
      createdAt: '2026-09-14T08:30:00Z',
    },
  ],
}

export const askSeeds = {
  /** Four ready books, two conversations, a configured connection. */
  'ask:shelf': {
    books: [books[0], books[1], books[2]],
    tasks: [],
    conversations: [askConversation, askRecent],
    acceptTask,
    duplicateBook: books[1],
  } satisfies MockData,
  /** The connection is not set up: the quiet state with the Settings link. */
  'ask:unconfigured': {
    books: [books[0]],
    tasks: [],
    conversations: [],
    config: { apiBaseURL: '', hasAPIKey: false, embedBaseURL: '', embedModel: '', hwQuestionScale: 100, hwFigureScale: 100 },
    acceptTask,
    duplicateBook: books[1],
  } satisfies MockData,
}
