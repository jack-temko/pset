/**
 * Home's greeting: a line for the hour, picked at random from a few, so
 * opening the app is a little different each time. Seven
 * stretches of the day, a few short lines each: mostly warm, some playful,
 * some encouraging (picked by Jack, 2026-09-30).
 *
 * A line writes its name as `, {name}`, which drops out whole (comma
 * and all) when there is no name. Lines carry their own punctuation.
 */

type Band = {
  /** First hour of the band, 0 to 23. It runs until the next band starts. */
  from: number
  /** What the band is, for the preview and the tests: "12am to 2am". */
  label: string
  lines: string[]
}

export const bands: Band[] = [
  {
    from: 0,
    label: '12am to 2am',
    lines: ['Up late, {name}?', 'Sleep can wait, {name}.', 'Almost there, {name}.'],
  },
  {
    from: 3,
    label: '3am to 5am',
    lines: ['Early start, {name}.', 'Coffee first, {name}.', 'Small steps count, {name}.'],
  },
  {
    from: 6,
    label: '6am to 10am',
    lines: ['Good morning, {name}.', 'Rise and shine, {name}.', 'Ready when you are, {name}.'],
  },
  {
    from: 11,
    label: '11am to 1pm',
    lines: ['Good to see you, {name}.', 'Noon, {name}. Snacks?', 'Good pace, {name}.'],
  },
  {
    from: 14,
    label: '2pm to 4pm',
    lines: ['Steady on, {name}.', "Snack o'clock, {name}?", 'Stay with it, {name}.'],
  },
  {
    from: 17,
    label: '5pm to 8pm',
    lines: ['Good evening, {name}.', 'Welcome back, {name}.', 'Dinner yet, {name}?'],
  },
  {
    from: 21,
    label: '9pm to 11pm',
    lines: ['Late one, {name}?', 'Winding down, {name}?', 'Still at it, {name}?', 'Rest is progress, {name}.'],
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
export function greeting(hour: number, name: string, pick: number): string {
  const { lines } = bandFor(hour)
  return fill(lines[Math.min(lines.length - 1, Math.floor(pick * lines.length))], name)
}
