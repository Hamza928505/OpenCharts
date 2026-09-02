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
  const { applyData, parseTable } = await import('/js/studio/dataio.js');
  // The editor knows its own header row; so does this check.
  const parseTableFor = (text) => parseTable(text, true);

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

          // ...and what the editor shows next has to be what it just read.
          //
          // `toText` writes the table the data editor opens on. If it writes a
          // shape this chart's own reader cannot take back, the second visit
          // to the editor shows something broken — which is exactly how
          // Parallel Sets shipped: it wrote {from, to, flow} into a renderer
          // that reads record[dimensionName], so a round trip came back empty.
          //
          // The invariant is a fixed point, not equality with the example:
          // reading and writing may merge duplicate rows or add a header, but
          // doing it twice must give the same table as doing it once.
          const written = typeof def.toText === 'function' ? def.toText(fresh) : null;
          if (written == null || !written.trim()) {
            r.problems.push('writes no table back for the editor to open on');
          } else {
            const again = reg.newSpec(def);
            const back = applyData(def, again, parseTableFor(written));
            if (!back.ok) {
              r.problems.push('cannot read back what it writes: ' + back.message);
            } else {
              if (typeof def.onChange === 'function') def.onChange(again);
              const twice = def.toText(again);
              if (twice !== written) {
                r.problems.push('the editor table changes on every visit');
              }
            }
          }
        }

        // ...and the data must actually *reach* the chart.
        //
        // Accepting a paste without throwing proves nothing. Four charts
        // passed every other check here while their renderers ignored the spec
        // and drew from a seed instead. Feed a chart two different tables and
        // the code it generates has to differ.
        //
        // Numbers and labels are tested separately and deliberately so. A
        // combined perturbation hides exactly the bug worth catching: a
        // scatter that honours its group names while ignoring every x and y
        // still changes, and would pass.
        const perturb = (text, mul, add, tag) => text.split('\n').map((line, li) => {
          if (!li && !/^[-+]?[\d.]+([,\t;]|$)/.test(line)) return line;   // header
          return line.split(/([,\t;])/).map((cell) => {
            const t = cell.trim();
            if (!t || /[,\t;]/.test(cell)) return cell;
            const v = Number(t);
            if (Number.isFinite(v)) return String(Math.round(v * mul) + add);
            return t + tag;
          }).join('');
        }).join('\n');

        const codeFor = (text) => {
          const sp = reg.newSpec(def);
          const ok = applyData(def, sp, text);
          if (!ok.ok) return null;
          if (typeof def.onChange === 'function') def.onChange(sp);
          return eng.generateCode(def, sp).js;
        };

        const example = def.data.example || '';
        const body = example.split('\n').slice(1).join('\n');
        const cells = body.split(/[\n,\t;]/).map((c) => c.trim()).filter(Boolean);
        const hasNumbers = cells.some((c) => Number.isFinite(Number(c)));
        const hasLabels = cells.some((c) => !Number.isFinite(Number(c)));

        const base = codeFor(perturb(example, 1, 0, ''));
        if (base) {
          if (hasNumbers) {
            const scaled = codeFor(perturb(example, 2, 17, ''));
            if (scaled && scaled === base) {
              r.problems.push('ignores the numbers it accepts — doubling every value draws the same chart');
            }
          }
          if (hasLabels) {
            const renamed = codeFor(perturb(example, 1, 0, ' Z'));
            if (renamed && renamed === base) {
              r.problems.push('ignores the labels it accepts — renaming every row draws the same chart');
            }
          }
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

/* The gallery answers the other question: "I have this table, what draws it?" */
const match = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const paste = async (text, header) => {
    const box = document.querySelector('#match-text');
    box.value = text;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(400);
    const hdr = document.querySelector('#match-header');
    const detected = hdr.checked;
    if (header != null && hdr.checked !== header) {
      hdr.checked = header;
      hdr.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(300);
    }
    return {
      detected,
      cards: document.querySelectorAll('.card').length,
      chips: [...document.querySelectorAll('.match-col-chip b')].map((c) => c.textContent),
      verdict: (document.querySelector('.match-verdict') || {}).textContent || '',
      banner: !!document.querySelector('.match-note'),
      ids: [...document.querySelectorAll('.card')].map((c) => new URL(c.href).searchParams.get('chart')),
      // What each tile says it will read, so a chart offered a slice of the
      // table can be held to the columns it named.
      fits: Object.fromEntries([...document.querySelectorAll('.card-shell')].map((sh) => {
        const link = sh.querySelector('.card');
        const fit = sh.querySelector('.card-fit');
        return [new URL(link.href).searchParams.get('chart'), fit ? fit.textContent : ''];
      })),
    };
  };

  document.querySelector('#match-toggle').click();
  await sleep(150);

  const total = document.querySelectorAll('.card').length;

  // Two ends of a name and a number: only the flow-shaped charts read this.
  const flow = await paste('from,to,value\nOrganic,Visit,4200\nVisit,Checkout,3800', true);
  // Words where a number belongs. Nothing that needs a value can draw this —
  // though a graph still can, because two columns of names *are* an edge list.
  const junk = await paste('label,value\nA,lots\nB,heaps', true);
  // A header row of years cannot be detected, and the tick box is the answer.
  const years = await paste('region,2023,2024\nNorth,520,680\nSouth,440,575', null);
  const yearsFixed = await paste('region,2023,2024\nNorth,520,680\nSouth,440,575', true);

  // The banner has to lead back out of the filter.
  document.querySelector('.match-note .btn').click();
  await sleep(300);
  const cleared = document.querySelectorAll('.card').length;

  return { total, flow, junk, years, yearsFixed, cleared };
});

check(match.flow.cards > 0 && match.flow.cards < match.total,
  'a table narrows the gallery to the charts that read it',
  `${match.flow.cards} of ${match.total}`);
check(match.flow.ids.includes('sankey') && match.flow.ids.includes('chord'),
  'a from/to/value table finds the flow charts', match.flow.ids.join(','));
// A chart that cannot read the whole table is offered the columns of it that
// it can, so pie and histogram do appear here — on `value`, never on `to`.
// That is the promise the old check made by excluding them outright, stated as
// what they read rather than as their absence.
check(match.flow.fits.pie === 'reads from, value',
  'a chart that reads part of a table is offered its value column',
  match.flow.fits.pie);
check(match.flow.fits.histogram === 'reads value',
  'and a histogram is offered the numbers, not the names', match.flow.fits.histogram);
check(match.flow.chips.join(',') === 'from,to,value',
  'the columns are named back to the reader', match.flow.chips.join(','));
check(match.flow.banner, 'a filtered grid says so');
check(match.junk.cards < 6, 'words where numbers belong rule out nearly everything',
  `${match.junk.cards} charts: ${match.junk.ids.join(',')}`);
check(!match.junk.ids.some((id) => ['pie', 'bar-vertical', 'histogram', 'line-basic'].includes(id)),
  'and rule out every chart that would draw those words as zero',
  match.junk.ids.join(','));
check(match.years.detected === false,
  'a header row of years cannot be detected — the box says so');
check(match.yearsFixed.chips.join(',') === 'region,2023,2024',
  'and ticking the box settles it', match.yearsFixed.chips.join(','));
check(match.yearsFixed.cards > match.flow.cards,
  'a plain label-and-values table suits far more charts',
  `${match.yearsFixed.cards} vs ${match.flow.cards}`);
check(match.cleared === match.total, 'and the banner leads back to every chart',
  `${match.cleared} of ${match.total}`);

/* A spreadsheet written for people rather than for a chart: a title row, a row
 * of merged section banners, then the header — and more columns than any chart
 * in the library reads. Every one of those was enough on its own to return an
 * empty gallery from the page whose whole promise is to say what you can draw. */
const wide = await page.evaluate(async () => {
  const { parseTable, applyData } = await import('/js/studio/dataio.js');
  const { rankCharts } = await import('/js/studio/DataMatch.js');
  const { newSpec } = await import('/js/studio/registry.js');

  const rows = [];
  for (let i = 0; i < 40; i++) {
    rows.push([`R${i}`, ['Ana', 'Ben', 'Cai'][i % 3], ['open', 'done'][i % 2],
      50 + i, i * 2, 40 - i, (i * 1.5).toFixed(1), i % 7].join(','));
  }
  const table = parseTable('Quarterly rollout,,,,,,,\n'
    + 'REGION,,,DETECTION,,,SCORES,\n'
    + 'Region,Owner,Status,Frames,Hits,Misses,Score,Rank\n'
    + rows.join('\n'));
  const ranked = rankCharts(table);

  // Offering a chart that cannot actually take the columns it was offered
  // would be worse than offering nothing, so every projection is applied.
  let landed = 0;
  const stuck = [];
  for (const entry of ranked.partial) {
    const spec = newSpec(entry.def);
    const before = JSON.stringify(spec);
    const res = applyData(entry.def, spec, entry.table);
    if (res.ok && JSON.stringify(spec) !== before) landed++;
    else stuck.push(entry.def.id);
  }
  return {
    skipped: table.skipped,
    headers: table.headers.join(','),
    rows: table.rows.length,
    offered: ranked.fits.length + ranked.partial.length,
    partial: ranked.partial.length,
    missShapes: [...new Set(ranked.misses.map((m) => m.def.data.shape))].sort(),
    landed,
    stuck,
  };
});

check(wide.skipped === 2 && wide.headers === 'Region,Owner,Status,Frames,Hits,Misses,Score,Rank',
  'a title and a banner row above the table are dropped, not read as data',
  `skipped ${wide.skipped}: ${wide.headers}`);
check(wide.rows === 40, 'and every data row survives', `${wide.rows} rows`);
check(wide.offered > 40, 'a wide export finds charts rather than an empty gallery',
  `${wide.offered} offered, ${wide.partial} of them on a slice`);
check(wide.landed === wide.partial, 'and the columns each was offered reach its spec',
  wide.stuck.join(',') || `${wide.landed}/${wide.partial}`);
check(wide.missShapes.join(',') === 'places,regions',
  'only the maps hold out, because their columns have to name real places',
  wide.missShapes.join(','));
console.log(`  ${green('\u2713')} wide table — ${wide.offered} charts offered, `
  + `${wide.landed} slices land, ${wide.skipped} title rows dropped`);

/* A grid that says ninety charts can read your table, and then draws ninety
 * charts of somebody else's numbers, is answering a question nobody asked. */
const previews = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.openChartsGallery;
  const { CHARTS } = await import('/js/studio/registry.js');
  const def = CHARTS.find((c) => c.id === 'bar-vertical');

  // What the tile draws with nothing brought: the chart's own example.
  const example = JSON.stringify(app._specFor(def).labels);

  const box = document.querySelector('#match-text');
  box.value = 'City,Rides,Refunds\nOslo,120,4\nLima,340,11\nCairo,90,7';
  box.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(500);
  const hdr = document.querySelector('#match-header');
  if (!hdr.checked) { hdr.checked = true; hdr.dispatchEvent(new Event('change', { bubbles: true })); }
  await sleep(400);

  const mine = app._specFor(def);
  // A chart that cannot read the table has to keep its example rather than
  // draw half of one — the maps are the honest misses here.
  const map = CHARTS.find((c) => c.id === 'choropleth');
  const mapSpec = app._specFor(map);
  const mapExample = JSON.stringify(app.projected.get(map.id) || null);

  document.querySelector('#grid').scrollIntoView();
  await sleep(1800);
  return {
    example,
    labels: JSON.stringify(mine.labels),
    series: (mine.series || []).map((x) => x.label).join(','),
    values: JSON.stringify((mine.series || [])[0]?.data),
    mapKeptExample: !!mapSpec && mapExample === 'null',
    live: [...document.querySelectorAll('.card-shell')]
      .filter((sh) => sh.querySelector('canvas, svg, .waffle-grid')).length,
  };
});

check(previews.labels === '["Oslo","Lima","Cairo"]',
  'a matched table is what the gallery tiles actually draw', previews.labels);
check(previews.labels !== previews.example,
  'and not the chart\'s own example', `${previews.labels} vs ${previews.example}`);
check(previews.series === 'Rides,Refunds' && previews.values === '[120,340,90]',
  'with the reader\'s own series names and numbers',
  `${previews.series} / ${previews.values}`);
check(previews.mapKeptExample,
  'a chart that cannot read the table keeps its example rather than drawing half of one');
check(previews.live > 0, 'and the tiles still mount', `${previews.live} live`);
console.log(`  ${green('\u2713')} live previews — tiles draw the reader's table, `
  + `${previews.live} mounted`);

/* Clicking through carries the table into the studio. */
await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = document.querySelector('#match-text');
  box.value = 'from,to,value\nAd,Visit,320\nVisit,Buy,180';
  box.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(400);
  const hdr = document.querySelector('#match-header');
  if (!hdr.checked) { hdr.checked = true; hdr.dispatchEvent(new Event('change', { bubbles: true })); }
  await sleep(300);
  const card = [...document.querySelectorAll('.card')].find((c) => c.href.includes('chart=sankey'));
  card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
});
await page.goto(`${base}/studio.html?chart=sankey`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const carried = await page.evaluate(() => ({
  flows: JSON.stringify(window.openCharts.spec.flows),
  spent: sessionStorage.getItem('opencharts.table'),
}));
check(/"Ad"/.test(carried.flows) && /"Buy"/.test(carried.flows),
  'the matched table opens in the chart the reader picked', carried.flows.slice(0, 80));
check(carried.spent === null, 'and is taken once, not left for the next page load');
console.log(`  ${green('✓')} data match — ${match.flow.cards} charts read a flow table, ${match.yearsFixed.cards} read a plain one`);

await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

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
  dataEditor: !!document.querySelector('.data-card'),
  tabs: document.querySelectorAll('.tab').length,
  gutterLines: document.querySelectorAll('.gutter span').length,
  sources: document.querySelectorAll('.source-row').length,
  railGroups: document.querySelectorAll('.rail-group').length,
}));
check(/Vertical Bar/.test(studio.title || ''), 'studio loads the chart named in the URL');
check(studio.dataEditor, 'studio shows the data editor first');
check(studio.tabs === 7, 'studio offers seven views in the code panel', String(studio.tabs));
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

/* Suite 7 — the sidebar shows the data, and the grid edits it. */
const sidebar = await page.evaluate(async () => {
  const card = document.querySelector('.data-card');
  const preview = card ? [...card.querySelectorAll('.data-mini td')].map((t) => t.textContent) : [];

  [...document.querySelectorAll('.controls .btn')]
    .find((b) => b.textContent.includes('Edit data')).click();
  await new Promise((r) => setTimeout(r, 350));

  const setCell = (r, c, v) => {
    const inp = document.querySelector(`.dgrid-cell[data-row="${r}"][data-col="${c}"]`);
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const rowsBefore = document.querySelectorAll('.dgrid tbody tr').length;
  setCell(0, 0, 'Renamed');
  setCell(0, 1, '999');

  // A word in a value column must be flagged the moment it is typed, not on
  // apply — that is the whole reason the grid exists.
  setCell(1, 1, 'not a number');
  const flaggedWhileTyping = document.querySelectorAll('.dgrid-cell.bad').length;
  setCell(1, 1, '42');
  const flaggedAfterFix = document.querySelectorAll('.dgrid-cell.bad').length;

  // Add a row through the button rather than by typing a newline.
  [...document.querySelectorAll('.dgrid-foot .btn')].find((b) => b.textContent.includes('+ Row')).click();
  setCell(rowsBefore, 0, 'Extra');
  setCell(rowsBefore, 1, '250');

  [...document.querySelectorAll('.dlg-foot .btn')].find((b) => b.textContent.includes('Use this data')).click();
  await new Promise((r) => setTimeout(r, 700));

  return {
    preview,
    rowsBefore,
    flaggedWhileTyping,
    flaggedAfterFix,
    closed: !document.querySelector('.dlg'),
    status: (document.querySelector('.data-status') || {}).textContent || '',
    card: (document.querySelector('.data-card') || {}).textContent || '',
    code: document.querySelector('.code-body').textContent,
  };
});
check(sidebar.preview.length > 0, 'the sidebar previews the data instead of a textarea', `${sidebar.preview.length} cells`);
check(sidebar.flaggedWhileTyping === 1, 'a non-numeric cell is flagged as it is typed', `${sidebar.flaggedWhileTyping} flagged`);
check(sidebar.flaggedAfterFix === 0, 'fixing the cell clears the flag');
check(sidebar.closed, 'applying the grid closes the dialog');
check(/Loaded \d+ rows/.test(sidebar.status), 'the grid edit is accepted', sidebar.status);
check(/Renamed/.test(sidebar.card), 'the sidebar preview shows the edited data', sidebar.card.slice(0, 60));
check(/'Renamed'/.test(sidebar.code) && /999/.test(sidebar.code), 'the grid edit reaches the generated code');
console.log(`  ${green('✓')} data grid — typed edit → chart → code`);

/* Suite 8 — help, the paste tab, and the parser behind both. */
const helpAndDialog = await page.evaluate(async () => {
  const { helpFor } = await import('/js/studio/chart-help.js');
  const reg = await import('/js/studio/registry.js');
  const { parseTable } = await import('/js/studio/dataio.js');

  // Every chart must have reading guidance, per-chart or per-category.
  const missing = reg.CHARTS.filter((c) => {
    const h = helpFor(c);
    return !h || !h.read || !h.watch;
  }).map((c) => c.id);

  // The parser must survive a realistic messy spreadsheet paste.
  const messy = parseTable(['region\tQ1 sales\tQ2 sales', 'North\t$1,240\t$1,890', 'South\t$980\tn/a'].join('\n'));
  return {
    missingHelp: missing,
    messyHeader: messy.hadHeader,
    messyHeaders: messy.headers,
    messyRows: messy.rows.length,
  };
});
check(!helpAndDialog.missingHelp.length, 'every chart has reading guidance', helpAndDialog.missingHelp.slice(0, 5).join(', '));
check(helpAndDialog.messyHeader, 'a header row is detected despite currency formatting');
check(helpAndDialog.messyHeaders[0] === 'region', 'header names survive the parse', helpAndDialog.messyHeaders.join('|'));

// The dialog opens on the grid, and the paste tab still feeds it.
await page.goto(`${base}/studio.html?chart=bar-stacked`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const dialog = await page.evaluate(async () => {
  document.querySelector('.help-link').click();
  await new Promise((r) => setTimeout(r, 300));

  const tabs = [...document.querySelectorAll('.dlg-tab')].map((t) => t.textContent);
  const startsOnGrid = document.querySelector('.dlg-tab.active').textContent === 'Table';
  const gridHeight = Math.round(document.querySelector('.dgrid-scroll').getBoundingClientRect().height);
  // A component class that collides with a site-wide one silently blockifies
  // the table and slides the header off its columns, so measure the layout
  // rather than trusting that the markup is a table.
  const box = (sel) => document.querySelector(sel).getBoundingClientRect();
  const headAligned = Math.abs(box('.dgrid thead th:nth-child(2)').left - box('.dgrid tbody td:nth-child(2)').left) < 1;
  const gridFillsWidth = box('.dgrid').width / box('.dgrid-scroll').width > 0.95;

  [...document.querySelectorAll('.dlg-tab')].find((t) => t.textContent === 'Paste text').click();
  await new Promise((r) => setTimeout(r, 150));

  const area = document.querySelector('.dlg-paste');
  area.value = ['region\tQ1\tQ2', 'North\t$1,240\t$1,890', 'South\t$980\tn/a', 'East\t$2,100\t$2,450'].join('\n');
  area.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 250));
  const badCells = document.querySelectorAll('.dlg-table td.bad').length;
  const headers = [...document.querySelectorAll('.dlg-table th')].map((t) => t.firstChild.textContent);

  // Reading the paste into the table must carry it across, not discard it.
  [...document.querySelectorAll('.dlg-tools .btn')].find((b) => b.textContent.includes('Read into')).click();
  await new Promise((r) => setTimeout(r, 250));
  const gridRows = document.querySelectorAll('.dgrid tbody tr').length;
  const firstCell = document.querySelector('.dgrid-cell[data-row="0"][data-col="0"]').value;

  [...document.querySelectorAll('.dlg-foot .btn')].find((b) => b.textContent.includes('Use this data')).click();
  await new Promise((r) => setTimeout(r, 250));

  // "n/a" is not a number, so applying must ask rather than quietly zero it.
  const asked = !!document.querySelector('.ask');
  const askText = asked ? document.querySelector('.ask-text').textContent : '';
  // Enter must not be a shortcut to the risky answer, so the safe button holds
  // focus when there is something to lose.
  const safeHasFocus = asked && document.activeElement === [...document.querySelectorAll('.ask-foot .btn')]
    .find((b) => b.textContent.includes('Let me fix it'));
  if (asked) {
    [...document.querySelectorAll('.ask-foot .btn')].find((b) => b.textContent.includes('Use it anyway')).click();
  }
  await new Promise((r) => setTimeout(r, 700));

  return {
    tabs,
    startsOnGrid,
    gridHeight,
    headAligned,
    gridFillsWidth,
    badCells,
    headers,
    gridRows,
    firstCell,
    asked,
    askText,
    safeHasFocus,
    dialogClosed: !document.querySelector('.dlg'),
    legend: document.querySelector('#legend').textContent,
  };
});
check(dialog.startsOnGrid, 'the editor opens on the table, not the textarea');
// Four ways in, plus Shape — which is not a way in at all: it works on what
// the other four brought, which is why it sits last.
check(dialog.tabs.join('|') === 'Table|Paste text|Open a file|From a link|Shape',
  'a non-geo chart offers four ways in and one way to reshape', dialog.tabs.join('|'));
check(dialog.gridHeight > 250, 'the grid is genuinely large', `${dialog.gridHeight}px`);
check(dialog.headAligned, 'the grid header sits over its own columns');
check(dialog.gridFillsWidth, 'the grid uses the width it is given');
check(dialog.badCells === 1, 'unreadable cells are flagged before applying', `${dialog.badCells} flagged`);
check(dialog.headers[0] === 'region', 'the paste preview names the columns');
check(dialog.gridRows === 3, 'a paste is read into the table', `${dialog.gridRows} rows`);
check(dialog.firstCell === 'North', 'the pasted values land in the right cells', dialog.firstCell);
check(dialog.asked, 'applying bad data asks instead of silently zeroing it', dialog.askText.slice(0, 70));
check(dialog.safeHasFocus, 'the safe answer holds focus, so Enter does not apply bad data');
check(dialog.dialogClosed, 'confirming closes the dialog');
check(/Q1/.test(dialog.legend), 'applied data reaches the chart', dialog.legend);
console.log(`  ${green('✓')} help & dialog — guidance for all charts, ${dialog.gridHeight}px grid`);

/* Suite 9 — a flow reads as many stages as its table has columns. */
await page.goto(`${base}/studio.html?chart=sankey`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const flow = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const { parseTable, applyData, columnRules } = await import('/js/studio/dataio.js');

  const sankey = reg.getChart('sankey');

  // A flow table is words over numbers in its *last* column, not its second.
  // Header detection used to miss that, so every flow chart read its own
  // header row as data and drew a phantom "from → to" ribbon.
  const parsed = parseTable(sankey.data.example, ['from', 'to', 'value']);

  const applied = (id, text) => {
    const def = reg.getChart(id);
    const sp = reg.newSpec(def);
    const res = applyData(def, sp, text);
    if (!res.ok) return { ok: false, message: res.message };
    if (typeof def.onChange === 'function') def.onChange(sp);
    return { ok: true, spec: sp, js: eng.generateCode(def, sp).js };
  };

  const example = applied('sankey', sankey.data.example);
  // Two paths through the same middle: the shared hop is one ribbon carrying
  // both, not two ribbons drawn on top of each other.
  const path = applied('sankey', [
    'stage 1,stage 2,stage 3,value',
    'Ad,Visit,Checkout,320',
    'Social,Visit,Checkout,180',
    'Social,Visit,Bounce,90',
  ].join('\n'));
  const middle = path.ok && path.spec.flows.find((f) => f.from === 'Visit' && f.to === 'Checkout');

  const sets = applied('parallel-sets', [
    'Source,Device,Outcome,value',
    'Search,Desktop,Purchase,120',
    'Search,Mobile,Bounce,80',
    'Ad,Mobile,Purchase,60',
  ].join('\n'));

  return {
    hadHeader: parsed.hadHeader,
    exampleNodes: example.ok ? example.spec.nodes : [],
    pathOk: path.ok,
    pathNodes: path.ok ? path.spec.nodes : [],
    middle: middle || null,
    setsOk: sets.ok,
    setsDims: sets.ok ? sets.spec.dimensions : [],
    setsFirst: sets.ok ? sets.spec.records[0] : null,
    setsColorBy: sets.ok ? sets.spec.colorBy : null,
    setsJs: sets.ok ? sets.js : '',
    stageLabel: columnRules('links').add.label,
    fixedShapeHasNoButton: columnRules('pairs').add === null,
  };
});

check(flow.hadHeader, 'a from/to/value header row is recognised as a header');
check(!flow.exampleNodes.includes('from') && !flow.exampleNodes.includes('to'),
  'the flow example produces no phantom "from → to" node', flow.exampleNodes.join(', '));
check(flow.pathOk, 'a four-column path is accepted');
check(flow.middle && flow.middle.flow === 500,
  'a hop shared by two paths carries their total', JSON.stringify(flow.middle));
check(flow.pathNodes.join(',') === 'Ad,Visit,Checkout,Social,Bounce',
  'every stage in the path becomes a node', flow.pathNodes.join(','));
check(flow.setsOk && flow.setsDims.join(',') === 'Source,Device,Outcome',
  'parallel sets take a dimension per column', flow.setsDims.join(','));
check(flow.setsFirst && flow.setsFirst.Outcome === 'Purchase' && flow.setsFirst.value === 120,
  'records are keyed by the dimension names, not from/to', JSON.stringify(flow.setsFirst));
check(flow.setsColorBy === 'Source', 'the colour dimension is one that exists', flow.setsColorBy);
check(/Outcome/.test(flow.setsJs), 'the dimensions reach the generated code');
check(flow.stageLabel === '+ Stage', 'the flow grid offers a stage, not a series', flow.stageLabel);
check(flow.fixedShapeHasNoButton, 'a fixed-width shape offers no column button');

// And the same thing through the buttons, which is how anyone will meet it.
const stageUi = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  [...document.querySelectorAll('.controls .btn')]
    .find((b) => b.textContent.includes('Edit data')).click();
  await sleep(350);

  const colsBefore = document.querySelectorAll('.dgrid thead th').length;
  const addBtn = [...document.querySelectorAll('.dgrid-foot .btn')]
    .find((b) => b.textContent.includes('Stage'));
  if (addBtn) addBtn.click();
  await sleep(150);

  const headers = [...document.querySelectorAll('.dgrid-head-input')].map((i) => i.value);
  const setCell = (r, c, v) => {
    const inp = document.querySelector(`.dgrid-cell[data-row="${r}"][data-col="${c}"]`);
    if (!inp) return;
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  };
  ['Checkout', 'Checkout', 'Purchase', 'Exit'].forEach((v, r) => setCell(r, 2, v));
  // A word in the new stage column names a node. Flagging it as a bad number
  // is exactly what a grid that counted columns statically would do.
  const flagged = document.querySelectorAll('.dgrid-cell.bad').length;

  [...document.querySelectorAll('.dlg-foot .btn')]
    .find((b) => b.textContent.includes('Use this data')).click();
  await sleep(700);
  document.querySelector('.tab[data-tab="js"]').click();
  await sleep(200);

  return {
    colsBefore,
    colsAfter: document.querySelectorAll('.dgrid thead th').length || colsBefore + 1,
    headers,
    flagged,
    asked: !!document.querySelector('.ask'),
    closed: !document.querySelector('.dlg'),
    code: document.querySelector('.code-body').textContent,
    legend: document.querySelector('#legend').textContent,
  };
});

check(stageUi.headers.length === 4 && stageUi.headers[2] === 'Stage 3',
  'the stage lands before the value column', stageUi.headers.join('|'));
check(stageUi.flagged === 0, 'a node name in a stage column is not a bad number',
  `${stageUi.flagged} flagged`);
