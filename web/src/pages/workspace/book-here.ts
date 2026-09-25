import { createContext, useContext } from 'react'

import type { Style } from '@/api/gen/probnum'

/** The book the workspace is showing, for what's deep inside it: how it
 *  numbers its problems, and a way to open its dialog. */
export interface BookHere {
  problems?: Style
  editBook: () => void
}

export const BookHereContext = createContext<BookHere>({ editBook: () => {} })

export const useBookHere = () => useContext(BookHereContext)

/** Whether the student should check how the book numbers its problems:
 *  unknown, or detected but not plainly, and never confirmed. */
export const numberingUnsure = (s: Style | undefined) => !s?.form || (!s.sure && !s.confirmed)
