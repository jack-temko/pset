/**
 * The small Markdown the repo's READMEs and view specs are written in:
 * headings, paragraphs, bullet and numbered lists (one level of nesting),
 * fenced code, tables, quotes, and `code`, **bold**, *italic* and links
 * inline. Anything else stays text. Written here because the app has no
 * Markdown dependency and these pages need no more than this.
 */
export type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'list'; ordered: boolean; items: { text: string; depth: number }[] }
  | { t: 'code'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'quote'; text: string };

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replaceAll('\\|', '|'));

const isRule = (line: string) =>
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);
const bullet = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

export function parseMarkdown(src: string): Block[] {
  const lines = src.replaceAll('\r\n', '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```'))
        body.push(lines[i++]);
      i++;
      blocks.push({ t: 'code', text: body.join('\n') });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ t: 'h', level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (
      line.trimStart().startsWith('|') &&
      i + 1 < lines.length &&
      isRule(lines[i + 1])
    ) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trimStart().startsWith('|'))
        rows.push(cells(lines[i++]));
      blocks.push({ t: 'table', head, rows });
      continue;
    }
    if (line.startsWith('>')) {
      const body: string[] = [];
      while (i < lines.length && lines[i].startsWith('>'))
        body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ t: 'quote', text: body.join(' ') });
      continue;
    }
    const b = bullet.exec(line);
    if (b) {
      const ordered = /\d/.test(b[2]);
      const items: { text: string; depth: number }[] = [];
      // A list item runs on through the indented lines under it.
      while (i < lines.length) {
        const m = bullet.exec(lines[i]);
        if (m) {
          items.push({ text: m[3], depth: m[1].length >= 2 ? 1 : 0 });
          i++;
        } else if (
          lines[i].trim() !== '' &&
          /^\s+\S/.test(lines[i]) &&
          items.length
        ) {
          items[items.length - 1].text += ' ' + lines[i].trim();
          i++;
        } else break;
      }
      blocks.push({ t: 'list', ordered, items });
      continue;
    }
    // A paragraph runs to the next blank line or the start of anything else.
    const body: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !bullet.test(lines[i]) &&
      !lines[i].startsWith('>') &&
      !(
        lines[i].trimStart().startsWith('|') &&
        i + 1 < lines.length &&
        isRule(lines[i + 1])
      )
    )
      body.push(lines[i++].trim());
    blocks.push({ t: 'p', text: body.join(' ') });
  }
  return blocks;
}

export type Span =
  | { k: 'text'; text: string }
  | { k: 'code'; text: string }
  | { k: 'strong'; text: string }
  | { k: 'em'; text: string }
  | { k: 'link'; text: string; href: string };

const inline =
  /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(src: string): Span[] {
  const spans: Span[] = [];
  let last = 0;
  for (const m of src.matchAll(inline)) {
    if (m.index > last)
      spans.push({ k: 'text', text: src.slice(last, m.index) });
    // Which alternative matched: the others' groups are undefined.
    const g: (string | undefined)[] = m;
    if (g[1] !== undefined) spans.push({ k: 'code', text: g[1] });
    else if (g[2] !== undefined) spans.push({ k: 'strong', text: g[2] });
    else if (g[3] !== undefined) spans.push({ k: 'em', text: g[3] });
    else spans.push({ k: 'link', text: m[4], href: m[5] });
    last = m.index + m[0].length;
  }
  if (last < src.length) spans.push({ k: 'text', text: src.slice(last) });
  return spans;
}
