import assert from 'node:assert/strict';
import { CHAT_SCHEMA, parseChatAnswer, buildChatCharts } from '../js/studio/ai-response.js';
import { setAiSettings, clearAiSettings } from '../js/studio/ai-config.js';
import { askAnalyst } from '../js/studio/analyst.js';
import { getChart, newSpec } from '../js/studio/registry.js';

const table = { headers: ['Experiment', 'B', 'Error'], rows: Array.from({ length: 103 }, (_, i) => [`EXP${i + 1}`, String(i + 10), String(i / 10)]) };
const reply = { message: 'Baseline comparisons and their distribution, using all uploaded rows.', charts: [
  { chart: 'bar-vertical', title: 'Baseline by experiment', columns: [0, 1] },
  { chart: 'histogram', title: 'Baseline distribution', columns: [1] },
] };
const wire = JSON.stringify(reply);
const result = buildChatCharts(parseChatAnswer('```json\n' + wire + '\n```').answer, table);
assert.equal(result.ok, true);
assert.equal(result.answer.charts.length, 2);
assert.equal(result.answer.charts[0].spec.labels.length, 103);
assert.equal(result.answer.charts[0].spec.series[0].data[102], 112);
assert.equal(result.answer.charts[1].spec.groups[0].values.length, 103);
assert.equal(result.answer.charts[0].rowCount, 103);
assert.equal(result.answer.charts[0].spec.opts.prefix, '');
assert.equal(result.answer.charts[0].spec.opts.suffix, '');
const histogram = getChart('histogram');
const counts = (spec) => histogram.chartjs.build(spec).data.datasets[0].data.reduce((a, b) => a + b, 0);
assert.equal(counts(result.answer.charts[1].spec), 103, 'all rows land in histogram bins, not the example range');
const decimals = buildChatCharts({ message: 'Baseline distribution', charts: [reply.charts[1]] }, { ...table, rows: [['A', '0.12'], ['B', '0.17'], ['C', '0.32']] });
assert.equal(counts(decimals.answer.charts[0].spec), 3, 'fractional baseline values must not be rounded out of their bins');
const identical = buildChatCharts({ message: 'Baseline distribution', charts: [reply.charts[1]] }, { ...table, rows: [['A', '0.12'], ['B', '0.12']] });
assert.equal(counts(identical.answer.charts[0].spec), 2, 'constant data gets a nonzero histogram range');
assert.equal(table.rows.length, 103);
for (const text of ['null', 'Here is your chart: ' + wire, wire.slice(0, -2), JSON.stringify({ ...reply, charts: [{ chart: 'not-a-chart', title: 'bad', columns: [1] }] }), JSON.stringify({ ...reply, charts: [{ ...reply.charts[0], columns: ['B'] }] }), JSON.stringify({ ...reply, charts: [{ ...reply.charts[0], spec: { labels: ['invented'] } }] }), JSON.stringify({ ...reply, charts: Array(4).fill(reply.charts[0]) })]) {
  assert.equal(parseChatAnswer(text).ok, false, 'invalid output must not reach a renderer');
}
assert.equal(buildChatCharts(reply, null).ok, false);
assert.equal(buildChatCharts({ ...reply, charts: [{ ...reply.charts[0], columns: [0, 999] }] }, table).ok, false);
const badTable = { ...table, rows: [...table.rows, ['EXP104', 'not a number', '0']] };
assert.equal(buildChatCharts(reply, badTable).ok, false);
const longTable = { ...table, rows: Array(201).fill(table.rows[0]).concat([['EXP202', '', '0']]) };
assert.equal(buildChatCharts(reply, longTable).ok, false, 'validate beyond the sample and do not invent zero for missing data');

