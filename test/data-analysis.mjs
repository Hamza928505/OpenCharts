import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, resolve, relative } from 'node:path';
import { chromium } from 'playwright';
import { profileTable, groupSummary, correlate } from '../js/studio/profile.js';
import { toNumber } from '../js/studio/transform.js';

// Unequal groups, valid zero, missing observations, a tiny scientific value,
// repeated numeric settings, repeated records and identical measurement columns.
const table = { headers: ['Run', 'Setting', 'Error', 'Copy', 'Kind'], rows: [
  ['R1', '2', '0', '0', 'A'], ['R2', '2', '4', '4', 'A'],
  ['R3', '5', '10', '10', 'B'], ['R4', '5', '—', '—', 'B'],
  ['R5', '5', '', '', 'B'], ['R6', '8', '-', '-', 'C'],
  ['R7', '8', 'N/A', 'N/A', 'C'], ['R8', '9', '1e-8', '1e-8', 'D'],
  ['R8', '9', '1e-8', '1e-8', 'D'],
] };
const before = JSON.stringify(table);
const p = profileTable(table);
assert.equal(p.columns[2].numericCount, 5);
assert.equal(p.columns[2].invalid, 3);
assert.equal(p.columns[2].missing, 1);
assert.equal(p.columns[2].mean, (14 + 2e-8) / 5);
assert.equal(p.columns[2].median, 1e-8);
assert.equal(p.columns[1].repeated, 5);
assert.ok(p.groups.some((c) => c.name === 'Setting'), 'numeric settings can group measurements');
assert.deepEqual(p.duplicates.rows, [[7, 8]]);
assert.deepEqual(p.duplicates.columns, [[2, 3]]);
assert.equal(p.duplicates.rowCount, 1);
assert.equal(p.duplicates.columnCount, 1);
assert.match(p.quality.map((q) => q.text).join(' '), /duplicate/);
const grouped = groupSummary(table, 1, 2);
assert.deepEqual(grouped.map((g) => [g.key, g.count, g.valid, g.value]), [
  ['2', 2, 2, 2], ['5', 3, 1, 10], ['8', 2, 0, null], ['9', 2, 2, 1e-8],
]);
assert.deepEqual(groupSummary(table, 1, null, 'count').map((g) => g.value), [2, 3, 2, 2]);
assert.equal(groupSummary(table, null, 2)[0].value, (14 + 2e-8) / 5, 'overall mean weights observations, not groups');
for (const [agg, expected] of [['sum', 14 + 2e-8], ['median', 1e-8], ['min', 0], ['max', 10]]) {
  assert.ok(Math.abs(groupSummary(table, null, 2, agg)[0].value - expected) < 1e-12);
}
assert.throws(() => groupSummary(table, -1, 2));
assert.throws(() => groupSummary(table, 1, 99));
assert.throws(() => groupSummary(table, 1, 2, 'execute'));
for (const v of ['', ' ', '-', '+', '$', '%', '—', 'N/A', 'Infinity', '0x10']) assert.ok(Number.isNaN(toNumber(v)), `${v} is not zero`);
assert.equal(toNumber('-$1,200.50'), -1200.5);
assert.equal(toNumber('12%'), 12, 'preserve percentage units');
const a = Array.from({ length: 103 }, (_, i) => String(400 + i));
const b = a.map((v) => String(-2 * Number(v) + 3));
assert.deepEqual(correlate(a, b), { n: 103, r: -1 });
assert.deepEqual(correlate(['1', '', '3', '4'], ['2', '9', '6', '8']), { n: 3, r: 1 });
assert.equal(correlate(a, a.map(() => '0')).r, null);
assert.equal(correlate(['1', '2'], ['3', '4']).r, null);
const full = profileTable({ headers: ['Dose', 'Response', 'Same response', 'Constant'], rows: a.map((v, i) => [v, b[i], b[i], '9']) });
assert.equal(full.correlations.length, 1, 'constants and duplicate columns cannot crowd out other patterns');
assert.equal(full.correlations[0].n, 103);
assert.equal(JSON.stringify(table), before, 'analysis must not mutate the source');
assert.equal(profileTable({ headers: ['Empty'], rows: [] }).columns[0].mean, undefined);
// JSON encoding distinguishes embedded separators and missing cells safely.
assert.equal(profileTable({ headers: ['a', 'b'], rows: [['a\0b', 'c'], ['a', 'b\0c']] }).duplicates.rowCount, 0);
console.log('Local calculations: counts, grouped arithmetic, duplicates, missing values, precision and relationships passed.');

