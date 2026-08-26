/**
 * OpenCharts test suite.
 *
 * Renders all 97 charts in a real headless browser and checks each one for
 * the failures that actually happen in this codebase:
 *
 *   - a chart that throws, or renders nothing
 *   - a canvas that is technically present but blank
 *   - a data editor that rejects its own example
 *   - a chart that breaks once real data is pasted into it
 *   - generated code that fails to parse, or omits a dependency it needs
 *
 * A headless browser rather than jsdom is not optional here: two thirds of the
 * library draws to a real canvas or measures real layout, and jsdom would give
 * a green run while rendering nothing.
 *
 *   node test/run.mjs            all suites
 *   node test/run.mjs --only geo only chart ids containing "geo"
 *   node test/run.mjs --headed   watch it happen
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8123);

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const headed = args.includes('--headed');

/* ── a static server, so the suite needs nothing running beforehand ──────── */

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png',
};

/** Standalone exports the suite wants to load over http rather than data: urls. */
const generated = new Map();

function serve() {
  const server = createServer(async (req, res) => {
    try {
      // Exported files are served from the project root so their relative
      // imports (./js/charts/…) and CDN scripts resolve exactly as they would
      // for someone who saved the file next to the repo.
      const gen = generated.get((req.url || '').split('?')[0]);
      if (gen) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(gen);
        return;
      }
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      const rel = normalize(url === '/' ? '/index.html' : url).replace(/^([/\\])+/, '');
      // Never serve outside the project root.
      const path = join(ROOT, rel);
      if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

/* ── reporting ───────────────────────────────────────────────────────────── */

const failures = [];
const notes = [];
let checks = 0;

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function check(ok, label, detail) {
  checks++;
  if (!ok) failures.push({ label, detail });
  return ok;
}

/* ── the run ─────────────────────────────────────────────────────────────── */

const server = await serve();
const browser = await chromium.launch({ headless: !headed });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Any uncaught page error is a failure, wherever it comes from.
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

const base = `http://127.0.0.1:${PORT}`;
console.log(bold('\nOpenCharts test suite') + dim(`  ${base}\n`));

await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });

/* Suite 1 — the registry is coherent. */
const meta = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const ids = reg.CHARTS.map((c) => c.id);
  return {
    total: reg.CHARTS.length,
    categories: reg.CATEGORIES.length,
    duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
    uncategorised: reg.CHARTS.filter((c) => !reg.CATEGORY_ORDER.includes(c.category)).map((c) => c.id),
    missingBlurb: reg.CHARTS.filter((c) => !c.blurb || c.blurb.length < 10).map((c) => c.id),
    missingTags: reg.CHARTS.filter((c) => !c.tags || c.tags.length < 2).map((c) => c.id),
    ids,
  };
});

check(meta.total > 0, 'registry has charts');
check(!meta.duplicateIds.length, 'chart ids are unique', meta.duplicateIds.join(', '));
check(!meta.uncategorised.length, 'every chart has a known category', meta.uncategorised.join(', '));
check(!meta.missingBlurb.length, 'every chart has a blurb', meta.missingBlurb.join(', '));
check(!meta.missingTags.length, 'every chart has search tags', meta.missingTags.join(', '));
console.log(`  ${green('✓')} registry — ${meta.total} charts, ${meta.categories} categories`);

/* Suite 2 — every chart renders, takes data, and generates code. */
const targets = only ? meta.ids.filter((id) => id.includes(only)) : meta.ids;
if (only) console.log(dim(`  filtered to "${only}" — ${targets.length} charts`));