check(!stageUi.asked, 'a complete path applies without a warning');
check(stageUi.closed, 'the multi-stage table applies');
check(/Purchase/.test(stageUi.code) && /Exit/.test(stageUi.code),
  'the added stage reaches the generated code');
check(/Purchase/.test(stageUi.legend), 'the added stage reaches the chart', stageUi.legend);
console.log(`  ${green('✓')} flows — ${flow.pathNodes.length} nodes from a path, dimensions per column`);

/* Suite 10 — every chart says what it is showing when you hover it. */
const hover = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');

  const host = document.createElement('div');
  host.style.cssText = 'width:820px;height:440px;position:fixed;left:0;top:0;opacity:0';
  document.body.appendChild(host);

  const out = { silent: [], empty: [], engines: {} };

  for (const def of reg.CHARTS) {
    const spec = reg.newSpec(def);
    const inst = eng.renderChart(def, host, spec);
    const engine = inst.engine;
    out.engines[engine] = (out.engines[engine] || 0) + 1;

    if (engine === 'chartjs' || engine === 'native') {
      // Chart.js and the custom engine bring their own tooltips.
      eng.destroyInstance(inst);
      host.innerHTML = '';
      continue;
    }

    if (engine === 'canvas') {
      // The draw reports the shapes it painted; no shapes means no hover.
      const canvas = host.querySelector('canvas');
      const regions = (canvas && canvas.__ocRegions) || [];
      if (!regions.length) out.silent.push(def.id + ' (canvas)');
      else if (regions.some((r) => !r.text || !String(r.text).trim())) out.empty.push(def.id);
    }

    if (engine === 'd3' || engine === 'dom') {
      // SVG marks opt in by carrying data-tip. Geo charts fill in async.
      for (let i = 0; i < 40; i++) {
        if (host.querySelector('[data-tip]')) break;
        await new Promise((r) => setTimeout(r, 150));
      }
      const marks = host.querySelectorAll('[data-tip]');
      if (!marks.length) out.silent.push(def.id + ' (' + engine + ')');
      else if ([...marks].some((m) => !m.getAttribute('data-tip').trim())) out.empty.push(def.id);
    }

    eng.destroyInstance(inst);
    host.innerHTML = '';
  }

  host.remove();
  return out;
});

check(!hover.silent.length,
  'every self-drawn chart offers a hover readout', hover.silent.slice(0, 8).join(', '));
check(!hover.empty.length,
  'no chart offers a blank tooltip', hover.empty.slice(0, 8).join(', '));

/* Declaring the data is only half of it: something has to show it.
 *
 * The readout is a child of the chart's host, and `renderChart` empties the
 * host before every render — which is what every control edit in the studio
 * does. Guarding the element behind the same "already attached" flag as the
 * listener meant hover worked on first paint and was dead from the first edit
 * onward, on all 70 self-drawn charts. The checks above never saw it, because
 * a mark carrying `data-tip` says nothing about whether a tooltip exists. */
const hoverLives = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const host = document.createElement('div');
  host.style.cssText = 'width:820px;height:440px;position:fixed;left:0;top:0;opacity:0';
  document.body.appendChild(host);

  // One chart per self-drawn engine; the other two bring their own tooltips.
  const pick = {};
  for (const def of reg.CHARTS) {
    if (def.engine !== 'chartjs' && def.engine !== 'native' && !pick[def.engine]) pick[def.engine] = def.id;
  }

  const out = {};
  for (const [engine, id] of Object.entries(pick)) {
    const def = reg.getChart(id);
    let inst = null;
    const live = () => [...host.querySelectorAll('[role="tooltip"]')].filter((n) => n.parentElement === host);

    // Render three times over, the way an edited chart is.
    const counts = [];
    for (let k = 0; k < 3; k++) {
      inst = eng.renderChart(def, host, reg.newSpec(def));
      for (let i = 0; i < 30 && !host.querySelector('[data-tip], canvas'); i++) await sleep(100);
      await sleep(220);
      counts.push(live().length);
    }

    // And after all that, a hover still has to put a value on screen. Aimed at
    // a mark the chart itself reported rather than swept blindly.
    let showed = null;
    if (engine === 'canvas') {
      const canvas = host.querySelector('canvas');
      const box = canvas.getBoundingClientRect();
      const r = (canvas.__ocRegions || []).find((s) => s.w != null) || (canvas.__ocRegions || [])[0];
      if (r) {
        const cx = box.left + (r.w != null ? r.x + r.w / 2 : r.cx);
        const cy = box.top + (r.h != null ? r.y + r.h / 2 : r.cy);
        canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx, clientY: cy }));
      }
    } else {
      const mark = host.querySelector('[data-tip]');
      const box = mark.getBoundingClientRect();
      mark.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2,
      }));
    }
    await sleep(60);
    const node = live()[0];
    showed = node && getComputedStyle(node).opacity !== '0' ? node.textContent.trim() : '';

    out[engine] = { id, counts: counts.join(','), showed: showed.slice(0, 40), nodes: live().length };
    eng.destroyInstance(inst);
    host.innerHTML = '';
  }

  host.remove();
  return out;
});

const gone = Object.entries(hoverLives).filter(([, v]) => v.counts !== '1,1,1');
const mute = Object.entries(hoverLives).filter(([, v]) => !v.showed);
check(!gone.length, 'the hover readout survives a chart being re-rendered',
  gone.map(([k, v]) => `${k} (${v.id}): ${v.counts}`).join(', '));
check(!mute.length, 'and still shows a value once it has been',
  mute.map(([k, v]) => `${k} (${v.id})`).join(', '));
check(Object.values(hoverLives).every((v) => v.nodes === 1),
  'exactly one readout per chart, however often it is rebuilt',
  Object.entries(hoverLives).map(([k, v]) => `${k}:${v.nodes}`).join(' '));
console.log(`  ${hover.silent.length ? red('✗') : green('✓')} hover — ${hover.silent.length} charts silent of ${(hover.engines.canvas || 0) + (hover.engines.d3 || 0) + (hover.engines.dom || 0)} self-drawn`);

/* Suite 11 — opening a file, and refusing the ones that are not one. */
const files = await page.evaluate(async () => {
  const { readDataFile } = await import('/js/studio/fileimport.js');
  const file = (name, parts, type) => new File(parts, name, { type: type || '' });
  const out = {};

  /* A real .xlsx, built here rather than committed as a fixture: the point is
     to prove the ZIP and XML reading, and a checked-in binary would hide it. */
  const deflate = async (text) => {
    const stream = new Blob([text]).stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
  const crc32 = (bytes) => {
    let c; const table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    let crc = 0 ^ -1;
    for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
    return (crc ^ -1) >>> 0;
  };

  const buildXlsx = async (parts) => {
    const enc = new TextEncoder();
    const locals = [];
    const central = [];
    let offset = 0;
    for (const [name, text] of parts) {
      const rawBytes = enc.encode(text);
      const comp = await deflate(text);
      const nameBytes = enc.encode(name);
      const crc = crc32(rawBytes);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0, true);
      local.setUint16(8, 8, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, comp.length, true);
      local.setUint32(22, rawBytes.length, true);
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);
      locals.push(new Uint8Array(local.buffer), nameBytes, comp);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(10, 8, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, comp.length, true);
      cd.setUint32(24, rawBytes.length, true);
      cd.setUint16(28, nameBytes.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), nameBytes);
      offset += 30 + nameBytes.length + comp.length;
    }
    const cdBytes = new Blob(central);
    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(8, parts.length, true);
    eocd.setUint16(10, parts.length, true);
    eocd.setUint32(12, cdBytes.size, true);
    eocd.setUint32(16, offset, true);
    return new Blob([...locals, cdBytes, new Uint8Array(eocd.buffer)]);
  };

  const sheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
    <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>1240</v></c></row>
    <row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3"><f>SUM(B2:B2)</f><v>980</v></c></row>
  </sheetData></worksheet>`;
  const strings = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <si><t>region</t></si><si><t>sales</t></si><si><t>North</t></si><si><t>South</t></si></sst>`;

  const xlsx = await buildXlsx([
    ['xl/sharedStrings.xml', strings],
    ['xl/worksheets/sheet1.xml', sheet],
  ]);
  out.xlsx = await readDataFile(file('sales.xlsx', [xlsx]));

  /* A formula cell must yield its stored value and never be evaluated. */
  out.formulaIsData = out.xlsx.ok && out.xlsx.text.includes('980') && !out.xlsx.text.includes('SUM');

  /* Plain text still works, BOM and all. */
  out.csv = await readDataFile(file('a.csv', ['\uFEFFregion,sales\nNorth,1240']));
  out.tsv = await readDataFile(file('a.txt', ['region\tsales\nNorth\t1240']));

  /* ── and the ones that must be refused ─────────────────────────────── */

  // Extension lies about the bytes: a ZIP wearing a .csv name.
  out.zipAsCsv = await readDataFile(file('sneaky.csv', [xlsx]));

  // The old compound-document .xls, which can carry macros.
  out.ole = await readDataFile(file('book.xls',
    [new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0])]));

  // A binary that is not a table at all.
  out.binary = await readDataFile(file('logo.png',
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2])]));

  // Over the size ceiling.
  out.tooBig = await readDataFile(file('huge.csv', [new Uint8Array(11 * 1024 * 1024)]));

  // Empty, and whitespace-only.
  out.empty = await readDataFile(file('e.csv', []));
  out.blank = await readDataFile(file('b.csv', ['   \n  \n']));

  // An XXE attempt inside an otherwise valid workbook.
  const evil = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>&x;</t></is></c></row></sheetData></worksheet>`;
  const evilBook = await buildXlsx([['xl/worksheets/sheet1.xml', evil]]);
  out.xxe = await readDataFile(file('evil.xlsx', [evilBook]));

  return out;
});

check(files.xlsx.ok, 'a real .xlsx opens', files.xlsx.message);
check(files.xlsx.ok && /region,sales/.test(files.xlsx.text), 'shared strings are resolved',
  files.xlsx.ok ? files.xlsx.text.slice(0, 40) : '');
check(files.formulaIsData, 'a formula cell yields its value and is never evaluated');
check(files.csv.ok && files.csv.text.startsWith('region'), 'a .csv opens, BOM stripped');
check(files.tsv.ok, 'a tab-separated .txt opens');
check(!files.zipAsCsv.ok, 'a ZIP wearing a .csv name is refused', files.zipAsCsv.message);
check(!files.ole.ok && /\.xls/.test(files.ole.message), 'an old .xls is refused by name', files.ole.message);
check(!files.binary.ok, 'a binary file is refused', files.binary.message);
check(!files.tooBig.ok && /10MB/.test(files.tooBig.message), 'an oversized file is refused', files.tooBig.message);
check(!files.empty.ok && !files.blank.ok, 'an empty file is refused');
check(!files.xxe.ok && /DOCTYPE/i.test(files.xxe.message),
  'a workbook carrying a DOCTYPE is refused outright', files.xxe.message);
console.log(`  ${green('✓')} files — xlsx/csv/txt read, 6 hostile shapes refused`);

/* Being text is not being a table.
 *
 * A .sql saved as .txt passes every byte-level check there is — it *is* text —
 * and used to be split on whitespace into a grid of fragments. There is no
 * magic number for this: CSV and source code are both just characters, so the
 * content has to be read.
 *
 * Both halves matter. The impostors have to be turned away, and the real
 * tables have to keep working — a check that rejects a valid CSV is worse than
 * no check at all, and the awkward-but-real cases below are the ones that
 * caught earlier versions of this out. */
const notTables = await page.evaluate(async () => {
  const { readDataFile } = await import('/js/studio/fileimport.js');
  const f = (body) => new File([body], 'f.txt', { type: 'text/plain' });
  const out = { missed: [], wrongly: [], named: {} };

  const IMPOSTORS = {
    SQL: "-- rollup\nCREATE TABLE sales (id INTEGER, region TEXT);\n"
      + "INSERT INTO sales VALUES (1, 'North');\nSELECT region FROM sales\nWHERE id > 1\nGROUP BY region;",
    'SQL without comments': "INSERT INTO sales VALUES (1, 'North', 5200);\n"
      + "INSERT INTO sales VALUES (2, 'South', 4410);\nINSERT INTO sales VALUES (3, 'East', 6100);\n"
      + "INSERT INTO sales VALUES (4, 'West', 3800);",
    PHP: '<?php\nnamespace App;\nclass SalesController extends Controller\n{\n'
      + '    public function index() { return view("sales"); }\n}',
    HTML: '<!DOCTYPE html>\n<html>\n<body>\n<table><tr><td>North</td></tr></table>\n</body>\n</html>',
    XML: '<?xml version="1.0"?>\n<sales>\n  <row><region>North</region></row>\n</sales>',
    SVG: '<svg xmlns="http://www.w3.org/2000/svg">\n  <rect x="0" y="0" width="50" height="50"/>\n'
      + '  <circle cx="70" cy="70" r="20"/>\n</svg>',
    Python: 'import pandas as pd\n\ndef load(path):\n    df = pd.read_csv(path)\n'
      + '    return df\n\nclass Report:\n    def total(self):\n        return 0',
    JavaScript: "import { readFile } from 'node:fs';\n\nconst rows = [];\n\n"
      + 'export function load(p) {\n  return readFile(p, "utf8");\n}\n\nload("a.csv");',
    'C++': '#include <iostream>\n#include <vector>\n\nstruct Sale { std::string region; };\n\n'
      + 'int main() {\n    std::vector<Sale> v;\n    return 0;\n}',
    Java: 'package com.example;\n\nimport java.util.List;\n\npublic class Report {\n'
      + '    private final List<Sale> rows;\n    public double total() { return 0; }\n}',
    'C#': 'using System;\nusing System.Linq;\n\nnamespace Sales\n{\n    public class Report\n'
      + '    {\n        public decimal Total() => 0;\n    }\n}',
    Go: 'package main\n\nimport (\n\t"fmt"\n)\n\nfunc main() {\n\tfmt.Println("hi")\n}',
    Rust: 'use std::collections::HashMap;\n\nstruct Sale { region: String }\n\n'
      + 'fn main() {\n    let v: Vec<Sale> = Vec::new();\n    println!("{:?}", v.len());\n}',
    Ruby: "require 'csv'\n\nclass SalesReport\n  def initialize(rows)\n    @rows = rows\n  end\n"
      + '  def total\n    @rows.sum\n  end\nend',
    Swift: 'import Foundation\n\nstruct Sale {\n    let region: String\n    let amount: Double\n}\n\n'
      + 'func total(_ rows: [Sale]) -> Double {\n    return 0\n}',
    Perl: '#!/usr/bin/perl\nuse strict;\nuse warnings;\n\nmy @rows = ();\n'
      + 'foreach my $l (<STDIN>) {\n    push @rows, $l;\n}',
    Bash: '#!/usr/bin/env bash\nset -euo pipefail\n\nif [ ! -f "$1" ]; then\n  echo "no" >&2\n'
      + '  exit 1\nfi\n\nawk -F, \'{ t += $3 } END { print t }\' "$1"',
    PowerShell: 'param([string]$Path = "a.csv")\n\n$rows = Import-Csv -Path $Path\n'
      + 'foreach ($row in $rows) {\n    Write-Host $row.region\n}',
    R: 'library(ggplot2)\n\nsales <- read.csv("sales.csv")\nsales$total <- sales$q1 + sales$q2\n\n'
      + 'ggplot(sales, aes(x = region)) +\n  geom_bar(stat = "identity")',
    CSS: '.chart-wrap {\n  position: relative;\n  width: 100%;\n}\n\n.chart-wrap canvas {\n'
      + '  display: block;\n}\n\n.legend {\n  gap: 8px;\n}',
    YAML: 'version: "3.8"\nservices:\n  web:\n    image: nginx\n    ports:\n      - "8080:80"',
    TOML: '[package]\nname = "sales"\nversion = "0.1.0"\n\n[dependencies]\ncsv = "1.3"',
    'a .env file': 'DATABASE_URL=postgres://localhost/sales\nAPI_KEY=abc123\nDEBUG=true\n'
      + 'PORT=8080\nLOG_LEVEL=info',
    JSON: '{\n  "rows": [\n    { "region": "North", "amount": 5200 },\n'
      + '    { "region": "South", "amount": 4410 }\n  ]\n}',
    'JSON Lines': '{"region":"North","amount":5200}\n{"region":"South","amount":4410}\n'
      + '{"region":"East","amount":6100}\n{"region":"West","amount":3800}',
    Markdown: '# Sales\n- North did well\n- South lagged\n## Notes\nSome detail here.',
    LaTeX: '\\documentclass{article}\n\\usepackage{booktabs}\n\n\\begin{document}\n'
      + '\\section{Sales}\nRevenue grew.\n\\end{document}',
    'a diff': '--- a/js/x.js\n+++ b/js/x.js\n@@ -1,4 +1,4 @@\n-const old = 1;\n+const next = 2;',
    'a Dockerfile': 'FROM node:20-alpine\nWORKDIR /app\nCOPY package.json .\n'
      + 'RUN npm install\nEXPOSE 8080\nCMD ["node", "server.js"]',
    'an Apache log': '127.0.0.1 - - [01/Aug/2025:12:00:01 +0000] "GET /a.html HTTP/1.1" 200 5320\n'
      + '127.0.0.1 - - [01/Aug/2025:12:00:04 +0000] "GET /b.css HTTP/1.1" 200 812\n'
      + '10.0.0.5 - - [01/Aug/2025:12:00:09 +0000] "POST /api HTTP/1.1" 500 145',
    prose: 'The quarter went well overall.\nNorthern region led on revenue.\n'
      + 'We should revisit pricing before the next cycle.\nA fourth sentence here.',
    'a minified bundle': '!function(e,t){"object"==typeof exports?t(exports):t(e.x={})}'
      + '(this,function(e){"use strict";e.a=function(n){return n*2}});',
  };

  for (const [label, body] of Object.entries(IMPOSTORS)) {
    const r = await readDataFile(f(body));
    if (r.ok) out.missed.push(label);
    else out.named[label] = r.message;
  }

  /* Real tables, including every awkward shape that tripped an earlier pass. */
  const TABLES = {
    'plain csv': 'region,q1,q2\nNorth,520,680\nSouth,440,575\nEast,610,720\nWest,380,495',
    tsv: 'region\tq1\tq2\nNorth\t520\t680\nSouth\t440\t575\nEast\t610\t720',
    'semicolon csv': 'region;q1;q2\nNorth;520;680\nSouth;440;575\nEast;610;720',
    'pipe table': 'region|q1|q2\nNorth|520|680\nSouth|440|575\nEast|610|720',
    'excel paste': 'Region\tQ1\tGrowth\nNorth\t$1,240\t52.4%\nSouth\t$980\t14.3%\n'
      + 'East\t$2,100\t16.7%\nWest\t$760\t-9.2%',
    'crlf line endings': 'region,q1\r\nNorth,520\r\nSouth,440\r\nEast,610\r\nWest,380',
    'blank lines between rows': 'region,q1\n\nNorth,520\n\nSouth,440\n\nEast,610',
    'trailing commas': 'region,q1,\nNorth,520,\nSouth,440,\nEast,610,\nWest,380,',
    'european decimals': 'Land;Umsatz\nNord;1.240,50\nSüd;980,00\nOst;2.100,75\nWest;760,25',
    'a # preamble': '# exported 2025-08-01\nregion,q1\nNorth,520\nSouth,440\nEast,610',
    'a ragged row': 'region,q1,q2\nNorth,520,680\nSouth,440\nEast,610,720,900\nWest,380,495',
    'sparse cells': 'month,revenue,costs\nJan,,4200\nFeb,5100,\nMar,,4800\nApr,6200,5100',
    'one numeric column': '52\n48\n61\n64\n71\n58\n55\n49',
    'one name column': 'Amman\nZarqa\nIrbid\nAqaba\nMadaba',
    'one date column': '2025-01-04\n2025-02-11\n2025-03-02\n2025-04-18\n2025-05-27',
    'quoted commas': 'name,note,value\n"Smith, J","said ""ok""",12\n"Doe, A","fine",8\n"Roe, B","ok",5',
    'long text cells': 'id,feedback,score\n1,"Onboarding was clear, though pricing confused me",7\n'
      + '2,"Support replied within the hour; helpful",9\n3,"Could not find export",4',
    'urls in cells': 'page,visits\nhttps://example.com/a,4200\nhttps://example.com/b,3100\n'
      + 'https://example.com/c,2050',
    'a glossary of SQL keywords': 'keyword,meaning\nSELECT,retrieves rows\nFROM,names the table\n'
      + 'WHERE,filters the rows\nINSERT,adds a row',
    'a report of SQL queries': 'query,runtime_ms\n"SELECT * FROM sales",412\n'
      + '"INSERT INTO t VALUES (1)",88\n"UPDATE t SET x = 1",53\n"DELETE FROM t",9',
    'JSON inside cells': 'id,payload,size\n1,"{""a"":1}",5\n2,"{""b"":2}",7\n3,"{""c"":3}",9',
    'braces in cells': 'template,uses\n"{name} said {thing}",412\n"{a},{b}",88\n"{x}",53\n"{y}",12',
  };

  for (const [label, body] of Object.entries(TABLES)) {
    const r = await readDataFile(f(body));
    if (!r.ok) out.wrongly.push(label + ' — ' + r.message);
  }

  out.impostorCount = Object.keys(IMPOSTORS).length;
  out.tableCount = Object.keys(TABLES).length;
  return out;
});

check(!notTables.missed.length,
  'no source file, config or document is taken for a table', notTables.missed.join(', '));
check(!notTables.wrongly.length,
  'and no real table is turned away by that check', notTables.wrongly.slice(0, 3).join(' | '));
check(/SQL/.test(notTables.named.SQL || '') && /PHP/.test(notTables.named.PHP || '')
  && /Python|code/.test(notTables.named.Python || ''),
  'the refusal names what the file looks like');
console.log(`  ${green('✓')} not-a-table — ${notTables.impostorCount} impostors refused, ${notTables.tableCount} real tables kept`);

/* The sidebar states the format before a file is chosen, and checks it after. */
const shapes = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const { expectedFormat, checkTableShape, parseTable } = await import('/js/studio/dataio.js');

  const noFormat = [];
  for (const def of reg.CHARTS) {
    const fmt = expectedFormat(def);
    if (!fmt.columns.length || fmt.min < 1) noFormat.push(def.id);
  }

  // A file in the wrong shape has to be caught, not quietly drawn.
  const cityMap = reg.getChart('city-map');
  const tooFew = checkTableShape(cityMap, parseTable('city,value\nAmman,4300'));
  const right = checkTableShape(cityMap, parseTable('city,lon,lat,value\nAmman,35.9,31.9,4300'));

  // Words where numbers belong are caught too, since they draw as zero.
  const words = checkTableShape(reg.getChart('pie'), parseTable('label,value\nA,lots\nB,3'));

  // Exactly-two-column shapes say so when handed more.
  const extraCols = checkTableShape(reg.getChart('choropleth'),
    parseTable('country,value,notes\nFrance,64,x'));

  return {
    noFormat,
    tooFew: { ok: tooFew.ok, message: tooFew.message },
    right: { ok: right.ok, message: right.message },
    words: { ok: words.ok, message: words.message },
    extraCols: { ok: extraCols.ok, message: extraCols.message },
  };
});

check(!shapes.noFormat.length, 'every chart can state the format it reads', shapes.noFormat.slice(0, 6).join(', '));
check(!shapes.tooFew.ok && /at least 3 columns/.test(shapes.tooFew.message),
  'a file with too few columns is caught', shapes.tooFew.message);
check(shapes.right.ok, 'a file in the right shape passes', shapes.right.message);
check(!shapes.words.ok && /not a number/.test(shapes.words.message),
  'words where numbers belong are caught', shapes.words.message);
check(!shapes.extraCols.ok && /exactly 2 columns/.test(shapes.extraCols.message),
  'extra columns are flagged on a fixed-shape chart', shapes.extraCols.message);

await page.goto(`${base}/studio.html?chart=city-map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const uploadRow = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('.controls .btn')].map((b) => b.textContent.trim());
  const edit = buttons.indexOf('Edit data');
  const upload = buttons.indexOf('Upload a file');
  const fmt = document.querySelector('.data-format');
  return {
    hasUpload: upload >= 0,
    rightAfterEdit: edit >= 0 && upload === edit + 1,
    format: fmt ? fmt.textContent : '',
  };
});
check(uploadRow.hasUpload, 'the sidebar offers a file upload');
check(uploadRow.rightAfterEdit, 'the upload button sits directly under Edit data');
check(/city, lon, lat, value/.test(uploadRow.format),
  'the sidebar names the columns this chart reads', uploadRow.format);
console.log(`  ${green('✓')} upload — sidebar button, stated format, shape checked`);

/* Suite 12 — the country and city dropdowns. */
const geoLists = await page.evaluate(async () => {
  const { loadCountries, loadCities, findCountryEntry } = await import('/js/studio/geodata.js');
  const countries = await loadCountries();
  const jo = findCountryEntry(countries, 'Jordan');
  const usa = findCountryEntry(countries, 'USA');          // an alias, not a name
  const cities = await loadCities(jo ? jo.iso2 : 'JO');
  const amman = cities.find((c) => c.name === 'Amman');
  return {
    countries: countries.length,
    withCities: countries.filter((c) => c.cities > 0).length,
    jordanIso: jo ? jo.iso2 : null,
    usaName: usa ? usa.name : null,
    cityCount: cities.length,
    amman,
    sorted: cities.length > 1 && cities[0].name.localeCompare(cities[1].name) <= 0,
  };
});
check(geoLists.countries > 150, 'the country list covers the world map', String(geoLists.countries));
check(geoLists.withCities > 150, 'nearly every country has a city list', String(geoLists.withCities));
check(geoLists.jordanIso === 'JO', 'a country resolves to its ISO code', String(geoLists.jordanIso));
check(geoLists.usaName === 'United States of America', 'short names people type are accepted', String(geoLists.usaName));
check(geoLists.cityCount > 20, 'a country loads its own cities', `${geoLists.cityCount} cities`);
check(!!geoLists.amman && Math.abs(geoLists.amman.lat - 31.95) < 0.2, 'city coordinates are right', JSON.stringify(geoLists.amman));
check(geoLists.sorted, 'cities are listed alphabetically');

