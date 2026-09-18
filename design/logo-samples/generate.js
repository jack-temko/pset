// PSet logo-mark sample generator: defines mark concepts on a 32-grid,
// renders palette variants, composes comparison sheets.
const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

// ---------- OKLCH -> hex (Ottosson) ----------
function oklchToHex(L, C, H) {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  let bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  const g12 = (v) => {
    v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
    return Math.min(255, Math.max(0, Math.round(v * 255)))
  }
  return '#' + [g12(r), g12(g), g12(bb)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

const C = {
  blue: oklchToHex(0.45, 0.16, 263),      // primary, fountain-pen blue
  paper: oklchToHex(0.985, 0.005, 95),    // glyph on tile
  ink: oklchToHex(0.245, 0.012, 90),      // foreground
  card: oklchToHex(0.998, 0.003, 95),
  bg: oklchToHex(0.984, 0.005, 95),
  border: oklchToHex(0.905, 0.008, 95),
  sideInk: oklchToHex(0.235, 0.012, 90),  // sidebar tile
  sideFg: oklchToHex(0.9, 0.008, 95),
  sideBlue: oklchToHex(0.72, 0.12, 263),  // sidebar-primary
  ochre: oklchToHex(0.75, 0.14, 80),      // chart-3 ochre
  darkBg: oklchToHex(0.178, 0.008, 90),
}
console.log('palette:', C)

// Palettes: each provides tile color, glyph color, accent color.
const PALETTES = {
  tile:  { tile: C.blue, glyph: C.paper, accent: C.ochre },
  paper: { tile: C.card, glyph: C.ink, accent: C.blue, border: C.border },
  dark:  { tile: C.sideInk, glyph: C.sideFg, accent: C.sideBlue },
}

// ---------- mark concepts (32x32 grid) ----------
// p = { g: glyph color, a: accent color, t: tile color }
const MARKS = {
  folio: (p) => `
  <g fill="none" stroke="${p.glyph}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 10 C13.8 8.45 11.2 8.05 8.5 8.6 V21.6 C11.2 21.05 13.8 21.45 16 23"/>
    <path d="M16 10 C18.2 8.45 20.8 8.05 23.5 8.6 V21.6 C20.8 21.05 18.2 21.45 16 23"/>
  </g>`,

  'folio-spark': (p) => `
  <g fill="none" stroke="${p.glyph}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 11.2 C14 9.9 11.7 9.4 9.25 10 V21.5 C11.7 21 14 21.4 16 22.8"/>
    <path d="M16 11.2 C18 9.9 20.3 9.4 22.75 10 V21.5 C20.3 21 18 21.4 16 22.8"/>
    <path d="M16 11.2 V22.8"/>
  </g>
  <path d="M25.5 3 C25.83 5.05 26.7 5.92 28.75 6.25 C26.7 6.58 25.83 7.45 25.5 9.5 C25.17 7.45 24.3 6.58 22.25 6.25 C24.3 5.92 25.17 5.05 25.5 3 Z" fill="${p.glyph}"/>`,

  bookmark: (p) => `
  <path d="M10.5 6.75 H21.5 V25.25 L16 20.25 L10.5 25.25 Z"
        fill="none" stroke="${p.glyph}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,

  pdot: (p) => `
  <path d="M11.75 25.25 V7.75 H17.5 A5.25 5.25 0 0 1 17.5 18.25 H11.75"
        fill="none" stroke="${p.glyph}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="23.6" cy="24.4" r="2.35" fill="${p.accent}"/>`,

  'problem-set': (p) => `
  <g fill="none" stroke="${p.glyph}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19.25 6.25 H10.25 A2 2 0 0 0 8.25 8.25 V23.75 A2 2 0 0 0 10.25 25.75 H21 A2 2 0 0 0 23 23.75 V10 Z"/>
    <path d="M19.25 6.25 V8 A2 2 0 0 0 21.25 10 H23"/>
    <path d="M12 12.5 H17.75"/>
    <path d="M12 16 H14.75"/>
    <path d="M12.25 20 L14.75 22.5 L19.75 16.75"/>
  </g>`,

  flashcards: (p) => `
  <g fill="none" stroke="${p.glyph}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="12.25" y="6.25" width="13" height="16" rx="2"/>
    <rect x="6.75" y="9.75" width="13" height="16" rx="2" fill="${p.tile}"/>
    <path d="M9.9 18.5 L12.5 21.1 L17.3 15.5"/>
  </g>`,

  ink: (p) => `
  <path d="M16 6.25 C19.75 11.25 23.25 15.5 23.25 19.75 A7.25 7.25 0 0 1 8.75 19.75 C8.75 15.5 12.25 11.25 16 6.25 Z" fill="${p.glyph}"/>
  <circle cx="23.4" cy="9.2" r="1.7" fill="${p.glyph}"/>`,

  ask: (p) => `
  <g fill="none" stroke="${p.glyph}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6.25" y="13.25" width="13" height="12.75" rx="2"/>
    <path d="M9.5 17.75 H16"/>
    <path d="M9.5 21.5 H13"/>
  </g>
  <path d="M23.25 4.25 C23.8 7.55 25.45 9.2 28.75 9.75 C25.45 10.3 23.8 11.95 23.25 15.25 C22.7 11.95 21.05 10.3 17.75 9.75 C21.05 9.2 22.7 7.55 23.25 4.25 Z" fill="${p.glyph}"/>`,

  pencil: (p) => `
  <g transform="rotate(45 16 16)">
    <path d="M13.2 8.4 A2.8 2.8 0 0 1 18.8 8.4 V20.9 H13.2 Z" fill="${p.glyph}"/>
    <path d="M13.2 11.2 H18.8" stroke="${p.accent}" stroke-width="1.6" fill="none"/>
    <path d="M13.2 20.9 L16 26.3 L18.8 20.9 Z" fill="${p.glyph}"/>
    <path d="M14.6 23.2 L16 26.3 L17.4 23.2 Z" fill="${p.accent}"/>
  </g>`,

  quill: (p) => `
  <path d="M25.9 6.1 C17.7 6.8 11.8 11.2 9.5 17.6 C8.75 19.7 8.2 21.85 7.9 23.85 L6.35 25.65 L8.75 24.3 C10.85 23.95 13.1 23.35 15.25 22.5 C21.6 19.95 25.4 13.7 25.9 6.1 Z" fill="${p.glyph}"/>
  <path d="M22.3 9.3 C18.6 10.7 13.9 14.2 10.9 19.9" stroke="${p.accent}" stroke-width="1.5" stroke-linecap="round" fill="none"/>`,

  continuity: (p) => `
  <path d="M9.25 22.5 V9.5 A2 2 0 0 1 11.25 7.5 H15.5 A1 1 0 0 1 16.5 8.5 V23.5 A1 1 0 0 1 15.5 24.5 H11.25 A2 2 0 0 1 9.25 22.5 Z"
        fill="none" stroke="${p.glyph}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M23.75 22.5 V9.5 A2 2 0 0 0 21.75 7.5 H17.5 A1 1 0 0 0 16.5 8.5 V23.5 A1 1 0 0 0 17.5 24.5 H21.75 A2 2 0 0 0 23.75 22.5 Z"
        fill="${p.glyph}" fill-opacity="0.3" stroke="${p.glyph}" stroke-width="2" stroke-linejoin="round"/>`,
}

const NAMES = Object.keys(MARKS)

function tileSvg(mark, pal) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="${pal.tile}"${pal.border ? ` stroke="${pal.border}" stroke-width="1"` : ''}/>
  ${MARKS[mark](pal)}
</svg>`
}

function render(svg, width, outPath) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
  })
  fs.writeFileSync(outPath, r.render().asPng())
}

const OUT = '/home/jackt/dev/pset/design/logo-samples'
fs.mkdirSync(path.join(OUT, 'svg'), { recursive: true })
fs.mkdirSync('/tmp/iconwork/png', { recursive: true })

// ---------- contact sheet ----------
// rows: concepts; columns: [48 tile, 32 tile, 16 tile, paper 32, dark 32, dark 48 sidebar-strip]
const COLS = [
  { key: 'tile', size: 48 },
  { key: 'tile', size: 32 },
  { key: 'tile', size: 16 },
  { key: 'paper', size: 32 },
  { key: 'dark', size: 32 },
]
const PAD = 18, CELL_W = 64, ROW_H = 72, LABEL_W = 130, HEADER_H = 64, FOOTER_H = 40
const SHEET_BG = C.bg
const sheetW = LABEL_W + COLS.length * CELL_W + PAD * 2
const sheetH = HEADER_H + NAMES.length * ROW_H + FOOTER_H

function nested(mark, palKey, size, x, y) {
  const pal = PALETTES[palKey]
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="${pal.tile}"${pal.border ? ` stroke="${pal.border}" stroke-width="1"` : ''}/>
  ${MARKS[mark](pal)}
</svg>`
}

let sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" viewBox="0 0 ${sheetW} ${sheetH}" font-family="DejaVu Sans">
<rect width="${sheetW}" height="${sheetH}" fill="${SHEET_BG}"/>
<text x="${PAD}" y="30" font-size="17" font-weight="bold" fill="${C.ink}">PSet — mark samples</text>
<text x="${PAD}" y="48" font-size="10.5" fill="${C.ink}" opacity="0.55">tile 48 / 32 / 16 · paper 32 · dark sidebar 32</text>`
NAMES.forEach((name, i) => {
  const y = HEADER_H + i * ROW_H + (ROW_H - 48) / 2
  sheet += `<text x="${PAD}" y="${HEADER_H + i * ROW_H + ROW_H / 2 + 4}" font-size="11.5" fill="${C.ink}">${name}</text>`
  COLS.forEach((col, j) => {
    const x = LABEL_W + j * CELL_W + (CELL_W - col.size) / 2
    const cy = HEADER_H + i * ROW_H + (ROW_H - col.size) / 2
    sheet += nested(name, col.key, col.size, x, cy)
  })
})
sheet += `<text x="${PAD}" y="${sheetH - 14}" font-size="9.5" fill="${C.ink}" opacity="0.45">geometry: 32-grid, rx 7 tile · ink &amp; paper palette (oklch tokens converted)</text>`
sheet += '</svg>'
fs.writeFileSync(path.join(OUT, 'contact-sheet.svg'), sheet)
render(sheet, sheetW * 2, path.join(OUT, 'contact-sheet.png'))
render(sheet, sheetW * 2, '/tmp/iconwork/png/contact-sheet.png')

// ---------- detail sheet: each mark at 256 ----------
const D = 256, DGAP = 28
const dcols = 5, drows = Math.ceil(NAMES.length / dcols)
const dw = dcols * (D + DGAP) + DGAP
const dh = drows * (D + DGAP) + DGAP
let detail = `<svg xmlns="http://www.w3.org/2000/svg" width="${dw}" height="${dh}" viewBox="0 0 ${dw} ${dh}"><rect width="${dw}" height="${dh}" fill="${C.bg}"/>`
NAMES.forEach((name, i) => {
  const cx = DGAP + (i % dcols) * (D + DGAP)
  const cy = DGAP + Math.floor(i / dcols) * (D + DGAP)
  detail += `<svg x="${cx}" y="${cy}" width="${D}" height="${D}" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${C.blue}"/>${MARKS[name](PALETTES.tile)}</svg>`
})
detail += '</svg>'
render(detail, dw, '/tmp/iconwork/png/detail-sheet.png')