const results = await page.evaluate(async (ids) => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const cdn = await import('/js/studio/cdn.js');
  const { applyData } = await import('/js/studio/dataio.js');

  const host = document.createElement('div');
  host.style.cssText = 'width:900px;height:440px;position:fixed;left:-9999px;top:0';
  document.body.appendChild(host);
  const legendHost = document.createElement('div');
  document.body.appendChild(legendHost);

  const out = [];

  /** A canvas can exist and still be empty; sample it for actual ink. */
  const hasInk = (canvas) => {
    if (!canvas || !canvas.width) return false;
    const px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let n = 0;
    for (let i = 3; i < px.length; i += 4 * 197) if (px[i] > 10) n++;
    return n >= 5;
  };

  for (const id of ids) {
    const def = reg.getChart(id);
    const r = { id, problems: [] };
    try {
      const spec = reg.newSpec(def);

      // Renders from defaults.
      let inst = eng.renderChart(def, host, spec);
      if (inst.engine === 'error') {
        r.problems.push('render failed: ' + host.textContent.trim().slice(0, 70));
      } else {
        if (def.engine === 'canvas' && !hasInk(host.querySelector('canvas'))) {
          r.problems.push('canvas rendered blank');
        }
        if (def.engine === 'd3' && !host.querySelector('svg')) r.problems.push('no svg produced');
      }

      // Legend, where the chart declares one.
      const items = def.legend ? def.legend(spec) : null;
      eng.renderLegend(legendHost, items, inst);
      if (items && items.length && !legendHost.children.length) r.problems.push('legend empty');
      eng.destroyInstance(inst);

      // Data editor round trip.
      if (!def.data) {
        r.problems.push('no data editor');
      } else {
        const fresh = reg.newSpec(def);
        const res = applyData(def, fresh, def.data.example || '');
        if (!res.ok) r.problems.push('example rejected: ' + res.message);
        else {
          if (typeof def.onChange === 'function') def.onChange(fresh);
          const inst2 = eng.renderChart(def, host, fresh);
          if (inst2.engine === 'error') r.problems.push('broke after pasting its own example');
          eng.destroyInstance(inst2);
        }
      }

      // Code generation, and dependency honesty.
      const code = eng.generateCode(def, spec);
      for (const tab of ['html', 'css', 'js', 'standalone']) {
        if (!code[tab] || !code[tab].trim()) r.problems.push('empty ' + tab + ' tab');
      }
      if (code.js.includes('Code generation failed')) r.problems.push('codegen threw');
      // The JS must parse on its own once imports are stripped.
      try {
        // eslint-disable-next-line no-new-func
        new Function(code.js.replace(/^import .*$/gm, ''));
      } catch (e) {
        r.problems.push('generated JS does not parse: ' + e.message.slice(0, 60));
      }
      cdn.scriptsOnly(code.deps || []).forEach((lib) => {
        if (!code.js.includes(lib.url)) r.problems.push('JS header omits ' + lib.name);
        if (!code.standalone.includes(lib.url)) r.problems.push('standalone omits ' + lib.name);
      });
    } catch (e) {
      r.problems.push('THREW ' + String(e.message).slice(0, 90));
    }
    out.push(r);
  }

  host.remove();
  legendHost.remove();
  return out;
}, targets);

let passed = 0;
for (const r of results) {
  if (r.problems.length) {
    r.problems.forEach((p) => failures.push({ label: r.id, detail: p }));
  } else passed++;
  checks++;
}
console.log(`  ${failures.length ? red('✗') : green('✓')} charts — ${passed}/${results.length} clean`);

/* Suite 3 — the gallery works as a page, not just as modules. */
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const gallery = await page.evaluate(() => ({
  tiles: document.querySelectorAll('.card').length,
  live: [...document.querySelectorAll('.card-canvas')].filter((h) => h.querySelector('canvas, svg, .waffle-grid')).length,
  filters: document.querySelectorAll('.filter').length,
  credits: document.querySelectorAll('.foot-lib').length,
  count: (document.querySelector('#result-count') || {}).textContent,
}));
check(gallery.tiles === meta.total, 'gallery lists every chart', `${gallery.tiles} tiles vs ${meta.total} charts`);
check(gallery.live > 0, 'gallery mounts live previews', `${gallery.live} mounted`);
check(gallery.filters >= meta.categories, 'gallery has a filter per category');
check(gallery.credits > 0, 'gallery credits its dependencies');
console.log(`  ${green('✓')} gallery — ${gallery.tiles} tiles, ${gallery.live} previews live`);

/* Suite 4 — search and filtering. */
const search = await page.evaluate(async () => {
  const el = document.querySelector('#search');
  const set = async (v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
    return document.querySelectorAll('.card').length;
  };
  const stacked = await set('stacked');
  const nonsense = await set('zzzznotachart');
  const empty = !!document.querySelector('.empty');
  await set('');
  return { stacked, nonsense, empty };
});
check(search.stacked > 0 && search.stacked < meta.total, 'search narrows results', `"stacked" → ${search.stacked}`);
check(search.nonsense === 0 && search.empty, 'search shows an empty state');
console.log(`  ${green('✓')} search — "stacked" → ${search.stacked}, no-match → empty state`);

