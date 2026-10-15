/** How a job's spending reads: the model, the time, the tokens, the dollars.
 *  One place, so the line and the card agree and the edges are tested. */

/** The model as it reads on the card: the vendor prefix dropped
 *  ("deepseek-v4.1-flash"), the full slug left in the title. */
export function shortModel(model: string): string {
  const i = model.lastIndexOf('/');
  return i === -1 ? model : model.slice(i + 1);
}

/** The models' time, their call durations added up: one decimal under ten
 *  seconds ("2.1s"), whole seconds from ten ("14s"), "1m 03s" from a
 *  minute, "1h 02m" from an hour. Rounded once, to the second, then split,
 *  so 59.6 seconds is "1m 00s" and 9.97 is "10s", never "60s" or "10.0s". */
export function clock(ms: number): string {
  // In tenths of a second, as integers: 0.95 as a float formats as "0.9".
  if (ms < 9950) return `${(Math.round(ms / 100) / 10).toFixed(1)}s`;
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** Dollars: four decimals under one ("$0.0031"), two from one ("$1.24"),
 *  "$0.0000" for exactly nothing (a local model serving for free), and
 *  "<$0.0001" for a paid call too small for four decimals, which must not
 *  read as free. Absent, the provider not having said, is a dash: never a
 *  zero, which would say the call cost nothing rather than went uncounted. */
export function cost(dollars: number | undefined): string {
  if (dollars === undefined) return '–';
  if (dollars > 0 && dollars < 0.00005) return '<$0.0001';
  if (dollars < 1) {
    const fixed = dollars.toFixed(4);
    // 0.99996 rounds up to "1.0000": say it as a dollar.
    if (Number(fixed) < 1) return `$${fixed}`;
  }
  return `$${dollars.toFixed(2)}`;
}

/** Tokens, exact, with separators: the card is where precision lives. */
export function tokens(n: number | undefined): string {
  return n === undefined ? '–' : n.toLocaleString('en-US');
}

/** A figure that adds up only the calls that reported, when some didn't:
 *  a minimum, marked as one. A dash stays a dash. */
export function atLeast(text: string, partial: boolean): string {
  return partial && text !== '–' ? `≥ ${text}` : text;
}

/** The time of day a call was made, local, to the second: "14:02:11". The
 *  modal's calls are a day's work, so the date would only repeat. */
export function timeOfDay(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

/** One call's duration in seconds to the hundredth: "6.37s". The stages and
 *  totals round to a readable clock; a call is the precise one. */
export function callSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}