// ---------- deliverable SVGs: all palettes per mark ----------
NAMES.forEach((name) => {
  fs.writeFileSync(path.join(OUT, 'svg', `${name}.svg`), tileSvg(name, PALETTES.tile))
  fs.writeFileSync(path.join(OUT, 'svg', `${name}-paper.svg`), tileSvg(name, PALETTES.paper))
  fs.writeFileSync(path.join(OUT, 'svg', `${name}-dark.svg`), tileSvg(name, PALETTES.dark))
})

// ---------- sidebar context preview (logo lives on the dark ink sidebar) ----------
const sidebarW = 240, rowH2 = 76, pad2 = 20
const headH = 78, footH = 44
const sh = headH + NAMES.length * rowH2 + footH
let ctx = `<svg xmlns="http://www.w3.org/2000/svg" width="${sidebarW}" height="${sh}" viewBox="0 0 ${sidebarW} ${sh}" font-family="DejaVu Sans">
<rect width="${sidebarW}" height="${sh}" fill="${C.sideInk}"/>
<rect x="0" y="${sh - footH}" width="${sidebarW}" height="${footH}" fill="${C.darkBg}"/>
<line x1="0" y1="${headH}" x2="${sidebarW}" y2="${headH}" stroke="#ffffff" stroke-opacity="0.08"/>
${nested('folio', 'dark', 28, pad2, 25)}
<text x="${pad2 + 40}" y="37" font-size="14" font-weight="bold" fill="${C.sideFg}">PSet</text>
<text x="${pad2 + 40}" y="52" font-size="10" fill="${C.sideFg}" opacity="0.55">Study engine</text>`
NAMES.forEach((name, i) => {
  const y = headH + i * rowH2
  ctx += nested(name, 'dark', 28, pad2, y + (rowH2 - 28) / 2)
  ctx += `<text x="${pad2 + 40}" y="${y + rowH2 / 2 - 3}" font-size="12.5" font-weight="bold" fill="${C.sideFg}">PSet</text>`
  ctx += `<text x="${pad2 + 40}" y="${y + rowH2 / 2 + 13}" font-size="9.5" fill="${C.sideFg}" opacity="0.55">${name}</text>`
})
ctx += `<text x="${pad2}" y="${sh - footH + 26}" font-size="10" fill="${C.sideFg}" opacity="0.45">v0.1.0 · local</text>`
ctx += '</svg>'
fs.writeFileSync(path.join(OUT, 'sidebar-preview.svg'), ctx)
render(ctx, sidebarW * 2, path.join(OUT, 'sidebar-preview.png'))

console.log('handoff written to', OUT)
