import assert from 'node:assert/strict';

const actualFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async (url, options) => {
  if (url !== 'https://api.openai.com/v1/responses') return actualFetch(url, options);
  const body = JSON.parse(options.body);
  assert.equal(options.headers.Authorization, 'Bearer test-key');
  assert.equal(body.store, false);
  assert.equal(body.model, 'gpt-6-luna');
  const latest = body.input.filter((part) => part.role === 'user').at(-1).content;
  const prompt = latest.match(/\n\nLatest user request: ([^\n]*)/)?.[1] || latest;
  if (prompt === 'Test quota') return new Response('', { status: 429 });
  if (prompt === 'Stop this request') {
    return new Promise((_, reject) => options.signal.addEventListener('abort',
      () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  }
  if (++calls === 1) {
    assert.equal(prompt, 'Analyze all rows and draw a comparison.');
    assert.match(latest, /Profile calculated from ALL 43 uploaded rows/);
    assert.match(latest, /Complete uploaded table:[\s\S]*R42/);
    return Response.json({ status: 'completed', output: [{
      type: 'function_call', name: 'read_rows', call_id: 'read-1',
      arguments: JSON.stringify({ offset: 40, limit: 3 }),
    }] });
  }
  const page = JSON.parse(body.input.find((part) => part.type === 'function_call_output').output);
  assert.equal(page.totalRows, 43);
  assert.equal(page.rows.length, 3);
  assert.equal(page.rows.at(-1)[0], 'R42');
  return Response.json({ status: 'completed', output: [{
    type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
      message: 'Analyzed 43 rows.', charts: [{ chart: 'bar-vertical', title: 'Values', columns: [0, 1] }],
    }) }],
  }] });
};
