import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { chromium } from 'playwright';
import { parseAgentLink, setAiSettings, clearAiSettings } from '../js/studio/ai-config.js';

const token = 'a'.repeat(64);
assert.deepEqual(parseAgentLink('http://127.0.0.1:8765/#mcp=' + token), { endpoint: 'http://127.0.0.1:8765', token });
for (const bad of [
  'https://example.com/#mcp=' + token, 'http://127.0.0.1.evil.test/#mcp=' + token,
  'http://user:pass@localhost/#mcp=' + token, 'http://localhost/?token=x#mcp=' + token,
  'http://localhost/other#mcp=' + token, 'http://localhost/#mcp=short',
]) assert.throws(() => parseAgentLink(bad));
await assert.rejects(setAiSettings({ endpoint: 'https://api.example', token }));
clearAiSettings();

const client = new Client({ name: 'opencharts-browser-test', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath, args: ['tools/mcp-server.mjs'],
  env: { ...process.env, MCP_PORT: '0' }, stderr: 'pipe',
});
const call = (name, args = {}) => client.callTool({ name, arguments: args });
const read = (result) => { assert.equal(result.isError, false, result.content?.[0]?.text); return JSON.parse(result.content[0].text); };
const nextRequest = async () => read(await call('opencharts_get_request', { waitSeconds: 5 }));
let browser;
try {
  await client.connect(transport);
  const { pairingUrl } = read(await call('opencharts_status'));
  const endpoint = new URL(pairingUrl).origin;
  await mkdir('test/screenshots', { recursive: true });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.goto(pairingUrl, { waitUntil: 'domcontentloaded' });
  await page.getByText('Paired with local agent', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, '', 'pairing fragment is removed from address/history');
  await page.evaluate(() => {
    localStorage.setItem('opencharts.ai-key', 'legacy-secret');
    localStorage.setItem('opencharts.ai-settings', '{"provider":"gemini"}');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Paired with local agent', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('opencharts.ai-key'), localStorage.getItem('opencharts.ai-settings')]), [null, null]);
  await page.locator('#match-text').fill('region,value\nNorth,680\nSouth,575');
  await page.waitForFunction(() => document.querySelector('#match-read-summary').textContent.includes('2 rows'));
  assert.equal(await page.locator('.match-reading').evaluate((el) => el.open), false);
  await page.locator('.match-reading > summary').click();
  assert.equal(await page.locator('#match-read').evaluate((el) => getComputedStyle(el).overflowY), 'visible');
  await page.locator('.match-reading > summary').click();
  await page.locator('#match-message').fill('Draw a comparison');
  await page.locator('#match-chat-send').click();
  const first = await nextRequest();
  assert.equal(first.kind, 'chat');
  assert.equal(first.table.totalRows, 2);
  const invalid = await call('opencharts_submit_answer', { requestId: first.id, answer: { message: 'Bad', charts: [{ chart: 'bogus', title: 'Bad', columns: [0, 1] }] } });
  assert.equal(invalid.isError, true, 'invalid replies stay pending and correctable');
  assert.equal(await page.locator('.match-chart-card').count(), 0);
  read(await call('opencharts_submit_answer', { requestId: first.id, answer: {
    message: 'Here are a comparison and a distribution.', charts: [
      { chart: 'bar-vertical', title: 'Regional comparison', columns: [0, 1] },
      { chart: 'histogram', title: 'Value distribution', columns: [1] },
    ],
  } }));
  await page.waitForSelector('.match-chat-chart canvas, .match-chat-chart svg');
  assert.equal(await page.locator('.match-chart-card').count(), 2);
  await page.locator('.match-chart-card').nth(1).locator('canvas, svg').waitFor();
  await page.getByRole('button', { name: 'Discuss this chart' }).first().click();
  await page.locator('#match-message').fill('How much higher?');
  await page.locator('#match-message').press('Enter');
  const followup = await nextRequest();
  const brief = JSON.parse(followup.message);
  assert.equal(brief.conversation.length, 2);
  assert.equal(brief.currentChart.chart, 'bar-vertical');
  assert.deepEqual(brief.currentChart.columns, [0, 1]);
  assert.equal(brief.currentChart.spec, undefined);
  read(await call('opencharts_submit_answer', { requestId: followup.id, answer: { message: 'North is 105 higher than South.', charts: [] } }));
  await page.getByText('North is 105 higher than South.', { exact: true }).waitFor();
  const editorHeight = await page.locator('#match-text').evaluate((el) => el.getBoundingClientRect().height);
  const chatHeight = await page.locator('.match-chat').evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(Math.abs(chatHeight - editorHeight) < 16, 'data textarea height aligns with chat');
  await page.locator('#match-chat-clear').click();
  assert.equal(await page.locator('.match-chat-message').count(), 1);
  assert.equal(await page.locator('.match-chart-card').count(), 0);

  await page.locator('#match-message').fill('Stop this request');
  await page.locator('#match-chat-send').click();
  const stopped = await nextRequest();
  await page.locator('#match-chat-stop').click();
  await page.getByText('Request stopped or timed out. You can send your message again.', { exact: true }).waitFor();
  assert.equal(await page.locator('#match-message').inputValue(), 'Stop this request');
  assert.equal((await call('opencharts_submit_answer', { requestId: stopped.id, answer: { message: 'Too late', charts: [] } })).isError, true);

  const rows = Array.from({ length: 103 }, (_, i) => `EXP${i + 1},${i + 10}`);
  await page.locator('#match-text').fill('Experiment,B\n' + rows.join('\n'));
  await page.waitForFunction(() => document.querySelector('#match-read-summary').textContent.includes('103 rows'));
  await page.locator('#match-message').fill('Suggest baseline charts');
  await page.locator('#match-chat-send').click();
  const baselines = await nextRequest();
  assert.equal(baselines.table.totalRows, 103);
  assert.equal(JSON.parse(baselines.message).table.rows.length, 40);
  const data = read(await call('opencharts_read_rows', { requestId: baselines.id, offset: 100 }));
  assert.deepEqual(data.rows.at(-1), ['EXP103', '112']);
  read(await call('opencharts_submit_answer', { requestId: baselines.id, answer: {
    message: 'Here are the baseline comparison and distribution.', charts: [
      { chart: 'bar-vertical', title: 'Baseline by experiment', columns: [0, 1] },
      { chart: 'histogram', title: 'Baseline distribution', columns: [1] },
    ],
  } }));
  await page.getByRole('heading', { name: 'Baseline by experiment', exact: true }).waitFor();
  await page.locator('.match-chart-card').nth(1).locator('canvas').waitFor();
  assert.equal(await page.locator('.match-chart-card').first().locator('canvas').evaluate((canvas) => window.Chart.getChart(canvas).data.datasets[0].data.length), 103);
  assert.equal(await page.locator('.match-chart-card').nth(1).locator('canvas').evaluate((canvas) => window.Chart.getChart(canvas).data.datasets[0].data.reduce((a, b) => a + b, 0)), 103);
  assert.equal(await page.locator('.match-chart-source').first().textContent(), 'Source: 103 uploaded rows · Experiment / B');
  await page.screenshot({ path: 'test/screenshots/mcp-baseline-charts.png' });

  await page.locator('#match-ai-settings').click();
  assert.equal(await page.locator('.ai-config input[type=password], .ai-config select, #ai-config-model').count(), 0);
  await page.getByLabel('Local connection link').fill('https://untrusted.example/#mcp=' + token);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: /Use the local OpenCharts link/ }).waitFor();
  assert.equal(await page.evaluate(async () => (await (await import('/js/studio/ai-config.js')).getAiSettings()).endpoint), endpoint, 'invalid configuration preserves current connection');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await page.locator('#match-ai-settings').evaluate((el) => el === document.activeElement), true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(viewport);
    await page.locator('#match-ai-settings').click();
    await page.getByText('First-time setup', { exact: true }).click();
    assert.equal(await page.locator('.ai-config').evaluate((el) => el.scrollWidth <= el.clientWidth), true);
    await page.getByRole('button', { name: 'Connect', exact: true }).focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.getByLabel('Local connection link').evaluate((el) => el === document.activeElement), true);
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#match-ai-settings').click();
  await page.screenshot({ path: 'test/screenshots/mcp-setup-desktop.png' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: 'test/screenshots/mcp-setup-mobile.png' });
  await page.evaluate(async () => (await import('/js/studio/theme.js')).setTheme('dark'));
  await page.screenshot({ path: 'test/screenshots/mcp-setup-dark.png' });
  await page.evaluate(async () => (await import('/js/studio/theme.js')).setTheme('light'));
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await page.getByText('Connect an agent to start', { exact: true }).waitFor();
  await page.locator('#match-message').fill('Hi');
  await page.locator('#match-chat-send').click();
  await page.getByText(/Connect your signed-in agent using Connect agent first/).waitFor();
  assert.equal(await page.locator('#match-message').inputValue(), 'Hi');
  assert.equal(read(await call('opencharts_status')).pending, 0);
  await page.locator('#match-ai-settings').click();
  await page.getByLabel('Local connection link').fill(pairingUrl);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByText('Paired with local agent', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  // Serve this working tree at the published site's origin to exercise the
  // actual cross-origin browser requests to the local bridge, without deploying.
  const hosted = await browser.newPage();
  hosted.setDefaultTimeout(15000);
  const published = 'https://hamza928505.github.io/OpenCharts';
  await hosted.route(published + '/**', async (route) => {
    const resource = new URL(route.request().url()).pathname.slice('/OpenCharts'.length);
    const path = new URL('..' + (resource === '/' ? '/index.html' : resource), import.meta.url);
    const contentType = ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' })[extname(path.pathname)] || 'application/octet-stream';
    await route.fulfill({ status: 200, contentType, body: await readFile(path) });
  });
  await hosted.goto(published + '/', { waitUntil: 'domcontentloaded' });
  await hosted.locator('#match-ai-settings').click();
  await hosted.getByLabel('Local connection link').fill(pairingUrl);
  await hosted.getByRole('button', { name: 'Connect', exact: true }).click();
  await hosted.getByText('Paired with local agent', { exact: true }).waitFor();
  await hosted.locator('#match-message').fill('Hello from the hosted site');
  await hosted.locator('#match-chat-send').click();
  const hostedRequest = await nextRequest();
  assert.equal(JSON.parse(hostedRequest.message).request, 'Hello from the hosted site');
  read(await call('opencharts_submit_answer', { requestId: hostedRequest.id, answer: { message: 'The reply appears on the hosted site.', charts: [] } }));
  await hosted.getByText('The reply appears on the hosted site.', { exact: true }).waitFor();
  await hosted.locator('#match-message').fill('Cancel when I disconnect');
  await hosted.locator('#match-chat-send').click();
  const disconnected = await nextRequest();
  await hosted.locator('#match-ai-settings').click();
  await hosted.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await hosted.getByText('Request stopped or timed out. You can send your message again.', { exact: true }).waitFor();
  assert.equal((await call('opencharts_submit_answer', { requestId: disconnected.id, answer: { message: 'Too late', charts: [] } })).isError, true);
  console.log('Browser MCP chat: pairing, full-row chart rendering, agent corrections, follow-ups, stop/reconnect, legacy-key removal and accessible mobile setup passed.');
} finally {
  await browser?.close();
  await client.close();
}
