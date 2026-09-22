import { chromium } from 'playwright'
const out = '/tmp/claude-1000/-home-jackt-dev-pset/4c9368b3-18e7-46ae-bfd2-e64a415b530c/scratchpad'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 1900 } })
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' })

await p.evaluate(() => {
  const cover = (hue, author, title, veil = '', overlay = '') => `
    <div class='relative aspect-3/4 w-full overflow-hidden rounded-md border border-black/15 shadow-[0_1px_2px_rgb(0_0_0/0.12)]'>
      <div class='absolute inset-0' style='${veil ? veil + ';transform:scale(1.06)' : ''}'>
        <div class='absolute inset-0' style='background: linear-gradient(160deg, var(--cover-${hue}), var(--cover-${hue}-to))'></div>
        <div class='absolute inset-y-0 left-0 w-2' style='background: var(--cover-${hue}-spine)'></div>
        <div class='absolute inset-y-0 left-2 w-px bg-white/20'></div>
        <div class='absolute inset-0 bg-[radial-gradient(130%_90%_at_18%_6%,rgb(255_255_255/0.13),transparent_55%)]'></div>
        <div class='absolute inset-y-2 right-[3px] w-1 rounded-full bg-white/20'></div>
        <div class='absolute inset-2 left-3 flex flex-col rounded-sm border border-white/15 p-3'>
          <div class='truncate text-xs tracking-[0.1em] text-white/75 uppercase'>${author}</div>
          <div class='mt-2 line-clamp-3 font-heading text-base leading-snug font-medium' style='color:oklch(0.98 0.005 95)'>${title}</div>
          <div class='mt-auto'><div class='mb-2 h-px w-8 bg-white/30'></div>
          <div class='text-xs tracking-[0.22em] text-white/55 uppercase'>PSet</div></div>
        </div>
      </div>
      ${overlay}
    </div>`

  const centre = (inner) => `<div class='absolute inset-0 flex items-center justify-center p-4'>
      <div class='w-full space-y-2 rounded-md border p-3 text-center shadow-floating' style='background:var(--card)'>${inner}</div>
    </div>`
  const bar = `<div class='mt-1 h-1 w-full overflow-hidden rounded-full' style='background:var(--muted)'><div class='h-full rounded-full' style='width:45%;background:var(--primary)'></div></div>`

  const set = (veil) => `
    <div class='grid grid-cols-4 items-start gap-6'>
      ${cover('violet','Michael Sipser','Introduction to the Theory of Computation', veil,
        centre(`<div class='text-sm font-medium' style='color:var(--warning)'>Read the pages</div>
                <div class='font-mono text-xs tabular-nums' style='color:var(--muted-foreground)'>140 of 312</div>${bar}`))}
      ${cover('violet','','Griffiths Introduction To Electrodynamics', veil,
        centre(`<div class='text-sm font-medium' style='color:var(--muted-foreground)'>Queued</div>`))}
      ${cover('rose','Clayden and Greeves','Organic Chemistry', veil,
        centre(`<div class='text-sm font-medium' style='color:var(--destructive)'>This PDF can't be read</div>
                <div class='text-xs' style='color:var(--muted-foreground)'>pset couldn't open it.</div>`))}
      ${cover('indigo','Sheldon Axler','Linear Algebra Done Right')}
    </div>`

  const label = (l, n, note) => `<div class='space-y-3'><div class='flex items-baseline gap-3'>
      <span class='font-mono text-xs' style='color:var(--muted-foreground)'>${l}</span>
      <span class='font-heading text-xl'>${n}</span>
      <span class='text-xs' style='color:var(--muted-foreground)'>${note}</span></div>`

  const shell = document.querySelector('main') || document.body
  shell.innerHTML = `<div class='mx-auto max-w-layout-page space-y-10 p-page'>
    ${label('1','The Veil’s own numbers','blur 6px · opacity 45%')}${set('filter:blur(6px);opacity:0.45')}</div>
    ${label('2','Gentler','blur 4px · opacity 60%')}${set('filter:blur(4px);opacity:0.6')}</div>
    ${label('3','Stronger','blur 10px · opacity 32%')}${set('filter:blur(10px);opacity:0.32')}</div>
    ${label('4','Blurred, barely faded','blur 8px · opacity 80%')}${set('filter:blur(8px);opacity:0.8')}</div>
  </div>`
})
await p.waitForTimeout(600)
await p.screenshot({ path: out + '/veil-strength2.png', fullPage: true })
await b.close()
