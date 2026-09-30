/**
 * Home's greeting: a line for the hour, picked at random from a few, so
 * opening the app is a little different each time. Two voices to choose
 * between (2026-09-30): A is warm and plain, B is dry and playful.
 *
 * A line writes its name as `, {name}`, which drops out whole (comma
 * and all) when there is no name. Lines carry their own punctuation.
 */

export type GreetingVoice = 'a' | 'b'

type Band = {
  /** First hour of the band, 0 to 23. It runs until the next band starts. */
  from: number
  /** What the band is, for the preview and the tests: "1am". */
  label: string
  a: string[]
  b: string[]
}

export const bands: Band[] = [
  {
    from: 0,
    label: '12am',
    a: ['Up late, {name}?', 'Burning the midnight oil, {name}?', 'Still up, {name}?'],
    b: ['Midnight, {name}. Bold.', 'The books are still here, {name}.', 'Sleep is also on the syllabus, {name}.'],
  },
  {
    from: 1,
    label: '1am',
    a: ['Late night, {name}?', 'Quiet hour, {name}.', 'Long night ahead, {name}?'],
    b: ['It is 1am, {name}. We both know.', 'Nothing good happens after 1am, {name}. Except maybe this.', 'Night owl mode, {name}.'],
  },
  {
    from: 2,
    label: '2am',
    a: ['Still going, {name}?', 'Take it easy tonight, {name}.', 'Hanging in there, {name}?'],
    b: ['2am, {name}. Truly committed.', 'This is the good kind of problem, {name}. Probably.', 'The moon is off the clock, {name}.'],
  },
  {
    from: 3,
    label: '3am',
    a: ['Deep in the night, {name}.', 'Go easy on yourself, {name}.', 'Almost out the other side, {name}.'],
    b: ['3am, {name}. Hydrate, at least.', 'Your future self is watching, {name}.', 'The sun is thinking about it, {name}.'],
  },
  {
    from: 4,
    label: '4am',
    a: ['Early or late, {name}?', 'Before the sun, {name}.', 'The world is quiet, {name}.'],
    b: ['4am, {name}. Early bird or last owl?', 'The birds are not even up, {name}.', 'Either very early or very late, {name}.'],
  },
  {
    from: 5,
    label: '5am',
    a: ['Early start, {name}.', 'Up with the sun, {name}?', 'Fresh and quiet, {name}.'],
    b: ['5am, {name}. Respect.', 'Who let the morning person in, {name}?', 'Coffee first, {name}. Then books.'],
  },
  {
    from: 6,
    label: '6am',
    a: ['Good morning, {name}.', 'Morning, {name}. Early one.', 'A calm start, {name}.'],
    b: ['Rise and shine, {name}. Or just rise.', 'Morning, {name}. Coffee status?', 'Up before the problems, {name}.'],
  },
  {
    from: 7,
    label: '7am',
    a: ['Good morning, {name}.', 'Morning, {name}.', 'Fresh day, {name}.'],
    b: ['Morning, {name}. The problems slept in.', 'Good morning, {name}. Coffee first.', 'Rise and grind, {name}.'],
  },
  {
    from: 9,
    label: '9am',
    a: ['Good morning, {name}.', 'Morning, {name}. Ready when you are.', 'A good hour to start, {name}.'],
    b: ['Morning, {name}. Let us make it count.', 'Nine-ish, {name}. Peak productivity, allegedly.', 'Back at it, {name}.'],
  },
  {
    from: 11,
    label: '11am',
    a: ['Good morning, {name}.', 'Almost noon, {name}.', 'Mid-morning, {name}.'],
    b: ['Nearly noon, {name}. Lunch is coming.', 'Still technically morning, {name}.', 'Hello again, {name}.'],
  },
  {
    from: 12,
    label: '12pm',
    a: ['Good afternoon, {name}.', 'Noon, {name}. Have you eaten?', 'Midday, {name}.'],
    b: ['Lunch break, {name}? Or lunch and books?', 'Noon, {name}. Half the day, gone.', 'Eat something, {name}. Then this.'],
  },
  {
    from: 13,
    label: '1pm',
    a: ['Good afternoon, {name}.', 'Afternoon, {name}.', 'Easing into the afternoon, {name}.'],
    b: ['Post-lunch slump, {name}? We can work with that.', 'Afternoon, {name}. Stretch first.', 'The afternoon awaits, {name}.'],
  },
  {
    from: 15,
    label: '3pm',
    a: ['Good afternoon, {name}.', 'Afternoon, {name}. A steady stretch.', 'Halfway through, {name}.'],
    b: ['3pm, {name}. Snack o\'clock.', 'The afternoon dip, {name}. You have got this.', 'Still standing, {name}?'],
  },
  {
    from: 17,
    label: '5pm',
    a: ['Good evening, {name}.', 'Evening, {name}. Winding down?', 'The day is nearly done, {name}.'],
    b: ['5pm, {name}. One more push?', 'Evening, {name}. Dinner plans?', 'Golden hour, {name}.'],
  },
  {
    from: 19,
    label: '7pm',
    a: ['Good evening, {name}.', 'Evening, {name}.', 'A quiet evening, {name}.'],
    b: ['Evening, {name}. Prime homework hours.', 'Good evening, {name}. Snacks ready?', 'The evening shift begins, {name}.'],
  },
  {
    from: 21,
    label: '9pm',
    a: ['Good evening, {name}.', 'Late evening, {name}.', 'Settling in, {name}?'],
    b: ['Evening, {name}. The deadline hour approaches.', 'Still at it, {name}?', 'Night mode, {name}.'],
  },
  {
    from: 23,
    label: '11pm',
    a: ['Late one, {name}?', 'Almost midnight, {name}.', 'Winding down, {name}?'],
    b: ['11pm, {name}. Just one more problem.', 'Almost midnight, {name}. Suspicious.', 'Nearly tomorrow, {name}.'],
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