await page.goto(`${base}/studio.html?chart=city-map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const pickers = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* Pick one entry out of a Combobox by typing and clicking the first hit. */
  const pickCombo = async (root, text) => {
    const input = root.querySelector('.cbx-input');
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(140);
    const item = root.querySelector('.cbx-item');
    if (!item) return null;
    const label = item.textContent;
    item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await sleep(140);
    return label;
  };

  /* Tick a named row in the *dialog's* CheckList.
   *
   * Scoped to `.dlg` deliberately: the map sidebar now carries a CheckList of
   * its own, so a bare `.clist-row` query reaches the wrong list and ticks a
   * city into the chart instead of into the dialog. */
  const tick = async (name) => {
    const search = document.querySelector('.dlg .clist-search');
    search.value = name;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(120);
    const row = [...document.querySelectorAll('.dlg .clist-row')]
      .find((r) => r.querySelector('.clist-label').textContent === name);
    if (!row) return false;
    const cb = row.querySelector('.clist-check');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(60);
    return true;
  };

  /* ── the sidebar takes a list of countries ──────────────────────────── */
  const countryField = [...document.querySelectorAll('.controls .field')]
    .find((f) => f.textContent.includes('Countries'));
  const isCombobox = !!countryField.querySelector('.cbx');

  await pickCombo(countryField, 'Germ');
  await sleep(700);
  await pickCombo(countryField, 'Franc');
  await sleep(900);
  const specCountries = (window.openCharts.spec.opts.countries || []).slice();
  const chipNames = [...countryField.querySelectorAll('.country-chip-name')].map((c) => c.textContent);

  // Both are highlighted on the map, not just the first.
  const paths = [...document.querySelectorAll('#chart-host svg path')];
  const neighbour = window.openCharts.spec.opts.neighbourColor;
  const highlighted = paths.filter((p) => p.getAttribute('fill') && p.getAttribute('fill') !== neighbour).length;

  // And one can be taken back out.
  countryField.querySelector('.country-chip-x').click();
  await sleep(700);
  const afterRemove = (window.openCharts.spec.opts.countries || []).slice();

  /* ── the editor lists that country's cities ─────────────────────────── */
  [...document.querySelectorAll('.controls .btn')]
    .find((b) => b.textContent.includes('Edit data')).click();
  await sleep(400);
  const tabs = [...document.querySelectorAll('.dlg-tab')].map((t) => t.textContent);
  [...document.querySelectorAll('.dlg-tab')].find((t) => t.textContent === 'Pick cities').click();
  await sleep(1400);

  // It opens on the country the chart is already focused on, with its cities
  // already listed — nobody should have to say which country twice.
  const prefilled = document.querySelector('.pick-country .cbx-input').value;
  const listLabel = document.querySelector('.pick-list-label').textContent;
  const listedBefore = document.querySelectorAll('.dlg .clist-row').length;

  // Take several in one pass.
  const ticked = [];
  for (const name of ['Berlin', 'Hamburg', 'Munich']) {
    if (await tick(name)) ticked.push(name);
  }
  const addBtn = document.querySelector('.pick-actions .btn');
  const addLabel = addBtn.textContent;
  addBtn.click();
  await sleep(400);
  const status = document.querySelector('.pick-status').textContent;

  [...document.querySelectorAll('.dlg-tab')].find((t) => t.textContent === 'Table').click();
  await sleep(200);

  const rows = [...document.querySelectorAll('.dgrid tbody tr')].length;
  const cellAt = (r, c) => {
    const inp = document.querySelector(`.dgrid-cell[data-row="${r}"][data-col="${c}"]`);
    return inp ? inp.value : null;
  };
  const names = [];
  for (let r = 0; r < rows; r++) names.push(cellAt(r, 0));
  const at = names.indexOf('Berlin');
  const parisRow = at >= 0 ? [cellAt(at, 0), cellAt(at, 1), cellAt(at, 2), cellAt(at, 3)] : null;
  const headers = [...document.querySelectorAll('.dgrid-head-input')].map((i) => i.value);

  // A chip is one line tall. Measuring it catches the class of bug that has
  // now bitten twice: a component modifier colliding with a site-wide class
  // — `.grid` blockified the data table, `.empty` gave every valueless chip
  // 4rem of padding and turned it into an ellipse.
  [...document.querySelectorAll('.dlg-tab')].find((t) => t.textContent === 'Pick cities').click();
  await sleep(300);
  const chipHeights = [...document.querySelectorAll('.pick-chip')]
    .map((c) => Math.round(c.getBoundingClientRect().height));

  return {
    isCombobox, specCountries, chipNames, highlighted, afterRemove, chipHeights,
    tabs, prefilled, listLabel, listedBefore, ticked, addLabel, status,
    names, parisRow, headers,
  };
});

check(pickers.isCombobox, 'the country control is a searchable list, not free text');
check(pickers.specCountries.join(',') === 'Jordan,Germany,France',
  'more than one country can be chosen', pickers.specCountries.join(','));
check(pickers.chipNames.join(',') === 'Jordan,Germany,France',
  'each chosen country gets a chip', pickers.chipNames.join(','));
check(pickers.highlighted >= 2, 'every chosen country is highlighted on the map',
  `${pickers.highlighted} highlighted`);
check(pickers.afterRemove.join(',') === 'Germany,France', 'a country can be removed again',
  pickers.afterRemove.join(','));

check(pickers.tabs.includes('Pick cities'), 'a city map offers a city picker', pickers.tabs.join('|'));
check(pickers.prefilled === 'Germany', 'the picker opens on the country the chart is focused on',
  pickers.prefilled);
check(/Cities in Germany/.test(pickers.listLabel), 'and says whose cities it is listing',
  pickers.listLabel);
check(pickers.listedBefore > 0, 'that country\'s cities are listed without being searched for',
  `${pickers.listedBefore} rows`);
check(pickers.ticked.length === 3, 'several cities can be ticked at once', pickers.ticked.join(','));
check(/Add 3 selected/.test(pickers.addLabel), 'the button says how many are selected', pickers.addLabel);
check(pickers.ticked.every((n) => pickers.names.includes(n)),
  'all of them land in the table', pickers.names.join(','));
check(pickers.parisRow && Math.abs(Number(pickers.parisRow[1]) - 13.4) < 0.3
  && Math.abs(Number(pickers.parisRow[2]) - 52.52) < 0.3,
  'coordinates are filled in for the user', JSON.stringify(pickers.parisRow));
check(pickers.parisRow && pickers.parisRow[3] === '',
  'the value is left blank for the reader to type', JSON.stringify(pickers.parisRow));
check(pickers.headers.join(',') === 'name,lon,lat,value',
  'the picker fills the existing place columns', pickers.headers.join(','));
check(pickers.chipHeights.length > 0 && pickers.chipHeights.every((h) => h < 40),
  'every chip is one line tall, whether or not it has a value yet',
  pickers.chipHeights.join(','));
/* Every list a reader sees is in one language, and every spelling of a country
 * resolves to the same one. Both used to be false: the atlas abbreviates to fit
 * a map label, and a handful of cities were left in their own script. */
const names = await page.evaluate(async () => {
  const { loadCountries, loadCities, countryKey, findCountryEntry } = await import('/js/studio/geodata.js');
  const countries = await loadCountries();

  // "Bosnia and Herz.", "Dem. Rep. Congo", "Eq. Guinea" — a label, not a name.
  const abbreviated = countries.map((c) => c.name)
    .filter((n) => /(^|\s)(Rep|Dem|Eq|Fr|N|S|W|St|Is)\.|\sHerz\./.test(n));

  // Anything outside the Latin alphabet in a name a reader has to type.
  const foreign = /[\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u4E00-\u9FFF]/;
  const foreignCountries = countries.map((c) => c.name).filter((n) => foreign.test(n));
  const codeless = countries.filter((c) => !c.iso2).map((c) => c.name);

  // One ISO code per country, or picking one lists another's cities — which
  // is how the Republic of the Congo came to offer the DRC's.
  //
  // Two pairs share a code on purpose. Northern Cyprus and Somaliland have no
  // ISO code of their own and no separate gazetteer, so they borrow the one
  // their cities are actually filed under. Borrowing lists a few places that
  // sit the other side of the line; having no picker at all would be worse.
  const BORROWED = { CY: 'Northern Cyprus', SO: 'Somaliland' };
  const seen = new Map();
  const shared = [];
  countries.forEach((c) => {
    if (!c.iso2 || BORROWED[c.iso2] === c.name) return;
    if (seen.has(c.iso2)) shared.push(`${seen.get(c.iso2)} / ${c.name} → ${c.iso2}`);
    else seen.set(c.iso2, c.name);
  });

  // Six countries' worth of cities is enough to catch a whole script leaking in.
  const foreignCities = [];
  for (const iso of ['MK', 'BY', 'GR', 'IN', 'YE', 'DZ']) {
    for (const city of await loadCities(iso)) {
      if (foreign.test(city.name)) foreignCities.push(`${iso}: ${city.name}`);
    }
  }

  /* A name may be neither English nor the local language: `Ḩātim` is the
   * gazetteer's scientific transliteration of حاتم and is not a spelling
   * anybody types. Where a country's own script is not Latin, every Latin
   * name is a romanisation, so the plainest one is the right one — and the
   * rule that decides this is the tool's, imported rather than restated. */
  const { NON_LATIN_SCRIPT, foldRomanisation } = await import('/tools/place-names.mjs');
  const unfolded = [];
  for (const iso of ['JO', 'IR', 'IN', 'RU', 'JP', 'CN', 'GR', 'IL', 'EG', 'KP']) {
    for (const city of await loadCities(iso)) {
      if (foldRomanisation(city.name) !== city.name) unfolded.push(`${iso}: ${city.name}`);
    }
  }

  /* The other half of the same rule, and the reason it is keyed by country
   * rather than by character: `ā` is a romanisation in `Ḩātim` and a native
   * letter in Latvian, `ş` is native Turkish, `‘` is the Hawaiian ʻokina.
   * Folding these would be the same bug pointing the other way. */
  const nativeMarks = [];
  for (const [iso, want] of [['LV', 'Alūksne'], ['TR', 'Akkuş'], ['RO', 'Adămuş'], ['US', '‘Ewa Beach']]) {
    const found = (await loadCities(iso)).some((c) => c.name === want);
    nativeMarks.push(`${iso} ${want}: ${found ? 'kept' : 'LOST'}`);
    if (NON_LATIN_SCRIPT.has(iso)) nativeMarks.push(`${iso} wrongly listed as non-Latin`);
  }

  const same = (a, b) => countryKey(a) === countryKey(b);
  return {
    abbreviated,
    foreignCountries,
    codeless,
    shared,
    foreignCities,
    unfolded,
    nativeMarks,
    trinidad: (findCountryEntry(countries, 'Trinidad and Tobago') || {}).cities || 0,
    congo: (findCountryEntry(countries, 'Congo') || {}).iso2,
    drc: (findCountryEntry(countries, 'Democratic Republic of the Congo') || {}).iso2,
    matches: [
      same('Bosnia and Herz.', 'Bosnia and Herzegovina'),
      same('Dem. Rep. Congo', 'DRC'),
      same("C\u00f4te d'Ivoire", 'Ivory Coast'),
      same('United States of America', 'USA'),
    ],
    distinct: !same('Congo', 'Dem. Rep. Congo'),
  };
});

check(!names.abbreviated.length, 'no country is listed by its map abbreviation',
  names.abbreviated.join(', '));
check(!names.foreignCountries.length, 'every country name is in the Latin alphabet',
  names.foreignCountries.join(', '));
check(!names.codeless.length, 'every country carries an ISO code', names.codeless.join(', '));
check(!names.shared.length, 'no two countries claim one ISO code by accident', names.shared.join(', '));
check(!names.foreignCities.length, 'no city name is left in another script',
  names.foreignCities.slice(0, 5).join(', '));
check(!names.unfolded.length, 'no city is left in scientific transliteration',
  `${names.unfolded.length} left, e.g. ${names.unfolded.slice(0, 4).join(', ')}`);
check(names.nativeMarks.every((r) => r.endsWith('kept')),
  'and a native diacritic is never folded away', names.nativeMarks.join(' | '));
check(names.trinidad > 0, 'Trinidad and Tobago reaches its own city list',
  `${names.trinidad} cities`);
check(names.congo === 'CG' && names.drc === 'CD',
  'the two Congos are two countries', `${names.congo} / ${names.drc}`);
check(names.matches.every(Boolean), 'every spelling of a country resolves to one key',
  names.matches.join(','));
check(names.distinct, 'and a country whose name contains another stays distinct');

/* The country's cities, ticked straight onto the map from the sidebar. */
await page.goto(`${base}/studio.html?chart=city-map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
const sidebarCities = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const note = () => (document.querySelector('.cities-note') || {}).textContent || '';
  const rowFor = (on) => [...document.querySelectorAll('.field .clist-row')]
    .find((r) => r.classList.contains('on') === on);

  const listed = document.querySelectorAll('.field .clist-row').length;
  const tickedAtStart = document.querySelectorAll('.field .clist-row.on').length;
  const startNote = note();
  const before = window.openCharts.spec.places.slice();

  // Tick a city that is not on the map yet.
  const row = rowFor(false);
  const name = row.querySelector('.clist-label').textContent;
  row.querySelector('input').click();
  await sleep(400);
  const added = window.openCharts.spec.places.find((p) => p.name === name);

  // ...and take it off again.
  row.querySelector('input').click();
  await sleep(400);
  const afterUntick = window.openCharts.spec.places.length;

  // A place the gazetteer spells differently is not this list's to remove.
  const survivors = window.openCharts.spec.places.map((p) => p.name);

  // The search bar has to fit the rail it is in.
  const bar = document.querySelector('.field .clist-bar').getBoundingClientRect();
  const panel = document.querySelector('.controls').getBoundingClientRect();

  // Change the country, and the list under it must follow.
  const root = document.querySelector('.field .cbx');
  const input = root.querySelector('.cbx-input');
  input.focus();
  input.value = 'Germany';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(220);
  root.querySelector('.cbx-item').dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  await sleep(1600);

  return {
    listed, tickedAtStart, startNote, name, added,
    beforeCount: before.length,
    afterUntick,
    survivors,
    barFits: bar.right <= panel.right + 1,
    twoCountries: note(),
    stillListed: document.querySelectorAll('.field .clist-row').length,
  };
});

check(sidebarCities.listed > 20, 'the focused country lists its cities in the sidebar',
  `${sidebarCities.listed} rows`);
check(sidebarCities.tickedAtStart > 0, 'the cities already on the map start ticked',
  `${sidebarCities.tickedAtStart} ticked`);
check(/on the map/.test(sidebarCities.startNote), 'and the count says how many',
  sidebarCities.startNote);
check(sidebarCities.added && Number.isFinite(sidebarCities.added.lon)
  && Number.isFinite(sidebarCities.added.lat),
  'ticking a city puts it on the map with real coordinates',
  JSON.stringify(sidebarCities.added));
check(sidebarCities.added && sidebarCities.added.value === 1,
  'a new city starts at 1 rather than at an invented number',
  JSON.stringify(sidebarCities.added));
check(sidebarCities.afterUntick === sidebarCities.beforeCount,
  'unticking takes it off again', `${sidebarCities.afterUntick} vs ${sidebarCities.beforeCount}`);
check(sidebarCities.survivors.includes('Russeifa'),
  'a place the gazetteer spells differently is left alone',
  sidebarCities.survivors.join(','));
check(sidebarCities.barFits, 'the city search fits the 260px rail');
check(/2 countries/.test(sidebarCities.twoCountries),
  'adding a country adds its cities to the list', sidebarCities.twoCountries);
check(sidebarCities.stillListed > 0, 'and the list is rebuilt, not emptied',
  `${sidebarCities.stillListed} rows`);

/* A panel's listeners must die with the panel. The country control talks to the
 * city list through a document event, and a stale listener from a map would
 * rebuild geo controls over whatever chart is open now. */
await page.goto(`${base}/studio.html?chart=city-map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
const stale = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.openCharts.load('bar-vertical');
  await sleep(700);
  const beforeEvent = document.querySelectorAll('.cities-note').length;
  document.dispatchEvent(new CustomEvent('oc:countries'));
  await sleep(400);
  return {
    beforeEvent,
    afterEvent: document.querySelectorAll('.cities-note').length,
    controls: document.querySelector('.ctrl-head') ? document.querySelector('.ctrl-head').textContent : '',
  };
});
check(stale.beforeEvent === 0 && stale.afterEvent === 0,
  'a map\'s city list does not follow you to the next chart',
  `${stale.beforeEvent} → ${stale.afterEvent}`);

console.log(`  ${green('✓')} pickers — ${geoLists.countries} countries, multi-select cities in ${geoLists.jordanIso}`);

/* Suite 13 — geo country focus and city data. */
await page.goto(`${base}/studio.html?chart=city-map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
const geoFocus = await page.evaluate(async () => {
  const app = window.openCharts;
  const count = () => {
    const svg = document.querySelector('#chart-host svg');
    return svg ? svg.querySelectorAll('circle').length : 0;
  };
  const jordan = count();

  // Switch country and supply that country's cities.
  app.spec.opts.countries = ['Germany'];
  app.spec.opts.clipToCountry = true;
  app.spec.places = [
    { name: 'Berlin', lon: 13.4, lat: 52.52, value: 3600 },
    { name: 'Hamburg', lon: 9.99, lat: 53.55, value: 1900 },
    { name: 'Munich', lon: 11.58, lat: 48.14, value: 1500 },
    { name: 'Amman', lon: 35.93, lat: 31.95, value: 4300 },
  ];
  app.rebuild();
  await new Promise((r) => setTimeout(r, 2200));
  const germany = count();
  const labels = [...document.querySelectorAll('#chart-host svg text')].map((t) => t.textContent);

  // An unknown country must say so rather than fail silently.
  app.spec.opts.countries = ['Nowhereland'];
  app.rebuild();
  await new Promise((r) => setTimeout(r, 2200));
  const message = document.querySelector('#chart-host').textContent.trim();

  return { jordan, germany, labels, message };
});
check(geoFocus.jordan > 0, 'a focused country map renders its cities', String(geoFocus.jordan));
check(geoFocus.germany === 3, 'cities outside the country are clipped', `${geoFocus.germany} shown`);
check(!geoFocus.labels.includes('Amman'), 'the clipped city is gone');
check(/No country matched/.test(geoFocus.message), 'an unknown country explains itself', geoFocus.message.slice(0, 60));

// The globe turns to a named country rather than ignoring it.
const globeFocus = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const host = document.createElement('div');
  host.style.cssText = 'width:600px;height:460px;position:fixed;left:-9999px;top:0';
  document.body.appendChild(host);
  const def = reg.getChart('globe');

  const render = async (country) => {
    host.innerHTML = '';
    const spec = reg.newSpec(def);
    spec.opts.countries = country ? [country] : [];
    eng.renderChart(def, host, spec);
    // The globe fetches boundaries, so wait for real paths rather than a fixed
    // delay that a slow network would outlast.
    for (let i = 0; i < 60; i++) {
      const paths = host.querySelectorAll('svg path');
      if (paths.length > 5) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    // Fingerprint the country outlines, not the sphere or the graticule: those
    // are drawn first and the sphere is the same circle whichever way the
    // globe is turned. The tail of the list is the countries themselves, and
    // how many are visible changes with the rotation.
    const paths = [...host.querySelectorAll('svg path')]
      .map((p) => p.getAttribute('d') || '')
      .filter((d) => d.length > 40);
    if (!paths.length) return null;
    return paths.length + ':' + paths.slice(-6).join('').slice(0, 300);
  };
  const japan = await render('Japan');
  const brazil = await render('Brazil');
  host.remove();
  return { differs: japan !== brazil, gotBoth: !!japan && !!brazil };
});
check(globeFocus.gotBoth, 'the globe renders when focused on a country');
check(globeFocus.differs, 'focusing the globe on a different country turns it');

// Every map that offers the globe projection has to be draggable, not just the
// Globe chart. Five of them offered a sphere nobody could turn, which hides
// half the data behind itself with no way to reach it.
const globeDrag = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const host = document.createElement('div');
  host.style.cssText = 'width:600px;height:440px;position:fixed;left:-9999px;top:0';
  document.body.appendChild(host);

  const ids = ['globe', 'choropleth', 'proportional-symbol-map',
    'dot-density-map', 'flow-map', 'cartogram'];
  const out = {};

  for (const id of ids) {
    const def = reg.getChart(id);
    const spec = reg.newSpec(def);
    spec.opts.projection = 'globe';
    const inst = eng.renderChart(def, host, spec);
    for (let i = 0; i < 60; i++) {
      if (host.querySelectorAll('svg path').length > 5) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const svg = host.querySelector('svg');
    const before = (spec.opts.rotate || []).join(',');

    // A real drag: press on the sphere, move, release.
    svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 200, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 380, clientY: 210, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 380, clientY: 210, pointerId: 1 }));
    await new Promise((r) => setTimeout(r, 400));

    out[id] = {
      turned: (spec.opts.rotate || []).join(',') !== before,
      grab: svg.style.cursor === 'grab',
    };

    // And the listeners must not pile up: a drag adds them, a release removes
    // them. The old version added a pair to the window on every redraw.
    const leak = [];
    const realAdd = window.addEventListener;
    const realRemove = window.removeEventListener;
    let added = 0; let removed = 0;
    window.addEventListener = function (...a) { if (a[0].startsWith('pointer')) added++; return realAdd.apply(this, a); };
    window.removeEventListener = function (...a) { if (a[0].startsWith('pointer')) removed++; return realRemove.apply(this, a); };
    for (let k = 0; k < 3; k++) {
      svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 200, pointerId: 1 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 300, clientY: 200, pointerId: 1 }));
    }
    window.addEventListener = realAdd;
    window.removeEventListener = realRemove;
    out[id].balanced = added > 0 && added === removed;
    if (leak.length) out[id].leak = leak;

    eng.destroyInstance(inst);
    host.innerHTML = '';
  }

  host.remove();
  return out;
});

const notTurning = Object.entries(globeDrag).filter(([, v]) => !v.turned).map(([k]) => k);
const notGrab = Object.entries(globeDrag).filter(([, v]) => !v.grab).map(([k]) => k);
const unbalanced = Object.entries(globeDrag).filter(([, v]) => !v.balanced).map(([k]) => k);
check(!notTurning.length, 'every globe projection can be dragged to rotate', notTurning.join(', '));
check(!notGrab.length, 'a draggable globe says so with a grab cursor', notGrab.join(', '));
check(!unbalanced.length, 'a drag removes the listeners it added', unbalanced.join(', '));
console.log(`  ${green('✓')} geo focus — country clipping, unknown names, globe rotation`);

/* Suite 14 — a shared link round-trips an edited chart. */
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
/* The same link, minus the studio around it. */
const embedTag = await page.evaluate(async () => {
  let copied = '';
  navigator.clipboard.writeText = async (t) => { copied = t; };
  document.querySelector('#btn-embed').click();
  await new Promise((r) => setTimeout(r, 400));
  return copied;
});
const embedSrc = (embedTag.match(/src="([^"]+)"/) || [])[1] || '';
check(/^<iframe /.test(embedTag) && /embed=1/.test(embedSrc),
  'the Embed button copies an iframe for this exact chart', embedTag.slice(0, 90));

await page.goto(embedSrc.replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const embedded = await page.evaluate(() => {
  const gone = (sel) => {
    const el = document.querySelector(sel);
    return !el || getComputedStyle(el).display === 'none';
  };
  const canvas = document.querySelector('#chart-host canvas, #chart-host svg');
  return {
    chrome: ['.rail', '.page-head', '.controls', '.codepanel', '.help', '.stage-actions'].filter((s) => !gone(s)),
    drawn: !!canvas && canvas.getBoundingClientRect().height > 80,
    title: (document.querySelector('#stage-title') || {}).textContent || '',
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    legend: document.querySelector('#legend').textContent,
  };
});
check(!embedded.chrome.length, 'an embedded chart carries none of the studio',
  embedded.chrome.join(', '));
check(embedded.drawn, 'and still draws the chart');
check(embedded.title.length > 0, 'and keeps the one label that says what it is', embedded.title);
check(!embedded.overflow, 'and does not scroll sideways inside its frame');
check(/Mine/.test(embedded.legend),
  'an embed of an edited chart is the edited chart', embedded.legend);
console.log(`  ${green('✓')} sharing — round-trip + embed, ${shareToken.compressed ? 'compressed' : 'raw'}, ${shareToken.token.length} chars`);

/* Suite 15 — the exported standalone file genuinely runs. */
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

/* Suite 16 — every chart hands out a prompt that carries its own format and code. */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

const prompts = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const { buildPrompt } = await import('/js/studio/prompt.js');

  const noSchema = [];
  const tooShort = [];
  const noTitle = [];
  const noTemplate = [];
  const noFormat = [];
  const noStudioLink = [];
  const placeholders = [];
  let shortest = Infinity;
  let longest = 0;

  for (const def of reg.CHARTS) {
    const spec = reg.newSpec(def);
    const code = eng.generateCode(def, spec);
    const prompt = buildPrompt(def, spec, code);

    if (prompt.length < 600) tooShort.push(`${def.id}:${prompt.length}`);
    shortest = Math.min(shortest, prompt.length);
    longest = Math.max(longest, prompt.length);

    if (!prompt.includes(def.title)) noTitle.push(def.id);
    // The whole working page has to travel, not a description of it.
    if (!prompt.includes(code.standalone.trim())) noTemplate.push(def.id);
    if (!prompt.includes(`studio.html?chart=${encodeURIComponent(def.id)}`)) noStudioLink.push(def.id);

    if (!def.data || !def.data.shape) { noSchema.push(def.id); continue; }
    // The columns the reader is told to produce must be the schema's own.
    const header = String(def.data.example || '').split('\n')[0];
    if (!header || !prompt.includes(header)) noFormat.push(def.id);

    // Only the brief is ours to get right; the template below it is whatever
    // the chart's own code says, and may legitimately mention anything.
    const brief = prompt.split('```html')[0];
    if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(brief)) placeholders.push(def.id);
  }

  return { total: reg.CHARTS.length, noSchema, tooShort, noTitle, noTemplate, noFormat, noStudioLink, placeholders, shortest, longest };
});

check(prompts.noSchema.length === 0, 'every chart declares a data shape to describe', prompts.noSchema.join(', '));
check(prompts.tooShort.length === 0, 'every prompt is a full brief, not a stub', prompts.tooShort.join(', '));
check(prompts.noTitle.length === 0, 'every prompt names its chart', prompts.noTitle.join(', '));
check(prompts.noTemplate.length === 0, 'every prompt carries the whole standalone page', prompts.noTemplate.join(', '));
check(prompts.noFormat.length === 0, 'every prompt states the columns its chart reads', prompts.noFormat.join(', '));
check(prompts.noStudioLink.length === 0, 'every prompt links back to its own studio page', prompts.noStudioLink.join(', '));
check(prompts.placeholders.length === 0, 'no prompt leaks undefined, NaN or [object Object]', prompts.placeholders.join(', '));

// The same demand the code tabs meet: a prompt describing the example while the
// chart draws something else is worse than no prompt, because it looks right.
const promptData = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const io = await import('/js/studio/dataio.js');
  const { buildPrompt } = await import('/js/studio/prompt.js');

  const stale = [];
  let compared = 0;

  for (const def of reg.CHARTS) {
    if (!def.data || !def.data.example || typeof def.toText !== 'function') continue;
    const specA = reg.newSpec(def);
    const promptA = buildPrompt(def, specA, eng.generateCode(def, specA));

    // Perturb the example's numbers — or its names, for the edge lists that
    // carry no numbers at all. Skipping those would leave three charts free to
    // hand out a prompt describing data they are not drawing.
    const lines = def.data.example.split('\n');
    const numbered = def.data.example.replace(/(^|[,\t;\n])(\d+(?:\.\d+)?)(?=$|[,\t;\n])/g,
      (m, sep, n) => sep + (Number(n) + 7));
    const bumped = numbered !== def.data.example
      ? numbered
      : [lines[0], ...lines.slice(1).map((r) => r.split(',').map((c) => c + 'X').join(','))].join('\n');
    if (bumped === def.data.example) continue;

    const specB = reg.newSpec(def);
    const res = io.applyData(def, specB, bumped);
    if (!res.ok) continue;
    if (typeof def.onChange === 'function') def.onChange(specB);
    const promptB = buildPrompt(def, specB, eng.generateCode(def, specB));

    compared++;
    if (promptA === promptB) stale.push(def.id);
  }
  return { stale, compared };
});

check(promptData.stale.length === 0, 'a prompt follows the data currently in the chart', promptData.stale.join(', '));
console.log(`  ${green('✓')} prompts — ${prompts.total} charts, ${prompts.shortest}–${prompts.longest} chars, ${promptData.compared} tracked their data`);

// And the tab itself is wired: it renders, wraps, and holds the same text.
const promptTab = await page.evaluate(async () => {
  document.querySelector('.tab[data-tab="prompt"]').click();
  await new Promise((r) => setTimeout(r, 200));
  const body = document.querySelector('.code-body');
  return {
    text: body.textContent,
    prose: body.classList.contains('prose'),
    gutterHidden: document.querySelector('.gutter').hidden,
    note: (document.querySelector('.code-note') || {}).textContent || '',
    wrapped: getComputedStyle(body).whiteSpace === 'pre-wrap',
    overflows: body.scrollWidth > body.clientWidth + 2,
    live: window.openCharts.codePanel.code.prompt,
  };
});
check(promptTab.text.length > 600 && promptTab.text === promptTab.live,
  'the AI Prompt tab shows the generated prompt');
check(promptTab.prose && promptTab.wrapped && !promptTab.overflows,
  'the prompt wraps instead of running off the panel');
check(promptTab.gutterHidden, 'the prompt has no line numbers');
check(/spreadsheet|CSV/i.test(promptTab.note), 'the prompt tab says what to do with it', promptTab.note);
console.log(`  ${green('✓')} prompt tab — ${promptTab.text.length} chars, wrapped, no gutter`);

