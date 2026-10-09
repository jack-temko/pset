// Injected before any app code (page.addInitScript). Records what the audit
// measures into window.__jumps, all times in performance.now() ms; `origin` is
// performance.timeOrigin, so origin + t is a wall-clock time the runner shares.
(() => {
  if (window.__jumps) return;
  const J = (window.__jumps = {
    origin: performance.timeOrigin,
    shifts: [],
    sizes: [],
    frames: [],
    last: 0,
  });

  // A short, stable-enough name for an element: tag, id or role, a few
  // classes, and its parent the same way.
  const part = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const role = el.getAttribute('role');
    if (role) s += '[' + role + ']';
    const cls =
      typeof el.className === 'string'
        ? el.className.split(/\s+/).filter(Boolean).slice(0, 2)
        : [];
    return s + cls.map((c) => '.' + c).join('');
  };
  const sel = (node) => {
    if (!node) return 'unknown';
    if (node.nodeType === 3) node = node.parentElement;
    if (!node) return 'unknown';
    const parts = [];
    for (
      let el = node, i = 0;
      el && el !== document.body && i < 3;
      el = el.parentElement, i++
    )
      parts.unshift(part(el));
    return parts.join(' > ') || 'body';
  };
  const rect = (r) => ({
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.width),
    h: Math.round(r.height),
  });

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        J.shifts.push({
          t: e.startTime,
          value: e.value,
          hadRecentInput: e.hadRecentInput,
          sources: (e.sources || []).map((s) => ({
            sel: sel(s.node),
            prev: rect(s.previousRect),
            cur: rect(s.currentRect),
          })),
        });
        J.last = performance.now();
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}

  // What an overlay is called: its label, its title, or its role.
  const name = (el) => {
    const label = el.getAttribute('aria-label');
    if (label)
      return el.getAttribute('role') === 'menu' ? label + ' menu' : label;
    const by = el.getAttribute('aria-labelledby');
    const text =
      (by && document.getElementById(by)?.textContent) ||
      el.querySelector('h2')?.textContent;
    return text ? text.trim().slice(0, 60) : '';
  };
  const fallback = (el) => el.getAttribute('role') || el.tagName.toLowerCase();
  // Each overlay keeps one id, so a dialog whose title arrives with its data
  // is still one series; `name` is what it was last called.
  const ids = new WeakMap();
  let nextId = 1;
  const idOf = (el) => {
    if (!ids.has(el)) ids.set(el, nextId++);
    return ids.get(el);
  };
  const watched = new WeakSet();
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      // The border box without transforms, so a menu's scale-in isn't growth.
      const b = e.borderBoxSize?.[0];
      const w = b ? b.inlineSize : e.target.offsetWidth;
      const h = b ? b.blockSize : e.target.offsetHeight;
      J.sizes.push({
        id: idOf(e.target),
        name: name(e.target) || fallback(e.target),
        named: !!name(e.target),
        t: performance.now(),
        w: Math.round(w),
        h: Math.round(h),
      });
      J.last = performance.now();
    }
  });
  const OVERLAYS = 'dialog, [role=dialog], [role=alertdialog], [role=menu]';
  const attach = (root) => {
    if (root.nodeType !== 1) return;
    const els = root.matches(OVERLAYS) ? [root] : [];
    els.push(...root.querySelectorAll(OVERLAYS));
    for (const el of els) {
      if (watched.has(el)) continue;
      watched.add(el);
      ro.observe(el);
    }
  };
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach(attach);
  }).observe(document, { childList: true, subtree: true });

  // Skeletons and spinners on screen, sampled every frame; only changes kept.
  // One counts only while it intersects the viewport: a skeleton in a hidden
  // tab, a closed dialog or far down a scrolled list isn't being waited on.
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.right > 0 &&
      r.top < innerHeight &&
      r.left < innerWidth
    );
  };
  // `.skeleton` too, so a branch from before data-skeleton can be measured.
  const SKELETON = '[data-skeleton], .skeleton';
  J.visible = (css) => [...document.querySelectorAll(css)].filter(inView);
  let prev = '';
  const tick = () => {
    const skels = J.visible(SKELETON);
    const stats = J.visible('[role=status]');
    const key = skels.length + ',' + stats.length;
    if (key !== prev) {
      prev = key;
      J.frames.push({
        t: performance.now(),
        skel: skels.length,
        status: stats.length,
        skelSel: skels.length ? sel(skels[0]) : '',
        statusSel: stats.length ? sel(stats[0]) : '',
      });
    }
    if (skels.length || stats.length) J.last = performance.now();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Loaded boxes (components/loaded): a grid whose layers carry data-variant,
  // the skeleton layer aria-hidden and the content layer not. At the swap, when
  // the content layer first has content over a skeleton layer still there,
  // the probe records both variants and the heights of each layer's top-level
  // blocks (a swap is a sample); the content layer's variant is watched after
  // its reveal (a change is a flash), and reveals are counted per navigation
  // epoch (two in one epoch is a double reveal).
  J.swaps = [];
  J.changes = [];
  J.reveals = [];
  J.epoch = 0;
  const bump = () => J.epoch++;
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function (...args) {
      bump();
      return orig.apply(this, args);
    };
  }
  addEventListener('popstate', bump);

  const layout = (layer) => {
    const kids = [...layer.children].map((c) => c.getBoundingClientRect());
    const total = kids.length
      ? Math.max(...kids.map((r) => r.bottom)) -
        Math.min(...kids.map((r) => r.top))
      : 0;
    return {
      blocks: kids.map((r) => Math.round(r.height)),
      total: Math.round(total),
    };
  };
  const boxes = new WeakMap();
  const watchBoxes = () => {
    for (const el of document.querySelectorAll(
      '[data-variant]:not([aria-hidden=true])',
    )) {
      const box = el.parentElement;
      if (!box) continue;
      let st = boxes.get(el);
      if (!st) boxes.set(el, (st = { revealed: false, variant: '' }));
      const variant = el.getAttribute('data-variant');
      const has = el.childElementCount > 0;
      if (has && !st.revealed) {
        st.revealed = true;
        st.variant = variant;
        const t = performance.now();
        J.reveals.push({ box: sel(box), t, epoch: J.epoch });
        const skel = box.querySelector(
          ':scope > [data-variant][aria-hidden=true]',
        );
        if (skel) {
          const a = layout(skel);
          const b = layout(el);
          J.swaps.push({
            box: sel(box),
            t,
            skeleton: skel.getAttribute('data-variant'),
            content: variant,
            skeletonBlocks: a.blocks,
            contentBlocks: b.blocks,
            skeletonHeight: a.total,
            contentHeight: b.total,
          });
        }
      } else if (!has && st.revealed) {
        st.revealed = false;
      } else if (has && st.revealed && variant !== st.variant) {
        J.changes.push({
          box: sel(box),
          t: performance.now(),
          from: st.variant,
          to: variant,
        });
        st.variant = variant;
      }
    }
  };
  const watchTick = () => {
    watchBoxes();
    requestAnimationFrame(watchTick);
  };
  requestAnimationFrame(watchTick);
})();
