#!/usr/bin/env node
/**
 * Builds the workboard: bundles the real components, inlines them with the
 * app's compiled CSS into one `.dc.html` artboard per entry below, and writes
 * the canvas manifest.
 *
 * The canvas runs the app's own code, so an artboard is never a copy of a
 * component that can drift — it IS the component. Run `npm run build` first:
 * the stylesheet comes from that output.
 *
 *   npm run workboard
 */
import { build } from 'esbuild'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const web = root
const out = join(root, 'workboard/build')

/** The side panel's width, in canvas px. A frame is its stage plus this, so
 *  the stage stays exactly the size the design is meant to be seen at. */
const PANEL = 200

/**
 * Every artboard: what it mounts, the size the stage should be, and its
 * states.
 *
 * **States earn their place.** One exists to reach something you otherwise
 * can't see — the other theme, a loading or error state, an empty
 * collection — or to play an animation. A variant you can simply lay out
 * beside its siblings is a specimen, not a state: give it one artboard that
 * shows them all at once.
 */
const ARTBOARDS = [
  {
    file: 'Main',
    component: 'Home',
    stage: { w: 1280, h: 820 },
    at: { x: 0, y: 0 },
    states: [
      { name: 'Paper', theme: 'light' },
      { name: 'Night study', theme: 'dark' },
    ],
  },
  {
    file: 'TopBar',
    component: 'TopBar',
    stage: { w: 1280, h: 140 },
    at: { x: 0, y: 940 },
    states: [
      { name: 'Paper', theme: 'light' },
      { name: 'Night study', theme: 'dark' },
    ],
  },
  {
    file: 'Buttons',
    component: 'ButtonSpecimen',
    stage: { w: 680, h: 220 },
    at: { x: 0, y: 1340 },
    states: [
      { name: 'Paper', theme: 'light' },
      { name: 'Night study', theme: 'dark' },
    ],
  },
  {
    file: 'Brand',
    component: 'BrandLockup',
    stage: { w: 320, h: 140 },
    at: { x: 960, y: 1340 },
    states: [
      { name: 'Paper', theme: 'light' },
      { name: 'Night study', theme: 'dark' },
    ],
  },
]

/** A literal `</script` inside the bundle would close the artboard's own
 *  script tag; inside JS source it is only ever in a string. */
const safe = (s) => s.split('</script').join('<\\/script')

async function bundleApp() {
  const result = await build({
    entryPoints: [join(web, 'workboard/entry.tsx')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    write: false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: { '@': join(web, 'src') },
    loader: { '.svg': 'dataurl' },
  })
  return result.outputFiles[0].text
}

/** The app's compiled stylesheet, minus the @font-face blocks: their URLs are
 *  relative to the app's own origin and would 404 in the artboard sandbox.
 *  Google Fonts stands in, and the family variables are remapped to match. */
async function appCss() {
  const dir = join(web, 'dist/assets')
  const files = await readdir(dir)
  const css = files.find((f) => f.startsWith('index-') && f.endsWith('.css'))
  if (!css) throw new Error('no built stylesheet in dist/assets — run `npm run build` first')
  const text = await readFile(join(dir, css), 'utf8')
  return text.replace(/@font-face\s*\{[^}]*\}/g, '')
}

const FONTS =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap">'

