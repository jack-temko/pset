/** "1 set", "12 sets": a count with its noun, thousands separated. */
export const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** Dollars as a student reads them: "$6.40", "$1,234.56". */
export const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
