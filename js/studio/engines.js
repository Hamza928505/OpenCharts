/**
 * engines.js — the bridge between a chart definition and the two things the
 * studio needs from it: a live preview, and copy-pasteable source.
 *
 * A definition declares exactly one renderer block (`chartjs`, `canvas`, `d3`,
 * `native` or `dom`). Both `renderChart()` and `generateCode()` read that same
 * block, so the code on screen is always generated from the very function that
 * drew the picture above it — they cannot drift apart.
 */

import { serialize, indent, tidy, toFunctionSource } from './serialize.js';
import { dependenciesFor, cdnOnly, scriptsOnly, scriptTag, describe } from './cdn.js';
import { attachTips, attachCanvasTips, recordTip } from './tooltip.js';

export const ENGINE_LABEL = {
  chartjs: 'Chart.js',
  d3:      'D3',
  canvas:  'Canvas 2D',
  native:  'OpenCharts',
  dom:     'DOM / CSS',
};

export const ENGINE_CHIP = {
  chartjs: 'chip-chartjs',
  d3:      'chip-d3',
  canvas:  'chip-canvas',
  native:  'chip-native',
  dom:     'chip-dom',
};

/** Which renderer block a definition uses. */
export const engineOf = (def) =>
  def.chartjs ? 'chartjs'
  : def.d3     ? 'd3'
  : def.canvas ? 'canvas'
  : def.native ? 'native'
  : 'dom';

/* ── Canvas sizing ───────────────────────────────────────────────────────── */

/**
 * Size a canvas for the device pixel ratio and return a context already scaled
 * so all drawing code can work in CSS pixels.
 */
export function sizeCanvas(canvas, w, h) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Resolve the drawing height for a definition at a given render size. */
function heightFor(def, opts) {
  if (opts.height) return opts.height;
  const block = def.canvas || def.d3 || def.dom || {};
  return block.height || 340;
}

/* ── Live render ─────────────────────────────────────────────────────────── */

/**
 * Draw `def` into `host` using `spec`.
 *
 * @param {object} def   chart definition
 * @param {HTMLElement} host  element the chart owns entirely (it is emptied)
 * @param {object} spec  the live, user-edited spec
 * @param {object} [opts]
 * @param {number} [opts.height]   override drawing height
 * @param {boolean} [opts.compact] gallery preview — hide axes chrome where supported
 * @returns {object} instance handle for destroyInstance()
 */