function artboard({ spec, bundle, css }) {
  const states = spec.states.map((s) => ({ theme: 'light', props: {}, ...s }))
  const names = states.map((s) => s.name)
  const many = states.length > 1

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  ${FONTS}
  <style>${safe(css)}</style>
  <style>
    /* Google Fonts serves these under their plain names; the app's tokens
       name the Fontsource variable faces. Same designs, different names. */
    :root {
      --font-heading: "Newsreader", ui-serif, Georgia, serif;
      --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
      --font-mono: "JetBrains Mono", ui-monospace, monospace;
    }
    html, body { height: 100%; }
    .wb { display: flex; height: 100%; align-items: stretch; }
    .wb-stage { flex: 0 0 ${spec.stage.w}px; width: ${spec.stage.w}px; overflow: hidden; }
    /* Workboard chrome — deliberately not the product's type or color, so it
       is never mistaken for the design under test. */
    .wb-panel { flex: 0 0 ${PANEL}px; width: ${PANEL}px; display: flex; flex-direction: column; gap: 10px;
      padding: 12px; background: #17171a; color: #e7e7ea; border-left: 1px solid #2a2a30;
      font: 500 12px/1.4 ui-sans-serif, system-ui, sans-serif; }
    .wb-name { font-size: 13px; font-weight: 600; }
    .wb-label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #8b8b95; }
    .wb-panel button { display: block; width: 100%; text-align: left; height: 26px; padding: 0 8px;
      border-radius: 4px; border: 1px solid #33333c; background: #23232a; color: #e7e7ea;
      font: inherit; cursor: pointer; }
    .wb-panel button[data-on="1"] { background: #e7e7ea; color: #17171a; border-color: #e7e7ea; }
    /* Directly under the states it plays through, not pinned to the floor of
       a panel that can be 800px tall. */
    .wb-play { margin-top: 4px; }
    .wb-hint { color: #6f6f79; font-size: 11px; font-weight: 400; }
  </style>
</helmet>
<div class="wb">
  <div class="wb-stage" ref="{{stageRef}}"></div>
  <div class="wb-panel">
    <div class="wb-name">${spec.component}</div>
    <sc-if value="{{many}}" hint-placeholder-val="{{true}}">
      <div class="wb-label">State</div>
      <sc-for list="{{stateButtons}}" as="s" hint-placeholder-count="2">
        <button data-on="{{s.on}}" onClick="{{s.pick}}">{{s.name}}</button>
      </sc-for>
      <button class="wb-play" onClick="{{togglePlay}}">{{playLabel}}</button>
    </sc-if>
    <sc-if value="{{one}}" hint-placeholder-val="{{false}}">
      <div class="wb-hint">A specimen — nothing to step through.</div>
    </sc-if>
  </div>
</div>
</x-dc>
<script data-dc-script data-props='{
  "state": {"editor": "enum", "default": ${JSON.stringify(names[0])}, "options": ${JSON.stringify(names)}, "section": "Workboard"},
  "stepMs": {"editor": "range", "default": 1200, "min": 300, "max": 4000, "unit": "ms", "section": "Workboard"}
}'>
${safe(bundle)}

var WB_STATES = ${JSON.stringify(states)};

class Component extends DCLogic {
  componentDidMount() { this.paint(); }
  componentDidUpdate() { this.paint(); }
  componentWillUnmount() { this.stop(); }

  current() {
    var name = this.state && this.state.name ? this.state.name : (this.props.state || WB_STATES[0].name);
    for (var i = 0; i < WB_STATES.length; i++) if (WB_STATES[i].name === name) return WB_STATES[i];
    return WB_STATES[0];
  }

  paint() {
    if (!this.stage) return;
    var s = this.current();
    try {
      window.PSetUI.mount(this.stage, { component: ${JSON.stringify(spec.component)}, props: s.props, theme: s.theme });
    } catch (e) {
      this.stage.textContent = 'workboard: ' + (e && e.message);
    }
  }

  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  togglePlay() {
    if (this.timer) { this.stop(); this.setState({ playing: false }); return; }
    var step = this.props.stepMs || 1200;
    this.timer = setInterval(() => {
      var names = WB_STATES.map(function (s) { return s.name; });
      var i = names.indexOf(this.current().name);
      this.setState({ name: names[(i + 1) % names.length] });
    }, step);
    this.setState({ playing: true });
  }

  renderVals() {
    var currentName = this.current().name;
    return {
      many: ${many},
      one: ${!many},
      stageRef: (el) => { if (el && el !== this.stage) { this.stage = el; this.paint(); } },
      playLabel: this.state && this.state.playing ? '\\u25A0 Stop' : '\\u25B6 Play',
      togglePlay: () => this.togglePlay(),
      stateButtons: WB_STATES.map((s) => ({
        name: s.name,
        on: s.name === currentName ? '1' : '0',
        pick: () => { this.stop(); this.setState({ name: s.name, playing: false }); },
      })),
    };
  }
}
</script>
</body>
</html>
`
}

const bundle = await bundleApp()
const css = await appCss()
await mkdir(out, { recursive: true })

for (const spec of ARTBOARDS) {
  await writeFile(join(out, `${spec.file}.dc.html`), artboard({ spec, bundle, css }), 'utf8')
}

const canvas = {
  artboards: ARTBOARDS.map((s) => ({
    file: `${s.file}.dc.html`,
    x: s.at.x,
    y: s.at.y,
    w: s.stage.w + PANEL,
    h: Math.max(s.stage.h, 240),
  })),
  annotations: [
    {
      id: 'note-live',
      x: 0,
      y: -150,
      w: 560,
      text: 'These artboards run the app’s real components, bundled from web/src — not copies of them.\nThe panel on the right of each one switches state and plays through them.\nRebuild after changing a component: npm run workboard',
    },
  ],
  launch: { view: 'canvas' },
}
await writeFile(join(out, 'canvas.json'), JSON.stringify(canvas, null, 2), 'utf8')

const kb = (s) => `${Math.round(s.length / 1024)} KB`
console.log(
  `workboard: ${ARTBOARDS.length} artboards — bundle ${kb(bundle)}, css ${kb(css)}, each artboard ~${kb(bundle + css)}`,
)
console.log(`written to ${out}`)
