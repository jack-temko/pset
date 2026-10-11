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
  // Every "<view>/<data-variant>" seen on a content layer and on a skeleton layer,
  // so a scenario can be checked to have shown the variant it is tagged with.
  J.variants = { content: [], skeleton: [] };
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

  // A layer's content, not its box: a fill-height panel keeps its box fixed
  // whatever it holds. `extent` is how far its descendants reach below the
  // layer's top; `blocks` and `offsets` are its top-level children's heights
  // and tops, from that same top.
  const layout = (layer) => {
    const top = layer.getBoundingClientRect().top;
    let bottom = top;
    for (const el of layer.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) bottom = Math.max(bottom, r.bottom);
    }
    const kids = [...layer.children].map((c) => c.getBoundingClientRect());
    return {
      blocks: kids.map((r) => Math.round(r.height)),
      offsets: kids.map((r) => Math.round(r.top - top)),
      extent: Math.round(bottom - top),
    };
  };
  const boxes = new WeakMap();
  const noteVariants = () => {
    for (const el of document.querySelectorAll('[data-variant]')) {
      const kind =
        el.getAttribute('aria-hidden') === 'true' ? 'skeleton' : 'content';
      // "<view>/<name>"; a box that names no view is "/<name>".
      const v = el.getAttribute('data-variant');
      const id = `${el.getAttribute('data-view') ?? ''}/${v}`;
      if (v && !J.variants[kind].includes(id)) J.variants[kind].push(id);
    }
  };
  const watchBoxes = () => {
    noteVariants();
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
            skeletonOffsets: a.offsets,
            contentOffsets: b.offsets,
            skeletonExtent: a.extent,
            contentExtent: b.extent,
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