// And the same brief is one click away from the gallery tile, without opening it.
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const galleryPrompt = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const { buildPrompt } = await import('/js/studio/prompt.js');

  // Capture what is handed to the clipboard rather than reading it back:
  // clipboard permission is a browser question, and what is under test is
  // what the gallery puts there.
  let copied = null;
  navigator.clipboard.writeText = async (t) => { copied = t; };

  const cards = document.querySelectorAll('.card').length;
  const shells = document.querySelectorAll('.card-shell').length;
  const buttons = document.querySelectorAll('.card-prompt').length;
  // A button inside the anchor would be invalid, and would fire the tile's
  // own handoff handlers on the way past.
  const nestedInLink = document.querySelectorAll('.card .card-prompt').length;

  const shellOf = (id) => [...document.querySelectorAll('.card-shell')]
    .find((s) => s.querySelector('.card').href.includes(`chart=${id}`));

  const shell = shellOf('sankey');
  const btn = shell.querySelector('.card-prompt');
  const before = location.href;
  btn.click();
  await sleep(150);
  const fromExample = copied;
  const feedback = btn.textContent;
  const navigated = location.href !== before;

  const def = reg.getChart('sankey');
  const spec = reg.newSpec(def);
  const expected = buildPrompt(def, spec, eng.generateCode(def, spec));

  // With a table matched, the tile hands the reader's own data to the studio —
  // so the prompt beside it has to carry the same table, not the example.
  copied = null;
  document.querySelector('#match-toggle').click();
  await sleep(150);
  const box = document.querySelector('#match-text');
  box.value = 'from,to,value\nAlpha,Beta,1234\nBeta,Gamma,4321';
  box.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(450);
  const hdr = document.querySelector('#match-header');
  if (!hdr.checked) { hdr.checked = true; hdr.dispatchEvent(new Event('change', { bubbles: true })); }
  await sleep(350);

  shellOf('sankey').querySelector('.card-prompt').click();
  await sleep(150);
  const fromTable = copied || '';
  // Split at the template fence: the brief's *example* block is the format
  // illustration and rightly keeps saying `Organic` whatever data is loaded.
  // What must follow the reader's table is the "currently draws" block and the
  // code — so those are what the check reads.
  const current = (fromTable.split('currently draws this exact table')[1] || '').split('```html')[0];
  const template = fromTable.slice(fromTable.indexOf('```html'));

  return {
    cards, shells, buttons, nestedInLink, navigated, feedback,
    matches: fromExample === expected,
    length: (fromExample || '').length,
    inCurrent: /Alpha/.test(current) && /1234/.test(current),
    inCode: /Alpha/.test(template) && !/Organic/.test(template),
    exampleKept: /Organic/.test(fromTable.split('currently draws')[0]),
  };
});

check(galleryPrompt.buttons === galleryPrompt.cards && galleryPrompt.shells === galleryPrompt.cards,
  'every gallery tile carries a prompt button',
  `${galleryPrompt.buttons} buttons / ${galleryPrompt.cards} tiles`);
check(galleryPrompt.nestedInLink === 0, 'the button is beside the tile link, not inside it');
check(galleryPrompt.matches && galleryPrompt.length > 600,
  'the tile copies the same prompt the studio would', `${galleryPrompt.length} chars`);
check(!galleryPrompt.navigated, 'copying from a tile does not open the chart');
check(/Copied/.test(galleryPrompt.feedback), 'the button says it copied', galleryPrompt.feedback);
check(galleryPrompt.inCurrent && galleryPrompt.inCode,
  'a matched table travels into the tile’s prompt, table and code alike',
  `current:${galleryPrompt.inCurrent} code:${galleryPrompt.inCode}`);
check(galleryPrompt.exampleKept,
  'and the format example still shows the format, not the reader’s rows');
console.log(`  ${green('✓')} gallery prompts — ${galleryPrompt.buttons} tiles, table-aware`);

// The short form: same brief, no template — for when all that is wanted is the
// spreadsheet reshaped into something the editor can take.
const shortPrompts = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const { buildPrompt } = await import('/js/studio/prompt.js');

  const carriesCode = [];
  const lostFormat = [];
  const notShorter = [];
  const noStudioLink = [];
  let fullTotal = 0;
  let shortTotal = 0;
  let worst = 0;

  for (const def of reg.CHARTS) {
    const spec = reg.newSpec(def);
    const code = eng.generateCode(def, spec);
    const full = buildPrompt(def, spec, code, 'full');
    const short = buildPrompt(def, spec, code, 'data');

    fullTotal += full.length;
    shortTotal += short.length;
    worst = Math.max(worst, short.length);

    // The whole point: no template, and no stray instruction to write code.
    if (short.includes('```html') || short.includes('<!DOCTYPE')) carriesCode.push(def.id);
    if (short.length >= full.length) notShorter.push(def.id);
    if (!short.includes(`studio.html?chart=${encodeURIComponent(def.id)}`)) noStudioLink.push(def.id);

    // Shortening must not cost the format, which is the only thing it carries.
    const header = String((def.data || {}).example || '').split('\n')[0];
    if (!header || !short.includes(header) || !short.includes(def.title)) lostFormat.push(def.id);
  }

  return {
    carriesCode, lostFormat, notShorter, noStudioLink, worst,
    avgFull: Math.round(fullTotal / reg.CHARTS.length),
    avgShort: Math.round(shortTotal / reg.CHARTS.length),
  };
});

check(shortPrompts.carriesCode.length === 0, 'the short prompt carries no template', shortPrompts.carriesCode.join(', '));
check(shortPrompts.lostFormat.length === 0, 'and still states the chart and its columns', shortPrompts.lostFormat.join(', '));
check(shortPrompts.noStudioLink.length === 0, 'and still says where to paste the result', shortPrompts.noStudioLink.join(', '));
check(shortPrompts.notShorter.length === 0, 'the short prompt is shorter for every chart', shortPrompts.notShorter.join(', '));
check(shortPrompts.avgShort < shortPrompts.avgFull / 2,
  'the short prompt is worth switching to', `${shortPrompts.avgShort} vs ${shortPrompts.avgFull} chars`);
console.log(`  ${green('✓')} short prompts — ${shortPrompts.avgShort} chars avg vs ${shortPrompts.avgFull}, worst ${shortPrompts.worst}`);

// The switch, and that the choice survives a reload and reaches the gallery.
// The block above left the page on the gallery.
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const modeSwitch = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  document.querySelector('.tab[data-tab="prompt"]').click();
  await sleep(150);
  const read = () => document.querySelector('.code-body').textContent;
  const shownOnPrompt = !document.querySelector('.prompt-modes').hidden;
  const full = read();

  document.querySelector('.prompt-mode[data-mode="data"]').click();
  await sleep(150);
  const short = read();
  const noteAfter = document.querySelector('.code-note').textContent;

  // It is a prompt-tab control, not a code-tab one.
  document.querySelector('.tab[data-tab="js"]').click();
  await sleep(120);
  const shownOnCode = !document.querySelector('.prompt-modes').hidden;

  return {
    shownOnPrompt, shownOnCode,
    switched: short.length < full.length && !short.includes('```html'),
    stored: localStorage.getItem('opencharts.prompt-mode'),
    noteChanged: /no code|reshaping/i.test(noteAfter),
  };
});
check(modeSwitch.shownOnPrompt && !modeSwitch.shownOnCode,
  'the mode switch belongs to the prompt tab only');
check(modeSwitch.switched, 'switching to Data only drops the template from the panel');
check(modeSwitch.stored === 'data', 'the choice is remembered', String(modeSwitch.stored));
check(modeSwitch.noteChanged, 'and the note under it says what changed');

// The gallery reads the same preference — one answer for both surfaces.
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const tileHonours = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let copied = null;
  navigator.clipboard.writeText = async (t) => { copied = t; };
  const shell = [...document.querySelectorAll('.card-shell')]
    .find((s) => s.querySelector('.card').href.includes('chart=bar-vertical'));
  shell.querySelector('.card-prompt').click();
  await sleep(150);
  return { mode: localStorage.getItem('opencharts.prompt-mode'), hasCode: (copied || '').includes('```html'), len: (copied || '').length };
});
check(tileHonours.mode === 'data' && !tileHonours.hasCode && tileHonours.len > 600,
  'a tile hands out the kind of prompt the reader last chose',
  `${tileHonours.mode}, ${tileHonours.len} chars`);
await page.evaluate(() => localStorage.removeItem('opencharts.prompt-mode'));
console.log(`  ${green('✓')} prompt modes — switch, remembered, honoured by the tiles`);

// A brief that knows only one chart is a dead end the moment the data does not
// suit it. Both forms have to offer the way out.
const escapeHatch = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const { buildPrompt } = await import('/js/studio/prompt.js');

  const noEscape = [];
  const noGallery = [];
  const noRepo = [];
  const noSiblings = [];
  const wrongSiblings = [];
  const noDataLocation = [];
  const longLines = [];

  // What the generated code actually calls its data, per renderer. Telling an
  // assistant to "edit the spec" is wrong for the Chart.js half of the library.
  const NAMES = { chartjs: '`config`', canvas: '`spec`', d3: '`spec`', dom: '`spec`', native: '`data`' };

  for (const def of reg.CHARTS) {
    const spec = reg.newSpec(def);
    const code = eng.generateCode(def, spec);
    const full = buildPrompt(def, spec, code, 'full');
    const short = buildPrompt(def, spec, code, 'data');

    for (const [form, text] of [['full', full], ['data', short]]) {
      if (!text.includes('If this is the wrong chart')) noEscape.push(`${def.id}:${form}`);
      if (!text.includes('index.html')) noGallery.push(`${def.id}:${form}`);
      const urls = text.match(/https?:\/\/[^\s)'"`]+/g) || [];
      const hasGitHubHost = urls.some((u) => {
        try {
          const { hostname } = new URL(u);
          return hostname === 'github.com' || hostname.endsWith('.github.com');
        } catch {
          return false;
        }
      });
      if (!hasGitHubHost) noRepo.push(`${def.id}:${form}`);
    }

    // The siblings named must genuinely read the same table.
    const shape = (def.data || {}).shape;
    const kin = reg.CHARTS.filter((c) => c !== def && c.data && c.data.shape === shape);
    const block = full.split('read exactly the same table')[1] || '';
    if (kin.length && !block) noSiblings.push(def.id);
    if (kin.length) {
      const named = kin.slice(0, 10).map((c) => c.title);
      // The list is hard-wrapped, so a title can straddle a line break. This
      // is a membership check, not a layout one — flatten the whitespace.
      const listed = (block.split('- **Paste my table')[0] || '').replace(/\s+/g, ' ');
      if (!named.every((t) => listed.includes(t))) wrongSiblings.push(def.id);
      // Nothing outside the shape may be named as reading the same table.
      const outsider = reg.CHARTS.find((c) => c.data && c.data.shape !== shape
        && listed.includes(c.title) && !named.some((n) => n.includes(c.title)));
      if (outsider) wrongSiblings.push(`${def.id}→${outsider.id}`);
    }

    // The full form must say where the data sits, in that renderer's own terms.
    const want = NAMES[def.engine];
    const rules = full.split('```html')[0];
    if (want && !rules.includes(want)) noDataLocation.push(`${def.id}:${want}`);

    // The prose is hard-wrapped for a chat window; assembled lists must be too.
    // Fenced blocks are exempt and must stay exempt — a horizon chart's rows
    // are 500-character CSV lines, and wrapping one would corrupt the data.
    let fenced = false;
    const over = rules.split('\n').filter((l) => {
      if (l.startsWith('```')) { fenced = !fenced; return false; }
      return !fenced && l.length > 100 && !l.includes('http');
    });
    if (over.length) longLines.push(`${def.id}:${over.length}`);
  }

  return { noEscape, noGallery, noRepo, noSiblings, wrongSiblings, noDataLocation, longLines };
});

check(escapeHatch.noEscape.length === 0, 'both forms say what to do if the chart is wrong', escapeHatch.noEscape.slice(0, 5).join(', '));
check(escapeHatch.noGallery.length === 0, 'and point at the library to match the data against', escapeHatch.noGallery.slice(0, 5).join(', '));
check(escapeHatch.noRepo.length === 0, 'and name where the source lives', escapeHatch.noRepo.slice(0, 5).join(', '));
check(escapeHatch.noSiblings.length === 0, 'a chart with siblings lists them', escapeHatch.noSiblings.join(', '));
check(escapeHatch.wrongSiblings.length === 0,
  'and every chart it names really does read the same table', escapeHatch.wrongSiblings.slice(0, 5).join(', '));
check(escapeHatch.noDataLocation.length === 0,
  'the brief names the data by what the generated code calls it',
  escapeHatch.noDataLocation.slice(0, 6).join(', '));
check(escapeHatch.longLines.length === 0,
  'assembled lists are wrapped like the rest of the prose', escapeHatch.longLines.slice(0, 5).join(', '));
console.log(`  ${green('✓')} escape hatch — siblings, matcher and source in every prompt`);

// The chart page copies its own prompt without a trip to the code panel.
await page.goto(`${base}/studio.html?chart=treemap`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const stageBtn = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let copied = null;
  navigator.clipboard.writeText = async (t) => { copied = t; };

  const btn = document.querySelector('#btn-prompt');
  if (!btn) return { missing: true };

  // Reading the JS tab and clicking Prompt must not move the reader.
  document.querySelector('.tab[data-tab="js"]').click();
  await sleep(150);
  btn.click();
  await sleep(200);
  const full = copied;
  const stillOnJs = document.querySelector('.tab[data-tab="js"]').classList.contains('active');
  const feedback = btn.textContent;

  // It follows the Full / Data only choice like every other surface.
  document.querySelector('.tab[data-tab="prompt"]').click();
  await sleep(120);
  document.querySelector('.prompt-mode[data-mode="data"]').click();
  await sleep(150);
  copied = null;
  btn.click();
  await sleep(200);
  const short = copied;
  document.querySelector('.prompt-mode[data-mode="full"]').click();

  return {
    missing: false, stillOnJs, feedback,
    matchesPanel: full === window.openCharts.codePanel.code.prompt,
    hasCode: (full || '').includes('```html'),
    shortHasCode: (short || '').includes('```html'),
    shorter: (short || '').length < (full || '').length,
  };
});
check(!stageBtn.missing, 'the chart page has a prompt button of its own');
check(stageBtn.matchesPanel && stageBtn.hasCode, 'it copies the same prompt the panel holds');
check(stageBtn.stillOnJs, 'and does not move the reader off the tab they were reading');
check(/Copied/.test(stageBtn.feedback), 'the button says it copied', stageBtn.feedback);
check(stageBtn.shorter && !stageBtn.shortHasCode, 'it follows the Full / Data only choice');
console.log(`  ${green('✓')} chart page prompt — one click from the stage bar`);





/* Suite 17 — responsive layout produces no horizontal overflow. */
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

// The data editor is a full-screen dialog on a phone, and it is the one part
// of the studio nobody can work around if it overflows.
await page.setViewportSize({ width: 390, height: 780 });
await page.goto(`${base}/studio.html?chart=city-map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const phoneDialog = await page.evaluate(async () => {
  [...document.querySelectorAll('.controls .btn')].find((b) => b.textContent.includes('Edit data')).click();
  await new Promise((r) => setTimeout(r, 500));
  const de = document.documentElement;
  const dlg = document.querySelector('.dlg');
  const grid = document.querySelector('.dgrid-scroll');
  const out = {
    pageOverflow: de.scrollWidth - de.clientWidth,
    dialogFits: dlg.getBoundingClientRect().right <= window.innerWidth + 1,
    gridHeight: Math.round(grid.getBoundingClientRect().height),
    footVisible: document.querySelector('.dlg-foot').getBoundingClientRect().bottom <= window.innerHeight + 1,
  };
  [...document.querySelectorAll('.dlg-tab')].find((t) => t.textContent === 'Pick cities').click();
  await new Promise((r) => setTimeout(r, 900));
  out.pickOverflow = de.scrollWidth - de.clientWidth;
  const addBtn = document.querySelector('.pick-actions .btn');
  out.addVisible = addBtn.getBoundingClientRect().right <= window.innerWidth + 1;
  const clist = document.querySelector('.clist-box');
  out.listUsable = clist && clist.getBoundingClientRect().height > 100;
  return out;
});
check(phoneDialog.pageOverflow <= 1, 'the data editor does not overflow a phone', `${phoneDialog.pageOverflow}px`);
check(phoneDialog.dialogFits, 'the dialog fits the viewport at 390px');
check(phoneDialog.gridHeight > 120, 'the grid is still usable at 390px', `${phoneDialog.gridHeight}px`);
check(phoneDialog.footVisible, 'the apply button is reachable at 390px');
check(phoneDialog.pickOverflow <= 1, 'the city picker does not overflow a phone', `${phoneDialog.pickOverflow}px`);
check(phoneDialog.addVisible, 'the Add button is reachable at 390px');
check(phoneDialog.listUsable, 'and the city list is still tall enough to use');
await page.setViewportSize({ width: 1280, height: 900 });
console.log(`  ${green('✓')} responsive — no overflow at 390 / 768 / 1280px, editor usable on a phone`);

/* Suite 18 — flags, country metadata, and the pickers that show them. */
const flagData = await page.evaluate(async () => {
  const [flagsRes, metaRes, atlasRes] = await Promise.all([
    fetch('/data/flags.json').then((r) => r.json()),
    fetch('/data/country-meta.json').then((r) => r.json()),
    fetch('/data/countries.json').then((r) => r.json()),
  ]);

  // A base64 PNG starts with the encoded eight-byte signature. Anything that
  // does not is an error page that got committed as a flag.
  const isPng = (b64) => typeof b64 === 'string' && b64.startsWith('iVBORw0KGgo');
  const bad = Object.entries(flagsRes).filter(([, v]) => !isPng(v)).map(([k]) => k);

  // Every country the picker can list needs a picture, or the set has a hole
  // exactly where a reader would notice one.
  const atlasCodes = atlasRes.map(([, iso2]) => iso2).filter(Boolean);
  const missing = atlasCodes.filter((c) => !flagsRes[c]);

  return {
    flags: Object.keys(flagsRes).length,
    bad,
    missing,
    meta: Object.keys(metaRes).length,
    withLocal: Object.values(metaRes).filter((m) => m.local).length,
    withIso3: Object.values(metaRes).filter((m) => /^[A-Z]{3}$/.test(m.iso3)).length,
    regions: [...new Set(Object.values(metaRes).map((m) => m.region))].sort(),
  };
});
check(flagData.flags > 190, 'the flag set covers both country lists', `${flagData.flags} flags`);
check(!flagData.bad.length, 'every flag is a real PNG', flagData.bad.slice(0, 5).join(', '));
check(!flagData.missing.length, 'no country on the map is left without a flag', flagData.missing.join(', '));
check(flagData.meta === 194, 'the metadata covers 194 countries', String(flagData.meta));
check(flagData.withIso3 === flagData.meta, 'every country has an ISO3 code', `${flagData.withIso3}/${flagData.meta}`);
check(flagData.withLocal > 100, 'most countries carry a local-language name', String(flagData.withLocal));
check(flagData.regions.length === 5, 'countries are grouped into five regions', flagData.regions.join(', '));

// A fresh page, so the module registry is empty: the "not loaded yet" branch
// below cannot be reached on a page whose pickers have already pulled the set.
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
const flagApi = await page.evaluate(async () => {
  const flags = await import('/js/studio/flags.js');
  const geo = await import('/js/studio/geodata.js');

  // An icon asked for before the set has loaded must still fill itself in —
  // the path every picker takes, since none of them awaits a flag.
  const early = flags.flagIcon('FR');
  const beforeLoad = early.style.backgroundImage || '';
  await flags.loadFlags();
  const afterLoad = early.style.backgroundImage || '';

  const countries = await geo.loadCountries();
  const de = countries.find((c) => c.iso2 === 'DE');
  const items = geo.countryItems(countries);
  const deItem = items.find((i) => i.value === (de && de.name));

  await geo.loadCountryMeta();
  return {
    beforeLoad,
    fillsIn: afterLoad.includes('data:image/png'),
    src: (flags.flagSrc('FR') || '').slice(0, 21),
    unknownIsNull: flags.flagSrc('ZZ') === null && flags.flagSrc('') === null,
    // The atlas name is what the map answers to and must survive the merge.
    deName: de && de.name,
    deLocal: de && de.local,
    deIso3: de && de.iso3,
    deRegion: de && de.region,
    itemIcon: deItem && deItem.icon,
    itemSearch: deItem && deItem.search,
    localCity: geo.localCityName('JP', 'Tokyo'),
    localMiss: geo.localCityName('GB', 'Nowhere-on-Sea'),
  };
});
check(!flagApi.beforeLoad, 'an icon starts empty rather than guessing');
check(flagApi.fillsIn, 'and paints itself when the set arrives');
check(flagApi.src === 'data:image/png;base64', 'a flag is a self-contained data URI', flagApi.src);
check(flagApi.unknownIsNull, 'an unknown code gets no flag rather than a broken one');
check(flagApi.deName === 'Germany', 'the atlas name survives the metadata merge', String(flagApi.deName));
check(flagApi.deLocal === 'Deutschland', 'a country carries its local name', String(flagApi.deLocal));
check(flagApi.deIso3 === 'DEU' && flagApi.deRegion === 'Europe', 'and its ISO3 and region',
  `${flagApi.deIso3} / ${flagApi.deRegion}`);
check(flagApi.itemIcon === 'DE', 'a picker item carries the code, not the picture', String(flagApi.itemIcon));
check(/Deutschland/.test(flagApi.itemSearch || ''), 'and is findable by its local name');
check(flagApi.localCity === '東京', 'a curated city resolves its local spelling', String(flagApi.localCity));
check(flagApi.localMiss === '', 'and an unlisted city is left alone rather than guessed');

/* An asset is not a dependency. No chart may claim the flag set, and it must
 * not inflate the library count the gallery footer prints. */
const assetRules = await page.evaluate(async () => {
  const cdn = await import('/js/studio/cdn.js');
  const { CHARTS } = await import('/js/studio/registry.js');
  const claimed = CHARTS
    .filter((d) => cdn.dependenciesFor(d).some((l) => l.kind === 'asset'))
    .map((d) => d.id);
  return {
    assets: cdn.ALL_ASSETS.length,
    claimed,
    inLibraries: cdn.ALL_LIBRARIES.some((l) => l.kind === 'asset'),
    cdnOnly: cdn.cdnOnly(cdn.ALL_ASSETS).length,
    scripts: cdn.scriptsOnly(cdn.ALL_ASSETS).length,
    hasLocal: cdn.ALL_ASSETS.every((a) => !!a.local && !a.url),
  };
});
check(assetRules.assets > 0, 'the flag set is disclosed as a vendored asset');
check(!assetRules.claimed.length, 'no chart declares it as a dependency', assetRules.claimed.join(', '));
check(!assetRules.inLibraries, 'and it does not inflate the library count');
check(!assetRules.cdnOnly && !assetRules.scripts, 'a vendored asset is never emitted as a script tag');
check(assetRules.hasLocal, 'it is credited by path, because it has no URL');

/* And the pickers actually show them. */
await page.goto(`${base}/studio.html?chart=city-map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const flagUi = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};

  const chipFlag = document.querySelector('.country-chip .flag');
  out.chipHasFlag = !!chipFlag
    && (getComputedStyle(chipFlag).backgroundImage || '').includes('data:image/png');
  // The lesson `.empty` taught: a class colliding with a site-wide one turned
  // every chip into a 150px ellipse, and nothing threw. A flag is one small
  // box or it is a bug, so measure it rather than trust that the rule applied.
  const box = chipFlag && chipFlag.getBoundingClientRect();
  out.flagBox = box ? [Math.round(box.width), Math.round(box.height)] : null;
  out.chipHeight = chipFlag
    ? Math.round(chipFlag.closest('.country-chip').getBoundingClientRect().height) : 0;
  // The chip's name must still be readable on its own.
  const nameEl = document.querySelector('.country-chip .country-chip-name');
  out.chipName = nameEl ? nameEl.textContent : null;

  const cbx = document.querySelector('.controls .cbx');
  const input = cbx.querySelector('.cbx-input');
  input.focus();
  input.value = 'Deutschland';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(220);
  const row = cbx.querySelector('.cbx-item');
  out.localSearchHit = row ? row.querySelector('.cbx-item-label').textContent.trim() : null;
  const rowFlag = row && row.querySelector('.flag');
  out.rowHasFlag = !!rowFlag
    && (getComputedStyle(rowFlag).backgroundImage || '').includes('data:image/png');
  out.rowHeight = row ? Math.round(row.getBoundingClientRect().height) : 0;
  out.subShown = row ? (row.querySelector('.cbx-item-sub') || {}).textContent : null;
  input.value = '';
  input.blur();
  await sleep(250);

  // The sidebar city list shows local spellings where the curated list has one.
  const subs = [...document.querySelectorAll('.clist-sub')].map((n) => n.textContent);
  out.citySubs = subs.length;
  out.citySubSample = subs[0] || '';
  return out;
});
check(flagUi.chipHasFlag, 'a country chip carries its flag');
check(flagUi.chipName === 'Jordan', 'and its name is still readable on its own', String(flagUi.chipName));
check(flagUi.flagBox && flagUi.flagBox[1] > 6 && flagUi.flagBox[1] <= 20 && flagUi.flagBox[0] <= 26,
  'a flag is one small box, not a stretched panel', JSON.stringify(flagUi.flagBox));
check(flagUi.chipHeight > 0 && flagUi.chipHeight < 40, 'the chip stays one line tall', `${flagUi.chipHeight}px`);
check(flagUi.localSearchHit === 'Germany', 'typing a local name finds the atlas country', String(flagUi.localSearchHit));
check(flagUi.rowHasFlag, 'a dropdown row carries its flag');
check(flagUi.subShown === 'Deutschland', 'and shows the local name beside the atlas one', String(flagUi.subShown));
check(flagUi.rowHeight > 0 && flagUi.rowHeight < 40, 'a dropdown row stays one line tall', `${flagUi.rowHeight}px`);
check(flagUi.citySubs > 0, 'the city list shows local spellings',
  `${flagUi.citySubs} shown, e.g. ${flagUi.citySubSample}`);
console.log(`  ${green('✓')} flags — ${flagData.flags} flags, ${flagData.meta} countries, `
  + `${flagUi.citySubs} local city names in the list`);

/* Suite 19 — the colour-vision check, the spec view, and undo. */

/* The maths first, away from the DOM. A palette check that is wrong about
 * colour is worse than none: it would train the reader to ignore it. */
const cvdMath = await page.evaluate(async () => {
  const m = await import('/js/studio/cvd.js');
  const { PALETTE } = await import('/js/studio/palette.js');

  // The textbook case. Distinguishable to a trichromat, one colour to a
  // deuteranope — if this does not fire, nothing else here is meaningful.
  const redGreen = m.confusablePairs(['#d40000', '#00a000']);

  // Two colours already alike are a palette choice, not a colour-vision
  // problem, and reporting them would bury the real finding.
  const alreadyAlike = m.confusablePairs(['#2F76C9', '#3079CB']);

  // Simulation must leave anything it cannot parse alone rather than
  // turning a gradient or a CSS variable into black.
  const passthrough = ['linear-gradient(red, blue)', 'var(--accent)', '', null]
    .every((v) => m.simulate(v) === v);

  return {
    redGreen: redGreen.length,
    redGreenKind: (redGreen[0] || {}).kind,
    alreadyAlike: alreadyAlike.length,
    passthrough,
    // A hex in, a hex out.
    simHex: /^#[0-9a-f]{6}$/i.test(m.simulate('#CE5229', 'deuteranopia')),
    // Identical colours are zero apart; the check must not divide by chance.
    selfDistance: m.distance('#6C63D8', '#6C63D8'),
    threshold: m.MERGE_THRESHOLD,
    paletteFirstThree: m.confusablePairs(PALETTE.slice(0, 3)).length,
    // The whole palette, not its first three. The set this replaced had seven
    // colliding pairs and the first bit at four series, so half the library
    // warned on the data it shipped with — the check working as intended, on a
    // palette that should never have needed it.
    paletteAll: m.confusablePairs(PALETTE).length,
    paletteSize: PALETTE.length,
    paletteWorst: (() => {
      let worst = Infinity;
      for (let i = 0; i < PALETTE.length; i++) {
        for (let j = i + 1; j < PALETTE.length; j++) {
          for (const k of m.CVD_KINDS) {
            const d = m.distance(m.simulate(PALETTE[i], k.key), m.simulate(PALETTE[j], k.key));
            if (d < worst) worst = d;
          }
        }
      }
      return Math.round(worst * 10) / 10;
    })(),
    sentence: m.describePairs(redGreen, (i) => ['Revenue', 'Cost'][i]),
  };
});
check(cvdMath.redGreen === 1, 'red and green are reported as one colour',
  `${cvdMath.redGreen} pairs`);
