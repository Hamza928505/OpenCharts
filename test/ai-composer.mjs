import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/remote.csv') { res.writeHead(200, { 'Content-Type': 'text/csv' }).end('Region,Sales\nWest,30'); return; }
    const path = join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, ''));
    if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }).end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const url = `http://127.0.0.1:${server.address().port}/ai.html`;
  await mkdir(join(root, '.cache'), { recursive: true });
  for (const [name, width, height] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.deepEqual(errors, [], `${name}: page errors`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: horizontal overflow`);
    assert.equal(await page.locator('.ai-hero').evaluate((node) => getComputedStyle(node).backgroundImage), 'none', `${name}: no gradient`);
    assert.equal(await page.locator('#match-chat-send').isDisabled(), true, `${name}: empty message cannot send`);
    assert.equal(await page.locator('.match-chat-suggestions').count(), 0, `${name}: no suggested questions`);
    await page.screenshot({ path: join(root, '.cache', `ai-${name}.png`) });
    if (name === 'desktop') {
      assert.equal(await page.locator('[data-chat-mode]').count(), 0);
      await page.locator('#match-message').fill('Show the trend');
      assert.equal(await page.locator('#match-chat-send').isEnabled(), true);
      await page.locator('#match-chat-send').click();
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.match-chat-message[data-role="user"] p').last().textContent(), 'Show the trend');
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#ai-attach').click()]);
      await chooser.setFiles({ name: 'sales-2024.csv', mimeType: 'text/csv', buffer: Buffer.from('Region,Sales\nNorth,10\nSouth,20') });
      await page.waitForTimeout(150);
      assert.equal(await page.locator('.ai-attachment').count(), 1);
      const [secondChooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#ai-attach').click()]);
      await secondChooser.setFiles({ name: 'sales-2025.csv', mimeType: 'text/csv', buffer: Buffer.from('Region,Sales\nEast,40\nSouth,50') });
      await page.waitForTimeout(350);
      assert.equal(await page.locator('.ai-attachment').count(), 2);
      assert.equal(await page.locator('.ai-attachment svg').count(), 4);
      assert.match(await page.locator('#match-read-summary').innerText(), /4 rows/);
      assert.match(await page.locator('#match-text').inputValue(), /Source file/);
      assert.match(await page.locator('#match-text').inputValue(), /sales-2025.csv/);
      await page.locator('#match-message').fill('');
      assert.equal(await page.locator('#match-chat-send').isEnabled(), true, 'attachments can send alone');
      await page.locator('#match-chat-send').click();
      await page.waitForTimeout(150);
      assert.match(await page.locator('#match-chat-log').innerText(), /Suggest a chart from the attached data/);
      const [wrongChooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#ai-attach').click()]);
      await wrongChooser.setFiles({ name: 'wrong.csv', mimeType: 'text/csv', buffer: Buffer.from('Month,Count\nJan,5') });
      await page.waitForTimeout(350);
      assert.equal(await page.locator('.ai-attachment').count(), 3);
      assert.match(await page.locator('#match-read-summary').innerText(), /5 rows/);
      const combined = await page.locator('#match-text').inputValue();
      assert.match(combined, /^Region,Sales,Month,Count,Source file/);
      assert.match(combined, /North,10,,,sales-2024.csv/);
      assert.match(combined, /,,Jan,5,wrong.csv/);
      await page.locator('#ai-link-button').click();
      await page.locator('#match-url').fill(`${url.replace('/ai.html', '')}/remote.csv`);
      await page.locator('#match-url').press('Enter');
      await page.waitForTimeout(350);
      assert.equal(await page.locator('.ai-attachment').count(), 4);
      assert.match(await page.locator('#match-read-summary').innerText(), /6 rows/);
      await page.screenshot({ path: join(root, '.cache', 'ai-attached-desktop.png') });
      await page.getByRole('button', { name: 'Remove sales-2024.csv' }).click();
      await page.waitForTimeout(150);
      assert.equal(await page.locator('.ai-attachment').count(), 3);
      assert.match(await page.locator('#match-read-summary').innerText(), /4 rows/);
      await page.locator('.ai-data-panel').evaluate((node) => { node.open = true; });
      await page.locator('#match-text').fill('Region,Sales\nWest,7');
      await page.waitForTimeout(350);
      assert.equal(await page.locator('.ai-attachment').count(), 0);
      assert.match(await page.locator('#ai-attach-status').innerText(), /editable copy/);
      assert.match(await page.locator('#match-read-summary').innerText(), /1 row/);
      await page.locator('#match-clear').click();
      const [yearChooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#ai-attach').click()]);
      await yearChooser.setFiles([
        { name: 'north.csv', mimeType: 'text/csv', buffer: Buffer.from('Region,2024\nNorth,10') },
        { name: 'south.csv', mimeType: 'text/csv', buffer: Buffer.from('Region,2024\nSouth,20') },
      ]);
      await page.waitForTimeout(350);
      assert.match(await page.locator('#match-read-summary').innerText(), /2 rows/);
      const combinedYears = await page.locator('#match-text').inputValue();
      assert.match(combinedYears, /^Region,2024,Source file/);
      assert.equal(combinedYears.split('\n').length, 3);
      await page.locator('#match-clear').click();
      const rows = Array.from({ length: 1600 }, (_, i) => `${['North', 'South'][i % 2]},${i + 10},${i + 20}`);
      const [largeChooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#ai-attach').click()]);
      await largeChooser.setFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.from('Region,Sales,Costs\n' + rows.join('\n')) });
      await page.waitForFunction(() => document.querySelector('#match-read-summary').textContent.includes('1600 rows')
        && !document.querySelector('#match-status').classList.contains('loading'));
      assert.equal(await page.evaluate(() => window.openChartsGallery.table.rows.length), 1600);
      const scatterCard = page.locator('.analysis-suggestion[data-plan^="relationship"]');
      const scatter = scatterCard.locator('.analysis-preview canvas');
      await scatter.waitFor();
      assert.ok(await scatter.evaluate((canvas) => window.Chart.getChart(canvas).data.datasets[0].data.length <= 800));
      assert.match(await scatterCard.locator('[data-chart-source]').innerText(), /opening or downloading uses all rows/);
      const line = page.locator('.card-canvas[data-id="line-basic"] canvas');
      await page.locator('.card-canvas[data-id="line-basic"]').scrollIntoViewIfNeeded();
      await line.waitFor();
      assert.ok(await line.evaluate((canvas) => window.Chart.getChart(canvas).data.labels.length <= 801));
      assert.equal(await page.evaluate(async () => {
        const { getChart } = await import('/js/studio/registry.js');
        return window.openChartsGallery._tableFor(getChart('line-basic')).rows.length;
      }), 1600, 'opening the chart keeps the complete table');
      await page.locator('#match-clear').click();
      const larger = Array.from({ length: 8000 }, (_, i) => `North,${i + 10}`);
      await page.evaluate((value) => {
        const input = document.querySelector('#match-text');
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, 'Region,Sales\n' + larger.join('\n'));
      await page.waitForFunction(() => document.querySelector('#match-status').classList.contains('loading'));
      await page.evaluate(() => {
        const input = document.querySelector('#match-text');
        input.value = 'Region,Sales\nWest,7';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction(() => document.querySelector('#match-read-summary').textContent.includes('1 row')
        && !document.querySelector('#match-status').classList.contains('loading'));
      await page.waitForTimeout(1000);
      assert.deepEqual(await page.evaluate(() => window.openChartsGallery.table.rows), [['West', '7']], 'older analysis cannot replace a newer table');
    } else {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#ai-attach').click()]);
      await chooser.setFiles([
        { name: 'regional-sales-2024.csv', mimeType: 'text/csv', buffer: Buffer.from('Region,Sales\nNorth,10') },
        { name: 'regional-sales-2025.csv', mimeType: 'text/csv', buffer: Buffer.from('Region,Sales\nSouth,20') },
      ]);
      await page.waitForTimeout(350);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile attachments fit');
      await page.screenshot({ path: join(root, '.cache', 'ai-attached-mobile.png') });
    }
    assert.deepEqual(errors, [], `${name}: interaction errors`);
    await page.close();
  }
  console.log('AI composer checks passed');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
