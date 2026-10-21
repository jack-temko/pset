import { addDays, dayKey } from '@/units/heatmap/day';
import type { StudyDay } from '@/units/heatmap';

/** The fixed Tuesday the Home samples count from (noon is for the greeting). */
export const SAMPLE_TODAY = new Date(2026, 9, 13);

export const SAMPLE_COURSES = [
  'Circuits I',
  'Signals and systems',
  'Thermodynamics',
  'Differential equations',
  'Linear algebra',
] as const;

/** A small seeded random, so the sample is the same on every visit. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A year (371 days) of study ending on `SAMPLE_TODAY`, for a student with
 *  five courses: gaps, lighter weekends, mostly under an hour and now and then
 *  a 3 h day. A late night is already counted on the day before, as the 4am
 *  rule does, with the questions done, the sets finished and the questions left each
 *  day. */
export function sampleStudy(): StudyDay[] {
  const rand = seeded(2026);
  // Apart from `rand`, so the days and their minutes stay as they were.
  const extra = seeded(7);
  // The questions still to do, as of each day: new work arrives now and
  // then and working it off brings the number down, a sawtooth.
  const arrivals = seeded(11);
  let left = 8;
  const out: StudyDay[] = [];
  for (let back = 370; back >= 0; back--) {
    const date = addDays(SAMPLE_TODAY, -back);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    if (back % 5 === 3 || arrivals() < 0.08)
      left += 8 + Math.floor(arrivals() * 8);
    if (rand() < (weekend ? 0.55 : 0.25) && back > 1) {
      out.push({
        date: dayKey(date),
        courses: [],
        questions: 0,
        sets: 0,
        left,
      });
      continue;
    }
    // Minutes: usually 15 to 75, rarely 2.5 to 3.5 hours.
    const long = rand() < 0.07;
    let minutes = long ? 150 + rand() * 60 : 15 + rand() * 60;
    if (weekend) minutes *= 0.7;
    const picks = 1 + Math.floor(rand() * (long ? 3 : 2));
    const start = Math.floor(rand() * SAMPLE_COURSES.length);
    const courses = Array.from({ length: picks }, (_, i) => ({
      course: SAMPLE_COURSES[(start + i) % SAMPLE_COURSES.length],
      minutes: Math.max(5, Math.round(minutes / picks / 5) * 5),
    }));
    const total = courses.reduce((n, c) => n + c.minutes, 0);
    const questions = Math.max(
      1,
      Math.round((total / 6) * (0.6 + extra() * 0.8)),
    );
    left = Math.max(0, left - Math.round(questions * 0.6));
    out.push({
      date: dayKey(date),
      courses,
      questions,
      sets: extra() < 0.1 ? 1 : 0,
      left,
    });
  }
  return out;
}
