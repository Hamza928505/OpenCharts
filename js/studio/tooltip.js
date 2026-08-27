/**
 * tooltip.js — hover readouts for the charts that draw themselves.
 *
 * Chart.js brings its own tooltips, so the 39 charts on that renderer were the
 * only ones you could interrogate. The other 59 drew a picture and told you
 * nothing: a bar was a bar, and the number behind it was unreachable. These two
 * helpers close that gap, one for each way the library draws.
 *
 * **Both functions are serialised verbatim into exported code**, so neither may
 * reference anything outside its own body — no imports, no module constants, no
 * shared style object. That is why the CSS is inline and repeated. See "One
 * build function, two outputs" in CLAUDE.md.
 */

/**
 * Hover readouts for an SVG chart.
 *
 * Delegated from the host rather than bound per mark: a chart with 12,000 city
 * dots would otherwise pay for 12,000 listeners, and marks are rebuilt on every
 * redraw. A mark opts in by carrying `data-tip`.
 *
 * @param {HTMLElement} host the element the chart was mounted into
 */
function attachTips(host) {
  if (!host || host.__ocTips) return;
  host.__ocTips = true;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const tip = document.createElement('div');
  tip.setAttribute('role', 'tooltip');
  tip.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;opacity:0;'
    + 'z-index:20;max-width:240px;padding:.34rem .5rem;border-radius:6px;'
    + 'background:rgba(22,22,26,.94);color:#fff;white-space:pre-line;'
    + 'font:12px/1.45 "DM Sans",system-ui,sans-serif;'
    + 'box-shadow:0 4px 14px rgba(0,0,0,.3);transition:opacity .1s';
  host.appendChild(tip);

  let shown = false;
  const hide = () => { if (shown) { tip.style.opacity = '0'; shown = false; } };

  host.addEventListener('mousemove', (e) => {
    const mark = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!mark) { hide(); return; }

    tip.textContent = mark.getAttribute('data-tip');
    const box = host.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;

    // Measure before placing, so the tip can be flipped or nudged rather than
    // hanging off the edge of a chart that sits flush against the page.
    tip.style.opacity = '1';
    shown = true;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.max(4, Math.min(box.width - w - 4, x - w / 2));
    const top = y - h - 12 < 4 ? y + 18 : y - h - 12;
    tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
  });

  host.addEventListener('mouseleave', hide);
}

/**
 * Hover readouts for a canvas chart.
 *
 * A canvas has no elements to hover, so `draw()` reports the shapes it painted
 * and this hit-tests them. Shapes are searched newest first: later marks are
 * drawn on top, so where two overlap the one you can see is the one that wins.
 *
 * Three shapes, because a bounding box is the wrong answer for two thirds of
 * this library. A pie wedge's box covers most of the circle and would steal
 * every neighbour's hover; a packed bubble's box overlaps four others.
 *
 *   rect   { x, y, w, h, text }
 *   circle { cx, cy, r, text }
 *   wedge  { cx, cy, r0, r1, a0, a1, text }   angles in radians, a0 < a1
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Array<object>} regions
 */
function attachCanvasTips(canvas, regions) {
  if (!canvas || !regions || !regions.length) return;
  const host = canvas.parentElement;
  if (!host) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  let tip = host.__ocCanvasTip;
  if (!tip) {
    tip = document.createElement('div');
    tip.setAttribute('role', 'tooltip');
    tip.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;opacity:0;'
      + 'z-index:20;max-width:240px;padding:.34rem .5rem;border-radius:6px;'
      + 'background:rgba(22,22,26,.94);color:#fff;white-space:pre-line;'
      + 'font:12px/1.45 "DM Sans",system-ui,sans-serif;'
      + 'box-shadow:0 4px 14px rgba(0,0,0,.3);transition:opacity .1s';
    host.appendChild(tip);
    host.__ocCanvasTip = tip;
  }

  // Every redraw hands over a fresh set of boxes; keep one listener and let it
  // read the latest, or a resize would leave stale hit areas behind.
  canvas.__ocRegions = regions;

  if (!canvas.__ocTipBound) {
    canvas.__ocTipBound = true;
    let shown = false;
    const hide = () => { if (shown) { tip.style.opacity = '0'; shown = false; } };

    canvas.addEventListener('mousemove', (e) => {
      const box = canvas.getBoundingClientRect();
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      const list = canvas.__ocRegions || [];

      let hit = null;
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        let inside;
        if (r.r != null) {
          const dx = x - r.cx;
          const dy = y - r.cy;
          inside = dx * dx + dy * dy <= r.r * r.r;
        } else if (r.r1 != null) {
          const dx = x - r.cx;
          const dy = y - r.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < r.r0 || dist > r.r1) {
            inside = false;
          } else {
            // Normalise both the mark's span and the cursor to one turn, so a
            // wedge that crosses the -π/π seam still matches.
            const TAU = Math.PI * 2;
            const norm = (a) => ((a % TAU) + TAU) % TAU;
            const from = norm(r.a0);
            const span = Math.min(TAU, Math.max(0, r.a1 - r.a0));
            inside = norm(Math.atan2(dy, dx) - from) <= span;
          }
        } else {
          inside = x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
        }
        if (inside) { hit = r; break; }
      }
      if (!hit) { hide(); return; }

      tip.textContent = hit.text;
      tip.style.opacity = '1';
      shown = true;
      const hostBox = host.getBoundingClientRect();
      const px = e.clientX - hostBox.left;
      const py = e.clientY - hostBox.top;
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      const left = Math.max(4, Math.min(hostBox.width - w - 4, px - w / 2));
      const top = py - h - 12 < 4 ? py + 18 : py - h - 12;
      tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
    });

    canvas.addEventListener('mouseleave', hide);
  }
}

/**
 * Build the `tip` a canvas `draw()` calls to report what it painted.
 *
 * Takes either a rectangle positionally — `tip(x, y, w, h, text)`, which is
 * what most charts want and reads cleanly at the call site — or a shape object
 * for the circles and wedges a box would misrepresent.
 */
function recordTip(regions) {
  return function tip(a, b, c, d, e) {
    if (a && typeof a === 'object') {
      if (a.text != null) regions.push(a);
      return;
    }
    if (e == null) return;
    regions.push({ x: a, y: b, w: c, h: d, text: String(e) });
  };
}

export { attachTips, attachCanvasTips, recordTip };
