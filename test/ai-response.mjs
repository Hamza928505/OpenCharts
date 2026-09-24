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
const providers = ['gemini', 'anthropic', 'nvidia', 'xai', 'openai'];
const payload = (provider, text, truncated = false) => provider === 'gemini'
  ? { candidates: [{ finishReason: truncated ? 'MAX_TOKENS' : 'STOP', content: { parts: [{ thought: true, text: 'Private reasoning is not JSON.' }, { text }] } }] }
  : provider === 'anthropic' ? { stop_reason: truncated ? 'max_tokens' : 'end_turn', content: [{ type: 'thinking', thinking: 'Not answer text.' }, { type: 'text', text }] }
    : { choices: [{ finish_reason: truncated ? 'length' : 'stop', message: { content: text } }] };
try {
  for (const provider of providers) {
    await setAiSettings({ provider, key: 'test-secret', model: provider === 'gemini' ? 'gemini-test-flash' : 'test-model', endpoint: 'http://localhost:11434/v1' });
    let calls = 0;
    globalThis.fetch = async (_, options) => {
      calls++;
      const body = JSON.parse(options.body);
      const schema = provider === 'gemini' ? body.generationConfig.responseJsonSchema
        : provider === 'anthropic' ? body.output_config.format.schema : body.response_format.json_schema.schema;
      assert.deepEqual(schema, CHAT_SCHEMA);
      const message = JSON.parse(provider === 'gemini' ? body.contents[0].parts[0].text : body.messages.at(-1).content);
      assert.equal(message.table.rows.length, 40);
      assert.equal(message.table.totalRows, 103);
      assert.equal(message.catalogue.find((chart) => chart.id === 'bar-vertical').shape, 'labelSeries');
      assert.ok(!options.body.includes('test-secret'));
      return Response.json(payload(provider, wire));
    };
    const response = await askAnalyst({ request: 'Suggest charts for the baselines', conversation: [], table });
    assert.equal(response.ok, true, provider + ': ' + response.error);
    assert.equal(response.answer.charts[0].spec.labels.length, 103);
    assert.equal(calls, 1);

    // A prose or truncated reply gets one bounded repair, for every adapter.
    for (const truncated of [false, true]) {
      calls = 0;
      globalThis.fetch = async () => Response.json(payload(provider, ++calls === 1 ? (truncated ? wire : 'Use a bar chart.') : wire, truncated && calls === 1));
      assert.equal((await askAnalyst({ request: 'Suggest charts', conversation: [], table })).ok, true);
      assert.equal(calls, 2);
    }
    calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json(payload(provider, 'not JSON')); };
    const failed = await askAnalyst({ request: 'Suggest charts', conversation: [], table });
    assert.equal(failed.ok, false);
    assert.match(failed.error, /after one repair/);
    assert.equal(calls, 2);

    // If native schema is unsupported, retry without that option but keep validation.
    calls = 0;
    globalThis.fetch = async (_, options) => {
      const body = JSON.parse(options.body);
      if (++calls === 1) return Response.json({ error: { message: 'Structured output json_schema is not supported by this model' } }, { status: 400 });
      assert.equal(body.response_format, undefined);
      assert.equal(body.output_config, undefined);
      assert.equal(body.generationConfig?.responseJsonSchema, undefined);
      return Response.json(payload(provider, wire));
    };
    assert.equal((await askAnalyst({ request: 'Suggest charts', conversation: [], table })).ok, true);
    assert.equal(calls, 2);
  }
  // Schema fallback must not restart Gemini's transport retries or turn into 9 requests.
  await setAiSettings({ provider: 'gemini', key: 'retry-cap-test', model: 'gemini-test-flash' });
  let overloadCalls = 0;
  globalThis.fetch = async () => ++overloadCalls === 1
    ? Response.json({ error: { message: 'json_schema is not supported' } }, { status: 400 })
    : Response.json({ error: { message: 'High demand' } }, { status: 503 });
  const overloaded = await askAnalyst({ request: 'Draw a chart', conversation: [], table });
  assert.equal(overloaded.ok, false);
  assert.match(overloaded.error, /paused/);
  assert.equal(overloadCalls, 3);
  assert.equal((await askAnalyst({ request: 'hi', conversation: [], table })).ok, false);
  assert.equal(overloadCalls, 3, 'cooldown must also cover subsequent chat messages');

  await setAiSettings({ provider: 'openai', model: 'local-test', endpoint: 'http://localhost:11434/v1' });
  for (const status of [400, 401, 403, 429, 503]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ error: { message: 'Some other problem' } }, { status }); };
    assert.equal((await askAnalyst({ request: 'Suggest charts', conversation: [], table })).ok, false);
    assert.equal(calls, 1, 'HTTP failures must not cause repair loops');
  }
  let calls = 0;
  const controller = new AbortController();
  globalThis.fetch = async () => { calls++; return Response.json(payload('openai', 'invalid')); };
  await assert.rejects(askAnalyst({ request: 'Suggest charts', conversation: [], table, signal: controller.signal, onStatus: () => controller.abort() }), { name: 'AbortError' });
  assert.equal(calls, 1);
  globalThis.fetch = async () => Response.json({ choices: [{ finish_reason: 'stop', message: { refusal: 'No', content: '' } }] });
  assert.equal((await askAnalyst({ request: 'Suggest charts', conversation: [], table })).reason, 'blocked');

  // Studio's preview/apply contract remains intact, independently of chat cards.
  const def = getChart('bar-vertical');
  globalThis.fetch = async () => Response.json(payload('openai', '{"chart":"bar-vertical","spec":{"caption":{"title":"Baseline"}}}'));
  assert.equal((await askAnalyst({ request: 'Change title', def, spec: newSpec(def) })).answer.spec.caption.title, 'Baseline');
  console.log('AI responses: shared schema across five adapters, 103-row multi-chart mapping, validation, format fallback, bounded repair and cancellation passed.');
} finally {
  globalThis.fetch = originalFetch;
  clearAiSettings();
}