export function renderChart(def, host, spec, opts = {}) {
  host.innerHTML = '';
  const engine = engineOf(def);
  const width = Math.max(120, host.clientWidth || host.offsetWidth || 600);
  const height = heightFor(def, opts);
  const ctxInfo = { width, height, compact: !!opts.compact };

  if (engine === 'chartjs') {
    if (typeof window.Chart === 'undefined') {
      return failure(host, 'Chart.js failed to load.');
    }
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:relative;width:100%;height:${height}px`;
    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    host.appendChild(wrap);
    try {
      const config = def.chartjs.build(spec, ctxInfo);
      const chart = new window.Chart(canvas, config);
      return { engine, chart, canvas };
    } catch (err) {
      return failure(host, err.message);
    }
  }

  if (engine === 'canvas') {
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    const draw = () => {
      const w = Math.max(120, host.clientWidth || width);
      const ctx = sizeCanvas(canvas, w, height);
      ctx.clearRect(0, 0, w, height);
      // A canvas has nothing to hover, so the draw reports the boxes it paints
      // and the tooltip hit-tests those. Gallery thumbnails skip it: they are
      // not interactive, and collecting boxes for 98 of them is wasted work.
      const regions = [];
      ctxInfo.tip = opts.compact ? null : recordTip(regions);
      try {
        def.canvas.draw(ctx, spec, w, height, ctxInfo);
      } catch (err) {
        drawError(ctx, w, height, err.message);
      }
      attachCanvasTips(canvas, regions);
    };
    draw();
    return { engine, canvas, redraw: draw };
  }

  if (engine === 'd3') {
    if (typeof window.d3 === 'undefined') {
      return failure(host, 'D3 failed to load.');
    }
    const mount = () => {
      host.innerHTML = '';
      const w = Math.max(120, host.clientWidth || width);
      try {
        def.d3.mount(host, spec, w, height, ctxInfo);
        if (!opts.compact) attachTips(host);
      } catch (err) {
        failure(host, err.message);
      }
    };
    // A mount that reacts to input — the globe's drag-to-rotate — needs a way
    // to ask for itself again. It cannot capture this closure, because the very
    // same function is serialised into the export where no such closure exists,
    // so it arrives on `env` the way width and height do.
    ctxInfo.redraw = mount;
    mount();
    return { engine, redraw: mount, host };
  }

  if (engine === 'native') {
    const canvas = document.createElement('canvas');
    canvas.id = 'studio-native-' + Math.random().toString(36).slice(2, 8);
    canvas.style.cssText = `width:100%;height:${height}px;display:block`;
    host.appendChild(canvas);
    try {
      const { data, config } = def.native.build(spec, ctxInfo);
      const chart = new def.native.Class(canvas, { data, ...config });
      if (!opts.compact && chart.enableTooltip) chart.enableTooltip();
      return { engine, chart, canvas };
    } catch (err) {
      return failure(host, err.message);
    }
  }

  // dom
  const mount = () => {
    host.innerHTML = '';
    try {
      def.dom.mount(host, spec, ctxInfo);
      if (!opts.compact) attachTips(host);
    } catch (err) {
      failure(host, err.message);
    }
  };
  mount();
  return { engine, redraw: mount, host };
}

function failure(host, message) {
  const box = document.createElement('div');
  box.style.cssText =
    'display:grid;place-items:center;min-height:160px;padding:1.5rem;text-align:center;'
    + 'color:var(--ink-faint);font-size:13px;line-height:1.5';
  box.textContent = 'Could not render this chart: ' + message;
  host.appendChild(box);
  return { engine: 'error' };
}

function drawError(ctx, w, h, message) {
  ctx.save();
  ctx.fillStyle = 'rgba(128,128,128,.7)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Render error: ' + message, w / 2, h / 2);
  ctx.restore();
}

/** Tear down whatever renderChart() produced. */
export function destroyInstance(inst) {
  if (!inst) return;
  try {
    if (inst.chart && typeof inst.chart.destroy === 'function') inst.chart.destroy();
  } catch { /* already gone */ }
}

/** Re-render on container resize where the renderer needs it. */
export function resizeInstance(inst) {
  if (inst && typeof inst.redraw === 'function') inst.redraw();
}

/* ── Legend ──────────────────────────────────────────────────────────────── */

/**
 * Build the DOM legend. Chart.js's own legend is deliberately switched off
 * across this library so the legend can be styled as page furniture rather
 * than painted inside the canvas.
 */
export function renderLegend(container, items, inst) {
  container.innerHTML = '';
  if (!items || !items.length) { container.style.display = 'none'; return; }
  container.style.display = 'flex';

  // The custom engine ships its own LegendSystem with working series toggling —
  // hand the container over rather than drawing a second, dumber legend.
  if (inst && inst.engine === 'native' && inst.chart && typeof inst.chart.enableLegend === 'function') {
    try {
      inst.chart.enableLegend(container);
      return;
    } catch {
      // fall through to the generic legend below
    }
  }

  items.forEach((item, i) => {
    const el = document.createElement('span');
    el.className = 'legend-item';
    const sw = document.createElement('span');
    sw.className = 'legend-swatch' + (item.line ? ' line' : '');
    sw.style.background = item.color;
    const label = document.createElement('span');
    label.textContent = item.label;
    el.append(sw, label);

    // Only Chart.js instances can hide a series without a full rebuild.
    if (inst && inst.chart && inst.engine === 'chartjs' && item.toggleable !== false) {
      el.addEventListener('click', () => {
        const chart = inst.chart;
        const meta = chart.getDatasetMeta(item.datasetIndex ?? i);
        meta.hidden = meta.hidden === null ? !chart.data.datasets[item.datasetIndex ?? i].hidden : !meta.hidden;
        el.classList.toggle('hidden', !!meta.hidden);
        chart.update();
      });
    } else {
      el.style.cursor = 'default';
    }
    container.appendChild(el);
  });
}

/* ── Code generation ─────────────────────────────────────────────────────── */

const BASE_CSS = `.chart-card {
  background: #ffffff;
  border: 1px solid #e3e0d7;
  border-radius: 16px;
  padding: 20px;
  font-family: 'DM Sans', system-ui, sans-serif;
  color: #171614;
}

.chart-wrap {
  position: relative;
  width: 100%;
  height: 340px;
}

.chart-wrap canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 14px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #56544d;
  cursor: pointer;
  user-select: none;
  transition: opacity .2s;
}

.legend-item.hidden { opacity: .35; }

.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: 0 0 10px;
}

