import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const child = spawn(process.execPath, ['--import', './test/mock-openai.mjs', 'tools/mcp-server.mjs', '--api'], {
  env: { ...process.env, MCP_PORT: '0', OPENAI_API_KEY: 'test-key' },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let browser;
try {
  const pairingUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Automatic AI server did not start.')), 10000);
    child.stderr.on('data', (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+\/ai\.html#mcp=[a-f0-9]{64}/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Automatic AI server exited ${code}.`)); });
  });
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pairingUrl, { waitUntil: 'domcontentloaded' });
  await page.getByText('Using OpenAI API key', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => JSON.stringify(sessionStorage).includes('test-key')), false);
  const paired = new URL(pairingUrl);
  assert.equal((await fetch(paired.origin + '/health', { headers: { Origin: 'https://hamza928505.github.io', 'x-opencharts-token': paired.hash.slice(5) } })).status, 403);
  const rows = Array.from({ length: 43 }, (_, index) => `R${index},${index + 1}`);
  await page.locator('#ai-files').setInputFiles({ name: 'measurements.csv', mimeType: 'text/csv', buffer: Buffer.from('Region,Sales\n' + rows.join('\n')) });
  await page.waitForFunction(() => window.openChartsGallery?.table?.rows?.length === 43);
  await page.locator('#match-message').fill('Analyze all rows and draw a comparison.');
  await page.locator('#match-chat-send').click();
  await page.getByText('Analyzed 43 rows.', { exact: true }).waitFor();
  assert.match(await page.locator('.match-chart-source').textContent(), /43 uploaded rows/);
  await page.locator('#match-message').fill('Test quota');
  await page.locator('#match-chat-send').click();
  await page.getByText('OpenAI rate limit or quota reached. Check your API account and try again.', { exact: true }).waitFor();
  await page.locator('#match-message').fill('Stop this request');
  await page.locator('#match-chat-send').click();
  await page.getByText('Analyzing your table with OpenAI…', { exact: true }).waitFor();
  await page.locator('#match-chat-stop').click();
  await page.getByText('Request stopped or timed out. You can send your message again.', { exact: true }).waitFor();
  await page.locator('#match-message').fill('Stop this request');
  const queued = page.waitForResponse((response) => response.url().endsWith('/requests') && response.request().method() === 'POST');
  await page.locator('#match-chat-send').click();
  const { id } = await (await queued).json();
  await page.goto('about:blank');
  let removed = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(paired.origin + '/requests/' + id, { headers: { 'x-opencharts-token': paired.hash.slice(5) } });
    if (response.status === 404) { removed = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(removed, true, 'Leaving the page should cancel its pending API request.');
  console.log('Automatic AI: local key, full-table profile, row tool, browser chart, stop, and page leave passed.');
} finally {
  await browser?.close();
  child.kill();
}