const root = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (relative(root, path).startsWith('..')) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' })[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', locale: 'en-US' });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // No API calls or CDN access can make these calculations succeed.
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await page.goto(base + '/ai.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.openChartsGallery);
  const upload = async (value) => {
    const prior = await page.evaluateHandle(() => window.openChartsGallery.table);
    await page.locator('#match-text').fill(value);
    await page.waitForFunction((old) => window.openChartsGallery.table && window.openChartsGallery.table !== old, prior);
    await prior.dispose();
    // Words-only tables cannot infer a header from numeric rows; the existing
    // checkbox lets the reader state it explicitly.
    await page.locator('#match-header').check();
    await page.waitForFunction(({ count, headers }) => window.openChartsGallery.table?.rows?.length === count
      && window.openChartsGallery.table.headers.join(',') === headers,
    { count: value.trim().split('\n').length - 1, headers: value.split('\n')[0] });
    await page.locator('#match-analysis').waitFor({ state: 'visible' });
  };
  await upload([table.headers, ...table.rows].map((r) => r.join(',')).join('\n'));
  const panel = page.locator('#match-analysis');
  assert.equal(await page.locator('.match-reading').evaluate((e) => e.open), false, 'analysis is not buried in What was read');
  await panel.locator('[data-group]').selectOption('1');
  await panel.locator('[data-measure]').selectOption('2');
  await panel.locator('[data-agg]').selectOption('mean');
  await panel.locator('.analysis-chart canvas').waitFor();
  assert.match(await panel.locator('.analysis-result').innerText(), /5 valid measurements; 4 excluded/);
  assert.deepEqual(await panel.locator('tbody tr').first().locator('td').allTextContents(), ['2', '2', '2', '0', '2']);
  const chartValues = () => page.evaluate(() => window.Chart.getChart(document.querySelector('#match-analysis .analysis-chart canvas')).data.datasets[0].data);
  assert.deepEqual(await chartValues(), [2, 10, 1e-8], 'invalid-only group is omitted, never drawn as zero');
  await panel.locator('[data-agg]').selectOption('count');
  assert.deepEqual(await chartValues(), [3, 2, 2, 2]);
  const downloadWait = page.waitForEvent('download');
  await panel.locator('[data-export]').click();
  const csv = await readFile(await (await downloadWait).path(), 'utf8');
  assert.match(csv, /Setting,Rows,Share/);
  assert.match(csv, /5,3,33\.333/);
  await panel.locator('[data-mode]').selectOption('duplicates');
  assert.equal(await panel.locator('tbody tr').count(), 2);
  assert.match(await panel.locator('tbody').innerText(), /Data row 8, Data row 9/);
  await panel.locator('[data-mode]').selectOption('columns');
  assert.match(await panel.locator('thead').innerText(), /Average/);
  const source = await page.evaluate(() => JSON.stringify(window.openChartsGallery.table.rows));
  assert.equal(source, JSON.stringify(table.rows));

  await upload('Setting,Response\n' + a.map((v, i) => `${v},${b[i]}`).join('\n'));
  await panel.locator('[data-mode]').selectOption('relationship');
  await panel.locator('[data-x]').selectOption('0');
  await panel.locator('[data-measure]').selectOption('1');
  await panel.locator('.analysis-chart canvas').waitFor();
  assert.match(await panel.locator('.analysis-result').innerText(), /103 paired numeric rows; 0 excluded.*-1/);
  assert.equal((await chartValues()).length, 103);
  const axes = await page.evaluate(() => {
    const chart = window.Chart.getChart(document.querySelector('#match-analysis .analysis-chart canvas'));
    return { xMin: chart.options.scales.x.min, xMax: chart.options.scales.x.max, yMin: chart.options.scales.y.min, yMax: chart.options.scales.y.max, xTitle: chart.options.scales.x.title.text };
  });
  assert.ok(axes.xMin < 400 && axes.xMax > 502 && axes.yMin < -1001 && axes.yMax > -797, 'scatter axes cover the actual data, not example price/rating bounds');
  assert.equal(axes.xTitle, 'Setting');
  await panel.locator('[data-next]').click();
  assert.match(await panel.locator('[data-page]').innerText(), /Page 2/);
  assert.equal(await panel.locator('tbody tr').first().locator('td').first().textContent(), '13');
  await panel.locator('[data-sort="1"]').click();
  assert.equal(await panel.locator('th').nth(1).getAttribute('aria-sort'), 'ascending');
  await panel.locator('[data-sort="1"]').click();
  assert.equal(await panel.locator('tbody tr').first().locator('td').nth(1).textContent(), '502');
  const sortedDownload = page.waitForEvent('download');
  await panel.locator('[data-export]').click();
  assert.match(await readFile(await (await sortedDownload).path(), 'utf8'), /^Data row,Setting,Response\n103,502,-1001/);
  await panel.locator('[data-mode]').selectOption('group');
  await panel.locator('[data-group]').selectOption('0');
  await panel.locator('[data-agg]').selectOption('count');
  assert.match(await panel.locator('[data-chart-note]').innerText(), /All 103 valid groups are plotted/);
  assert.equal((await chartValues()).length, 103);

  await upload('Label,Value\n<img src=x onerror=alert(1)>,2\n=1+1,4\n=1+1,6');
  await panel.locator('[data-group]').selectOption('0');
  assert.equal(await panel.locator('img').count(), 0, 'input text is not HTML');
  const safeDownload = page.waitForEvent('download');
  await panel.locator('[data-export]').click();
  const safeCsv = await readFile(await (await safeDownload).path(), 'utf8');
  assert.match(safeCsv, /'=1\+1/, 'download must not execute spreadsheet formulas');
  await mkdir('test/screenshots', { recursive: true });
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: 'test/screenshots/local-analysis-desktop.png' });
  for (const theme of ['dark', 'light']) {
    await page.evaluate(async (value) => (await import('/js/studio/theme.js')).setTheme(value), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no page overflow on mobile: ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && el.getBoundingClientRect().width > 0).slice(0, 12).map((el) => ({ tag: el.tagName, cls: el.className, right: el.getBoundingClientRect().right })))));
    await panel.screenshot({ path: `test/screenshots/local-analysis-${theme}.png` });
    await panel.locator('[data-mode]').selectOption('columns');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'wide statistics scroll only inside the table');
    await panel.locator('[data-mode]').selectOption('group');
  }
  await upload('Category,Comment\nNorth,good\nNorth,ready\nSouth,ready');
  assert.equal(await panel.locator('[data-agg]').inputValue(), 'count');
  assert.equal(await panel.locator('[data-measure-field]').isVisible(), false);
  assert.equal(await panel.locator('[data-mode] option[value="relationship"]').evaluate((o) => o.disabled), true);
  assert.deepEqual(await chartValues(), [2, 1]);
  await upload('Setting\n2\n2\n5');
  assert.equal(await panel.locator('[data-agg]').inputValue(), 'count', 'one repeated numeric column defaults to frequencies, not averages of itself');
  assert.deepEqual(await chartValues(), [2, 1]);
  await panel.locator('[data-mode]').selectOption('duplicates');
  assert.match(await panel.locator('.analysis-result').innerText(), /1 extra duplicate rows/);

  // The same full-table recommendation path runs for paste, file and URL.
  const wide = ['Group,' + Array.from({ length: 18 }, (_, i) => `Measure ${i}`).join(','),
    ...Array.from({ length: 103 }, (_, row) => `Batch ${row % 3},` + Array.from({ length: 18 }, (_, col) => String(100 + row * (col + 1) + col * col)).join(','))].join('\n');
  await page.setViewportSize({ width: 1280, height: 900 });
  await upload(wide);
  const recommendations = panel.locator('[data-recommendations]');
  assert.ok(Number((await recommendations.locator('[data-charts-count]').innerText()).split(' ')[0]) > 115);
  assert.equal(await recommendations.locator('.analysis-suggestion').count(), 4, 'only the visible page is built');
  assert.ok((await recommendations.locator('[data-chart-source]').allTextContents()).every((note) => /All 103 source rows analyzed/.test(note)));
  const firstKey = await recommendations.locator('.analysis-suggestion').first().getAttribute('data-plan');
  await recommendations.locator('[data-charts-next]').click();
  assert.notEqual(await recommendations.locator('.analysis-suggestion').first().getAttribute('data-plan'), firstKey);
  assert.match(await recommendations.locator('[data-charts-page]').innerText(), /Page 2/);
  await recommendations.locator('[data-chart-kind]').selectOption('relationship');
  await recommendations.locator('[data-chart-column]').selectOption('18');
  assert.ok((await recommendations.locator('h5').allTextContents()).every((title) => title.includes('Measure 17')));
  assert.equal(await recommendations.locator('[data-chart-status]').first().innerText(), '');
  const renderedPoints = await recommendations.locator('.analysis-preview canvas').first().evaluate((canvas) => {
    const chart = window.Chart.getChart(canvas);
    return chart.getDatasetMeta(0).data.filter((point) => !point.skip && Number.isFinite(point.x) && Number.isFinite(point.y)).length;
  });
  assert.equal(await recommendations.locator('.analysis-preview canvas').first().evaluate((canvas) => window.Chart.getChart(canvas).options.animation), false, 'previews honor reduced motion');
  assert.equal(renderedPoints, 103, 'scatter renders every valid point, not just axes');
  const coloredPixels = await recommendations.locator('.analysis-preview canvas').first().evaluate((canvas) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 1] > pixels[i] + 15 && pixels[i + 1] > pixels[i + 2] + 15 && pixels[i + 3]) colored++;
    return colored;
  });
  assert.ok(coloredPixels > 50, 'scatter previews contain visible plotted marks');
  const selectedTitle = await recommendations.locator('h5').first().innerText();
  const chartDataWait = page.waitForEvent('download');
  await recommendations.locator('[data-chart-download]').first().click();
  const chartCsv = await readFile(await (await chartDataWait).path(), 'utf8');
  assert.equal(chartCsv.trim().split('\n').length, 104, 'download includes the complete plotted inputs');
  await page.evaluate(() => { window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('Storage disabled'); }; });
  await recommendations.locator('[data-open-chart]').first().click();
  assert.match(await recommendations.locator('[data-chart-status]').first().innerText(), /could not keep this chart/);
  assert.ok(!page.url().includes('studio.html'), 'failed handoff does not open misleading example data');
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; delete window.originalSetItem; });
  await recommendations.screenshot({ path: 'test/screenshots/analysis-recommendations-desktop.png' });
  await recommendations.locator('[data-open-chart]').first().click();
  await page.waitForURL('**/studio.html?chart=scatter-basic');
  await page.waitForFunction(() => window.openCharts?.spec?.points?.length === 103);
  assert.equal(await page.evaluate(() => window.openCharts.spec.caption.title), selectedTitle);
  assert.equal(await page.evaluate(() => window.openCharts.spec.points.at(-1).y), 2225);
  await page.goto(base + '/ai.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.openChartsGallery);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#match-file').click();
  await (await chooser).setFiles({ name: 'full-data.csv', mimeType: 'text/csv', buffer: Buffer.from(wide) });
  await page.waitForFunction(() => window.openChartsGallery.table?.rows.length === 103);
  assert.equal(await recommendations.locator('.analysis-suggestion').count(), 4);
  const urlCsv = 'Category,Amount\nNorth,10\nNorth,20\nSouth,40';
  await page.route(base + '/recommendations.csv', (route) => route.fulfill({ status: 200, contentType: 'text/csv', body: urlCsv }));
  await page.locator('#match-url').fill(base + '/recommendations.csv');
  await page.locator('#match-url-go').click();
  await page.waitForFunction(() => window.openChartsGallery.table?.rows.length === 3);
  assert.match(await recommendations.locator('[data-chart-source]').first().innerText(), /All 3 source rows analyzed/);
  for (const theme of ['dark', 'light']) {
    await page.evaluate(async (value) => (await import('/js/studio/theme.js')).setTheme(value), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'recommendations fit mobile');
    await recommendations.screenshot({ path: `test/screenshots/analysis-recommendations-${theme}.png` });
  }
  await page.locator('#match-clear').click();
  await panel.waitFor({ state: 'hidden' });
  assert.equal(await panel.locator('canvas').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Local analysis UI: charts, full rows, CSV, pagination, sorting, mobile, themes, cleanup and no AI passed.');
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
