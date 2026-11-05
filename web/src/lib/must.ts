/** The value, or a thrown error naming what was missing: for what the code
 *  around it has already made sure of (a mounted ref, a fixture's element),
 *  where a missing value is a bug and not a case to handle. */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`${what} is missing`);
  }
  return value;
}
