// Injected before any app code (page.addInitScript). Records what the audit
// measures into window.__jumps, all times in performance.now() ms; `origin` is
// performance.timeOrigin, so origin + t is a wall-clock time the runner shares.
;(() => {
  if (window.__jumps) return
  const J = (window.__jumps = { origin: performance.timeOrigin, shifts: [], sizes: [], frames: [], last: 0 })

  // A short, stable-enough name for an element: tag, id or role, a few
  // classes, and its parent the same way.
  const part = (el) => {
    let s = el.tagName.toLowerCase()
    if (el.id) s += '#' + el.id
    const role = el.getAttribute('role')
    if (role) s += '[' + role + ']'
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2) : []
    return s + cls.map((c) => '.' + c).join('')
  }
  const sel = (node) => {
    if (!node) return 'unknown'
    if (node.nodeType === 3) node = node.parentElement
    if (!node) return 'unknown'
    const parts = []
    for (let el = node, i = 0; el && el !== document.body && i < 3; el = el.parentElement, i++) parts.unshift(part(el))
    return parts.join(' > ') || 'body'
  }
  const rect = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) })

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        J.shifts.push({
          t: e.startTime,
          value: e.value,
          hadRecentInput: e.hadRecentInput,
          sources: (e.sources || []).map((s) => ({ sel: sel(s.node), prev: rect(s.previousRect), cur: rect(s.currentRect) })),
        })
        J.last = performance.now()
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {}

  // What an overlay is called: its label, its title, or its role.
  const name = (el) => {
    const label = el.getAttribute('aria-label')
    if (label) return el.getAttribute('role') === 'menu' ? label + ' menu' : label
    const by = el.getAttribute('aria-labelledby')
    const text = (by && document.getElementById(by)?.textContent) || el.querySelector('h2')?.textContent
    return (text || el.getAttribute('role') || el.tagName.toLowerCase()).trim().slice(0, 60)
  }
  const watched = new WeakSet()
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const r = e.target.getBoundingClientRect()
      J.sizes.push({ name: name(e.target), t: performance.now(), w: Math.round(r.width), h: Math.round(r.height) })
      J.last = performance.now()
    }
  })
  const OVERLAYS = 'dialog, [role=dialog], [role=alertdialog], [role=menu]'
  const attach = (root) => {
    if (root.nodeType !== 1) return
    const els = root.matches(OVERLAYS) ? [root] : []
    els.push(...root.querySelectorAll(OVERLAYS))
    for (const el of els) {
      if (watched.has(el)) continue
      watched.add(el)
      ro.observe(el)
    }
  }
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach(attach)
  }).observe(document, { childList: true, subtree: true })

  // Skeletons and spinners on screen, sampled every frame; only changes kept.
  let prev = ''
  const tick = () => {
    const skel = document.querySelectorAll('[data-skeleton]').length
    const status = document.querySelectorAll('[role=status]').length
    const key = skel + ',' + status
    if (key !== prev) {
      prev = key
      J.frames.push({ t: performance.now(), skel, status })
    }
    if (skel || status) J.last = performance.now()
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})()
