/* Console front-end: plain DOM, no framework. Talks to /__control/* and
 * keeps the iframe, rules, and run buttons in sync. */

const $ = (s) => document.querySelector(s)
const api = (path, body) =>
  fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(
    async (r) => {
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || String(r.status))
      return j
    },
  )

let states = []
let stagedId = null
let shotsByState = {}
let busy = false
let poll = null
let swReg = null
const lb = { shots: [], i: 0 }

const status = (text, err = false) => {
  const el = $('#status')
  el.textContent = text
  el.classList.toggle('err', err)
}

const refreshButtons = () => {
  for (const b of document.querySelectorAll('.row button')) b.disabled = busy
  $('#rebuild').disabled = busy
}

// — situations ------------------------------------------------------------------------

function renderSituations() {
  const root = $('#situations')
  root.textContent = ''
  const groups = new Map()
  for (const s of states) {
    if (!groups.has(s.page)) groups.set(s.page, [])
    groups.get(s.page).push(s)
  }
  for (const [page, list] of groups) {
    const h = document.createElement('h3')
    h.textContent = page
    root.appendChild(h)
    for (const s of list) root.appendChild(row(s))
  }
}

function row(s) {
  const el = document.createElement('div')
  el.className = 'row' + (s.id === stagedId ? ' sel' : '')
  el.dataset.id = s.id

  const line1 = document.createElement('div')
  line1.className = 'line1'
  const badge = document.createElement('span')
  badge.className = 'badge ' + s.kind
  badge.textContent = s.kind
  const title = document.createElement('span')
  title.className = 'title'
  title.textContent = s.title
  line1.appendChild(badge)
  line1.appendChild(title)
  el.appendChild(line1)

  const note = document.createElement('div')
  note.className = 'note'
  note.textContent = `${s.id} · seed ${s.seed}`
  el.appendChild(note)

  const btns = document.createElement('div')
  btns.className = 'btns'
  const load = document.createElement('button')
  load.textContent = 'Load'
  load.addEventListener('click', () => loadState(s.id))
  btns.appendChild(load)
  if (s.kind === 'flow') {
    const replay = document.createElement('button')
    replay.textContent = 'Replay'
    replay.addEventListener('click', () => replayFlow(s.id))
    btns.appendChild(replay)
  } else {
    const capture = document.createElement('button')
    capture.textContent = 'Capture'
    capture.addEventListener('click', () => captureState(s.id))
    btns.appendChild(capture)
  }
  btns.querySelectorAll('button').forEach((b) => (b.disabled = busy))
  el.appendChild(btns)

  const thumbs = document.createElement('div')
  thumbs.className = 'thumbs'
  if (shotsByState[s.id]) {
    for (const shot of shotsByState[s.id]) {
      const img = document.createElement('img')
      img.src = shot.url
      img.title = `${shot.name} · ${shot.theme}`
      img.addEventListener('click', () => openLightbox(s.id, shot))
      thumbs.appendChild(img)
    }
  }
  el.appendChild(thumbs)
  return el
}

async function loadState(id) {
  const s = states.find((x) => x.id === id)
  const r = await api('/__control/load', { id })
  stagedId = id
  renderStaged(r.seed, r.script)
  for (const row of document.querySelectorAll('.row')) row.classList.toggle('sel', row.dataset.id === id)
  const frame = $('#app')
  if (frame.contentWindow && frame.contentWindow.location.pathname + frame.contentWindow.location.search === s.entry) {
    frame.contentWindow.location.reload()
  } else {
    frame.src = s.entry
  }
  status(`staged ${id}`)
}

function renderStaged(seed, script) {
  const el = $('#staged')
  el.textContent = ''
  const seedChip = document.createElement('span')
  seedChip.className = 'chip'
  seedChip.textContent = 'seed: ' + seed
  el.appendChild(seedChip)
  const entries = Object.entries(script || {})
  if (entries.length) {
    const chip = document.createElement('span')
    chip.className = 'chip'
    chip.textContent = 'script: ' + entries.map(([k, v]) => `${k}=${typeof v === 'boolean' ? v : JSON.stringify(v)}`).join(' ')
    const x = document.createElement('button')
    x.textContent = '×'
    x.title = 'clear script'
    x.addEventListener('click', async () => {
      const r = await api('/__control/script-clear')
      renderStaged(r.seed, r.script)
    })
    chip.appendChild(x)
    el.appendChild(chip)
  }
}

// — network rules ---------------------------------------------------------------------

function renderRules() {
  const el = $('#rulechips')
  el.textContent = ''
  for (const rule of rules) {
    const chip = document.createElement('span')
    chip.className = 'chip'
    chip.textContent =
      rule.kind + ' ' + rule.pattern + (rule.kind === 'slow' && rule.delayMs ? ` ${rule.delayMs}ms` : '') + (rule.kind === 'error' && rule.status ? ` ${rule.status}` : '')
    const x = document.createElement('button')
    x.textContent = '×'
    x.addEventListener('click', async () => {
      rules = rules.filter((r) => r.id !== rule.id)
      await api('/__control/rules', { rules })
      renderRules()
      swPush()
    })
    chip.appendChild(x)
    el.appendChild(chip)
  }
}

function swPush() {
  // controller is null until the worker claims this page; the registration's
  // active worker is available sooner and is the reliable channel
  swReg?.active?.postMessage({ type: 'rules', rules })
  navigator.serviceWorker.controller?.postMessage({ type: 'rules', rules })
}