/* Suite 5 — the studio page itself. */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const studio = await page.evaluate(() => ({
  title: (document.querySelector('#chart-title') || {}).textContent,
  controls: document.querySelectorAll('.controls .ctrl-group').length,
  dataEditor: !!document.querySelector('.data-paste'),
  tabs: document.querySelectorAll('.tab').length,
  gutterLines: document.querySelectorAll('.gutter span').length,
  sources: document.querySelectorAll('.source-row').length,
  railGroups: document.querySelectorAll('.rail-group').length,
}));
check(/Vertical Bar/.test(studio.title || ''), 'studio loads the chart named in the URL');
check(studio.dataEditor, 'studio shows the data editor first');
check(studio.tabs === 4, 'studio offers four code tabs', String(studio.tabs));
check(studio.gutterLines > 0, 'code panel renders line numbers');
check(studio.sources > 0, 'sources panel lists dependencies');
check(studio.railGroups > 0, 'rail renders collapsible categories');
console.log(`  ${green('✓')} studio — ${studio.controls} control groups, ${studio.sources} sources`);

/* Suite 6 — editing a control actually changes the generated code. */
const live = await page.evaluate(async () => {
  document.querySelector('.tab[data-tab="js"]').click();
  await new Promise((r) => setTimeout(r, 200));
  const read = () => document.querySelector('.code-body').textContent;
  const before = read();

  const slider = [...document.querySelectorAll('.controls .field')]
    .find((f) => f.textContent.includes('Corner radius'))
    .querySelector('input[type=range]');
  slider.value = '13';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  const after = read();
  return { changed: before !== after, hasRadius: /borderRadius:\s*13/.test(after) };
});
check(live.changed, 'editing a control updates the code');
check(live.hasRadius, 'the edit appears verbatim in the code');
console.log(`  ${green('✓')} live editing — control change reaches the JS tab`);

/* Suite 7 — pasting data drives the chart. */
const paste = await page.evaluate(async () => {
  const area = document.querySelector('.data-paste');
  area.value = 'label,Alpha,Beta\nOne,10,20\nTwo,30,40\nThree,50,60';
  [...document.querySelectorAll('.controls .btn')]
    .find((b) => b.textContent.includes('Use this data')).click();
  await new Promise((r) => setTimeout(r, 500));
  return {
    status: (document.querySelector('.data-status') || {}).textContent || '',
    legend: document.querySelector('#legend').textContent,
    code: document.querySelector('.code-body').textContent.includes("'Alpha'"),
  };
});
check(/Loaded 3 rows/.test(paste.status), 'pasted data is accepted', paste.status);
check(/Alpha/.test(paste.legend), 'pasted series reach the legend');
check(paste.code, 'pasted data reaches the generated code');
console.log(`  ${green('✓')} data editor — paste → chart → code`);

/* Suite 8 — a shared link round-trips an edited chart. */
const shareToken = await page.evaluate(async () => {
  const { encodeSpec, decodeSpec } = await import('/js/studio/share.js');
  // A spec with edits that must survive the trip.
  const spec = {
    labels: ['A', 'B', 'C'],
    series: [{ label: 'Mine', color: '#123456', data: [7, 8, 9] }],
    opts: { radius: 11, prefix: '€' },
    _internal: 'must not travel',
  };
  const token = await encodeSpec(spec);
  const back = await decodeSpec(token);
  return {
    token,
    roundTripped: JSON.stringify(back.series) === JSON.stringify(spec.series)
      && back.opts.radius === 11 && back.opts.prefix === '€',
    strippedInternal: back._internal === undefined,
    compressed: token[0] === 'z',
    garbageIsNull: (await decodeSpec('znot-a-real-token')) === null,
  };
});
check(shareToken.roundTripped, 'shared spec survives encode → decode');
check(shareToken.strippedInternal, 'internal fields are stripped from links');
check(shareToken.garbageIsNull, 'a corrupt link decodes to null rather than throwing');