const originalFetch = globalThis.fetch;
const token = 'a'.repeat(64);
const endpoint = 'http://127.0.0.1:8765';
try {
  // No credentials, requests or automatic remote fallbacks before local pairing.
  clearAiSettings();
  globalThis.fetch = () => { throw new Error('Unexpected network access'); };
  assert.equal((await askAnalyst({ request: 'Hi', conversation: [] })).reason, 'no-agent');
  assert.equal((await askAnalyst({ request: '  ' })).reason, 'empty');
  await setAiSettings({ endpoint, token });
  let answer = reply;
  let calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.ok(url.startsWith(endpoint + '/requests'), 'only paired loopback destination is called');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['x-opencharts-token'], token);
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.kind, 'chat');
      assert.deepEqual(body.schema, CHAT_SCHEMA);
      assert.equal(body.table.rows.length, 103, 'the MCP agent can read all rows');
      const message = JSON.parse(body.message);
      assert.equal(message.table.rows.length, 40);
      assert.equal(message.table.totalRows, 103);
      assert.match(message.note, /opencharts_read_rows/);
      assert.equal(message.catalogue.find((chart) => chart.id === 'bar-vertical').shape, 'labelSeries');
      assert.ok(!options.body.includes(token));
      return Response.json({ id: 'test-request' });
    }
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json({ status: 'complete', answer });
  };
  let response = await askAnalyst({ request: 'Suggest charts for the baselines', conversation: [], table });
  assert.equal(response.ok, true, response.error);
  assert.equal(response.answer.charts[0].spec.labels.length, 103);
  assert.deepEqual(calls.map(({ options }) => options.method || 'GET'), ['POST', 'GET', 'DELETE']);

  // A server or older MCP client cannot bypass browser chart validation.
  for (const invalid of [
    { message: 'Bad chart', charts: [{ chart: 'not-a-chart', title: 'Bad', columns: [1] }] },
    { message: 'Bad data', charts: [{ chart: 'bar-vertical', title: 'Bad', columns: [0, 999] }] },
  ]) {
    answer = invalid;
    calls = [];
    response = await askAnalyst({ request: 'Draw', conversation: [], table });
    assert.equal(response.reason, 'malformed');
    assert.equal(calls.filter(({ options }) => options.method === 'POST').length, 1, 'no provider retry/repair loops');
    assert.equal(calls.at(-1).options.method, 'DELETE');
  }
  for (const status of [401, 403, 404, 410, 413, 429, 503]) {
    let count = 0;
    globalThis.fetch = async () => { count++; return Response.json({}, { status }); };
    response = await askAnalyst({ request: 'Draw', conversation: [], table });
    assert.equal(response.ok, false);
    assert.equal(count, 1, 'HTTP failures must not cause retries');
    assert.ok(!response.error.includes(token));
  }

  const stopped = new AbortController();
  let deleted = false;
  globalThis.fetch = async (_, options) => {
    if (options.method === 'DELETE') { deleted = true; assert.equal(options.signal.aborted, false); return new Response(null, { status: 204 }); }
    return Response.json({ id: 'cancelled-request' });
  };
  await assert.rejects(askAnalyst({ request: 'Draw', conversation: [], table, signal: stopped.signal, onStatus: () => stopped.abort() }), { name: 'AbortError' });
  assert.equal(deleted, true, 'stop removes the queued data with an independent cleanup signal');

  // Studio's preview/apply contract remains intact and exposes all source rows to MCP.
  const def = getChart('bar-vertical');
  const spec = newSpec(def);
  globalThis.fetch = async (_, options) => {
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.kind, 'chart');
      assert.ok(body.table.rows.length);
      assert.ok(body.message.includes('Change title'));
      return Response.json({ id: 'studio-request' });
    }
    return Response.json({ status: 'complete', answer: { chart: 'bar-vertical', spec: { caption: { title: 'Baseline' } } } });
  };
  assert.equal((await askAnalyst({ request: 'Change title', def, spec })).answer.spec.caption.title, 'Baseline');
  console.log('Agent responses: MCP queue, full 103-row chart mapping, validation, cleanup, cancellation, connection errors and studio previews passed.');
} finally {
  globalThis.fetch = originalFetch;
  clearAiSettings();
}
