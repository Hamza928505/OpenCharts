import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/OpenCharts/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><meta charset="utf-8"><title>Local library check</title>');
      return;
    }
    if (!pathname.startsWith('/OpenCharts/')) { res.writeHead(404).end(); return; }
    const path = resolve(root, decodeURIComponent(pathname.slice('/OpenCharts/'.length)));
    if (relative(root, path).startsWith('..')) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const external = [], requests = [], errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (new URL(url).origin !== origin) { external.push(url); return route.abort(); }
    requests.push(url);
    return route.continue();
  });
  await page.goto(origin + '/OpenCharts/');
  const result = await page.evaluate(async () => {
    const { LIBRARIES } = await import('./js/studio/cdn.js');
    const { loadLibrary } = await import('./js/studio/loader.js');
    const keys = Object.keys(LIBRARIES).filter((key) => LIBRARIES[key].kind === 'script');
    if (keys.some((key) => !LIBRARIES[key].local)) throw new Error('A runtime script still requires a CDN');
    await Promise.all([...keys, ...keys].map(loadLibrary));
    const { CHARTS, newSpec } = await import('./js/studio/registry.js');
    const { renderChart, destroyInstance } = await import('./js/studio/engines.js');
    const rendered = [];
    for (const key of ['matrix', 'treemap', 'boxplot', 'echarts']) {
      const def = CHARTS.find((def) => key === 'echarts' ? def.echarts : def.chartjs?.plugins?.includes(key));
      const host = document.createElement('div');
      host.style.cssText = 'width:640px;height:320px';
      document.body.append(host);
      const instance = renderChart(def, host, newSpec(def), { height: 320 });
      await instance.whenReady;
      if (instance.engine === 'error' || !host.querySelector('canvas, svg')) throw new Error(`${key} did not render`);
      rendered.push(def.id);
      destroyInstance(instance);
    }
    return { rendered, scripts: keys.map((key) => LIBRARIES[key].local),
      topojson: typeof window.topojson.feature, rows: window.aq.from([{ value: 1 }]).numRows() };
  });
  assert.equal(result.rendered.length, 4);
  assert.equal(result.topojson, 'function');
  assert.equal(result.rows, 1);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, [], 'no runtime script should contact a third-party origin');
  for (const path of result.scripts) assert.equal(requests.filter((url) => url.endsWith('/' + path)).length, 1, path + ' loads once');
  console.log('Local libraries: all nine scripts loaded once under /OpenCharts/, four plugin/engine charts rendered, no CDN requests.');
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