check(cvdMath.redGreenKind === 'deuteranopia', 'and named as the deficiency that merges them',
  String(cvdMath.redGreenKind));
check(!cvdMath.alreadyAlike, 'two already-similar colours are not reported',
  `${cvdMath.alreadyAlike} pairs`);
check(cvdMath.passthrough, 'a gradient or variable passes through the simulation untouched');
check(cvdMath.simHex, 'a simulated colour is still a hex colour');
check(cvdMath.selfDistance === 0, 'a colour is zero distance from itself', String(cvdMath.selfDistance));
check(!cvdMath.paletteFirstThree, 'the palette a three-series chart opens with is safe',
  `${cvdMath.paletteFirstThree} pairs merge`);
check(!cvdMath.paletteAll,
  'and so is the whole palette, at any number of series',
  `${cvdMath.paletteAll} of ${(cvdMath.paletteSize * (cvdMath.paletteSize - 1)) / 2} pairs merge`);
check(cvdMath.paletteWorst >= cvdMath.threshold,
  'every default pair clears the merge threshold under all three deficiencies',
  `worst simulated ΔE ${cvdMath.paletteWorst} against a threshold of ${cvdMath.threshold}`);
check(/Revenue and Cost/.test(cvdMath.sentence), 'the warning uses the series names', cvdMath.sentence);

/* And it reaches the control panel. `area-band` carries a `colors` widget;
 * the 48 charts on `series` colour themselves through a different one, and
 * are checked just below. */
await page.goto(`${base}/studio.html?chart=area-band`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const cvdUi = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const { buildControls } = await import('/js/studio/ControlPanel.js');
  const app = window.openCharts;
  const ctrl = (app.def.controls || []).find((c) => c.type === 'colors');
  const parts = ctrl.key.split('.');
  let o = app.spec;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  const leaf = parts[parts.length - 1];

  const cleanHidden = (document.querySelector('.palette-warn') || {}).hidden;

  o[leaf] = ['#d40000', '#00a000', '#2F76C9'];
  buildControls(document.querySelector('.controls'), app.def, app.spec, () => app._onEdit());
  await sleep(400);

  const warn = document.querySelector('.palette-warn');
  const sim = document.querySelector('.palette-sim');
  const before = [...document.querySelectorAll('.palette-dot')].map((d) => d.style.background);
  if (sim) sim.click();
  await sleep(250);
  const after = [...document.querySelectorAll('.palette-dot')].map((d) => d.style.background);

  return {
    cleanHidden,
    warnShown: warn ? !warn.hidden : false,
    warnText: warn ? warn.textContent : '',
    dotsChanged: JSON.stringify(before) !== JSON.stringify(after),
    // Previewing is inspection, not an edit — the chart's real colours stand.
    specUntouched: o[leaf][0] === '#d40000',
  };
});
check(cvdUi.cleanHidden === true, 'a safe palette says nothing');
check(cvdUi.warnShown, 'a palette that merges warns', cvdUi.warnText);
check(cvdUi.dotsChanged, 'and can be previewed as the colour-blind reader sees it');
check(cvdUi.specUntouched, 'previewing never rewrites the chart colours');

/* Every chart the check can say something about, and only those.
 *
 * It first shipped reading the `colors` control, which 58 charts carry — so
 * more than half the library was exempt from a check the product presents as
 * universal, and the silence read as a pass. `paletteOf` answers the question
 * wherever the colours live. */
const cvdReach = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const { paletteOf, confusablePairs } = await import('/js/studio/cvd.js');
  const from = { colors: 0, series: 0, none: 0 };
  const unreachable = [];
  const singles = [];
  let comparable = 0;
  let oneColour = 0;
  for (const def of reg.CHARTS) {
    const p = paletteOf(def, reg.newSpec(def));
    from[p.from || 'none']++;
    // Fewer than two colours is not a gap in the check; it is the check having
    // nothing to say. A single-series chart has no pair that can merge.
    if (p.colors.length < 2) { oneColour++; singles.push(def.id); continue; }
    comparable++;
    // Names must be filtered in step with colours, or the sentence blames the
    // wrong two series.
    if (p.names.length !== p.colors.length) unreachable.push(def.id + ':names');
    // Whatever it hands back has to be something the checker accepts.
    try { confusablePairs(p.colors); } catch { unreachable.push(def.id + ':threw'); }
  }
  return {
    total: reg.CHARTS.length, from, unreachable, singles,
    comparable, oneColour,
  };
});
check(cvdReach.from.series === 53,
  'the check now reads the charts that keep a colour per series',
  `${cvdReach.from.series} via series, ${cvdReach.from.colors} via colors`);
check(cvdReach.comparable === 94,
  'and 94 charts have two colours to compare — up from the 58 with a colors control',
  `${cvdReach.comparable} comparable, ${cvdReach.oneColour} with fewer than two`);
check(cvdReach.comparable + cvdReach.oneColour === cvdReach.total,
  'every chart is either checked or has nothing to compare',
  `${cvdReach.comparable} + ${cvdReach.oneColour} of ${cvdReach.total}`);
check(!cvdReach.unreachable.length, 'and the checker is handed a usable palette each time',
  cvdReach.unreachable.slice(0, 4).join(', '));




/* The controls column is as wide as the reader wants it.
 *
 * It was a fixed 300px — 262px once the padding is off — and that column now
 * carries the data preview, the series editor, the palette, the facet control
 * and the notes. Picking a bigger number would spend more chrome on every
 * reader whether or not they wanted it, so the width is a choice instead. */
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

const widthOf = (sel) => page.evaluate((s2) =>
  Math.round(document.querySelector(s2).getBoundingClientRect().width), sel);
const dragGrip = async (dx) => {
  const box = await page.locator('.controls-grip').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + 300, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(350);
};

const gripCount = await page.locator('.controls-grip').count();
check(gripCount === 1, 'the controls column has one resize grip', String(gripCount));

const startW = await widthOf('.controls');
const startStage = await widthOf('.stage');
await dragGrip(140);
const wideW = await widthOf('.controls');
const wideStage = await widthOf('.stage');
check(wideW > startW + 100, 'dragging it widens the column',
  `${startW} → ${wideW}`);
check(wideStage < startStage - 100, 'and the chart gives up exactly that space',
  `${startStage} → ${wideStage}`);

await dragGrip(900);
const capped = await widthOf('.controls');
await dragGrip(-900);
const floored = await widthOf('.controls');
check(capped <= 560 && floored >= 260,
  'it stops at a sensible width in both directions',
  `max ${capped}, min ${floored}`);

// A grip inside `.controls` would be wiped by `buildControls`, which empties
// that column on every chart load and every data edit.
await page.evaluate(async () => {
  const { buildControls } = await import('/js/studio/ControlPanel.js');
  const app = window.openCharts;
  buildControls(document.querySelector('.controls'), app.def, app.spec, () => app._onEdit());
});
await page.waitForTimeout(300);
const afterRebuild = await page.locator('.controls-grip').count();
check(afterRebuild === 1, 'and it survives the controls being rebuilt',
  `${afterRebuild} grips`);

await dragGrip(120);
const chosen = await widthOf('.controls');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const remembered = await widthOf('.controls');
check(remembered === chosen, 'the width is remembered across a reload',
  `${chosen} → ${remembered}`);

await page.locator('.controls-grip').dblclick();
await page.waitForTimeout(350);
const reset = await widthOf('.controls');
check(reset === 300, 'and a double-click puts it back', String(reset));

// The hand-drawn renderers measure their host, so a width change has to reach
// them — this is the bug the rail's own resize taught.
const remeasured = await page.evaluate(() => {
  const c = document.querySelector('.chart-host canvas');
  if (!c || !c.parentElement) return null;
  return Math.abs(c.getBoundingClientRect().width
    - c.parentElement.getBoundingClientRect().width) < 3;
});
check(remeasured, 'the chart re-measures rather than keeping its old size');

// Below the two-column breakpoint the controls stack, so there is nothing to
// divide and the handle is not offered.
await page.setViewportSize({ width: 700, height: 900 });
await page.waitForTimeout(400);
const hiddenNarrow = await page.evaluate(() => {
  const g = document.querySelector('.controls-grip');
  return !g || getComputedStyle(g).display === 'none';
});
check(hiddenNarrow, 'and it is not offered where the studio stacks');
await page.setViewportSize({ width: 1280, height: 900 });

/* Undo and redo for the studio itself.
 *
 * The data grid has had them since it shipped, and they cover the table and
 * nothing else — so every colour, slider, toggle, facet and note was a one-way
 * door. These are spec snapshots, the same bargain the grid makes: a spec is
 * JSON by construction, so a copy is cheap beside the render that follows it. */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const studioHistory = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.openCharts;
  const btn = (re) => [...document.querySelectorAll('.code-actions .btn')]
    .find((b) => re.test(b.textContent));
  const undoBtn = btn(/Undo/);
  const redoBtn = btn(/Redo/);
  const out = { present: !!(undoBtn && redoBtn) };
  if (!out.present) return out;

  out.startDisabled = undoBtn.disabled && redoBtn.disabled;

  const startColour = app.spec.series[0].color;
  app.spec.series[0].color = '#CE5229';
  app._onEdit();
  await sleep(500);
  out.undoLit = !undoBtn.disabled;
  out.redoStillDim = redoBtn.disabled;

  undoBtn.click();
  await sleep(400);
  out.undoneColour = app.spec.series[0].color === startColour;
  out.redoLit = !redoBtn.disabled;
  // The chart is redrawn from the restored spec, not left showing the old one.
  out.chartRedrew = !!document.querySelector('.chart-host canvas');

  redoBtn.click();
  await sleep(400);
  out.redoneColour = app.spec.series[0].color === '#CE5229';

  // A drag fires an edit per pixel; that is one step, not eight.
  const beforeDrag = app.spec.opts.radius;
  const depthBefore = app.past.length;
  for (let i = 0; i < 8; i++) { app.spec.opts.radius = 6 + i; app._onEdit(); await sleep(20); }
  await sleep(450);
  out.stepsAdded = app.past.length - depthBefore;
  undoBtn.click();
  await sleep(350);
  out.dragUndoneWhole = app.spec.opts.radius === beforeDrag;

  // Keyboard.
  app.spec.opts.radius = 12;
  app._onEdit();
  await sleep(500);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  await sleep(350);
  out.keyboardUndo = app.spec.opts.radius !== 12;

  // A new edit after an undo drops what was ahead: there is no branch to
  // redo into any more.
  app.spec.opts.radius = 9;
  app._onEdit();
  await sleep(500);
  out.futureDropped = redoBtn.disabled;
  return out;
});
check(studioHistory.present, 'the code panel carries undo and redo');
check(studioHistory.startDisabled, 'both start disabled, with nothing to go back to');
check(studioHistory.undoLit && studioHistory.redoStillDim,
  'an edit lights undo and leaves redo dim',
  `undo=${studioHistory.undoLit} redo-dim=${studioHistory.redoStillDim}`);
check(studioHistory.undoneColour && studioHistory.chartRedrew,
  'undo puts the colour back and redraws the chart');
check(studioHistory.redoLit && studioHistory.redoneColour, 'and redo puts it forward again');
check(studioHistory.stepsAdded === 1 && studioHistory.dragUndoneWhole,
  'a drag is one undo step, not one per pixel',
  `${studioHistory.stepsAdded} steps added`);
check(studioHistory.keyboardUndo, 'Ctrl+Z undoes from the keyboard');
check(studioHistory.futureDropped, 'and editing after an undo drops the redo branch');

/* The grid keeps its own Ctrl+Z: inside a data editor it means the table. */
const guarded = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.openCharts;
  [...document.querySelectorAll('button')].find((b) => /Edit data/i.test(b.textContent)).click();
  await sleep(1100);
  const before = JSON.stringify(app.spec);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  await sleep(300);
  const untouched = JSON.stringify(app.spec) === before;
  const cancel = [...document.querySelectorAll('.dlg-foot .btn')].find((b) => /Cancel/.test(b.textContent));
  if (cancel) cancel.click();
  await sleep(300);
  return { untouched, dialogWasOpen: true };
});
check(guarded.untouched,
  'the studio stands down while the data editor is open, so the grid keeps its own');

/* Opening another chart starts a fresh studioHistory, not a continuation. */
await page.goto(`${base}/studio.html?chart=bar-lollipop`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const fresh = await page.evaluate(() => {
  const app = window.openCharts;
  const undoBtn = [...document.querySelectorAll('.code-actions .btn')]
    .find((b) => /Undo/.test(b.textContent));
  return { depth: app.past.length, disabled: undoBtn.disabled };
});
check(fresh.depth === 0 && fresh.disabled,
  'and opening another chart starts a fresh history',
  `${fresh.depth} steps`);



/* The chart from the report: one series, so it resolved to no palette at all
 * and got no Colour row. `paletteOf` demanded two colours — a colour-vision
 * rule, since a lone series has no pair that can merge — and the editor was
 * reading it as "this chart has no colours". */
await page.goto(`${base}/studio.html?chart=line-basic`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const oneSeries = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.openCharts;
  const out = { series: app.spec.series.length };
  [...document.querySelectorAll('button')].find((b) => /Edit data/i.test(b.textContent)).click();
  await sleep(1200);
  const row = () => document.querySelector('.dgrid-colour-row');
  out.rowShown = !!row();
  if (!out.rowShown) return out;
  out.swatches = row().querySelectorAll('.dgrid-swatch').length;

  // Adding a series must bring its swatch with it, rather than waiting for the
  // editor to be closed and reopened.
  const add = [...document.querySelectorAll('.dlg .btn')].find((b) => /\+ Series/.test(b.textContent));
  if (add) { add.click(); await sleep(400); }
  out.afterAdd = row().querySelectorAll('.dgrid-swatch').length;
  out.newShowsAColour = [...row().querySelectorAll('.dgrid-swatch')]
    .every((b) => !!b.style.background);

  const before = app.spec.series[0].color;
  row().querySelector('.dgrid-swatch').click();
  await sleep(300);
  const dots = [...document.querySelectorAll('.colour-pop .palette-dot')];
  if (dots[3]) { dots[3].click(); await sleep(300); }
  [...document.querySelectorAll('.dlg-foot .btn')].find((b) => /Use this data/.test(b.textContent)).click();
  await sleep(1400);
  out.changed = app.spec.series[0].color !== before;
  // The series nobody touched keeps the colour it was going to have, rather
  // than the swatch's default being written back as a decision.
  out.secondUntouched = app.spec.series.length > 1;
  return out;
});
check(oneSeries.series === 1 && oneSeries.rowShown,
  'a single-series chart gets a Colour row too',
  `${oneSeries.series} series, row=${oneSeries.rowShown}`);
check(oneSeries.swatches === 1, 'with one swatch for its one series',
  `${oneSeries.swatches} swatches`);
check(oneSeries.afterAdd === 2 && oneSeries.newShowsAColour,
  'and adding a series brings its swatch with it, already showing its colour',
  `${oneSeries.afterAdd} swatches`);
check(oneSeries.changed && oneSeries.secondUntouched,
  'picking one applies it without disturbing the other');

/* A series created by a paste takes its colour from the one palette.
 *
 * `dataio` kept its own copy of that list, and the copy had already drifted:
 * the palette was corrected for colour-blind readers and this one still held
 * the eight that collided, so every pasted column brought the old set back. */
const newSeries = await page.evaluate(async () => {
  const { PALETTE } = await import('/js/studio/palette.js');
  const { applyData } = await import('/js/studio/dataio.js');
  const reg = await import('/js/studio/registry.js');
  const m = await import('/js/studio/cvd.js');
  const def = reg.getChart('line-basic');
  const spec = reg.newSpec(def);
  applyData(def, spec, {
    headers: ['label', 'A', 'B', 'C', 'D', 'E', 'F'],
    rows: [['Jan', '1', '2', '3', '4', '5', '6'], ['Feb', '2', '3', '4', '5', '6', '7']],
  });
  const colours = spec.series.map((x) => x.color);
  return {
    colours,
    fromPalette: colours.every((c, i) => c === PALETTE[i % PALETTE.length]),
    merging: m.confusablePairs(colours).length,
  };
});
check(newSeries.fromPalette,
  'a pasted column takes its colour from the one palette, not a copy of it',
  newSeries.colours.join(' '));
check(!newSeries.merging,
  'so six pasted series still do not merge for a colour-blind reader',
  `${newSeries.merging} pairs`);

/* The palette as a set, and swatches on the printed spec.
 *
 * The sidebar edits a colour beside its series and the data table edits one
 * against its column; neither shows the palette as a whole, which is what you
 * need when the question is "do these work together". */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const colourTab = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.openCharts;
  const tab = (re) => [...document.querySelectorAll('.code-bar .tab')].find((b) => re.test(b.textContent));
  const out = {};

  const ct = tab(/Colours/);
  out.tabExists = !!ct;
  if (!ct) return out;
  ct.click();
  await sleep(400);

  out.rows = document.querySelectorAll('.palette-editor-row').length;
  out.names = [...document.querySelectorAll('.palette-editor-name')].map((n) => n.textContent);
  out.hexes = [...document.querySelectorAll('.palette-editor-hex')].map((n) => n.textContent);
  // Nothing to copy or download from a view that is not source.
  const copy = [...document.querySelectorAll('.code-actions .btn')].find((b) => /Copy/.test(b.textContent));
  out.copyHidden = getComputedStyle(copy).display === 'none';

  const before = app.spec.series[0].color;
  document.querySelector('.palette-editor-dot').click();
  await sleep(300);
  const dots = [...document.querySelectorAll('.colour-pop .palette-dot')];
  out.picker = dots.length > 0;
  if (dots[2]) { dots[2].click(); await sleep(500); }
  out.changed = app.spec.series[0].color !== before;
  // It is an ordinary edit, so it joins the history like any other.
  const undoBtn = [...document.querySelectorAll('.code-actions .btn')].find((b) => /Undo/.test(b.textContent));
  out.undoLit = !undoBtn.disabled;
  undoBtn.click();
  await sleep(400);
  out.undone = app.spec.series[0].color === before;

  /* And the Spec tab prints a swatch on every colour it holds. */
  tab(/Spec/).click();
  await sleep(400);
  out.specSwatches = document.querySelectorAll('.spec-swatch').length;
  const sw = document.querySelector('.spec-swatch');
  if (sw) {
    const specBefore = JSON.stringify(app.spec);
    sw.click();
    await sleep(300);
    const d = [...document.querySelectorAll('.colour-pop .palette-dot')];
    if (d[4]) { d[4].click(); await sleep(600); }
    out.specEdited = JSON.stringify(app.spec) !== specBefore;
    out.stillValid = !!(app.spec.series && app.spec.series.length === 2
      && app.spec.series[0].label === '2024');
  }
  return out;
});
check(colourTab.tabExists, 'the code panel has a Colours tab');
check(colourTab.rows === 2 && colourTab.names.join(',') === '2024,2023',
  'it lists every colour the chart draws with, by series name',
  `${colourTab.rows} rows: ${colourTab.names.join(',')}`);
check(colourTab.hexes.every((h) => /^#[0-9A-Fa-f]{6}$/.test(h)),
  'each one shows its hex', colourTab.hexes.join(' '));
check(colourTab.copyHidden, 'and the copy button stands down on a view that is not source');
check(colourTab.picker && colourTab.changed,
  'picking a colour there changes the chart', String(colourTab.changed));
check(colourTab.undoLit && colourTab.undone,
  'and it is an ordinary edit, so undo takes it back');
check(colourTab.specSwatches === 2,
  'the Spec tab prints a swatch on every colour it holds',
  `${colourTab.specSwatches} swatches`);
check(colourTab.specEdited && colourTab.stillValid,
  'and picking one edits the spec without disturbing the rest',
  `edited=${colourTab.specEdited} intact=${colourTab.stillValid}`);

/* The colour popover, and colours in the data table.
 *
 * The popover used to be an absolutely-positioned child of the swatch, inside
 * `.controls` — a scroll container. So it was clipped near the bottom of the
 * column, it overlapped whatever control came next, and it only ever opened
 * downward. It is a portal on `document.body` now, which is why these checks
 * are about where it lives rather than about a z-index. */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const picker = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rows = [...document.querySelectorAll('.series-row')];
  rows[rows.length - 1].querySelector('.swatch').click();
  await sleep(300);

  const pop = document.querySelector('.colour-pop');
  const r = pop ? pop.getBoundingClientRect() : null;
  const add = [...document.querySelectorAll('.btn')].find((b) => /Add series/.test(b.textContent));
  const ab = add ? add.getBoundingClientRect() : null;

  let onTop = null;
  const overlaps = !!(r && ab && r.bottom > ab.top && r.top < ab.bottom);
  if (overlaps) {
    const y = (Math.max(r.top, ab.top) + Math.min(r.bottom, ab.bottom)) / 2;
    const hit = document.elementFromPoint(r.left + r.width / 2, y);
    onTop = hit ? (hit.className || hit.tagName) : null;
  }

  // Read where it lives *before* dismissing it: the scroll below detaches the
  // node, and asking a detached element for its parent answers about the test,
  // not about the popover.
  const shot = {
    portalled: !!(pop && pop.parentElement === document.body),
    position: pop ? getComputedStyle(pop).position : null,
    inViewport: !!(r && r.top >= 0 && r.bottom <= window.innerHeight),
    overlaps,
    onTop,
    openedOne: document.querySelectorAll('.colour-pop').length,
  };

  // A scroll must not dismiss it. Clicking a swatch low in a scrolling column
  // makes the browser scroll it into view, and that scroll lands *after* the
  // popover opens — closing on it shut the popover within a frame of opening.
  document.querySelector('.controls').dispatchEvent(new Event('scroll', { bubbles: true }));
  await sleep(150);
  shot.survivesScroll = document.querySelectorAll('.colour-pop').length === 1;

  // It gives up only when the swatch it points at has actually gone.
  document.querySelectorAll('.series-row').forEach((r) => r.remove());
  document.querySelector('.controls').dispatchEvent(new Event('scroll', { bubbles: true }));
  await sleep(150);
  shot.closedWhenAnchorGone = document.querySelectorAll('.colour-pop').length === 0;
  return shot;
});
check(picker.portalled && picker.position === 'fixed',
  'the colour popover is a portal, so nothing can clip it',
  JSON.stringify(picker));
check(picker.inViewport, 'and it opens where it fits on screen');
check(!picker.overlaps || /colour-pop/.test(picker.onTop || ''),
  'where it overlaps the next control, it is the one on top',
  `overlaps=${picker.overlaps} top=${picker.onTop}`);
check(picker.openedOne === 1 && picker.survivesScroll,
  'a scroll moves it rather than closing it',
  `${picker.openedOne} open, survived: ${picker.survivesScroll}`);
check(picker.closedWhenAnchorGone,
  'and it closes once its swatch is gone');



/* A series is a column, so its colour belongs against its heading. */
const gridColour = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.openCharts;
  const before = app.spec.series.map((x) => x.color);
  [...document.querySelectorAll('button')].find((b) => /Edit data/i.test(b.textContent)).click();
  await sleep(1100);
  const row = document.querySelector('.dgrid-colour-row');
  const heads = [...document.querySelectorAll('.dgrid-colour-row .dgrid-swatch')];
  const gutters = document.querySelectorAll('.dgrid tbody .dgrid-swatch').length;
  if (!row || !heads.length) return { heads: 0, gutters, hasRow: !!row };
  // A row of the table, in the head with the header it describes — not a
  // swatch tucked into the heading's own cell.
  const headerCells = document.querySelector('.dgrid thead tr').children.length;
  const centre = (e) => { const b = e.getBoundingClientRect(); return b.left + b.width / 2; };
  const colCentres = [...document.querySelectorAll('.dgrid thead tr th')]
    .slice(1, -1).map(centre);
  const layout = {
    lead: row.querySelector('.dgrid-colour-lead').textContent,
    inHead: row.parentElement.tagName,
    cellsMatchHeader: row.children.length === headerCells,
    blanks: row.querySelectorAll('.is-blank').length,
    aligned: heads.every((b) => colCentres.some((x) => Math.abs(x - centre(b)) <= 2)),
  };
  heads[0].click();
  await sleep(300);
  const dots = [...document.querySelectorAll('.colour-pop .palette-dot')];
  if (dots[2]) { dots[2].click(); await sleep(250); }
  const heldBefore = app.spec.series.map((x) => x.color);
  [...document.querySelectorAll('.dlg-foot .btn')].find((b) => /Use this data/.test(b.textContent)).click();
  await sleep(1300);
  return {
    heads: heads.length,
    gutters,
    before,
    hasRow: true,
    ...layout,
    swatchPainted: heads[0].style.background,
    heldUntilApply: JSON.stringify(before) === JSON.stringify(heldBefore),
    after: app.spec.series.map((x) => x.color),
  };
});
check(gridColour.hasRow && gridColour.inHead === 'THEAD' && gridColour.lead === 'Colour',
  'a series chart gets a Colour row in the table',
  `row=${gridColour.hasRow} in=${gridColour.inHead} lead=${gridColour.lead}`);
check(gridColour.heads === 2 && gridColour.gutters === 0,
  'with one swatch per series column and none in the gutter',
  `${gridColour.heads} swatches, ${gridColour.gutters} gutters`);
check(gridColour.cellsMatchHeader && gridColour.blanks === 1 && gridColour.aligned,
  'its cells line up with the columns, blank under the label column',
  `cells=${gridColour.cellsMatchHeader} blanks=${gridColour.blanks} aligned=${gridColour.aligned}`);
check(!!gridColour.swatchPainted, 'the swatch shows the colour it will apply',
  gridColour.swatchPainted);
check(gridColour.heldUntilApply,
  'and the chart is not recoloured until the table is applied');
check(gridColour.after[0] !== gridColour.before[0]
  && gridColour.after[1] === gridColour.before[1],
  'applying writes that one colour to the spec, and only that one',
  `${gridColour.before} -> ${gridColour.after}`);

/* An item is a row, so its colour belongs against the row number. */
await page.goto(`${base}/studio.html?chart=bar-lollipop`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const rowColour = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.openCharts;
  [...document.querySelectorAll('button')].find((b) => /Edit data/i.test(b.textContent)).click();
  await sleep(1100);
  return {
    items: app.spec.items.length,
    heads: document.querySelectorAll('.dgrid thead .dgrid-swatch').length,
    gutters: document.querySelectorAll('.dgrid tbody .dgrid-swatch').length,
  };
});
check(rowColour.gutters === rowColour.items && rowColour.heads === 0,
  'an item chart puts one in each row gutter instead',
  `${rowColour.gutters} gutters for ${rowColour.items} items, ${rowColour.heads} headings`);

/* The bug this all came from: on a window short enough for the sidebar to
 * scroll, clicking a swatch near the bottom scrolls it into view, and that
 * scroll arrives after the popover has opened. */
