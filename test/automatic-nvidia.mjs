import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

const blocker = createServer();
await new Promise((resolve, reject) => {
  blocker.once('error', (error) => error.code === 'EADDRINUSE' ? resolve() : reject(error));
  blocker.listen(8765, '127.0.0.1', resolve);
});
const env = { ...process.env, NVIDIA_API_KEY: 'nvidia-test-key', OPENAI_API_KEY: 'unused-openai-key' };
delete env.MCP_PORT;
const child = spawn(process.execPath, ['--import', './test/mock-nvidia.mjs', 'tools/mcp-server.mjs', '--api'], {
  env,
  stdio: ['ignore', 'ignore', 'pipe'],
});
let browser;
try {
  const pairingUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('NVIDIA AI server did not start.')), 10000);
    child.stderr.on('data', (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+\/ai\.html#mcp=[a-f0-9]{64}/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`NVIDIA AI server exited ${code}.`)); });
  });
  browser = await chromium.launch();
  assert.notEqual(new URL(pairingUrl).port, '8765');
  const page = await browser.newPage();
  await page.goto(pairingUrl, { waitUntil: 'domcontentloaded' });
  await page.getByText('Using NVIDIA API key', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => JSON.stringify(sessionStorage).includes('nvidia-test-key')), false);
  const rows = Array.from({ length: 43 }, (_, index) => `R${index},${index + 1}`);
  await page.locator('#ai-files').setInputFiles({ name: 'measurements.csv', mimeType: 'text/csv', buffer: Buffer.from('Region,Sales\n' + rows.join('\n')) });
  await page.waitForFunction(() => window.openChartsGallery?.table?.rows?.length === 43);
  await page.locator('#match-message').fill('Analyze all rows and draw a comparison.');
  await page.locator('#match-chat-send').click();
  await page.getByText('NVIDIA analyzed 43 rows.', { exact: true }).waitFor();
  assert.match(await page.locator('.match-chart-source').textContent(), /43 uploaded rows/);
  await page.locator('#match-message').fill('Test quota');
  await page.locator('#match-chat-send').click();
  await page.getByText('NVIDIA rate limit or trial allowance reached. Check your model limit and try again later.', { exact: true }).waitFor();
  await page.locator('#match-message').fill('Test delayed');
  await page.locator('#match-chat-send').click();
  await page.getByText('Delayed NVIDIA reply.', { exact: true }).waitFor();
  await page.locator('#match-message').fill('Stop this request');
  await page.locator('#match-chat-send').click();
  await page.getByText('Analyzing your table with NVIDIA…', { exact: true }).waitFor();
  await page.locator('#match-chat-stop').click();
  await page.getByText('Request stopped or timed out. You can send your message again.', { exact: true }).waitFor();
  await page.locator('#match-message').fill('B is the baseline between the cameras, H is drone height, and D is the drone distance from the camera midpoint. The cameras use a Raspberry Pi, GPS and IMU.');
  await page.locator('#match-chat-send').click();
  await page.getByText('I understand: B is the camera baseline, H is drone height, and D is its distance from the camera midpoint.', { exact: true }).waitFor();
  assert.equal(await page.getByText('The AI returned an unsupported chart reply.', { exact: false }).count(), 0);
  await page.locator('#match-chat-clear').click();
  await page.getByRole('button', { name: 'Remove measurements.csv' }).click();
  const droneHeaders = ['EXP', 'Date', 'Issue', 'B (m)', 'H true (m)', 'D true (m)', 'Stereo H', 'Stereo D', 'IMU H', 'IMU D', 'Final H', 'Final D',
    ...Array.from({ length: 33 }, (_, index) => index === 21 ? 'ML H' : `Measure ${index + 1}`)];
  const missingMlRows = new Set([9, 12, 13, 14, 21]);
  const droneRows = Array.from({ length: 103 }, (_, index) => [
    `EXP${index + 1}`, '2025-01-01', '', '0.3', '10', '12', '9.8', '11.9', '10.1', '12.2', '10', '12',
    ...Array.from({ length: 33 }, (_, column) => column === 21 && missingMlRows.has(index) ? '—' : index + column + 1),
  ].join(','));
  await page.locator('#ai-files').setInputFiles({ name: 'drone-results.csv', mimeType: 'text/csv', buffer: Buffer.from(droneHeaders.join(',') + '\n' + droneRows.join('\n')) });
  await page.waitForFunction(() => window.openChartsGallery?.table?.rows?.length === 103 && window.openChartsGallery?.table?.headers?.length === 45);
  for (const [question, answer] of [
    ['Are you able to read the data?', 'Yes. I can read all 103 rows and 45 columns.'],
    ['What do you think they are talking about?', 'The columns suggest drone distance estimates from stereo cameras and an IMU compared with ground truth H and D.'],
    ['If you want to suggest charts for these data what is the source you will give a recommendation from?', 'I would base recommendations on drone-results.csv: its 103 rows, B, H true, D true, stereo and IMU estimates, and their completeness and ranges.'],
  ]) {
    await page.locator('#match-message').fill(question);
    await page.locator('#match-chat-send').click();
    await page.getByText(answer, { exact: true }).waitFor();
  }
  await page.locator('#match-message').fill('Plot Stereo H against H true.');
  await page.locator('#match-chat-send').click();
  await page.getByRole('heading', { name: 'Stereo versus ground truth height' }).waitFor();
  assert.match(await page.locator('.match-chart-source').last().textContent(), /H true \(m\) \/ Stereo H/);
  await page.locator('#match-message').fill('Plot ML H by experiment.');
  await page.locator('#match-chat-send').click();
  await page.getByRole('heading', { name: 'ML height by experiment' }).waitFor();
  assert.match(await page.locator('.match-chart-source').last().textContent(), /98 of 103 uploaded rows \(5 unavailable excluded\) · EXP \/ ML H/);
  console.log('NVIDIA AI: key isolation, chart IDs, follow-ups and five unavailable measurements passed.');
} finally {
  await browser?.close();
  child.kill();
  if (blocker.listening) blocker.close();
}