// And the studio actually opens one.
await page.goto(`${base}/studio.html?chart=bar-vertical&s=${encodeURIComponent(shareToken.token)}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const restored = await page.evaluate(() => ({
  legend: document.querySelector('#legend').textContent,
  code: document.querySelector('.code-body').textContent,
}));
check(/Mine/.test(restored.legend), 'a shared link restores the edited series');
console.log(`  ${green('✓')} sharing — round-trip, ${shareToken.compressed ? 'compressed' : 'raw'}, ${shareToken.token.length} chars`);

/* Suite 9 — the exported standalone file genuinely runs. */
const exported = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  // One per rendering engine, plus the plugin-backed and async ones.
  const ids = ['bar-vertical', 'funnel', 'sunburst', 'waffle', 'box-plot', 'engine-line', 'globe'];
  const out = [];
  for (const id of ids) {
    const def = reg.getChart(id);
    const code = eng.generateCode(def, reg.newSpec(def));
    out.push({ id, html: code.standalone });
  }
  return out;
});

let exportsOk = 0;
for (const { id, html } of exported) {
  const probe = await browser.newPage();
  const errs = [];
  probe.on('pageerror', (e) => errs.push(String(e.message)));
  // Serve it rather than setContent: an about:blank document has no origin,
  // so CDN scripts and relative module imports would both fail for reasons
  // that say nothing about whether the export is correct.
  // Served from the project root, not a subfolder: the custom-engine export
  // imports './js/charts/…' and is documented as needing js/ beside it, so
  // root is where a user would actually put the file.
  const route = `/export-${id}.html`;
  generated.set(route, html);
  await probe.goto(base + route, { waitUntil: 'networkidle' });
  // Geo charts fetch their boundaries after load, so wait for real work to
  // finish rather than for the document to be idle.
  await probe.waitForTimeout(1500);
  await probe
    .waitForFunction(() => {
      const c = document.querySelector('canvas');
      if (c && c.width) {
        const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < px.length; i += 4 * 197) if (px[i] > 10) return true;
        return false;
      }
      const svg = document.querySelector('svg');
      if (svg) return svg.querySelectorAll('path,circle,rect,line').length > 3;
      return document.querySelectorAll('.waffle-cell').length > 10;
    }, { timeout: 12000 })
    .catch(() => {});
  const state = await probe.evaluate(() => {
    const c = document.querySelector('canvas');
    let ink = 0;
    if (c && c.width) {
      const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < px.length; i += 4 * 197) if (px[i] > 10) ink++;
    }
    const svg = document.querySelector('svg');
    return {
      drew: c ? ink >= 5
        : svg ? svg.querySelectorAll('path,circle,rect,line').length > 3
          : document.querySelectorAll('.waffle-cell').length > 10,
      canvas: !!c, svg: !!svg, ink,
      libs: { Chart: typeof window.Chart, d3: typeof window.d3, topojson: typeof window.topojson },
    };
  });
  await probe.close();
  // Say what actually went wrong, not just that something did.
  const why = errs.length ? errs[0]
    : !state.canvas && !state.svg ? 'no canvas or svg in the document'
      : state.canvas && !state.ink ? 'canvas present but nothing drawn'
        : `libs: ${JSON.stringify(state.libs)}`;
  if (check(state.drew && !errs.length, `standalone export runs: ${id}`, why)) exportsOk++;
}
console.log(`  ${green('✓')} exports — ${exportsOk}/${exported.length} standalone files run clean`);

/* Suite 10 — responsive layout produces no horizontal overflow. */
for (const width of [390, 768, 1280]) {
  await page.setViewportSize({ width, height: 900 });
  for (const path of ['/index.html', '/studio.html?chart=sankey']) {
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      return de.scrollWidth - de.clientWidth;
    });
    check(overflow <= 1, `no horizontal overflow at ${width}px on ${path}`, `${overflow}px`);
  }
}
console.log(`  ${green('✓')} responsive — no overflow at 390 / 768 / 1280px`);

/* Suite 11 — nothing wrote to the console along the way. */
const realErrors = pageErrors.filter((e) => !/favicon|net::ERR_/i.test(e));
check(!realErrors.length, 'no page errors during the run', realErrors.slice(0, 3).join(' | '));
console.log(`  ${realErrors.length ? red('✗') : green('✓')} console — ${realErrors.length} errors`);

await browser.close();
server.close();

/* ── result ──────────────────────────────────────────────────────────────── */

console.log('');
if (failures.length) {
  console.log(red(bold(`${failures.length} failure${failures.length > 1 ? 's' : ''}`)) + dim(` of ${checks} checks\n`));
  const byLabel = new Map();
  failures.forEach((f) => {
    if (!byLabel.has(f.label)) byLabel.set(f.label, []);
    byLabel.get(f.label).push(f.detail);
  });
  for (const [label, details] of byLabel) {
    console.log(`  ${red('✗')} ${label}`);
    details.forEach((d) => d && console.log(`      ${dim(d)}`));
  }
  console.log('');
  process.exit(1);
}
console.log(green(bold(`All ${checks} checks passed`)) + dim(`  ·  ${meta.total} charts\n`));
notes.forEach((n) => console.log(dim('  ' + n)));
process.exit(0);