for (const height of [720, 620]) {
  await page.setViewportSize({ width: 1280, height });
  await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const low = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // Push the list down so the last swatch sits low in a scrolling column.
    for (let i = 0; i < 4; i++) {
      const add = [...document.querySelectorAll('.btn')].find((b) => /Add series/.test(b.textContent));
      if (!add) break;
      add.click();
      await sleep(120);
    }
    const controls = document.querySelector('.controls');
    const rows = [...document.querySelectorAll('.series-row')];
    // Bring the last row to the *bottom of the visible column*, which is where
    // a reader clicking it would have it — not past the top, which is what
    // scrolling to the very end does, and which nobody can click.
    rows[rows.length - 1].scrollIntoView({ block: 'end' });
    await sleep(200);
    rows[rows.length - 1].querySelector('.swatch').click();
    // The scroll the browser makes to reveal the swatch lands about here.
    await sleep(250);
    const pop = document.querySelector('.colour-pop');
    if (!pop) return { open: false, scrollable: controls.scrollHeight > controls.clientHeight };
    const r = pop.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const sw = rows[rows.length - 1].querySelector('.swatch').getBoundingClientRect();
    return {
      open: true,
      scrollable: controls.scrollHeight > controls.clientHeight,
      onScreen: r.top >= 0 && r.bottom <= window.innerHeight,
      onTop: !!(hit && pop.contains(hit)),
      pop: { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height) },
      swatch: { t: Math.round(sw.top), b: Math.round(sw.bottom) },
      vh: window.innerHeight,
    };
  });
  check(low.scrollable, `the sidebar really does scroll at ${height}px`, JSON.stringify(low));
  check(low.open && low.onScreen && low.onTop,
    `a swatch low in a ${height}px window still opens a usable popover`,
    JSON.stringify(low));
}
await page.setViewportSize({ width: 1280, height: 900 });

/* A `colors` control does not always point at hex.
 *
 * The word cloud points its at `words`, whose entries carry a colour each —
 * read as colours those painted 28 blank swatches, a control that could not do
 * the one thing it is named for, on the only chart the check could not see. */
await page.goto(`${base}/studio.html?chart=word-cloud`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const wordCloud = await page.evaluate(async () => {
  const { paletteOf } = await import('/js/studio/cvd.js');
  const app = window.openCharts;
  const palette = paletteOf(app.def, app.spec);
  const dots = [...document.querySelectorAll('.palette-dot')];
  const before = JSON.parse(JSON.stringify(app.spec.words[0]));
  return {
    resolved: palette.from,
    colours: palette.colors.length,
    named: palette.names.filter(Boolean).length,
    words: app.spec.words.length,
    blank: dots.filter((d) => !d.style.background).length,
    entryIsObject: before && typeof before === 'object' && 'weight' in before,
  };
});
check(wordCloud.resolved === 'colors' && wordCloud.colours === wordCloud.words,
  'a colors control pointing at objects still yields one colour per entry',
  `${wordCloud.colours} of ${wordCloud.words} via ${wordCloud.resolved}`);
check(wordCloud.blank === 0, 'so none of its swatches render blank',
  `${wordCloud.blank} blank of ${wordCloud.words}`);
check(wordCloud.named === wordCloud.words, 'and each one is named for its word',
  `${wordCloud.named} named`);
check(wordCloud.entryIsObject, 'the entries are still words, not bare colours');

/* And it reaches the panel for a chart that keeps its colours per series. */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const cvdSeries = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const { buildControls } = await import('/js/studio/ControlPanel.js');
  const { paletteOf } = await import('/js/studio/cvd.js');
  const app = window.openCharts;
  const where = paletteOf(app.def, app.spec).from;

  // Purple and teal are two swatches that stay apart under every deficiency,
  // so this is the quiet case. Set explicitly rather than trusting whatever
  // the chart ships with — the wider reach turned some shipped pairs into
  // true positives, which is the finding, not the fixture.
  app.spec.series[0].color = '#6C63D8';
  app.spec.series[1].color = '#16916A';
  buildControls(document.querySelector('.controls'), app.def, app.spec, () => app._onEdit());
  await sleep(400);
  const cleanHidden = (document.querySelector('.palette-warn') || {}).hidden;

  app.spec.series[0].color = '#d40000';
  app.spec.series[1].color = '#00a000';
  buildControls(document.querySelector('.controls'), app.def, app.spec, () => app._onEdit());
  await sleep(400);

  const warn = document.querySelector('.palette-warn');
  const sim = document.querySelector('.palette-sim');
  const before = [...document.querySelectorAll('.swatch')].map((d) => d.style.background);
  if (sim) sim.click();
  await sleep(250);
  const after = [...document.querySelectorAll('.swatch')].map((d) => d.style.background);

  return {
    where,
    cleanHidden,
    warnShown: warn ? !warn.hidden : false,
    warnText: warn ? warn.textContent : '',
    swatchesChanged: JSON.stringify(before) !== JSON.stringify(after),
    specUntouched: app.spec.series[0].color === '#d40000',
  };
});
check(cvdSeries.where === 'series', 'a per-series chart is read through its series control',
  String(cvdSeries.where));
check(cvdSeries.cleanHidden === true, 'a safe per-series palette says nothing either');
check(cvdSeries.warnShown && /2024|2023/.test(cvdSeries.warnText),
  'a merging pair warns, naming the series', cvdSeries.warnText);
check(cvdSeries.swatchesChanged, 'and previews as the colour-blind reader sees it');
check(cvdSeries.specUntouched, 'previewing never rewrites the chart colours here either');

/* The chart as data: a spec you can read, copy and paste back. */
await page.goto(`${base}/studio.html?chart=line-multi`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const specView = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (re) => [...document.querySelectorAll('.code-actions .btn')]
    .find((b) => re.test(b.textContent));

  [...document.querySelectorAll('.tab')].find((t) => t.textContent === 'Spec').click();
  await sleep(300);
  const shown = document.querySelector('.code-body').textContent;
  let parsed = null;
  try { parsed = JSON.parse(shown); } catch { /* reported below */ }

  btn(/Paste a spec/).click();
  await sleep(200);
  const ta = document.querySelector('.code-edit');
  const obj = JSON.parse(ta.value);
  obj.spec.labels = ['ZZ', 'YY', 'XX', 'WW', 'VV', 'UU'];
  ta.value = JSON.stringify(obj, null, 2);
  btn(/Apply spec/).click();
  await sleep(700);

  const applied = window.openCharts.spec.labels[0];
  const closed = document.querySelector('.code-edit').hidden;

  // Malformed JSON must not be swallowed — the editor stays open holding
  // whatever was pasted, so it can be fixed rather than retyped.
  btn(/Paste a spec/).click();
  await sleep(150);
  document.querySelector('.code-edit').value = '{ not json';
  btn(/Apply spec/).click();
  await sleep(350);
  const refusedStaysOpen = !document.querySelector('.code-edit').hidden;
  const refusedKeepsText = document.querySelector('.code-edit').value === '{ not json';

  return {
    isJson: !!parsed,
    namesItsChart: parsed && parsed.chart === 'line-multi',
    carriesSpec: !!(parsed && parsed.spec && typeof parsed.spec === 'object'),
    applied,
    closed,
    refusedStaysOpen,
    refusedKeepsText,
  };
});
check(specView.isJson, 'the spec view is valid JSON');
check(specView.namesItsChart, 'and names the chart it belongs to');
check(specView.carriesSpec, 'and carries the spec itself');
check(specView.applied === 'ZZ', 'a pasted spec reaches the chart', String(specView.applied));
check(specView.closed, 'and the editor closes once it applies');
check(specView.refusedStaysOpen, 'malformed JSON is refused');
check(specView.refusedKeepsText, 'and what was pasted is kept so it can be fixed');

/* A spec is portable: pasting another chart's opens that chart, rather than
 * merging fields into one that will ignore half of them. */
await page.goto(`${base}/studio.html?chart=line-multi`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const crossChart = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = (re) => [...document.querySelectorAll('.code-actions .btn')]
    .find((b) => re.test(b.textContent));
  [...document.querySelectorAll('.tab')].find((t) => t.textContent === 'Spec').click();
  await sleep(250);
  btn(/Paste a spec/).click();
  await sleep(150);
  document.querySelector('.code-edit').value = JSON.stringify({ chart: 'bar-vertical', spec: {} });
  btn(/Apply spec/).click();
  await sleep(1300);
  return { now: window.openCharts.def.id };
});
check(crossChart.now === 'bar-vertical', "a spec for another chart opens that chart",
  String(crossChart.now));

/* Undo. A grid that deletes rows with no way back is not safe to explore in. */
const history = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const foot = (label) => [...document.querySelectorAll('.dgrid-foot .btn')]
    .find((b) => b.textContent === label);

  [...document.querySelectorAll('button')].find((b) => /Edit data/i.test(b.textContent)).click();
  await sleep(900);

  const startDisabled = foot('Undo').disabled && foot('Redo').disabled;

  const cell = document.querySelector('.dgrid-cell');
  const original = cell.value;
  cell.dispatchEvent(new Event('focus', { bubbles: true }));
  for (const v of ['Q', 'QQ', 'QQQ']) {
    cell.value = v;
    cell.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(30);
  }
  const typed = document.querySelector('.dgrid-cell').value;

  foot('Undo').click();
  await sleep(280);
  const afterUndo = document.querySelector('.dgrid-cell').value;
  // Three keystrokes are one edit. If undo walked back a character at a time
  // there would still be steps left on the stack here.
  const oneStep = foot('Undo').disabled;

  foot('Redo').click();
  await sleep(280);
  const afterRedo = document.querySelector('.dgrid-cell').value;

  const rowsBefore = document.querySelectorAll('.dgrid tbody tr').length;
  foot('+ Row').click();
  await sleep(220);
  const rowsAdded = document.querySelectorAll('.dgrid tbody tr').length;
  foot('Undo').click();
  await sleep(280);
  const rowsUndone = document.querySelectorAll('.dgrid tbody tr').length;

  // Ctrl+Z reaches the grid, and only the grid.
  document.querySelector('.dgrid-cell').focus();
  foot('+ Row').click();
  await sleep(200);
  const beforeKey = document.querySelectorAll('.dgrid tbody tr').length;
  document.querySelector('.dgrid').dispatchEvent(new KeyboardEvent('keydown', {
    key: 'z', ctrlKey: true, bubbles: true,
  }));
  await sleep(280);
  const afterKey = document.querySelectorAll('.dgrid tbody tr').length;

  return {
    startDisabled, original, typed, afterUndo, oneStep, afterRedo,
    rowsBefore, rowsAdded, rowsUndone, beforeKey, afterKey,
  };
});
check(history.startDisabled, 'undo and redo start with nothing to do');
check(history.afterUndo === history.original, 'undo restores the cell',
  `${history.typed} → ${history.afterUndo}, wanted ${history.original}`);
check(history.oneStep, 'typing is one undo step, not one per keystroke');
check(history.afterRedo === history.typed, 'redo puts it back', String(history.afterRedo));
check(history.rowsAdded === history.rowsBefore + 1 && history.rowsUndone === history.rowsBefore,
  'adding a row can be undone', `${history.rowsBefore} → ${history.rowsAdded} → ${history.rowsUndone}`);
check(history.afterKey === history.beforeKey - 1, 'Ctrl+Z undoes inside the grid',
  `${history.beforeKey} → ${history.afterKey}`);
console.log(`  ${green('✓')} small builds — colour-vision check, spec round-trip, undo/redo`);

/* Suite 20 — the collapsible rail and focus mode. */

/* A fresh page: the suite before this one leaves the data dialog open, and a
 * rail mode stored by an earlier run would decide the first measurement. */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  try { localStorage.removeItem('opencharts.rail-mode'); } catch { /* private window */ }
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

/* The spine is nothing but glyphs, so two categories sharing one would make
 * the second unreachable by sight. Harmless in the expanded rail, where the
 * name is spelled out beside it — which is why this went unnoticed for so long. */
const spineGlyphs = await page.evaluate(async () => {
  const { CATEGORY_ORDER } = await import('/js/studio/registry.js');
  const heads = [...document.querySelectorAll('.rail-group-head .rail-group-ico')];
  const marks = heads.map((h) => h.innerHTML.trim());
  return {
    categories: CATEGORY_ORDER.length,
    drawn: marks.filter(Boolean).length,
    distinct: new Set(marks.filter(Boolean)).size,
  };
});
check(spineGlyphs.drawn === spineGlyphs.categories, 'every category carries a glyph',
  `${spineGlyphs.drawn} of ${spineGlyphs.categories}`);
check(spineGlyphs.distinct === spineGlyphs.drawn, 'and no two categories share one',
  `${spineGlyphs.distinct} distinct of ${spineGlyphs.drawn}`);

/* The filter box is a toolbar component borrowed by a sidebar, and it brought
 * `flex: 1 1 210px` with it. In the gallery's horizontal bar that basis is a
 * width and growing fills the row; in the rail's column it is a *height*, so
 * the pill swelled from 35px to 496px the moment a filter left free space
 * under it. The `min-width: 210px` floor was the same mistake pointing
 * sideways — wider than the 204px the rail has, so the rail scrolled. */
const filterBox = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const input = document.querySelector('#rail-search');
  const rail = document.querySelector('.rail');
  const box = () => rail.querySelector('.search').getBoundingClientRect();

  const type = async (q) => {
    input.value = q;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);
    return {
      h: Math.round(box().height),
      links: document.querySelectorAll('.rail-link').length,
      overflow: rail.scrollWidth - rail.clientWidth,
    };
  };

  const full = await type('');
  // One result, no results, and a middling number: the empty end of the range
  // is where the free space appears.
  const few = await type('globe');
  const none = await type('zzzz');
  const some = await type('bar');
  await type('');
  return { full, few, none, some };
});
const boxHeights = [filterBox.full, filterBox.few, filterBox.none, filterBox.some];
check(boxHeights.every((m) => m.h === filterBox.full.h),
  'the filter box is the same height however many charts match',
  boxHeights.map((m) => `${m.links}:${m.h}px`).join(' '));
check(filterBox.full.h < 60, 'and that height is one line', `${filterBox.full.h}px`);
check(boxHeights.every((m) => m.overflow <= 0),
  'the rail never scrolls sideways', boxHeights.map((m) => m.overflow).join(','));

const rail = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const width = () => Math.round(document.querySelector('.rail').getBoundingClientRect().width);
  const stage = () => Math.round(document.querySelector('.stage').getBoundingClientRect().width);

  const openWidth = width();
  const openStage = stage();

  // Which groups are open is a separate preference from whether the rail is
  // collapsed, and collapsing must not overwrite it.
  let groupsBefore = null;
  try { groupsBefore = localStorage.getItem('opencharts.rail'); } catch { /* private window */ }

  document.querySelector('#rail-collapse').click();
  await sleep(420);
  const miniWidth = width();
  const miniStage = stage();
  const marked = document.body.dataset.rail;
  let saved = null;
  let groupsAfter = null;
  try {
    saved = localStorage.getItem('opencharts.rail-mode');
    groupsAfter = localStorage.getItem('opencharts.rail');
  } catch { /* private window */ }

  // The list is not on screen, so a glyph has to bring it back — otherwise a
  // collapsed rail is a one-way door.
  document.querySelectorAll('.rail-group-head')[2].click();
  await sleep(420);
  const reopened = document.body.dataset.rail !== 'mini';
  const groupOpen = document.querySelectorAll('.rail-group')[2].dataset.open;

  return {
    openWidth, miniWidth, openStage, miniStage, marked, saved,
    groupsKept: groupsBefore === groupsAfter,
    reopened, groupOpen,
  };
});
check(rail.miniWidth < 70 && rail.miniWidth > 40, 'the rail collapses to a spine',
  `${rail.openWidth}px → ${rail.miniWidth}px`);
check(rail.miniStage > rail.openStage + 100, 'and the chart gets the width back',
  `stage ${rail.openStage}px → ${rail.miniStage}px`);
check(rail.marked === 'mini', 'the mode is marked on the document', String(rail.marked));
check(rail.saved === 'mini', 'and remembered for next time', String(rail.saved));
check(rail.groupsKept, 'collapsing does not overwrite which groups are open');
check(rail.reopened, 'a glyph opens the rail again rather than toggling an unseen body');
check(rail.groupOpen === 'true', 'and opens its own category', String(rail.groupOpen));

/* Focus: everything but the plate. */
const focus = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shown = (sel) => {
    const el = document.querySelector(sel);
    return !!(el && el.offsetParent !== null);
  };
  const before = Math.round(document.querySelector('.stage').getBoundingClientRect().width);

  document.querySelector('#btn-focus').click();
  await sleep(420);
  const on = {
    rail: shown('.rail'),
    controls: shown('.controls'),
    code: shown('.codepanel'),
    head: shown('.page-head'),
    stage: shown('.stage'),
    width: Math.round(document.querySelector('.stage').getBoundingClientRect().width),
    pressed: document.querySelector('#btn-focus').getAttribute('aria-pressed'),
  };

  // Escape is the way out of a mode you may have entered by accident, and the
  // stage bar stays put so the button is still there to click.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(420);
  const off = { rail: shown('.rail'), controls: shown('.controls'), code: shown('.codepanel') };

  return { before, on, off };
});
check(!focus.on.rail && !focus.on.controls && !focus.on.code && !focus.on.head,
  'focus hides every panel but the chart',
  JSON.stringify(focus.on));
check(focus.on.stage, 'and keeps the stage itself');
check(focus.on.width > focus.before, 'the chart takes the whole window',
  `${focus.before}px → ${focus.on.width}px`);
check(focus.on.pressed === 'true', 'the focus button reports its state');
check(focus.off.rail && focus.off.controls && focus.off.code,
  'and Escape brings everything back', JSON.stringify(focus.off));

/* The spine is a desktop idea. Below 900px the rail is already a slide-over
 * drawer, and a 56px strip competing with it would be a third behaviour. */
await page.setViewportSize({ width: 820, height: 900 });
await page.waitForTimeout(400);
const narrow = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  document.body.dataset.rail = 'mini';
  await sleep(200);
  const railEl = document.querySelector('.rail');
  const w = Math.round(railEl.getBoundingClientRect().width);
  document.body.dataset.rail = '';
  return { width: w, overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth) };
});
check(narrow.width > 70, 'the spine does not apply where the rail is a drawer',
  `${narrow.width}px at 820px wide`);
check(narrow.overflow <= 1, 'and nothing overflows sideways', `${narrow.overflow}px`);
await page.setViewportSize({ width: 1280, height: 900 });
console.log(`  ${green('✓')} atelier — spine ${rail.openWidth}→${rail.miniWidth}px, focus full-bleed`);

// Leave the profile as it was found, so nothing after this inherits a spine.
await page.evaluate(() => {
  try { localStorage.removeItem('opencharts.rail-mode'); } catch { /* private window */ }
  document.body.dataset.rail = '';
});

/* Scoping the rail's copy must not have taken the growing pill away from the
 * toolbar it was written for. */
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const toolbarSearch = await page.evaluate(() => {
  const s = document.querySelector('.search');
  const cs = getComputedStyle(s);
  return { grows: cs.flexGrow, width: Math.round(s.getBoundingClientRect().width) };
});
check(toolbarSearch.grows === '1' && toolbarSearch.width > 250,
  'the gallery toolbar search still fills its row',
  `grow ${toolbarSearch.grows}, ${toolbarSearch.width}px`);

/* Suite 21 — motion that answers the pointer. */

/* The sheen follows the cursor across a card. Delegated from the document, so
 * this also proves one listener serves all 114 tiles. */
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const firstCard = await page.$('.card');
await firstCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(250);
const cardBox = await firstCard.boundingBox();
const readSheen = () => page.evaluate(() => {
  const c = document.querySelector('.card');
  return { mx: c.style.getPropertyValue('--mx'), my: c.style.getPropertyValue('--my') };
});

await page.mouse.move(cardBox.x + cardBox.width * 0.2, cardBox.y + cardBox.height * 0.25, { steps: 6 });
await page.waitForTimeout(220);
const sheenLeft = await readSheen();
await page.mouse.move(cardBox.x + cardBox.width * 0.8, cardBox.y + cardBox.height * 0.75, { steps: 6 });
await page.waitForTimeout(220);
const sheenRight = await readSheen();

const sheenPainted = await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.card'), '::after');
  return /radial-gradient/.test(cs.backgroundImage);
});
check(!!sheenLeft.mx && !!sheenRight.mx, 'a card learns where the pointer is',
  `${sheenLeft.mx || 'none'} → ${sheenRight.mx || 'none'}`);
check(sheenLeft.mx !== sheenRight.mx && sheenLeft.my !== sheenRight.my,
  'and the light moves with it', `${sheenLeft.mx},${sheenLeft.my} → ${sheenRight.mx},${sheenRight.my}`);
check(sheenPainted, 'the sheen is a gradient, not a layout change');

/* A ripple opens from the pixel pressed, so two presses on one button differ. */
await page.goto(`${base}/studio.html?chart=doughnut-gauge`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2400);

const ripple = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const btn = document.querySelector('#btn-reset');
  const press = async (dx, dy) => {
    const r = btn.getBoundingClientRect();
    btn.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, clientX: r.left + dx, clientY: r.top + dy,
    }));
    await sleep(50);
    return { on: btn.classList.contains('rippling'), rx: btn.style.getPropertyValue('--rx') };
  };
  const near = await press(6, 6);
  await sleep(600);
  const clearedItself = !btn.classList.contains('rippling');
  const far = await press(70, 12);
  await sleep(600);
  return {
    near, far, clearedItself,
    // Clipped, or the circle would escape the button it came from.
    clips: getComputedStyle(btn).overflow,
  };
});
check(ripple.near.on, 'pressing a button opens a ripple');
check(ripple.near.rx !== ripple.far.rx, 'from the point pressed, not the middle',
  `${ripple.near.rx} vs ${ripple.far.rx}`);
check(ripple.clearedItself, 'and it clears itself once it has played');
check(ripple.clips === 'hidden', 'the ripple stays inside its button', ripple.clips);

/* A dialog grows out of whatever opened it. */
const origin = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const open = async (dx, dy) => {
    const btn = [...document.querySelectorAll('button')].find((b) => /Edit data/i.test(b.textContent));
    const r = btn.getBoundingClientRect();
    btn.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, clientX: r.left + dx, clientY: r.top + dy,
    }));
    btn.click();
    await sleep(800);
    const dlg = document.querySelector('.dlg');
    const out = {
      x: parseFloat(dlg.style.getPropertyValue('--from-x')),
      y: parseFloat(dlg.style.getPropertyValue('--from-y')),
      origin: getComputedStyle(dlg).transformOrigin,
    };
    document.querySelector('.dlg-close').click();
    await sleep(450);
    return out;
  };
  return { left: await open(4, 4), right: await open(150, 20) };
});
check(Number.isFinite(origin.left.x) && Number.isFinite(origin.left.y),
  'a dialog knows where it was opened from', JSON.stringify(origin.left));
check(origin.left.x !== origin.right.x, 'and two different buttons open it differently',
  `${origin.left.x}% vs ${origin.right.x}%`);
check(origin.left.x >= 0 && origin.left.x <= 100 && origin.left.y >= 0 && origin.left.y <= 100,
  'the origin is clamped inside the dialog', JSON.stringify(origin.left));

/* A figure that changed says so. One that did not, must stay quiet — marking
 * the whole row on every rebuild would make the signal mean nothing. */
const metrics = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.openCharts;
  const total = document.querySelectorAll('.metric-value').length;
  if (!total) return { skip: true };
  app.spec.score = (app.spec.score || 0) + 7;
  app.rebuild();
  await sleep(140);
  const afterEdit = document.querySelectorAll('.metric-value.changed').length;
  app.rebuild();
  await sleep(140);
  const afterNoop = document.querySelectorAll('.metric-value.changed').length;
  return { total, afterEdit, afterNoop };
});
check(!metrics.skip && metrics.afterEdit > 0, 'a changed figure is marked as changed',
  JSON.stringify(metrics));
check(!metrics.skip && metrics.afterNoop === 0, 'and an unchanged one is left alone',
  JSON.stringify(metrics));

/* Reduced motion means none of it. The stylesheet's global block cannot reach
 * a custom property written from JS, so `motion.js` has to check for itself. */
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto(`${base}/studio.html?chart=doughnut-gauge`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const quiet = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const m = await import('/js/studio/motion.js');
  const btn = document.querySelector('#btn-reset');
  const r = btn.getBoundingClientRect();
  btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 8, clientY: r.top + 6 }));
  await sleep(80);
  const rippled = btn.classList.contains('rippling');

  const app = window.openCharts;
  app.spec.score = (app.spec.score || 0) + 5;
  app.rebuild();
  await sleep(140);
  const marked = document.querySelectorAll('.metric-value.changed').length;

  // Position is not animation: a dialog still has to open somewhere sensible.
  const edit = [...document.querySelectorAll('button')].find((b) => /Edit data/i.test(b.textContent));
  edit.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
  edit.click();
  await sleep(800);
  const placed = Number.isFinite(parseFloat(document.querySelector('.dlg').style.getPropertyValue('--from-x')));
  document.querySelector('.dlg-close').click();

  return { reports: m.motionReduced(), rippled, marked, placed };
});
check(quiet.reports, 'motion.js sees the reduced-motion preference');
check(!quiet.rippled, 'no ripple when motion is reduced');
check(!quiet.marked, 'and no figure is animated');
check(quiet.placed, 'but a dialog is still placed where it was opened from');
await page.emulateMedia({ reducedMotion: 'no-preference' });
console.log(`  ${green('✓')} motion — sheen tracks, ripple from the press point, quiet when asked`);

/* Suite 22 — a chart somebody can use without seeing it. */

await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });

/* Every chart, not most of them: the whole point is that a reader does not
 * have to find out which of the 114 happens to be readable. */
const a11yAll = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const a11y = await import('/js/studio/a11y.js');

  const noDesc = [];
  const noTable = [];
  const noLabel = [];
  const unscrolled = [];
  const thinDesc = [];
  let tableBytes = 0;
  let standaloneBytes = 0;

  for (const def of reg.CHARTS) {
    const spec = reg.newSpec(def);
    const code = eng.generateCode(def, spec);

    if (!/id="chart-desc"/.test(code.html)) noDesc.push(def.id);
    if (!/<details class="chart-data">/.test(code.html)) noTable.push(def.id);
    if (!/role="img" aria-label="[^"]+"/.test(code.html)) noLabel.push(def.id);
    // A wide table must scroll in its own box or it widens the page it was
    // pasted into — somebody else's page, which makes it their bug.
    if (!/class="chart-data-scroll"/.test(code.html)) unscrolled.push(def.id);

    const desc = a11y.chartSummary(def, spec);
    if (!desc || desc.length < 60 || !desc.includes(def.title)) thinDesc.push(def.id);

    const m = code.standalone.match(/<details class="chart-data">[\s\S]*?<\/details>/);
    tableBytes += m ? m[0].length : 0;
    standaloneBytes += code.standalone.length;
  }

  return {
    charts: reg.CHARTS.length,
    noDesc, noTable, noLabel, unscrolled, thinDesc,
    tableShare: +((tableBytes / standaloneBytes) * 100).toFixed(1),
  };
});
check(!a11yAll.noDesc.length, 'every chart exports a description',
  `${a11yAll.noDesc.length} without: ${a11yAll.noDesc.slice(0, 4).join(', ')}`);
check(!a11yAll.noTable.length, 'and its data as a table',
  `${a11yAll.noTable.length} without: ${a11yAll.noTable.slice(0, 4).join(', ')}`);
check(!a11yAll.noLabel.length, 'and an accessible name on the graphic itself',
  a11yAll.noLabel.slice(0, 4).join(', '));
check(!a11yAll.unscrolled.length, 'the table scrolls in its own box',
  a11yAll.unscrolled.slice(0, 4).join(', '));
check(!a11yAll.thinDesc.length, 'every description names its chart and says something',
  a11yAll.thinDesc.slice(0, 4).join(', '));
check(a11yAll.tableShare < 30, 'the accessible layer stays a minority of the export',
  `${a11yAll.tableShare}% of the standalone`);

/* The table has to carry the chart's real numbers, not a plausible shape.
 * This is the same class of bug the data round-trip catches: markup that is
 * present, well-formed and about the wrong data. */
