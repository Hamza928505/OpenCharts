import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, relative } from 'node:path';
import { chromium } from 'playwright';
import { parseChatAnswer } from '../js/studio/analyst.js';

assert.equal(parseChatAnswer('{"message":"Which column should I compare?"}').ok, true);
assert.equal(parseChatAnswer('{"message":"Bad chart","chart":"not-a-chart","spec":{}}').ok, false);
assert.equal(parseChatAnswer('null').ok, false);
const root = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const pathname = req.url === '/'
      ? '/index.html'
      : new URL(req.url, 'http://127.0.0.1').pathname;
    const decodedPathname = decodeURIComponent(pathname);
    const path = resolve(root, '.' + decodedPathname);
    const rel = relative(root, path);
    if (rel.startsWith('..') || rel === '..' || rel.includes('\\..') || rel.includes('/..')) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(12000);
  const requests = [];
  await page.route('http://localhost:11434/v1/chat/completions', async (route) => {
    requests.push(JSON.parse(route.request().postData()));
    const answer = requests.length === 1
      ? { message: 'North has the highest value.', chart: 'bar-vertical', spec: { labels: ['North', 'South'], series: [{ label: 'Value', color: '#448866', data: [680, 575] }] } }
      : { message: 'North is 105 higher than South.' };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }) });
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.match-chat-message');
  await page.evaluate(async () => {
    const { setAiSettings } = await import('/js/studio/ai-config.js');
    await setAiSettings({ provider: 'openai', endpoint: 'http://localhost:11434/v1/chat/completions', model: 'test' });
  });
  await page.locator('#match-text').fill('region,value\nNorth,680\nSouth,575');
  await page.waitForFunction(() => document.querySelector('#match-read-summary').textContent.includes('2 rows'));
  assert.equal(await page.locator('.match-reading').evaluate((el) => el.open), false);
  await page.locator('.match-reading > summary').click();
  assert.equal(await page.locator('#match-read').evaluate((el) => getComputedStyle(el).overflowY), 'visible');
  await page.locator('.match-reading > summary').click();
  await page.locator('#match-message').fill('Draw a comparison');
  await page.locator('#match-chat-send').click();
  await page.waitForSelector('.match-chat-chart canvas, .match-chat-chart svg');
  await page.locator('#match-message').fill('How much higher?');
  await page.locator('#match-message').press('Enter');
  await page.getByText('North is 105 higher than South.', { exact: true }).waitFor();
  const followup = JSON.parse(requests[1].messages[1].content);
  assert.equal(followup.conversation.length, 2);
  assert.equal(followup.currentChart.chart, 'bar-vertical');
  assert.equal(followup.table.rows.length, 2);
  await page.route('http://localhost:11434/v1/chat/completions', (route) => route.fulfill({ status: 429, body: '{}' }));
  await page.locator('#match-message').fill('Try again');
  await page.locator('#match-chat-send').click();
  await page.getByText(/This provider is out of free capacity/).waitFor();
  assert.equal(await page.locator('#match-message').inputValue(), 'Try again');
  const editorHeight = await page.locator('#match-text').evaluate((el) => el.getBoundingClientRect().height);
  const chatHeight = await page.locator('.match-chat').evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(Math.abs(chatHeight - editorHeight) < 16, `Table editor (${editorHeight}px) should align with chat (${chatHeight}px).`);
  await page.locator('#match-chat-clear').click();
  assert.equal(await page.locator('.match-chat-message').count(), 1);
  const geminiCalls = [];
  await page.route(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models/, async (route) => {
    const generating = route.request().url().includes(':generateContent');
    if (generating) geminiCalls.push(route.request().url());
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(generating
      ? { candidates: [{ content: { parts: [{ text: '{"message":"Gemini connected successfully."}' }] } }] }
      : { models: [
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
      ] }) });
  });
  await page.locator('#match-ai-settings').click();
  await page.getByLabel('AI provider', { exact: true }).selectOption('gemini');
  await page.getByLabel('Gemini API key', { exact: true }).fill('test-key');
  assert.equal(await page.getByLabel('Model name', { exact: true }).isVisible(), false);
  await page.getByRole('button', { name: 'Save provider', exact: true }).click();
  await page.locator('#match-message').fill('Hello Gemini');
  await page.locator('#match-chat-send').click();
  await page.getByText('Gemini connected successfully.', { exact: true }).waitFor().catch(async (error) => {
    throw new Error(error.message + '\nConversation: ' + await page.locator('#match-chat-log').innerText());
  });
  assert.match(geminiCalls[0], /models\/gemini-3\.8-flash:generateContent/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('#matchbar').evaluate((el) => el.scrollWidth <= el.clientWidth), true);
  console.log('Matchbar chat: follow-up context, chart rendering, report layout, rate-limit recovery and mobile checks passed.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