// — runs ------------------------------------------------------------------------------

async function captureState(id) {
  if (busy) return
  try {
    await api('/__control/capture', { id })
    busy = true
    refreshButtons()
    status(`capturing ${id} (light + dark)…`)
    delete shotsByState[id]
    startPolling()
  } catch (e) {
    status(e.message, true)
  }
}

async function replayFlow(id) {
  if (busy) return
  const vp = $('#viewport').value === 'custom' ? `${$('#vw').value || 1536}x${$('#vh').value || 960}` : $('#viewport').value
  try {
    await api('/__control/replay', { id, viewport: vp, theme: $('#rtheme').value })
    busy = true
    refreshButtons()
    status(`replaying ${id} in a headed window (${vp})…`)
    startPolling()
  } catch (e) {
    status(e.message, true)
  }
}

function startPolling() {
  const pane = $('#runpane')
  pane.style.display = 'block'
  poll = setInterval(async () => {
    const r = await api('/__control/run')
    pane.textContent = (r.lines || []).join('\n')
    pane.scrollTop = pane.scrollHeight
    if (!r.done) {
      $('#runstatus').textContent = `${r.kind} ${r.id} · running`
      return
    }
    clearInterval(poll)
    busy = false
    refreshButtons()
    const ok = r.exitCode === 0
    $('#runstatus').textContent = `${r.kind} ${r.id} · ${ok ? 'finished' : 'failed'}`
    if (r.kind === 'capture' && r.shots && r.shots.length) {
      shotsByState[r.id] = r.shots
      renderSituations()
      status(`captured ${r.id}: ${r.shots.length} shot(s)` + (r.galleryUrl ? ` · gallery: ` : ''), !ok)
      if (r.galleryUrl) {
        const a = document.createElement('a')
        a.href = r.galleryUrl
        a.target = '_blank'
        a.textContent = 'open gallery'
        $('#status').appendChild(a)
      }
    } else {
      status(`${r.kind} ${r.id} ${ok ? 'finished' : 'failed with exit ' + r.exitCode}`, !ok)
    }
    // The run clobbered shared server state; restage what was on screen.
    if (stagedId) {
      const rr = await api('/__control/load', { id: stagedId })
      renderStaged(rr.seed, rr.script)
    }
  }, 600)
}

// — lightbox --------------------------------------------------------------------------

function openLightbox(stateId, shot) {
  lb.shots = shotsByState[stateId]
  lb.i = lb.shots.indexOf(shot)
  $('#lightbox').classList.add('on')
  renderLightbox()
}

function renderLightbox() {
  const shot = lb.shots[lb.i]
  $('#lbimg').src = shot.url
  $('#lbcap').textContent = `${shot.name} · ${shot.theme} · ${lb.i + 1}/${lb.shots.length}`
}

$('#lbprev').addEventListener('click', () => {
  lb.i = (lb.i - 1 + lb.shots.length) % lb.shots.length
  renderLightbox()
})
$('#lbnext').addEventListener('click', () => {
  lb.i = (lb.i + 1) % lb.shots.length
  renderLightbox()
})
$('#lbclose').addEventListener('click', () => $('#lightbox').classList.remove('on'))
document.addEventListener('keydown', (e) => {
  if (!$('#lightbox').classList.contains('on')) return
  if (e.key === 'ArrowLeft') $('#lbprev').click()
  if (e.key === 'ArrowRight') $('#lbnext').click()
  if (e.key === 'Escape') $('#lbclose').click()
})

// — top bar ---------------------------------------------------------------------------

$('#viewport').addEventListener('change', () => {
  const custom = $('#viewport').value === 'custom'
  $('#vw').classList.toggle('hidden', !custom)
  $('#vh').classList.toggle('hidden', !custom)
})

$('#rkind').addEventListener('change', () => {
  $('#rdelay').classList.toggle('hidden', $('#rkind').value !== 'slow')
  $('#rstatus').classList.toggle('hidden', $('#rkind').value !== 'error')
})

$('#addrule').addEventListener('click', async () => {
  const rule = {
    id: String(Date.now()),
    kind: $('#rkind').value,
    pattern: $('#rpattern').value.trim() || '^/api/',
  }
  if (rule.kind === 'slow') rule.delayMs = Number($('#rdelay').value) || 2000
  if (rule.kind === 'error') rule.status = Number($('#rstatus').value) || 500
  rules = rules.concat(rule)
  await api('/__control/rules', { rules })
  renderRules()
  swPush()
  status('rule active: ' + rule.kind + ' ' + rule.pattern)
})

$('#rebuild').addEventListener('click', async () => {
  if (busy) return
  $('#rebuild').disabled = true
  status('rebuilding web/dist…')
  try {
    await api('/__control/rebuild')
    status('rebuilt')
    $('#app').contentWindow.location.reload()
  } catch (e) {
    status(e.message, true)
  }
  $('#rebuild').disabled = false
})

// — boot ------------------------------------------------------------------------------

;(async () => {
  try {
    const s = await api('/__control/states')
    states = s.states
    const r = await api('/__control/rules')
    rules = r.rules ?? []
    renderSituations()
    renderRules()
    status('ready')
    if (navigator.serviceWorker) {
      try {
        swReg = await navigator.serviceWorker.register('/__sw.js')
        await navigator.serviceWorker.ready
        swPush()
      } catch {
        // conditioning unavailable; the console still works without it
      }
    }
  } catch (e) {
    status('console failed to load: ' + e.message, true)
  }
})()