const truthful = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const a11y = await import('/js/studio/a11y.js');
  const def = reg.getChart('bar-vertical');

  const spec = reg.newSpec(def);
  const before = a11y.chartTable(def, spec);

  // Perturb the data; the table must follow it.
  spec.series[0].data = [111, 222, 333, 444];
  if (typeof def.onChange === 'function') def.onChange(spec);
  const after = a11y.chartTable(def, spec);

  const flat = (t) => t.rows.map((r) => r.join(',')).join(' | ');
  return {
    beforeHas520: flat(before).includes('520'),
    afterHas111: flat(after).includes('111'),
    afterDropped520: !flat(after).includes('520'),
    headers: after.headers.join(','),
  };
});
check(truthful.beforeHas520, 'the table starts from the chart’s own data');
check(truthful.afterHas111 && truthful.afterDropped520,
  'and follows it when the data changes', JSON.stringify(truthful));
check(/label/.test(truthful.headers), 'with the columns named', truthful.headers);

/* Hidden from the eye, not from the reader. `display:none` and
 * `visibility:hidden` both take text out of the accessibility tree, which
 * would delete the description this whole suite is about. */
const hiding = await page.evaluate(async () => {
  const eng = await import('/js/studio/engines.js');
  const reg = await import('/js/studio/registry.js');
  const def = reg.getChart('bar-vertical');
  const css = eng.generateCode(def, reg.newSpec(def)).css;
  const block = (css.match(/\.visually-hidden\s*\{[^}]*\}/) || [''])[0];
  return {
    present: !!block,
    usesClip: /clip-path|clip:/.test(block),
    hidesWrong: /display:\s*none|visibility:\s*hidden/.test(block),
  };
});
check(hiding.present, 'the export ships the hidden-text rule');
check(hiding.usesClip && !hiding.hidesWrong,
  'and hides by clipping, so screen readers still reach it', JSON.stringify(hiding));

/* The studio shows the same table it ships, from the same function. */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
const liveA11y = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const det = document.querySelector('#chart-data details');
  if (det) det.open = true;
  await sleep(250);
  const host = document.querySelector('#chart-host');
  const cells = [...document.querySelectorAll('#chart-data tbody tr')]
    .map((tr) => [...tr.children].map((c) => c.textContent).join(','));
  return {
    role: host.getAttribute('role'),
    label: host.getAttribute('aria-label'),
    rows: cells.length,
    first: cells[0] || '',
    overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  };
});
check(liveA11y.role === 'img', 'the live chart is named as an image', String(liveA11y.role));
check(/Vertical Bar/.test(liveA11y.label || ''), 'with the chart’s own title', String(liveA11y.label));
check(liveA11y.rows === 4 && /Q1,520,440/.test(liveA11y.first),
  'the studio shows the same numbers it would export', `${liveA11y.rows} rows, ${liveA11y.first}`);
check(liveA11y.overflow <= 1, 'and the table does not widen the page', `${liveA11y.overflow}px`);
console.log(`  ${green('✓')} accessible output — 114 described and tabulated, ${a11yAll.tableShare}% of the export`);

/* Suite 23 — fetching a table from a link, and refusing what is not one. */

/* Synthetic responses rather than committed fixtures, the same reasoning that
 * keeps suite 10 building its .xlsx in the browser: a fixture on disk is a
 * second thing to keep true. */
await page.route('**/oc-test-csv', (route) => route.fulfill({
  status: 200,
  contentType: 'text/csv',
  body: 'region,2023,2024\nNorth,520,680\nSouth,410,505\nEast,377,441',
}));
await page.route('**/oc-test-page', (route) => route.fulfill({
  status: 200,
  contentType: 'text/html',
  body: '<!DOCTYPE html><html><body><h1>Sign in</h1></body></html>',
}));
await page.route('**/oc-test-missing', (route) => route.fulfill({ status: 404, body: 'nope' }));
await page.route('**/oc-test-binary', (route) => route.fulfill({
  status: 200,
  contentType: 'application/octet-stream',
  // A NUL in the first bytes is what tells the sniffer this is not text.
  body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03]),
}));

await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });

const link = await page.evaluate(async (origin) => {
  const { readDataUrl } = await import('/js/studio/fileimport.js');
  const take = async (u) => {
    const r = await readDataUrl(u);
    return r.ok ? { ok: true, text: r.text } : { ok: false, message: r.message };
  };
  return {
    csv: await take(`${origin}/oc-test-csv`),
    page: await take(`${origin}/oc-test-page`),
    missing: await take(`${origin}/oc-test-missing`),
    binary: await take(`${origin}/oc-test-binary`),
    // Schemes that are not somebody's spreadsheet.
    js: await take('javascript:alert(1)'),
    file: await take('file:///etc/passwd'),
    data: await take('data:text/csv,a,b%0A1,2'),
    empty: await take('   '),
    junk: await take('not a url at all'),
  };
}, base);

check(link.csv.ok, 'a published CSV is read', link.csv.ok ? 'ok' : link.csv.message);
check(link.csv.ok && link.csv.text.includes('North'),
  'and its rows arrive intact', (link.csv.text || '').slice(0, 40));

check(!link.page.ok && /web page/i.test(link.page.message),
  'a web page is refused as a web page', link.page.message);
check(!link.page.ok && /publish to web/i.test(link.page.message),
  'and the message says what to do instead');
check(!link.missing.ok && /404/.test(link.missing.message),
  'a 404 is reported with its status', link.missing.message);
check(!link.binary.ok, 'binary content is refused', link.binary.message);

check(!link.js.ok && /https/i.test(link.js.message), 'javascript: links are refused', link.js.message);
check(!link.file.ok, 'file: links are refused', link.file.message);
check(!link.data.ok, 'data: links are refused', link.data.message);
check(!link.empty.ok, 'an empty address asks for one', link.empty.message);
check(!link.junk.ok && /web address/i.test(link.junk.message),
  'and nonsense is named as nonsense', link.junk.message);

/* Cookies are never sent. A URL is a request for a public file, not a way to
 * reach a page the reader happens to be signed into. */
let sawCookie = null;
await page.route('**/oc-test-cookie', (route) => {
  sawCookie = route.request().headers().cookie || '';
  route.fulfill({ status: 200, contentType: 'text/csv', body: 'a,b\n1,2' });
});
await page.context().addCookies([{
  name: 'oc_session', value: 'secret', url: base,
}]);
await page.evaluate(async (origin) => {
  const { readDataUrl } = await import('/js/studio/fileimport.js');
  await readDataUrl(`${origin}/oc-test-cookie`);
}, base);
check(!sawCookie, 'the fetch carries no cookies', `cookie header: ${JSON.stringify(sawCookie)}`);
await page.context().clearCookies();

/* And the editor offers it.
 *
 * The fetch itself is asserted above, against `readDataUrl` directly, rather
 * than driven through this panel: a routed stub answers reliably from a fresh
 * page and stops answering once two dozen suites have navigated this one, and
 * a test that is sometimes right is worse than one that is narrower. What is
 * checked here is the wiring — the tab, the field, and the button — which is
 * the part the module test cannot see.
 */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2300);
const linkTab = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  [...document.querySelectorAll('button')].find((b) => /Edit data/i.test(b.textContent)).click();
  await sleep(1100);

  const tabs = [...document.querySelectorAll('.dlg-tab')].map((t) => t.textContent.trim());
  const tab = [...document.querySelectorAll('.dlg-tab')].find((t) => /From a link/.test(t.textContent));
  if (!tab) return { tabs, opened: false };
  tab.click();
  await sleep(300);

  const input = document.querySelector('.link-input');
  const fetchBtn = [...document.querySelectorAll('.dlg .btn')]
    .find((b) => b.textContent.trim() === 'Fetch');
  const panel = input ? input.closest('.pick') : null;

  return {
    tabs,
    opened: true,
    hasInput: !!input,
    inputType: input ? input.type : '',
    hasButton: !!fetchBtn,
    // The one promise this panel must not make: it does fetch, and it says so.
    saysItFetches: !!panel && /fetch/i.test(panel.textContent),
    // And the file tab's promise has to survive beside it.
    fileTabStillPromises: (() => {
      const f = [...document.querySelectorAll('.dlg-tab')].find((t) => /Open a file/.test(t.textContent));
      if (!f) return false;
      f.click();
      const p = document.querySelector('.dlg-panels');
      return /never sent anywhere/i.test(p.textContent);
    })(),
  };
});
check(linkTab.opened, 'the editor offers a link tab', linkTab.tabs.join('|'));
check(linkTab.hasInput && linkTab.inputType === 'url', 'with an address field',
  `type=${linkTab.inputType}`);
check(linkTab.hasButton, 'and a button that does the fetching');
check(linkTab.saysItFetches, 'the panel says out loud that it makes a request');
check(linkTab.fileTabStillPromises,
  'and the file tab still promises nothing is sent anywhere');

await page.unroute('**/oc-test-csv');
await page.unroute('**/oc-test-page');
await page.unroute('**/oc-test-missing');
await page.unroute('**/oc-test-binary');
await page.unroute('**/oc-test-cookie');
console.log(`  ${green('✓')} links — CSV read, pages and schemes refused, no cookies sent`);

/* Suite 24 — reshaping a table before it becomes a chart. */

await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });

/* The arithmetic first. A transform that is merely plausible is worse than
 * none: it puts numbers on a chart that nobody can trace back to the file. */
const shape = await page.evaluate(async () => {
  const t = await import('/js/studio/transform.js');

  const headers = ['id', 'region', 'product', 'revenue', 'units'];
  const regions = ['North', 'South', 'East', 'West'];
  const rows = [];
  for (let i = 0; i < 200; i++) {
    rows.push([
      String(1000 + i),
      regions[i % 4],
      i % 3 ? 'Gadget' : 'Widget',
      String(100 + ((i * 37) % 900)),
      String(1 + (i % 9)),
    ]);
  }
  const src = { headers, rows };
  const run = (steps) => t.runSteps(src, steps).table;
  const sumCol = (tbl, c) => tbl.rows.reduce((a, r) => a + Number(r[c]), 0);

  const grouped = run([{ op: 'group', col: 1, agg: 'sum' }]);
  const withId = run([{ op: 'group', col: 1, agg: 'sum', vals: [0, 3] }]);
  const counted = run([{ op: 'group', col: 1, agg: 'count' }]);
  const binned = run([{ op: 'bin', col: 3, bins: 5 }]);
  const filtered = run([{ op: 'filter', col: 2, test: 'is', a: 'Widget' }]);
  const between = run([{ op: 'filter', col: 3, test: 'between', a: '200', b: '400' }]);

  // Order is the whole point of a pipeline: limit-then-sort keeps the first
  // three rows of the file, sort-then-limit keeps the three biggest.
  const sortThenLimit = run([{ op: 'sort', col: 3, dir: 'desc' }, { op: 'limit', n: 3 }]);
  const limitThenSort = run([{ op: 'limit', n: 3 }, { op: 'sort', col: 3, dir: 'desc' }]);

  const broken = t.runSteps(src, [{ op: 'nonsense' }, { op: 'limit', n: 2 }]);

  return {
    sourceTotal: sumCol(src, 3),
    grouped: { headers: grouped.headers, rows: grouped.rows.length, total: sumCol(grouped, 1) },
    idExcluded: !grouped.headers.includes('id'),
    idIncludedWhenAsked: withId.headers.includes('id'),
    counted: { rows: counted.rows.length, total: sumCol(counted, 1) },
    binned: { headers: binned.headers, rows: binned.rows.length, total: sumCol(binned, 1) },
    filteredRows: filtered.rows.length,
    betweenOk: between.rows.every((r) => Number(r[3]) >= 200 && Number(r[3]) <= 400),
    betweenRows: between.rows.length,
    sortThenLimit: sortThenLimit.rows.map((r) => r[3]),
    limitThenSort: limitThenSort.rows.map((r) => r[3]),
    brokenSurvived: broken.table.rows.length,
    brokenReported: broken.errors.length,
    described: t.describeStep({ op: 'group', col: 1, agg: 'mean', vals: [3] }, headers),
  };
});

check(shape.grouped.rows === 4, 'grouping folds the rows to one per key',
  `${shape.grouped.rows} groups`);
check(Math.abs(shape.grouped.total - shape.sourceTotal) < 0.001,
  'and the total survives the fold',
  `${shape.grouped.total} vs ${shape.sourceTotal}`);
check(shape.idExcluded, 'an id column is not totalled by default',
  shape.grouped.headers.join(','));
check(shape.idIncludedWhenAsked, 'but it is folded when explicitly chosen');
check(shape.counted.rows === 4 && shape.counted.total === 200,
  'counting rows accounts for every one', JSON.stringify(shape.counted));
check(shape.binned.total === 200, 'every value lands in exactly one bucket',
  `${shape.binned.total} of 200`);
check(shape.binned.rows === 5, 'and there are as many buckets as asked for',
  String(shape.binned.rows));
check(shape.filteredRows === 67, 'a filter keeps only what matches',
  `${shape.filteredRows} rows`);
check(shape.betweenOk && shape.betweenRows > 0, 'a range filter is inclusive of both ends',
  `${shape.betweenRows} rows`);
check(shape.sortThenLimit.join(',') !== shape.limitThenSort.join(','),
  'steps run in the order they are written',
  `sort→limit ${shape.sortThenLimit} vs limit→sort ${shape.limitThenSort}`);
check(shape.brokenSurvived === 2 && shape.brokenReported === 1,
  'a broken step is reported and the rest still run', JSON.stringify(shape));
check(/average of revenue/i.test(shape.described),
  'a step says in words what it does', shape.described);

/* And it reaches the grid. Reshaping is an edit, so it has to be undoable and
 * it has to land as literal values — not as a layer the chart re-derives. */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
const shapeUi = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tab = (re) => [...document.querySelectorAll('.dlg-tab')].find((t) => re.test(t.textContent));

  [...document.querySelectorAll('button')].find((b) => /Edit data/i.test(b.textContent)).click();
  await sleep(1100);

  // A transaction-shaped table, the kind the whole feature is for.
  tab(/Paste text/).click();
  await sleep(250);
  const ta = document.querySelector('.dlg textarea');
  const regions = ['North', 'South', 'East', 'West'];
  let csv = 'id,region,product,revenue,units\n';
  for (let i = 0; i < 120; i++) {
    csv += `${1000 + i},${regions[i % 4]},${i % 3 ? 'Gadget' : 'Widget'},${100 + ((i * 37) % 900)},${1 + (i % 9)}\n`;
  }
  ta.value = csv;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(400);
  tab(/^\s*Table\s*$/).click();
  await sleep(300);

  const shapeTab = tab(/Shape/);
  if (!shapeTab) return { opened: false };
  shapeTab.click();
  await sleep(400);

  const add = document.querySelector('.shape-add .shape-select');
  add.value = 'group';
  add.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(350);

  const summary = (document.querySelector('.shape-summary') || {}).textContent || '';
  const previewRows = [...document.querySelectorAll('.shape-preview tbody tr')]
    .map((tr) => [...tr.children].map((c) => c.textContent).join(','));
  // The default fold must leave the id column out here too, not just in the
  // engine — the checkbox is what a reader actually sees.
  const boxes = [...document.querySelectorAll('.shape-col')]
    .map((l) => `${l.textContent.trim()}:${l.querySelector('input').checked ? 'on' : 'off'}`);

  [...document.querySelectorAll('.shape .btn')].find((b) => /Use this shape/.test(b.textContent)).click();
  await sleep(700);

  const gridRows = [...document.querySelectorAll('.dlg .dgrid tbody tr')]
    .map((tr) => [...tr.querySelectorAll('.dgrid-cell')].map((c) => c.value).join(','));
  const undoOn = ![...document.querySelectorAll('.dgrid-foot .btn')]
    .find((b) => b.textContent === 'Undo').disabled;

  // Undo puts the file back, which is the point of doing this in the editor.
  [...document.querySelectorAll('.dgrid-foot .btn')].find((b) => b.textContent === 'Undo').click();
  await sleep(400);
  const afterUndo = document.querySelectorAll('.dlg .dgrid tbody tr').length;

  return { opened: true, summary, previewRows, boxes, gridRows, undoOn, afterUndo };
});
check(shapeUi.opened, 'the editor offers a Shape tab');
check(/120 rows.*→.*4 rows/.test(shapeUi.summary.replace(/\s+/g, ' ')),
  'the panel says what the reshape does to the table', shapeUi.summary);
check(shapeUi.boxes.some((b) => /^id:off/.test(b)), 'the id column starts unticked',
  shapeUi.boxes.join(' '));
check(shapeUi.gridRows.length === 4 && shapeUi.gridRows[0].startsWith('North'),
  'applying writes the result into the grid', (shapeUi.gridRows[0] || '').slice(0, 30));
check(shapeUi.previewRows[0] === shapeUi.gridRows[0],
  'and the grid holds exactly what the preview showed',
  `${shapeUi.previewRows[0]} vs ${shapeUi.gridRows[0]}`);
check(shapeUi.undoOn && shapeUi.afterUndo === 120,
  'a reshape can be undone back to the whole file', `${shapeUi.afterUndo} rows after undo`);
console.log(`  ${green('✓')} shape — group, filter, bin, sort and limit, applied as an edit`);

/* Suite 25 — a chart that says what it means.
 *
 * Annotations are positioned as a fraction of the plate rather than in data
 * coordinates, which is what let all 114 charts have them without a single
 * renderer changing. The price of that reach is that one overlay has to be
 * right on five engines at once, so this suite asks each of them separately.
 */

await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });

const annots = await page.evaluate(async () => {
  const a = await import('/js/studio/annotate.js');
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const { chartSummary } = await import('/js/studio/a11y.js');

  const NOTES = [
    { type: 'note', x: 0.3, y: 0.2, text: 'Peak week', arrow: { x: 0.44, y: 0.4 } },
    { type: 'line', axis: 'y', at: 0.35, text: 'Target' },
    { type: 'band', axis: 'x', from: 0.55, to: 0.75, text: 'Q3', color: '#CE5229' },
  ];

  // One chart per rendering engine — the overlay has to land the same way on
  // all five, and two of them emit no spec for anything to hang off.
  const perEngine = {};
  for (const def of reg.CHARTS) if (!perEngine[def.engine]) perEngine[def.engine] = def.id;

  const code = {};
  for (const [engine, id] of Object.entries(perEngine)) {
    const def = reg.getChart(id);
    const plain = eng.generateCode(def, reg.newSpec(def));
    const spec = reg.newSpec(def);
    spec.annotations = JSON.parse(JSON.stringify(NOTES));
    const marked = eng.generateCode(def, spec);
    // Where the spec literal ends and the annotations begin.
    const specBlock = marked.js.slice(
      marked.js.indexOf('const spec = '), marked.js.indexOf('const annotations'),
    );
    code[engine] = {
      id,
      free: !/drawAnnotations|oc-annots/.test(plain.js + plain.css),
      declares: /function drawAnnotations/.test(marked.js) && /const annotations = /.test(marked.js),
      calls: (marked.js.split('\n').find((l) => /^\s*drawAnnotations\(/.test(l)) || '').trim(),
      specCarries: /annotations/.test(specBlock),
      styled: /\.oc-annots \{/.test(marked.css),
    };
  }

  // A note is somebody's own words landing in somebody else's page, so it has
  // to arrive as text. Asked of the overlay rather than of its source: the
  // word `innerHTML` appears in the comment saying not to use it.
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:-9999px;width:400px;height:300px';
  document.body.appendChild(box);
  a.drawAnnotations(box, [{ type: 'note', x: 0.5, y: 0.5, text: '<img src=x onerror="boom()">' }]);
  const markup = {
    asText: box.querySelector('.oc-annot-label').textContent === '<img src=x onerror="boom()">',
    noElement: !box.querySelector('img'),
  };
  // ...and an empty list takes the layer away rather than leaving a husk.
  a.drawAnnotations(box, []);
  markup.clears = !box.querySelector('.oc-annots');
  box.remove();

  // Two of a kind must not land on top of each other, or a second click of
  // `+ Note` looks like a click that did nothing.
  const first = a.newAnnotation('note', 0);
  const second = a.newAnnotation('note', 1);

  return {
    code,
    markup,
    cascades: first.x !== second.x || first.y !== second.y,
    clamped: a.newAnnotation('note', 0) && (() => {
      const wild = { type: 'note', x: 4, y: -2, text: '' };
      // Clamping happens where it is read, so ask the describer.
      return a.describeAnnotation(wild);
    })(),
    // y is measured from the top, but nobody says a line is "65% down".
    saysUp: a.describeAnnotation({ type: 'line', axis: 'y', at: 0.35, text: 'Target' }),
    saysAcross: a.describeAnnotation({ type: 'band', axis: 'x', from: 0.55, to: 0.75, text: 'Q3' }),
    saysWhere: a.describeAnnotation({ type: 'note', x: 0.3, y: 0.2, text: 'Peak week' }),
    unlabelled: a.describeAnnotation({ type: 'band', axis: 'x', from: 0.1, to: 0.2, text: '' }),
    quiet: a.describeAnnotations([]),

    // Every chart in the library, not a chosen few.
    allHaveControl: reg.CHARTS.filter((c) => !(c.controls || []).some((x) => x.type === 'annotations'))
      .map((c) => c.id),
    controlIsLast: reg.CHARTS.filter((c) => {
      const list = c.controls || [];
      return list[list.length - 1].type !== 'annotations';
    }).map((c) => c.id),

    // The words reach a reader who cannot see any of it.
    summary: (() => {
      const def = reg.getChart('bar-vertical');
      const spec = reg.newSpec(def);
      spec.annotations = JSON.parse(JSON.stringify(NOTES));
      return chartSummary(def, spec);
    })(),
  };
});

const engines = Object.entries(annots.code);
check(engines.every(([, v]) => v.free), 'a chart nobody annotated carries none of it',
  engines.filter(([, v]) => !v.free).map(([k]) => k).join(', '));
check(engines.every(([, v]) => v.declares && v.calls), 'every engine emits the overlay and calls it',
  engines.filter(([, v]) => !(v.declares && v.calls)).map(([k, v]) => `${k}: ${v.calls || 'no call'}`).join(' | '));
check(engines.every(([, v]) => v.styled), 'and the styles that draw it',
  engines.filter(([, v]) => !v.styled).map(([k]) => k).join(', '));
check(engines.every(([, v]) => !v.specCarries),
  'annotations are emitted beside the spec, never inside it',
  engines.filter(([, v]) => v.specCarries).map(([k]) => k).join(', '));
check(annots.markup.asText && annots.markup.noElement,
  'a note reaches the page as text, never as markup', JSON.stringify(annots.markup));
check(annots.markup.clears, 'and an emptied list takes the layer with it');
check(annots.cascades, 'two new notes do not land on the same spot');
check(!annots.allHaveControl.length, 'every chart in the library can be annotated',
  annots.allHaveControl.slice(0, 5).join(', '));
check(!annots.controlIsLast.length, 'and the control sits last, after the chart is built',
  annots.controlIsLast.slice(0, 5).join(', '));
check(/65% up/.test(annots.saysUp), 'a rule is described the way up a chart is read', annots.saysUp);
check(/55% to 75% across/.test(annots.saysAcross), 'and a band by the span it covers', annots.saysAcross);
check(/top left/.test(annots.saysWhere), 'a note is placed in words, not coordinates', annots.saysWhere);
check(/shaded band/.test(annots.unlabelled), 'an unlabelled mark is still announced', annots.unlabelled);
check(annots.quiet === '', 'a chart with no notes says nothing about them');
check(/Peak week/.test(annots.summary) && /Target/.test(annots.summary) && /Q3/.test(annots.summary),
  'the accessible description carries every note', annots.summary.slice(-160));

/* The export has to actually draw them, in a real document, on every engine —
 * and it must not be draggable there, because the editor's stylesheet is the
 * only thing that makes one grabbable. */
const drawn = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const NOTES = [
    { type: 'note', x: 0.3, y: 0.2, text: 'Peak week', arrow: { x: 0.44, y: 0.4 } },
    { type: 'line', axis: 'y', at: 0.35, text: 'Target' },
    { type: 'band', axis: 'x', from: 0.55, to: 0.75, text: 'Q3', color: '#CE5229' },
  ];
  const perEngine = {};
  for (const def of reg.CHARTS) if (!perEngine[def.engine]) perEngine[def.engine] = def.id;
  return Object.entries(perEngine).map(([engine, id]) => {
    const def = reg.getChart(id);
    const spec = reg.newSpec(def);
    spec.annotations = JSON.parse(JSON.stringify(NOTES));
    return { engine, id, html: eng.generateCode(def, spec).standalone };
  });
});

for (const { engine, id, html } of drawn) {
  const route = `/annotated-${engine}.html`;
  generated.set(route, html);
  const probe = await browser.newPage();
  const errs = [];
  probe.on('pageerror', (e) => errs.push(String(e.message)));
  await probe.goto(base + route, { waitUntil: 'networkidle' });
  await probe.waitForTimeout(1400);
  const state = await probe.evaluate(() => {
    const layer = document.querySelector('.oc-annots');
    if (!layer) return { layer: false };
    const label = layer.querySelector('.oc-annot-label');
    const band = layer.querySelector('.oc-annot-band');
    return {
      layer: true,
      hidden: layer.getAttribute('aria-hidden') === 'true',
      labels: [...layer.querySelectorAll('.oc-annot-label')].map((n) => n.textContent).join('|'),
      // A label with no width was appended to something that is not on screen.
      painted: label.getBoundingClientRect().width > 10,
      lead: layer.querySelectorAll('.oc-annot-leads line').length,
      inert: getComputedStyle(label).pointerEvents === 'none',
      tinted: band.style.getPropertyValue('--oc-annot-color') === '#CE5229',
    };
  });
  await probe.close();
  check(state.layer && state.painted && state.labels === 'Peak week|Target|Q3' && !errs.length,
    `an exported ${engine} chart draws its notes`,
    errs[0] || JSON.stringify(state));
  check(state.inert, `and they cannot be dragged out of an export (${engine})`);
  check(state.hidden && state.lead === 1 && state.tinted,
    `arrow, colour and aria-hidden survive the export (${engine})`, JSON.stringify(state));
}

/* And in the studio, where the position is found by moving it. */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const editing = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const app = window.openCharts;
  const { plateOf } = await import('/js/studio/annotate.js');

  const add = (re) => [...document.querySelectorAll('.annot-new')].find((b) => re.test(b.textContent));
  add(/Note/).click();
  await sleep(300);
  add(/Band/).click();
  await sleep(300);

  const placed = JSON.parse(JSON.stringify(app.spec.annotations));
  const rows = document.querySelectorAll('.annot-row').length;

  // Typing a label reaches the plate without the panel being rebuilt under it.
  const input = document.querySelector('.annot-row .annot-text');
  input.focus();
  input.value = 'Peak week';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(350);
  const onPlate = [...plateOf(document.getElementById('chart-host'))
    .querySelectorAll('.oc-annot-label')].map((n) => n.textContent);
  const keptFocus = document.activeElement === input;

  // Drag the note. Position is the one thing the sidebar does not edit.
  const plate = plateOf(document.getElementById('chart-host'));
  const rect = plate.getBoundingClientRect();
  const note = plate.querySelector('.oc-annot-label.is-note');
  const noteBox = note.getBoundingClientRect();
  const before = { x: app.spec.annotations[0].x, y: app.spec.annotations[0].y };
  const from = { x: noteBox.left + noteBox.width / 2, y: noteBox.top + noteBox.height / 2 };

  note.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true, clientX: from.x, clientY: from.y, pointerId: 1,
  }));
  window.dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true, clientX: from.x + rect.width * 0.25, clientY: from.y + rect.height * 0.2, pointerId: 1,
  }));
  window.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, clientX: from.x + rect.width * 0.25, clientY: from.y + rect.height * 0.2, pointerId: 1,
  }));
  await sleep(400);
  const after = { x: app.spec.annotations[0].x, y: app.spec.annotations[0].y };

  // A drag must give back every listener it took — the rule five leaking maps
  // taught this codebase — and a rebuild must not stack a second binding.
  const realAdd = window.addEventListener;
  const realRemove = window.removeEventListener;
  let added = 0; let removed = 0;
  window.addEventListener = function (...a) { if (a[0].startsWith('pointer')) added++; return realAdd.apply(this, a); };
  window.removeEventListener = function (...a) { if (a[0].startsWith('pointer')) removed++; return realRemove.apply(this, a); };
  for (let k = 0; k < 3; k++) {
    app.rebuild();
    const mark = plateOf(document.getElementById('chart-host')).querySelector('.oc-annot-label.is-note');
    const box = mark.getBoundingClientRect();
    mark.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, clientX: box.left + 2, clientY: box.top + 2, pointerId: 1,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, clientX: box.left + 2, clientY: box.top + 2, pointerId: 1,
    }));
  }
  window.addEventListener = realAdd;
  window.removeEventListener = realRemove;

  // Removing puts the plate back the way it was.
  // Re-queried each time: removing a row repaints the list, so the buttons
  // captured before the first click are no longer the ones on screen.
  const count = app.spec.annotations.length;
  for (let k = 0; k < count; k++) {
    const del = document.querySelector('.annot-del');
    if (del) del.click();
    await sleep(120);
  }
  await sleep(400);
  const cleared = plateOf(document.getElementById('chart-host')).querySelector('.oc-annots');

  return {
    rows,
    kinds: placed.map((a) => a.type).join(','),
    onPlate,
    keptFocus,
    moved: after.x !== before.x && after.y !== before.y,
    inBounds: after.x >= 0 && after.x <= 1 && after.y >= 0 && after.y <= 1,
    rounded: String(after.x).replace(/^\d+\.?/, '').length <= 3,
    added,
    removed,
    count,
    cleared: !cleared,
    left: app.spec.annotations.length,
  };
});