.legend-swatch.line { width: 16px; height: 2px; border-radius: 1px; }

@media (prefers-color-scheme: dark) {
  .chart-card { background: #16161d; border-color: rgba(255,255,255,.09); color: #eceae4; }
  .legend-item { color: #a3a09a; }
}`;

/**
 * Make a string safe to sit inside an inline <script> block.
 *
 * HTML closes a script element at the first literal `</script`, wherever it
 * appears — including inside a string or a comment. Escaping the slash is the
 * standard idiom and stays readable in the emitted source.
 */
function safeForInlineScript(text) {
  // The replacement needs a real backslash in the output, so the literal is
  // escaped here: '<\\/' produces the two characters `<` and `\` then `/`.
  return String(text).replace(/<\/(script)/gi, '<\\/$1');
}

/**
 * Emit the legend as code.
 *
 * The generic "one entry per dataset" legend only suits charts whose series
 * map one-to-one onto datasets. Slice, node and group legends (pie, sankey,
 * treemap, the hand-drawn charts) do not, so the items the definition already
 * computed for the live page are emitted as a literal instead — the copied
 * legend is then exactly the legend on screen. Entries carrying a
 * `datasetIndex` stay clickable; the rest render as a static key.
 */
function legendCode(items, interactive) {
  const clean = items.map((it) => {
    const out = { label: it.label, color: it.color };
    if (it.line) out.line = true;
    if (interactive && it.toggleable !== false && it.datasetIndex != null) {
      out.datasetIndex = it.datasetIndex;
    }
    return out;
  });

  const toggle = interactive ? [
    `    if (item.datasetIndex != null) {`,
    `      el.style.cursor = 'pointer';`,
    `      el.addEventListener('click', () => {`,
    `        const meta = chart.getDatasetMeta(item.datasetIndex);`,
    `        meta.hidden = !meta.hidden;`,
    `        el.classList.toggle('hidden', !!meta.hidden);`,
    `        chart.update();`,
    `      });`,
    `    }`,
  ] : [];

  return [
    `const legendItems = ${serialize(clean, 0)};`,
    ``,
    `function buildLegend(containerId, items) {`,
    `  const host = document.getElementById(containerId);`,
    `  if (!host) return;`,
    `  host.innerHTML = '';`,
    `  items.forEach((item) => {`,
    `    const el = document.createElement('span');`,
    `    el.className = 'legend-item';`,
    `    const sw = document.createElement('span');`,
    `    sw.className = 'legend-swatch' + (item.line ? ' line' : '');`,
    `    sw.style.background = item.color;`,
    `    const text = document.createElement('span');`,
    `    text.textContent = item.label;`,
    `    el.append(sw, text);`,
    ...toggle,
    `    host.appendChild(el);`,
    `  });`,
    `}`,
    ``,
    `buildLegend('legend', legendItems);`,
  ].join('\n');
}

/**
 * Emit a renderer as a named function declaration, so the exported code reads
 * `function draw(...)` rather than `const draw = function draw(...)`.
 */
function namedFunction(fn, name) {
  const src = toFunctionSource(fn);
  return src.replace(/^(async\s+)?function\s*[A-Za-z_$][\w$]*\s*\(/, `$1function ${name}(`)
            .replace(/^(async\s+)?function\s*\(/, `$1function ${name}(`);
}

/** Source text for any helper functions a definition declares. */
function helperSource(block) {
  const helpers = block && block.helpers;
  if (!helpers || !helpers.length) return '';
  return helpers.map((fn) => toFunctionSource(fn)).join('\n\n') + '\n\n';
}

/** The HTML fragment a chart needs. */
function buildHTML(def, spec) {
  const engine = engineOf(def);
  const legend = def.legend ? def.legend(spec) : null;
  const hasLegend = !!(legend && legend.length);

  if (def.html) return def.html(spec, { hasLegend });

  const inner = (engine === 'd3' || engine === 'dom')
    ? `  <div id="chart"></div>`
    : `  <div class="chart-wrap">\n    <canvas id="chart"></canvas>\n  </div>`;

  return [
    `<div class="chart-card">`,
    inner,
    hasLegend ? `  <div class="legend" id="legend"></div>` : null,
    `</div>`,
  ].filter(Boolean).join('\n');
}

/** The CSS a chart needs: shared base plus any per-chart extras. */
function buildCSS(def, spec) {
  const engine = engineOf(def);
  const parts = [BASE_CSS];

  if (engine === 'd3' || engine === 'dom') {
    parts.push(`#chart {\n  width: 100%;\n  min-height: ${heightFor(def, {})}px;\n}`);
  }
  if (def.css) parts.push(typeof def.css === 'function' ? def.css(spec) : def.css);
  return tidy(parts.join('\n\n'));
}

/** The JavaScript a chart needs. */
/**
 * Drop the studio's own bookkeeping before a spec is printed into exported
 * code. Anything prefixed with `_` is internal — a transient status message, a
 * parsing scratch field — and has no business in a snippet someone pastes.
 */
function publicSpec(spec) {
  if (!spec || typeof spec !== 'object') return spec;
  const out = Array.isArray(spec) ? [] : {};
  for (const key of Object.keys(spec)) {
    if (key.startsWith('_')) continue;
    const v = spec[key];
    out[key] = (v && typeof v === 'object' && !(v instanceof Date)) ? publicSpec(v) : v;
  }
  return out;
}

function buildJS(def, spec) {
  const engine = engineOf(def);
  const legend = def.legend ? def.legend(spec) : null;
  const hasLegend = !!(legend && legend.length);
  const header = dependencyHeader(def, dependenciesFor(def));

  if (engine === 'chartjs') {
    const config = def.chartjs.build(spec, { width: 800, height: heightFor(def, {}) });
    const lines = [
      ...header,
      '',
      `const config = ${serialize(config, 0)};`,
      '',
      `const chart = new Chart(document.getElementById('chart'), config);`,
    ];
    if (hasLegend) lines.push('', legendCode(legend, true));
    return tidy(lines.join('\n'));
  }

  if (engine === 'canvas') {
    const block = def.canvas;
    const h = heightFor(def, {});
    return tidy([
      ...header,
      '',
      `const spec = ${serialize(publicSpec(spec), 0)};`,
      '',
      helperSource(block).trim(),
      '',
      toFunctionSource(recordTip),
      '',
      toFunctionSource(attachCanvasTips),
      '',
      namedFunction(block.draw, 'draw'),
      '',
      `// Size for the device pixel ratio, then draw in CSS pixels.`,
      `const canvas = document.getElementById('chart');`,
      `function render() {`,
      `  const host = canvas.parentElement;`,
      `  const w = host.clientWidth;`,
      `  const h = ${h};`,
      `  const dpr = window.devicePixelRatio || 1;`,
      `  canvas.width = Math.round(w * dpr);`,
      `  canvas.height = Math.round(h * dpr);`,
      `  canvas.style.width = w + 'px';`,
      `  canvas.style.height = h + 'px';`,
      `  const ctx = canvas.getContext('2d');`,
      `  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);`,
      `  ctx.clearRect(0, 0, w, h);`,
      `  const regions = [];`,
      `  draw(ctx, spec, w, h, {`,
      `    width: w, height: h,`,
      `    tip: recordTip(regions),`,
      `  });`,
      `  attachCanvasTips(canvas, regions);`,
      `}`,
      '',
      `render();`,
      `window.addEventListener('resize', render);`,
      ...(hasLegend ? ['', legendCode(legend, false)] : []),
    ].join('\n'));
  }

  if (engine === 'd3') {
    const block = def.d3;
    const h = heightFor(def, {});
    return tidy([
      ...header,
      '',
      `const spec = ${serialize(publicSpec(spec), 0)};`,
      '',
      helperSource(block).trim(),
      '',
      toFunctionSource(attachTips),
      '',
      namedFunction(block.mount, 'mount'),
      '',
      `const host = document.getElementById('chart');`,
      `function render() {`,
      `  host.innerHTML = '';`,
      `  mount(host, spec, host.clientWidth, ${h}, { width: host.clientWidth, height: ${h}, redraw: render });`,
      `  attachTips(host);`,
      `}`,
      '',
      `render();`,
      `window.addEventListener('resize', render);`,
      ...(hasLegend ? ['', legendCode(legend, false)] : []),
    ].join('\n'));
  }

  if (engine === 'native') {
    const { data, config } = def.native.build(spec, { width: 800, height: heightFor(def, {}) });
    const cls = def.native.className;
    return tidy([
      ...header,
      '',
      `import { ${cls} } from './js/charts/${cls}.js';`,
      '',
      `const data = ${serialize(data, 0)};`,
      '',
      `const config = ${serialize(config, 0)};`,
      '',
      `const chart = new ${cls}('chart', { data, ...config });`,
      `chart.enableTooltip();`,
      // enableLegend takes the element itself, not an id — the studio passes a
      // node, so the exported code must too or it throws on innerHTML.
      hasLegend ? `chart.enableLegend(document.getElementById('legend'));` : '',
    ].join('\n'));
  }

  // dom
  const block = def.dom;
  return tidy([
    ...header,
    '',
    `const spec = ${serialize(publicSpec(spec), 0)};`,
    '',
    helperSource(block).trim(),
    '',
    toFunctionSource(attachTips),
    '',
    namedFunction(block.mount, 'mount'),
    '',
    `const host = document.getElementById('chart');`,
    `mount(host, spec);`,
    `attachTips(host);`,
    ...(hasLegend ? ['', legendCode(legend, false)] : []),
  ].join('\n'));
}

/**
 * The comment header that opens the JS tab, naming exactly what has to be on
 * the page for the snippet below it to run. Copying the JS alone is the most
 * common way to end up with a blank canvas, so the script tags are spelled out
 * here rather than pointing at another tab.
 */
function dependencyHeader(def, deps) {
  const cdn = cdnOnly(deps);
  const scripts = scriptsOnly(deps);
  const data = deps.filter((d) => d.kind === 'data');
  const lines = [`// ${def.title} — ${ENGINE_LABEL[engineOf(def)]}`];

  if (engineOf(def) === 'native') {
    lines.push(`//`);
    lines.push(`// Needs the OpenCharts engine: copy js/core/ and js/charts/ next to`);
    lines.push(`// this file. No CDN, no build step, no other dependency.`);
    return lines;
  }
  if (!cdn.length) {
    lines.push(`//`);
    lines.push(`// No library required — this chart is drawn with the browser's own APIs.`);
    return lines;
  }

  lines.push(`//`);
  if (scripts.length) {
    lines.push(`// Requires ${scripts.length === 1 ? 'this script' : 'these scripts'} on the page, in this order:`);
    scripts.forEach((lib) => {
      // The closing tag is escaped: an unescaped </script> inside this comment
      // would terminate the enclosing <script> block when the snippet is
      // embedded in a page, dumping the rest of the code out as visible text.
      lines.push(`//   ${safeForInlineScript(scriptTag(lib))}`);
      lines.push(`//     ${describe(lib)} — ${lib.homepage}`);
    });
  }
  if (data.length) {
    lines.push(`//`);
    lines.push(`// Also fetches ${data.length === 1 ? 'this data file' : 'these data files'} at runtime:`);
    data.forEach((lib) => {
      lines.push(`//   ${lib.url}`);
      lines.push(`//     ${describe(lib)} — ${lib.homepage}`);
    });
  }
  return lines;
}

/** A complete, runnable HTML document. */
function buildStandalone(def, spec, html, css, js) {
  const engine = engineOf(def);
  const allDeps = dependenciesFor(def);
  const deps = scriptsOnly(allDeps);
  const dataDeps = allDeps.filter((d) => d.kind === 'data');
  const isModule = engine === 'native';

  // Each tag is labelled so whoever opens the file can see what it pulls in,
  // from where, and under which licence — without leaving the file.
  const scriptBlock = deps.length
    ? [
      `<!-- Libraries this chart needs, in load order -->`,
      ...deps.flatMap((lib) => [
        `<!-- ${describe(lib)} · ${lib.homepage} -->`,
        scriptTag(lib),
      ]),
    ]
    : [`<!-- No charting library needed — this chart draws itself. -->`];

  if (dataDeps.length) {
    scriptBlock.push(`<!-- Fetched at runtime by the script below: -->`);
    dataDeps.forEach((lib) => scriptBlock.push(`<!--   ${describe(lib)} · ${lib.url} -->`));
  }

  return tidy([
    `<!DOCTYPE html>`,
    `<html lang="en">`,
    `<head>`,
    `<meta charset="UTF-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeText(def.title)}</title>`,
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">`,
    ...scriptBlock,
    `<style>`,
    `body {`,
    `  margin: 0;`,
    `  min-height: 100vh;`,
    `  display: grid;`,
    `  place-items: center;`,
    `  padding: 32px;`,
    `  background: #faf9f5;`,
    `  font-family: 'DM Sans', system-ui, sans-serif;`,
    `}`,
    ``,
    `.chart-card { width: 100%; max-width: 860px; }`,
    ``,
    `@media (prefers-color-scheme: dark) { body { background: #0e0e13; } }`,
    ``,
    indent(css, 0),
    `</style>`,
    `</head>`,
    `<body>`,
    ``,
    indent(html, 0),
    ``,
    isModule ? `<script type="module">` : `<script>`,
    indent(safeForInlineScript(js), 0),
    `</script>`,
    `</body>`,
    `</html>`,
  ].join('\n'));
}

function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Produce all four code views for a chart.
 *
 * @returns {{html:string, css:string, js:string, standalone:string, note:string}}
 */
export function generateCode(def, spec) {
  let html, css, js;
  try {
    html = buildHTML(def, spec);
    css = buildCSS(def, spec);
    js = buildJS(def, spec);
  } catch (err) {
    const msg = `/* Code generation failed: ${err.message} */`;
    return { html: msg, css: msg, js: msg, standalone: msg, note: 'Code generation failed.' };
  }

  const standalone = buildStandalone(def, spec, html, css, js);
  const engine = engineOf(def);
  const deps = dependenciesFor(def);
  const cdn = cdnOnly(deps);

  let note;
  if (engine === 'native') {
    note = 'Bundled engine — copy js/core/ and js/charts/ next to the exported file.';
  } else if (cdn.length) {
    note = `${cdn.length} CDN script${cdn.length > 1 ? 's' : ''} required — listed above, and already in the Standalone tab.`;
  } else {
    note = 'No CDN and no library — this chart is drawn with the browser’s own APIs.';
  }

  return { html, css, js, standalone, note, deps };
}
