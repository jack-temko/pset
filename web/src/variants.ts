/**
 * Every view that takes more than one shape once its data is here, and the
 * shapes it takes, by name. A view's skeletons and its content are typed by
 * these names so they cannot drift apart, and the jump guard (`make jumps-check`,
 * part 3) opens every one (the fixture library holds one of each). Add a variant here first; a view
 * with a shape not listed is a bug. A question's body (queued, working,
 * ready, unwritten, failed) is not here: events change it live and no load
 * ever swaps one in, so it has no skeleton to match. See `components/loaded`.
 */
export const VARIANTS = {
  /** Home: a first run is the greeting and an empty shelf, nothing else. */
  home: ['firstRun', 'library'],
  /** The book's contents rail: absent for a book with no contents. */
  rail: ['none', 'contents'],
  /** The Homework tab's list. */
  homeworkList: ['empty', 'active', 'turnedIn'],
  /** An open homework set: a question, the finish page (every question done),
   *  a turned-in set's finish page, or a set with no questions yet. */
  homeworkSet: ['question', 'finish', 'turnedIn', 'empty'],
  /** The Ask tab: the prompt, or a conversation. */
  ask: ['empty', 'turns'],
  /** Settings' key box: no layout difference, but the states are exercised. */
  settingsKey: ['missing', 'saved'],
} as const;

export type Views = keyof typeof VARIANTS;
/** The names of one view's variants: `Variant<'homeworkSet'>`. */
export type Variant<K extends Views> = (typeof VARIANTS)[K][number];
