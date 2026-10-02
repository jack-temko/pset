/**
 * Samples for what a view loads by URL: a figure crop, a page scan, the
 * worksheet. Drawn as SVG so they are crisp at any size and follow no
 * theme (a scan is paper whatever the app's ground is).
 */
const svg = (w: number, h: number, body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="serif">${body}</svg>`,
  )}`

/** A circuit-ish figure crop with its label. */
export function sampleFigure(label: string) {
  return svg(
    480,
    220,
    `<rect width="480" height="220" fill="#fbfaf7"/>
     <g fill="none" stroke="#2b2b2b" stroke-width="2">
       <path d="M60 60H160L180 40L200 80L220 40L240 80L260 60H360V160H60Z"/>
       <circle cx="60" cy="110" r="16" fill="#fbfaf7"/>
     </g>
     <text x="60" y="114" font-size="14" text-anchor="middle" fill="#2b2b2b">+</text>
     <text x="240" y="30" font-size="14" text-anchor="middle" fill="#2b2b2b">4 Ω</text>
     <text x="380" y="114" font-size="14" fill="#2b2b2b">2 A</text>
     <text x="240" y="205" font-size="13" text-anchor="middle" fill="#6b6b6b">${label.replace(/[<&]/g, '')}</text>`,
  )
}

/** A page scan: ruled lines standing in for text. */
export function samplePage(page: number) {
  const lines = Array.from({ length: 24 }, (_, i) => {
    const w = 380 - ((i * 37 + page * 11) % 90)
    return `<rect x="60" y="${80 + i * 22}" width="${w}" height="6" rx="3" fill="#cfcac0"/>`
  }).join('')
  return svg(
    500,
    650,
    `<rect width="500" height="650" fill="#fbfaf7"/><text x="250" y="48" font-size="16" text-anchor="middle" fill="#6b6b6b">${page}</text>${lines}`,
  )
}

let worksheet: string | undefined
/** The worksheet's stand-in: a page saying so, since a real one is
 *  drawn by the server from a real book. */
function sampleWorksheet() {
  worksheet ??= URL.createObjectURL(
    new Blob(
      ['<!doctype html><meta charset="utf-8"><title>Worksheet (sample)</title><body style="font:17px Georgia,serif;margin:4rem"><h1>Worksheet</h1><p>A sample. The real one is printed by the server, with the statements and figures of the set and room to work.</p>'],
      { type: 'text/html' },
    ),
  )
  return worksheet
}

/** Maps an API URL an `<img>` or a new tab would load to a sample. */
export function assetUrl(path: string): string {
  let m = /\/api\/questions\/[^/]+\/figures\/(\d+)/.exec(path)
  if (m) return sampleFigure(`Figure ${Number(m[1]) + 1}`)
  m = /\/api\/books\/[^/]+\/pages\/(\d+)\/image/.exec(path)
  if (m) return samplePage(Number(m[1]))
  if (/\/api\/homework\/[^/]+\/worksheet/.test(path)) return sampleWorksheet()
  return 'data:,'
}