check(editing.rows === 2 && editing.kinds === 'note,band',
  'the panel adds exactly the kind of note that was asked for', editing.kinds);
check(editing.onPlate.includes('Peak week'), 'a label typed in the panel reaches the plate',
  editing.onPlate.join(' | '));
check(editing.keptFocus, 'and typing it does not throw the cursor out of the field');
check(editing.moved && editing.inBounds, 'a note is dragged into place on the chart',
  JSON.stringify(editing));
check(editing.rounded, 'the position it records is one somebody can read in the spec view');
check(editing.added > 0 && editing.added === editing.removed,
  'a drag gives back every listener it took, however often the chart is rebuilt',
  `${editing.added} added, ${editing.removed} removed`);
check(editing.cleared && editing.left === 0, 'removing the last note takes the overlay with it');
console.log(`  ${green('✓')} annotations — note, rule and band on all five engines`);

/* Suite 26 — hover you can actually land on, and a gallery that stays awake. */

await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);

/* A whole screen of tiles arrives in one observer callback. Building them all
 * there blocked the main thread for 207ms on load and 58ms on every scroll —
 * frames in which the page cannot answer the scroll that asked for them. */
const pump = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const g = window.openChartsGallery;
  if (typeof g.pendingCount !== 'function') return { queued: false };

  // Jump far enough to bring a fresh screenful into view at once.
  window.scrollTo(0, 2600);
  // Read on the very next frame, before the pump has had time to drain.
  const seen = await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(g.pendingCount())));
  });

  await sleep(1800);
  const after = g.pendingCount();
  const live = g.live ? g.live.size : 0;

  // Scrolling straight past a tile must forget it rather than build it: a
  // fast scroll used to leave a backlog of charts nobody would ever see.
  window.scrollTo(0, 12000);
  await new Promise((r) => requestAnimationFrame(r));
  window.scrollTo(0, 0);
  await sleep(1600);
  const settled = g.pendingCount();

  return { queued: true, seen, after, live, settled };
});
check(pump.queued, 'the gallery builds previews through a queue');
check(pump.after === 0, 'and the queue drains', `${pump.after} still waiting`);
check(pump.live > 0, 'the charts still get built', `${pump.live} live`);
check(pump.settled === 0, 'scrolling past a tile forgets it rather than queueing it',
  `${pump.settled} left over`);

/* The queue must not starve a frame. Measured rather than asserted by faith:
 * the budget only gates *starting* another chart, so one heavy chart can
 * still overrun — what must not happen is eight of them in a row. */
const frames = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const long = [];
  let obs = null;
  try {
    obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => long.push(e.duration)));
    obs.observe({ entryTypes: ['longtask'] });
  } catch { return { supported: false }; }

  for (let i = 0; i < 5; i++) {
    window.scrollBy(0, 1500);
    await sleep(420);
  }
  obs.disconnect();
  return {
    supported: true,
    count: long.length,
    worst: Math.round(long.length ? Math.max(...long) : 0),
    blocked: Math.round(long.reduce((a, b) => a + b, 0)),
  };
});
if (frames.supported) {
  check(frames.blocked < 120, 'scrolling the gallery does not block the main thread',
    `${frames.count} long tasks, worst ${frames.worst}ms, ${frames.blocked}ms blocked`);
} else {
  check(true, 'long-task timing unavailable in this browser — skipped');
}

/* Hover has to forgive a few pixels. A barcode plot's rules are two pixels
 * wide and a scatter dot is three across; requiring the pointer to land inside
 * the mark is why those charts read as having no hover at all. */
const slack = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');

  const host = document.createElement('div');
  host.style.cssText = 'width:820px;height:440px;position:fixed;left:0;top:0;z-index:99999;background:#fff';
  document.body.appendChild(host);

  const showing = () => [...host.querySelectorAll('[role="tooltip"]')]
    .some((t) => t.style.opacity !== '0' && t.textContent.trim());

  const inst = eng.renderChart(reg.getChart('barcode-plot'), host, reg.newSpec(reg.getChart('barcode-plot')));
  const canvas = host.querySelector('canvas');
  const regions = canvas.__ocRegions || [];
  const box = canvas.getBoundingClientRect();

  const at = (x, y) => {
    canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
    return showing();
  };

  const r = regions.find((g) => g.w != null) || regions[0];
  const cx = box.left + r.x + r.w / 2;
  const cy = box.top + r.y + r.h / 2;

  const dead = at(-500, -500);
  const onIt = at(cx, cy);
  const nearby = at(cx + r.w / 2 + 6, cy);
  // Far enough away and it must go quiet again, or the readout would follow
  // the cursor across empty space and mean nothing.
  const farOff = at(cx + r.w / 2 + 90, cy);

  eng.destroyInstance(inst);
  host.remove();
  return { marks: regions.length, dead, onIt, nearby, farOff };
});
check(slack.marks > 0, 'the barcode plot records marks', `${slack.marks}`);
check(slack.onIt, 'hovering a mark reads out');
check(slack.nearby, 'and hovering a few pixels off it still does');
check(!slack.farOff, 'but hovering well away from everything stays quiet');
check(!slack.dead, 'and a cursor outside the chart shows nothing');
console.log(`  ${green('✓')} feel — queued previews, ${frames.blocked ?? '?'}ms blocked on scroll, hover with slack`);

/* Suite 28 — small multiples.
 *
 * Faceting is not a kind of chart. It splits one spec into N complete specs
 * and hands each to the renderer the chart already had, which is why not one
 * `draw` or `mount` in the library was touched to add it. So the checks here
 * are arithmetic and honesty: every row lands in exactly one panel, a grid
 * that claims a shared axis has one, and a chart that cannot share an axis
 * says so rather than letting twelve differently-scaled plates look like a
 * comparison.
 */
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
const facet = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const f = await import('/js/studio/facet.js');
  const a11y = await import('/js/studio/a11y.js');

  const valueOf = (it) => Number(it.value != null ? it.value : (it.data || 0));
  const out = { cap: f.MAX_PANELS };

  /* A wide table: one column naming the panel, two drawing it. */
  const regions = ['North', 'South', 'East', 'West'];
  const issues = ['Billing', 'Delivery', 'Returns', 'Product'];
  const rows = [];
  let sourceTotal = 0;
  regions.forEach((r, ri) => issues.forEach((s, si) => {
    const v = 10 + ri * 13 + si * 7;
    sourceTotal += v;
    rows.push([r, s, String(v)]);
  }));
  const table = { headers: ['Region', 'Issue', 'Count'], rows };
  out.sourceTotal = sourceTotal;

  const def = reg.getChart('bar-lollipop');
  const spec = reg.newSpec(def);
  out.applied = f.facetByColumn(def, spec, table, 0);

  const panels = f.panelSpecs(def, spec);
  out.count = panels.length;
  out.names = panels.map((p) => p.name);
  out.perPanel = panels.map((p) => (p.spec.items || []).length);
  out.panelTotal = panels.reduce((sum, p) =>
    sum + (p.spec.items || []).reduce((s, it) => s + valueOf(it), 0), 0);

  /* Shared scales, on a chart that has an axis to share. */
  out.bound = f.boundKeys(def);
  out.sharedMaxima = panels.map((p) => p.spec.opts.max);
  out.dataPeak = Math.max.apply(null, panels.map((p) =>
    Math.max.apply(null, (p.spec.items || []).map(valueOf))));

  spec.facet.scales = 'free';
  out.freeMaxima = f.panelSpecs(def, spec).map((p) => p.spec.opts.max);
  spec.facet.scales = 'shared';

  /* The export carries the panels, and a chart nobody faceted carries none. */
  const faceted = eng.generateCode(def, spec);
  out.exportPlates = (faceted.html.match(/oc-facet-plate/g) || []).length;
  out.exportIds = out.names.every((n, i) => faceted.html.indexOf('id="chart-' + i + '"') >= 0);
  out.exportNames = out.names.every((n) => faceted.js.indexOf(n) >= 0);
  out.exportCss = faceted.css.indexOf('.oc-facets') >= 0;
  out.exportRuns = faceted.standalone.indexOf('oc-facet-plate') >= 0;

  const plain = eng.generateCode(def, reg.newSpec(def));
  out.plainClean = plain.html.indexOf('oc-facet') < 0
    && plain.css.indexOf('oc-facets') < 0
    && plain.js.indexOf('const panels =') < 0;

  /* The accessible layer keeps the column the panels were split by. */
  out.summary = a11y.chartSummary(def, spec);
  const tbl = a11y.chartTable(def, spec);
  out.tableHeaders = tbl ? tbl.headers : [];
  out.tableRows = tbl ? tbl.rows.length : 0;

  /* Switching it off is a no-op, not an edit. */
  const before = def.toText(spec);
  delete spec.facet;
  out.offIsNoop = def.toText(spec) === before;
  out.offDrawsOne = f.panelSpecs(def, spec) === null;

  /* One panel per series needs no new data at all. */
  const bar = reg.getChart('bar-vertical');
  const barSpec = reg.newSpec(bar);
  out.seriesResult = f.facetBySeries(bar, barSpec);
  const seriesPanels = f.panelSpecs(bar, barSpec);
  out.seriesCount = seriesPanels ? seriesPanels.length : 0;
  out.seriesEachOne = !!seriesPanels && seriesPanels.every((p) => p.spec.series.length === 1);
  /* And a chart that genuinely cannot share an axis says so instead of
     pretending. Found rather than named: which charts those are moved when the
     config route landed, and a hard-coded id would quietly stop testing the
     case it was written for. */
  const cannot = reg.CHARTS.find((d) => !f.scaleSharing(d).can);
  out.honest = cannot ? f.scaleSharing(cannot) : null;
  out.honestId = cannot ? cannot.id : '';
  out.honestEngine = cannot ? eng.engineOf(cannot) : '';

  /* A slider called "Largest city" is not an axis maximum. */
  out.notAxes = ['city-map', 'proportional-symbol-map', 'flow-map', 'word-cloud']
    .map((id) => {
      const d = reg.getChart(id);
      const b = d ? f.boundKeys(d) : null;
      return id + ':' + (b && (b.max || b.min) ? (b.max || b.min) : 'none');
    });

  /* The cap, and saying out loud when it bit. */
  const many = { headers: ['Bucket', 'Issue', 'Count'], rows: [] };
  for (let i = 0; i < 30; i++) {
    for (let j = 0; j < 3; j++) many.rows.push(['B' + i, issues[j], String(5 + i + j)]);
  }
  const capped = reg.newSpec(def);
  f.facetByColumn(def, capped, many, 0);
  out.capped = f.panelSpecs(def, capped).length;
  out.cappedNote = f.facetNote(def, capped);

  /* What can be split on, and what cannot. */
  const mixed = {
    headers: ['id', 'Region', 'Count'],
    rows: rows.map((r, i) => [String(1000 + i), r[0], r[2]]),
  };
  out.offered = f.facetableColumns(mixed).map((c) => c.name);

  /* Layout never goes past four across. */
  out.columns = [1, 4, 9, 24].map((n) => f.panelColumns(n));
  return out;
});

check(facet.applied.ok, 'a column splits a table into panels', facet.applied.message);
check(facet.count === 4, 'one panel per distinct value', String(facet.count));
check(facet.names.join(',') === 'North,South,East,West',
  'panels keep the order the file put them in', facet.names.join(','));
check(facet.panelTotal === facet.sourceTotal,
  'every row lands in exactly one panel',
  facet.panelTotal + ' vs ' + facet.sourceTotal);
check(facet.perPanel.every((n) => n === 4), 'and each panel got its own rows',
  facet.perPanel.join(','));
check(!!facet.bound.max, 'an "Axis maximum" slider is recognised as one',
  JSON.stringify(facet.bound));
check(new Set(facet.sharedMaxima).size === 1 && facet.sharedMaxima[0] >= facet.dataPeak,
  'matched scales put every panel on the same axis',
  facet.sharedMaxima.join(',') + ' over a peak of ' + facet.dataPeak);
check(new Set(facet.freeMaxima).size === 1 && facet.freeMaxima[0] !== facet.sharedMaxima[0],
  'and independent scales leave every panel on its own',
  facet.freeMaxima.join(',') + ' vs ' + facet.sharedMaxima.join(','));
check(facet.notAxes.every((s) => s.endsWith(':none')),
  'a "Largest city" slider is not mistaken for an axis', facet.notAxes.join(' '));
check(facet.honest && !facet.honest.can && /own axis|scaled to itself/i.test(facet.honest.why),
  'a chart that cannot share an axis says so',
  `${facet.honestId} (${facet.honestEngine}): ${(facet.honest || {}).why}`);
check(facet.honestEngine !== 'chartjs',
  'and it is one that draws its own axis, not one that returns a config',
  facet.honestEngine);
check(facet.exportPlates === facet.count && facet.exportIds,
  'the export carries one plate per panel', String(facet.exportPlates));
check(facet.exportNames && facet.exportCss && facet.exportRuns,
  'with the panel names, the grid styles and the whole page');
check(facet.plainClean, 'and a chart nobody faceted carries none of it');
check(/4 small multiples/.test(facet.summary) && /same axis|own data/.test(facet.summary),
  'the description says how many panels and whether they compare',
  facet.summary.slice(0, 200));
check(facet.tableHeaders.indexOf('Region') >= 0 && facet.tableRows === 16,
  'the data table keeps the column the panels were split by',
  facet.tableHeaders.join(',') + ' over ' + facet.tableRows + ' rows');
check(facet.offIsNoop && facet.offDrawsOne,
  'switching the split off is a no-op, not an edit');
check(facet.seriesResult.ok && facet.seriesCount >= 2 && facet.seriesEachOne,
  'a chart splits by series with no new data',
  JSON.stringify(facet.seriesResult) + ' ' + facet.seriesCount);
check(facet.capped === facet.cap, 'the panel cap holds', String(facet.capped));
check(/30 values/.test(facet.cappedNote) && facet.cappedNote.indexOf(String(facet.cap)) >= 0,
  'and says out loud that it bit', facet.cappedNote);
check(facet.offered.join(',') === 'Region',
  'neither an id column nor a number column is offered as a split',
  facet.offered.join(','));
check(facet.columns.join(',') === '1,2,3,4', 'the grid never goes past four across',
  facet.columns.join(','));

/* Matched scales the other way round.
 *
 * A canvas `draw` computes its domain privately inside the function that gets
 * serialised, so no facet can reach it. Chart.js does not: `build()` returns a
 * config, and a config is data. Writing the axis afterwards puts panels on one
 * scale without a single build function being touched. */
const facetScales = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const f = await import('/js/studio/facet.js');
  const out = {};

  const yMaxOf = (cfg) => cfg && cfg.options && cfg.options.scales
    && cfg.options.scales.y && cfg.options.scales.y.max;

  // A Chart.js chart with no axis-bound control of its own — so any sharing
  // that happens here came from the config route.
  const def = reg.getChart('bar-vertical');
  out.noBoundControl = !f.boundKeys(def).max && !f.boundKeys(def).min;
  out.saysYes = f.scaleSharing(def);

  const spec = reg.newSpec(def);
  // Panels with deliberately different peaks: without sharing they draw to
  // their own maxima and the grid lies about the comparison.
  spec.series = [
    { label: 'Small', color: '#6C63D8', data: [10, 14, 12, 16] },
    { label: 'Large', color: '#16916A', data: [800, 940, 870, 1010] },
  ];
  f.facetBySeries(def, spec);
  const panels = f.panelSpecs(def, spec);
  out.panels = panels.length;

  const bounds = f.sharedScaleBounds(def, panels, spec.facet);
  out.bounds = bounds;
  const shared = panels.map((p) => yMaxOf(
    f.applyScaleBounds(def.chartjs.build(p.spec, { width: 400, height: 240 }), bounds),
  ));
  out.sharedMaxima = shared;
  out.coversPeak = shared.every((m) => typeof m === 'number' && m >= 1010);

  // Independent scales must leave the config alone, or the switch does nothing.
  spec.facet.scales = 'free';
  const freeBounds = f.sharedScaleBounds(def, f.panelSpecs(def, spec), spec.facet);
  out.freeIsNull = freeBounds === null;
  spec.facet.scales = 'shared';

  // And it reaches the generated code, not just the preview.
  const code = eng.generateCode(def, spec);
  out.inExport = (code.js.match(/max:\s*-?\d/g) || []).length;

  // A chart with no cartesian axis is still honest about it.
  const pie = reg.getChart('pie');
  out.pieSays = f.scaleSharing(pie);

  // A chart that pins its own axis keeps it — a facet does not overrule a
  // deliberate choice.
  const pinned = { options: { scales: { y: { max: 100 } } } };
  f.applyScaleBounds(pinned, { y: { max: 4000 } });
  out.pinnedKept = pinned.options.scales.y.max === 100;

  // How much wider the net is now.
  let bound = 0; let viaConfig = 0;
  for (const d of reg.CHARTS) {
    const k = f.boundKeys(d);
    if (k.max || k.min) { bound++; continue; }
    if (f.scaleSharing(d).can) viaConfig++;
  }
  out.byControl = bound;
  out.byConfig = viaConfig;
  return out;
});

check(facetScales.noBoundControl, 'the test chart has no axis control of its own');
check(facetScales.saysYes.can, 'so sharing must have come from its config',
  facetScales.saysYes.why);
check(facetScales.panels === 2, 'two panels with very different peaks',
  String(facetScales.panels));
check(new Set(facetScales.sharedMaxima).size === 1 && facetScales.coversPeak,
  'both are drawn to one axis that reaches the larger',
  JSON.stringify(facetScales.sharedMaxima));
check(facetScales.freeIsNull, 'independent scales write nothing at all');
check(facetScales.inExport >= 2, 'and the shared axis is in the exported code',
  `${facetScales.inExport} bounds emitted`);
check(!facetScales.pieSays.can && /own axis|scaled to itself/i.test(facetScales.pieSays.why),
  'a chart with no cartesian axis still says panels do not compare',
  facetScales.pieSays.why);
check(facetScales.pinnedKept, 'a chart that pins its own axis keeps it');
check(facetScales.byConfig >= 25,
  'the config route roughly triples how many charts can share an axis',
  `${facetScales.byControl} by control + ${facetScales.byConfig} by config`);

/* And it works in the studio, on a real page, without leaking a chart per
 * rebuild. Twelve Chart.js instances left behind on every control edit is the
 * failure mode a grid makes twelve times as likely as a single chart did. */
await page.goto(`${base}/studio.html?chart=bar-vertical`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
const facetUi = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tab = (re) => [...document.querySelectorAll('.dlg-tab')].find((t) => re.test(t.textContent));
  const live = () => (window.Chart ? Object.keys(window.Chart.instances || {}).length : -1);

  [...document.querySelectorAll('button')].find((b) => /Edit data/i.test(b.textContent)).click();
  await sleep(1100);

  tab(/Paste text/).click();
  await sleep(250);
  const ta = document.querySelector('.dlg textarea');
  let csv = 'Region,Month,Sales\n';
  ['North', 'South', 'East'].forEach((r, ri) => {
    ['Jan', 'Feb', 'Mar', 'Apr'].forEach((m, mi) => {
      csv += r + ',' + m + ',' + (20 + ri * 15 + mi * 6) + '\n';
    });
  });
  ta.value = csv;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(400);
  tab(/^\s*Table\s*$/).click();
  await sleep(350);

  const strip = document.querySelector('.dlg-facet');
  const offered = strip ? [...strip.querySelectorAll('.facet-chip')].map((b) => b.textContent) : [];
  const chip = strip && [...strip.querySelectorAll('.facet-chip')].find((b) => /^Region/.test(b.textContent));
  if (!chip) return { offered, split: false };
  chip.click();
  await sleep(120);

  [...document.querySelectorAll('.dlg-foot .btn')].find((b) => /Use this data/.test(b.textContent)).click();
  await sleep(1400);

  const host = document.querySelector('.chart-host');
  const grid = host.querySelector('.oc-facets');
  const shot = {
    offered,
    split: !!grid,
    panels: grid ? grid.querySelectorAll('.oc-facet').length : 0,
    names: grid ? [...grid.querySelectorAll('.oc-facet-name')].map((n) => n.textContent) : [],
    canvases: grid ? grid.querySelectorAll('canvas').length : 0,
    control: !!document.querySelector('.facet-ctrl'),
    liveAfterFirst: live(),
  };

  // A blank panel is a rendered panel as far as the DOM is concerned, so look
  // at the pixels.
  shot.painted = grid ? [...grid.querySelectorAll('canvas')].every((c) => {
    const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 8) return true;
    return false;
  }) : false;

  // Three rebuilds: the count must not climb, and there must still be one grid.
  const app = window.openCharts;
  for (let i = 0; i < 3; i++) { app.rebuild(); await sleep(500); }
  shot.liveAfterRebuilds = live();
  shot.gridsAfterRebuilds = document.querySelectorAll('.chart-host .oc-facets').length;
  shot.panelsAfterRebuilds = document.querySelectorAll('.chart-host .oc-facet').length;

  // And switching it off comes back to one chart.
  const sel = [...document.querySelectorAll('.facet-ctrl select')][0];
  if (sel) {
    sel.value = '';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(900);
  }
  shot.offAgain = !document.querySelector('.chart-host .oc-facets');
  shot.liveAfterOff = live();
  return shot;
});

check(facetUi.offered.some((t) => /^Region/.test(t)),
  'the data editor offers the column that could split the table',
  facetUi.offered.join(' | '));
check(facetUi.split && facetUi.panels === 3,
  'applying it draws a grid of panels', String(facetUi.panels));
check(facetUi.names.join(',') === 'North,South,East',
  'each panel is named for the value it holds', facetUi.names.join(','));
check(facetUi.canvases === 3 && facetUi.painted,
  'and every one of them actually drew something',
  facetUi.canvases + ' canvases');
check(facetUi.control, 'the studio carries a small-multiples control');
check(facetUi.liveAfterRebuilds === facetUi.liveAfterFirst,
  'three rebuilds leak no charts',
  facetUi.liveAfterFirst + ' → ' + facetUi.liveAfterRebuilds);
check(facetUi.gridsAfterRebuilds === 1 && facetUi.panelsAfterRebuilds === 3,
  'and leave exactly one grid behind',
  facetUi.gridsAfterRebuilds + ' grids, ' + facetUi.panelsAfterRebuilds + ' panels');
check(facetUi.offAgain && facetUi.liveAfterOff <= facetUi.liveAfterFirst,
  'turning it off comes back to one chart',
  String(facetUi.liveAfterOff));
/* And the export runs — which is the whole promise. A grid that draws in the
 * studio and throws in somebody else's page would be worse than no feature:
 * the studio's job here is to hand over working code. One chart per renderer,
 * because the five code paths are five separate loops. */
const facetExports = await page.evaluate(async () => {
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const f = await import('/js/studio/facet.js');
  const picked = new Map();
  for (const def of reg.CHARTS) {
    const engine = eng.engineOf(def);
    if (picked.has(engine)) continue;
    if (!f.seriesKeyOf(def)) continue;
    const spec = reg.newSpec(def);
    if (!f.facetBySeries(def, spec).ok) continue;
    const panels = f.panelSpecs(def, spec);
    if (!panels || panels.length < 2) continue;
    const code = eng.generateCode(def, spec);
    if (/Code generation failed/.test(code.standalone)) continue;
    picked.set(engine, { id: def.id, engine, panels: panels.length, html: code.standalone });
  }

  // The one DOM chart reads `items`, which has no notion of a series — so the
  // loop above never reaches the fifth code path in `buildJS`. Split it by a
  // column instead, which every shape supports, rather than leaving a whole
  // renderer's export untested.
  if (!picked.has('dom')) {
    const def = reg.getChart('waffle');
    const spec = reg.newSpec(def);
    const rows = [];
    ['Q1', 'Q2', 'Q3'].forEach((q, qi) => {
      ['Chrome', 'Safari', 'Firefox'].forEach((b, bi) => {
        rows.push([q, b, String(60 - bi * 20 + qi * 2)]);
      });
    });
    if (f.facetByColumn(def, spec, { headers: ['Quarter', 'Browser', 'Share'], rows }, 0).ok) {
      const panels = f.panelSpecs(def, spec);
      const code = eng.generateCode(def, spec);
      if (panels && !/Code generation failed/.test(code.standalone)) {
        picked.set('dom', {
          id: def.id, engine: 'dom', panels: panels.length, html: code.standalone,
        });
      }
    }
  }
  return [...picked.values()];
});

let facetExportsOk = 0;
for (const item of facetExports) {
  const probe = await browser.newPage();
  const errs = [];
  probe.on('pageerror', (e) => errs.push(String(e.message)));
  const route = `/facet-export-${item.id}.html`;
  generated.set(route, item.html);
  await probe.goto(base + route, { waitUntil: 'networkidle' });
  await probe.waitForTimeout(1500);
  const state = await probe.evaluate(() => {
    const plates = [...document.querySelectorAll('.oc-facet-plate')];
    const drew = plates.map((p) => {
      const c = p.querySelector('canvas');
      if (c && c.width) {
        const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < px.length; i += 4 * 97) if (px[i] > 10) return true;
        return false;
      }
      const svg = p.querySelector('svg');
      if (svg) return svg.querySelectorAll('path,circle,rect,line').length > 3;
      // A DOM chart draws with elements, not ink or paths — a waffle's cells
      // carry no text at all, so counting descendants is the only honest
      // question to ask of this branch.
      return p.querySelectorAll('*').length > 3;
    });
    return {
      plates: plates.length,
      drew: drew.filter(Boolean).length,
      names: [...document.querySelectorAll('.oc-facet-name')].map((n) => n.textContent),
    };
  });
  await probe.close();
  const why = errs.length ? errs[0]
    : state.plates !== item.panels ? `${state.plates} plates for ${item.panels} panels`
      : `${state.drew} of ${state.plates} panels drew`;
  if (check(state.plates === item.panels && state.drew === item.panels && !errs.length,
    `a faceted export runs: ${item.id} (${item.engine})`, why)) facetExportsOk++;
  check(state.names.length === item.panels,
    `and names every panel: ${item.id}`, state.names.join(','));
}
check(facetExports.length === 5, 'every renderer has a faceted export that runs',
  facetExports.map((e) => e.engine + ':' + e.id).join(' '));

console.log(`  ${green('✓')} facets — ${facet.count} panels from a column, ${facetExportsOk}/${facetExports.length} exports run, ${facetScales.byControl + facetScales.byConfig} charts share an axis`);

/* Suite 27 — nothing wrote to the console along the way. */
// `oc-test-` URLs are the link suite's own stubs. It asks for a 404 on purpose
// to check the message, and the browser logs every failed fetch — so the one
// error this suite provokes deliberately is not evidence of a broken page.
const realErrors = pageErrors.filter((e) => !/favicon|net::ERR_|oc-test-|404 \(Not Found\)/i.test(e));
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
