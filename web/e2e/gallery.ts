import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { StateResult, Theme } from './types.ts'

export interface GalleryMeta {
  runId: string
  mode: string
  themes: Theme[]
  filters: string[]
  watch: boolean
  createdAt: string
}

interface GalleryData {
  meta: GalleryMeta
  results: StateResult[]
}

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.5 system-ui, sans-serif; color: #1c1c1c; background: #fafafa; }
.layout { display: flex; min-height: 100vh; }
aside { width: 280px; flex-shrink: 0; border-right: 1px solid #e4e4e4; padding: 16px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
main { flex: 1; padding: 24px 32px 64px; min-width: 0; }
h1 { font-size: 18px; margin: 0 0 4px; }
.sub { color: #666; font-size: 12px; margin-bottom: 16px; }
.switch { display: flex; margin-bottom: 12px; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; }
.switch button { flex: 1; padding: 5px 0; font: inherit; font-size: 12px; border: 0; background: #fff; cursor: pointer; color: #555; }
.switch button + button { border-left: 1px solid #ccc; }
.switch button.active { background: #1c1c1c; color: #fff; }
#filter { width: 100%; padding: 7px 10px; border: 1px solid #ccc; border-radius: 6px; font: inherit; margin-bottom: 12px; }
.navlink { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 4px; color: #1c1c1c; text-decoration: none; font-size: 13px; }
.navlink:hover { background: #eee; }
.navlink .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot.ok { background: #2e9e44; } .dot.fail { background: #d43c3c; }
section.state { margin-bottom: 40px; }
section.state h2 { font-size: 16px; margin: 0; }
.note { color: #555; margin: 4px 0 10px; max-width: 70ch; }
.chips { margin-bottom: 14px; }
.chip { display: inline-block; background: #ececec; border-radius: 999px; padding: 2px 10px; font-size: 11px; margin-right: 6px; font-family: ui-monospace, monospace; }
.themerow { margin-bottom: 16px; }
.themerow h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #888; margin: 0 0 6px; }
body.theme-light .themerow[data-theme="dark"] { display: none; }
body.theme-dark .themerow[data-theme="light"] { display: none; }
.shots { display: flex; gap: 16px; flex-wrap: wrap; }
.shots figure { margin: 0; flex: 1 1 420px; min-width: 0; }
.shots img { width: 100%; border: 1px solid #d6d6d6; border-radius: 6px; display: block; }
.shots figcaption { font-size: 11px; color: #777; margin-top: 4px; font-family: ui-monospace, monospace; }
.failbox { border: 1px solid #e2b0b0; background: #fdf1f1; border-radius: 6px; padding: 12px 14px; margin-bottom: 12px; }
.failbox pre { white-space: pre-wrap; font-size: 12px; color: #7a2020; margin: 6px 0 0; }
.consol { margin-top: 8px; font-size: 12px; color: #8a6d1f; }
.hidden { display: none; }
`

const CLIENT = `
const data = JSON.parse(document.getElementById('data').textContent);
const byState = new Map();
for (const r of data.results) {
  if (!byState.has(r.stateId)) byState.set(r.stateId, []);
  byState.get(r.stateId).push(r);
}
const nav = document.getElementById('nav');
const main = document.getElementById('main');
const m = data.meta;
let current = 'light';
if (!m.themes.includes('light')) current = m.themes[0];

const h1 = document.createElement('h1');
h1.textContent = 'Visual gallery: ' + m.mode + ' mode';
nav.appendChild(h1);
const sub = document.createElement('div');
sub.className = 'sub';
sub.textContent = [m.runId, m.filters.length ? 'filter: ' + m.filters.join(' ') : '', m.watch ? 'watch' : ''].filter(Boolean).join(' | ');
nav.appendChild(sub);

const sw = document.createElement('div');
sw.className = 'switch';
const options = m.themes.length > 1 ? [...m.themes, 'both'] : m.themes;
for (const t of options) {
  const b = document.createElement('button');
  b.textContent = t; b.dataset.t = t;
  b.addEventListener('click', () => setTheme(t));
  sw.appendChild(b);
}
nav.appendChild(sw);

const filter = document.createElement('input');
filter.id = 'filter'; filter.placeholder = 'Filter states...';
nav.appendChild(filter);
const list = document.createElement('div');
nav.appendChild(list);

for (const [stateId, rs] of byState) {
  const sec = document.createElement('section');
  sec.className = 'state'; sec.id = 's-' + CSS.escape(stateId);
  sec.dataset.needle = (stateId + ' ' + rs[0].title + ' ' + rs[0].note + ' ' + rs[0].tags.join(' ')).toLowerCase();
  const h2 = document.createElement('h2');
  const a = document.createElement('a'); a.href = '#s-' + CSS.escape(stateId); a.textContent = rs[0].title; a.style.color = 'inherit';
  h2.appendChild(a); sec.appendChild(h2);
  const idline = document.createElement('div'); idline.className = 'note';
  idline.textContent = stateId; sec.appendChild(idline);
  const note = document.createElement('p'); note.className = 'note'; note.textContent = rs[0].note; sec.appendChild(note);
  const chips = document.createElement('div'); chips.className = 'chips';
  const chipData = [['seed', rs[0].seed], ['modes', rs[0].modes.join(',')]];
  if (rs[0].tags.length) chipData.push(['tags', rs[0].tags.join(',')]);
  if (rs[0].network) chipData.push(['network', JSON.stringify(rs[0].network)]);
  for (const [k, v] of chipData) {
    const c = document.createElement('span'); c.className = 'chip'; c.textContent = k + ': ' + v; chips.appendChild(c);
  }
  sec.appendChild(chips);
  for (const r of rs) {
    const row = document.createElement('div'); row.className = 'themerow'; row.dataset.theme = r.theme;
    const h3 = document.createElement('h3'); h3.textContent = r.theme; row.appendChild(h3);
    if (r.error) {
      const box = document.createElement('div'); box.className = 'failbox';
      box.textContent = 'Failed: ' + r.error;
      if (r.consoleErrors.length) {
        const c = document.createElement('div'); c.className = 'consol';
        c.textContent = 'console: ' + r.consoleErrors.join(' | ');
        box.appendChild(c);
      }
      row.appendChild(box);
    } else if (r.consoleErrors.length) {
      const c = document.createElement('div'); c.className = 'consol';
      c.textContent = 'console errors: ' + r.consoleErrors.join(' | ');
      row.appendChild(c);
    }
    const shots = document.createElement('div'); shots.className = 'shots';
    for (const shot of r.shots) {
      const fig = document.createElement('figure');
      const img = document.createElement('img'); img.src = 'png/' + shot.file; img.alt = stateId + ' ' + shot.name + ' ' + r.theme; img.loading = 'lazy';
      const cap = document.createElement('figcaption'); cap.textContent = shot.name;
      fig.appendChild(img); fig.appendChild(cap); shots.appendChild(fig);
    }
    row.appendChild(shots); sec.appendChild(row);
  }
  main.appendChild(sec);

  const link = document.createElement('a');
  link.className = 'navlink'; link.href = '#s-' + CSS.escape(stateId);
  link._rs = rs;
  const dot = document.createElement('span');
  link.appendChild(dot);
  link.appendChild(document.createTextNode(stateId));
  list.appendChild(link);
}

function setTheme(t) {
  current = t;
  document.body.className = t === 'both' ? '' : 'theme-' + t;
  for (const b of sw.querySelectorAll('button')) b.classList.toggle('active', b.dataset.t === t);
  for (const link of list.querySelectorAll('.navlink')) {
    const rs = current === 'both' ? link._rs : link._rs.filter((r) => r.theme === current);
    const dot = link.firstChild;
    dot.className = 'dot ' + (rs.some((r) => r.error) ? 'fail' : 'ok');
  }
}
setTheme(current);

filter.addEventListener('input', () => {
  const q = filter.value.trim().toLowerCase();
  for (const sec of main.querySelectorAll('section.state')) {
    sec.classList.toggle('hidden', q !== '' && !sec.dataset.needle.includes(q));
  }
  for (const link of list.querySelectorAll('.navlink')) {
    const sec = document.getElementById(link.getAttribute('href').slice(1));
    link.classList.toggle('hidden', sec.classList.contains('hidden'));
  }
});
`

export async function writeGallery(runDir: string, meta: GalleryMeta, results: StateResult[]): Promise<string> {
  const payload = JSON.stringify({ meta, results } satisfies GalleryData).replace(/</g, '\\u003c')
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PSet visual gallery, ${meta.runId}</title>
<style>${CSS}</style>
</head>
<body>
<div class="layout">
<aside id="nav"></aside>
<main id="main"></main>
</div>
<script id="data" type="application/json">${payload}</script>
<script>${CLIENT}</script>
</body>
</html>
`
  const file = join(runDir, 'gallery.html')
  await mkdir(runDir, { recursive: true })
  return writeFile(file, html).then(() => file)
}
