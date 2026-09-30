/**
 * Home's greeting: a line for the hour, picked at random from a few, so
 * opening the app is a little different each time. Two voices to choose
 * between (2026-09-30): A is warm and plain, B a little playful. Seven
 * stretches of the day, three short lines each.
 *
 * A line writes its name as `, {name}`, which drops out whole (comma
 * and all) when there is no name. Lines carry their own punctuation.
 */

export type GreetingVoice = 'a' | 'b'

type Band = {
  /** First hour of the band, 0 to 23. It runs until the next band starts. */
  from: number
  /** What the band is, for the preview and the tests: "12am to 2am". */
  label: string
  a: string[]
  b: string[]
}

export const bands: Band[] = [
  {
    from: 0,
    label: '12am to 2am',
    a: ['Up late, {name}?', 'Midnight oil, {name}?', 'Still up, {name}?'],
    b: ['Night owl, {name}?', 'Sleep can wait, {name}.', 'Midnight, {name}. Bold.'],
  },
  {
    from: 3,
    label: '3am to 5am',
    a: ['Early start, {name}.', 'Before sunrise, {name}?', 'Quiet hour, {name}.'],
    b: ['Early bird, {name}?', 'Coffee first, {name}.', 'The birds aren\'t up, {name}.'],
  },
  {
    from: 6,
    label: '6am to 10am',
    a: ['Good morning, {name}.', 'Morning, {name}.', 'Fresh start, {name}.'],
    b: ['Rise and shine, {name}.', 'Coffee ready, {name}?', 'Back at it, {name}.'],
  },
  {
    from: 11,
    label: '11am to 1pm',
    a: ['Midday, {name}.', 'Good to see you, {name}.', 'Lunchtime, {name}?'],
    b: ['Lunch first, {name}?', 'Hello again, {name}.', 'Noon, {name}. Snacks?'],
  },
  {
    from: 14,
    label: '2pm to 4pm',
    a: ['Good afternoon, {name}.', 'Afternoon, {name}.', 'Steady on, {name}.'],
    b: ['Afternoon slump, {name}?', 'Snack o\'clock, {name}?', 'Still going, {name}?'],
  },
  {
    from: 17,
    label: '5pm to 8pm',
    a: ['Good evening, {name}.', 'Evening, {name}.', 'Welcome back, {name}.'],
    b: ['Homework hours, {name}.', 'Dinner yet, {name}?', 'Evening shift, {name}.'],
  },
  {
    from: 21,
    label: '9pm to 11pm',
    a: ['Late one, {name}?', 'Winding down, {name}?', 'Good evening, {name}.'],
    b: ['Still at it, {name}?', 'One more problem, {name}?', 'Night mode, {name}.'],
  },
]

export function bandFor(hour: number): Band {
  let found = bands[0]
  for (const b of bands) if (b.from <= hour) found = b
  return found
}

/** Fills the name in, or drops `, {name}` when there is none. */
export function fill(line: string, name: string): string {
  return name ? line.replace('{name}', name) : line.replace(', {name}', '')
}

/** `pick` is a number in [0, 1), so a page can hold one choice for its whole
 *  visit and a test can hold it still. */
export function greeting(hour: number, name: string, voice: GreetingVoice, pick: number): string {
  const lines = bandFor(hour)[voice]
  return fill(lines[Math.min(lines.length - 1, Math.floor(pick * lines.length))], name)
}
