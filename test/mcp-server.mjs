import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: process.execPath,
  // Advance only the child's clock to exercise the real expiry path without
  // a ten-minute wait or a test-only endpoint in the production server.
  args: ['--input-type=module', '-e', `
    const realNow = Date.now;
    let advance = 0, input = '';
    Date.now = () => realNow() + advance;
    await import(${JSON.stringify(new URL('../tools/mcp-server.mjs', import.meta.url).href)});
    process.stdin.on('data', chunk => {
      input += chunk;
      let end;
      while ((end = input.indexOf('\\n')) !== -1) {
        if (JSON.parse(input.slice(0, end)).method === 'notifications/test/expire') advance += 660000;
        input = input.slice(end + 1);
      }
    });
  `],
  env: { ...process.env, MCP_PORT: '0' },
  stderr: 'pipe',
});
let diagnostics = '';
transport.stderr?.on('data', (data) => { diagnostics += String(data); });
const client = new Client({ name: 'opencharts-test', version: '1.0.0' });
const call = (name, args = {}) => client.callTool({ name, arguments: args });
const text = (result) => JSON.parse(result.content[0].text);
let origin;
let headers;
const table = { headers: ['Experiment', 'Baseline'], rows: Array.from({ length: 403 }, (_, i) => [`EXP${i + 1}`, i + 10]) };
const payload = { kind: 'chat', system: 'Analyze the uploaded data.', message: 'Suggest a baseline chart', schema: { type: 'object' }, table };
const api = (path, options = {}) => fetch(origin + path, { ...options, headers: { ...headers, ...options.headers } });
async function post(data = payload) {
  const response = await api('/requests', { method: 'POST', body: JSON.stringify(data) });
  assert.equal(response.status, 201);
  return (await response.json()).id;
}
function raw(path, extra = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(origin, { path, headers: extra }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.end();
  });
}
try {
  await client.connect(transport);
  assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).sort(), ['opencharts_get_request', 'opencharts_read_rows', 'opencharts_status', 'opencharts_submit_answer']);
  const status = text(await call('opencharts_status'));
  const paired = new URL(status.pairingUrl);
  assert.match(paired.hash, /^#mcp=[a-f0-9]{64}$/);
  assert.equal(paired.hostname, '127.0.0.1');
  assert.equal(status.connected, true);
  origin = paired.origin;
  headers = { 'x-opencharts-token': paired.hash.slice(5), 'Content-Type': 'application/json', Origin: origin };
  assert.deepEqual(await (await api('/health')).json(), { name: 'OpenCharts MCP', connected: true });
  assert.equal((await fetch(origin + '/health')).status, 401);
  assert.equal((await api('/health', { headers: { 'x-opencharts-token': 'f'.repeat(64) } })).status, 401);
  for (const badOrigin of ['null', 'https://evil.example', 'https://hamza928505.github.io.evil.example', 'http://localhost:8765']) {
    assert.equal((await api('/health', { headers: { Origin: badOrigin } })).status, 403);
  }
  assert.equal(await raw('/health', { ...headers, Host: 'evil.example' }), 403, 'reject DNS rebinding');
  const remote = 'https://hamza928505.github.io';
  const preflight = await fetch(origin + '/requests', { method: 'OPTIONS', headers: { Origin: remote, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, x-opencharts-token', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), remote);
  assert.equal(preflight.headers.get('Access-Control-Allow-Private-Network'), 'true');
  assert.equal((await fetch(origin + '/requests', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } })).status, 403);
  const page = await fetch(origin + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /OpenCharts/);
  assert.equal((await fetch(origin + '/js/studio/registry.js')).status, 200);
  for (const path of ['/package.json', '/.env', '/.git/config', '/node_modules/zod/package.json', '/tools/mcp-server.mjs', '/js/../package.json', '/js/%2e%2e/package.json', '/js/%5c..%5c.env', '/js/.private.js', '/%00']) {
    assert.equal(await raw(path), 404, path + ' must not expose private files');
  }
  assert.equal(await raw('/%zz'), 400);
  assert.equal((await api('/requests', { method: 'POST', body: '{}' })).status, 400);
  assert.equal((await api('/requests', { method: 'POST', body: '{' })).status, 400);
  assert.equal((await api('/requests', { method: 'POST', body: JSON.stringify({ ...payload, table: { headers: ['x'], rows: [[{ nested: true }]] } }) })).status, 400);
  assert.equal((await api('/requests', { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await api('/requests', { method: 'POST', body: 'x'.repeat(5 * 1024 * 1024 + 1) })).status, 413);
  assert.equal(text(await call('opencharts_get_request')).status, 'waiting');
  const waiting = call('opencharts_get_request', { waitSeconds: 2 });
  const id = await post();
  const request = text(await waiting);
  assert.equal(request.id, id);
  assert.equal(request.table.totalRows, 403);
  assert.equal(request.table.rows, undefined, 'the tool brief must not silently dump the entire table');
  assert.equal(request.system, payload.system);
  assert.deepEqual(request.schema, payload.schema);
  assert.ok(request.expiresAt > Date.now() + 590000 && request.expiresAt <= Date.now() + 600000);
  const first = text(await call('opencharts_read_rows', { requestId: id }));
  assert.equal(first.rows.length, 200);
  assert.equal(first.nextOffset, 200);
  const last = text(await call('opencharts_read_rows', { requestId: id, offset: 400 }));
  assert.equal(last.totalRows, 403);
  assert.equal(last.nextOffset, null);
  assert.deepEqual(last.rows.at(-1), ['EXP403', 412]);
  const invalid = await call('opencharts_submit_answer', { requestId: id, answer: { message: 'bad chart', charts: [{ chart: 'bar-vertical', title: 'Bad', columns: [0, 999] }] } });
  assert.equal(invalid.isError, true);
  assert.equal((await (await api('/requests/' + id)).json()).status, 'pending', 'an invalid answer remains correctable');
  const answer = { message: 'Baseline across all 403 experiments.', charts: [{ chart: 'bar-vertical', title: 'Baselines', columns: [0, 1] }] };
  assert.equal((await call('opencharts_submit_answer', { requestId: id, answer })).isError, false);
  assert.deepEqual(await (await api('/requests/' + id)).json(), { status: 'complete', answer });
  assert.equal((await call('opencharts_submit_answer', { requestId: id, answer })).isError, true, 'cannot overwrite a completed response');
  assert.equal((await call('opencharts_read_rows', { requestId: id })).isError, true, 'completed requests release uploaded rows');
  assert.equal((await api('/requests/' + id, { method: 'DELETE' })).status, 204);
  assert.equal((await api('/requests/' + id)).status, 404);
  assert.equal((await call('opencharts_submit_answer', { requestId: id, answer })).isError, true, 'cancelled requests reject late replies');
  const chatId = await post({ ...payload, table: null });
  assert.equal((await call('opencharts_submit_answer', { requestId: chatId, answer: { message: 'Hello', charts: [] } })).isError, false, 'greetings need no table');
  await api('/requests/' + chatId, { method: 'DELETE' });
  const chartId = await post({ ...payload, kind: 'chart' });
  assert.equal((await call('opencharts_submit_answer', { requestId: chartId, answer: { chart: 'bar-vertical', spec: [] } })).isError, true);
  assert.equal((await call('opencharts_submit_answer', { requestId: chartId, answer: { chart: 'bar-vertical', spec: { caption: { title: 'Baselines' } } } })).isError, false);
  await api('/requests/' + chartId, { method: 'DELETE' });
  const queued = [];
  for (let i = 0; i < 8; i++) queued.push(await post());
  assert.equal((await api('/requests', { method: 'POST', body: JSON.stringify(payload) })).status, 429);
  assert.equal(text(await call('opencharts_status')).pending, 8);
  for (const pending of queued) await api('/requests/' + pending, { method: 'DELETE' });
  assert.equal(text(await call('opencharts_status')).pending, 0);
  const expiredId = await post();
  await client.notification({ method: 'notifications/test/expire' });
  assert.equal(text(await call('opencharts_status')).pending, 0, 'expiry releases queued requests');
  assert.equal((await api('/requests/' + expiredId)).status, 404);
  assert.equal((await call('opencharts_read_rows', { requestId: expiredId })).isError, true);
  assert.equal((await call('opencharts_submit_answer', { requestId: expiredId, answer })).isError, true, 'expired requests reject late replies');
  assert.ok(!diagnostics.includes(headers['x-opencharts-token']), 'never log the pairing token');
  console.log('MCP bridge: stdio tools, full-row paging, validated charts, pairing, CORS, traversal, cancellation, expiry and queue limits passed.');
} finally {
  await client.close();
}
if (origin) await assert.rejects(fetch(origin + '/health'), 'stdio disconnect closes the local listener');
