/** "7 materials", "1 material", "No materials". */
export function count(n: number, one: string, many: string): string {
  if (n === 0) return `No ${many}`;
  return `${String(n)} ${n === 1 ? one : many}`;
}
