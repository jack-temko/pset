export { cn } from "cn"

/** "1 homework set", "3 homework sets", "1,204 pages". */
export function plural(n: number, word: string) {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`
}
