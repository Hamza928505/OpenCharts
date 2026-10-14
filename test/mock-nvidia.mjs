import assert from 'node:assert/strict';

const actualFetch = globalThis.fetch;
let calls = 0;
let contextCalls = 0;
globalThis.fetch = async (url, options) => {
  if (url === 'https://integrate.api.nvidia.com/v1/status/12345678-1234-1234-1234-123456789012') {
    return Response.json({ choices: [{ message: { content: '{"message":"Delayed NVIDIA reply.","charts":[]}' } }] });
  }
  if (url !== 'https://integrate.api.nvidia.com/v1/chat/completions') return actualFetch(url, options);
  const body = JSON.parse(options.body);
  assert.equal(options.headers.Authorization, 'Bearer nvidia-test-key');
  assert.equal(body.model, 'nvidia/nemotron-3.5-lightning-30b-a3b');
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
  assert.equal(body.stream, false);
  assert.equal(body.messages[0].role, 'system');
  const latest = body.messages.filter((message) => message.role === 'user').at(-1).content;
  const prompt = latest.match(/\n\nLatest user request: ([^\n]*)/)?.[1] || latest;
  if (prompt === 'Test quota') return new Response('', { status: 429 });
  if (prompt === 'Test delayed') return new Response('', {
    status: 202, headers: { 'nvcf-reqid': '12345678-1234-1234-1234-123456789012' },
  });
  if (prompt === 'Stop this request') {
    return new Promise((_, reject) => options.signal.addEventListener('abort',
      () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  }
  if (prompt.includes('B is the baseline between the cameras')) {
    assert.match(body.messages[0].content, /only explains the experiment or defines columns/);
    contextCalls++;
    if (contextCalls === 1) return Response.json({ choices: [{ message: { content: JSON.stringify({
      message: 'Drone geometry.', charts: [{ chart: 'invented-chart', title: 'Geometry', columns: [0, 1] }],
    }) } }] });
    assert.equal(contextCalls, 2);
    assert.match(latest, /Unknown chart ID/);
    assert.match(latest, /acknowledge it with charts: \[\]/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      message: 'I understand: B is the camera baseline, H is drone height, and D is its distance from the camera midpoint.', charts: [],
    }) } }] });
  }
  if (prompt === 'Are you able to read the data?') {
    assert.match(latest, /Profile calculated from ALL 103 uploaded rows/);
    assert.match(latest, /Complete uploaded table:[\s\S]*EXP103/);
    assert.equal(body.messages.at(-1).role, 'user');
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      message: 'Yes. I can read all 103 rows and 45 columns.', charts: [],
    }) } }] });
  }
  if (prompt === 'What do you think they are talking about?') {
    assert.equal(body.messages.at(-2).role, 'assistant');
    assert.match(body.messages.at(-2).content, /I can read all 103 rows/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      message: 'The columns suggest drone distance estimates from stereo cameras and an IMU compared with ground truth H and D.', charts: [],
    }) } }] });
  }
  if (prompt === 'If you want to suggest charts for these data what is the source you will give a recommendation from?') {
    assert.deepEqual(body.messages.map((message) => message.role), ['system', 'user', 'assistant', 'user', 'assistant', 'user']);
    assert.equal(body.messages.at(-2).role, 'assistant');
    assert.match(body.messages.at(-2).content, /stereo cameras and an IMU/);
    assert.match(body.messages[0].content, /what evidence would support chart recommendations/);
    assert.match(latest, /"sourceFiles":\["drone-results.csv"\]/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      message: 'I would base recommendations on drone-results.csv: its 103 rows, B, H true, D true, stereo and IMU estimates, and their completeness and ranges.', charts: [],
    }) } }] });
  }
  if (prompt === 'Plot Stereo H against H true.') {
    assert.match(body.messages[0].content, /Valid chart IDs \(copy one exactly\):[\s\S]*scatter-basic/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      message: 'Stereo H against ground truth H.', charts: [{ chart: 'Scatter', title: 'Stereo versus ground truth height', columns: [4, 6] }],
    }) } }] });
  }
  if (prompt === 'Plot ML H by experiment.') {
    assert.match(latest, /"ML H"/);
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      message: 'ML height by experiment, excluding unavailable measurements.', charts: [{ chart: 'Vertical Bar', title: 'ML height by experiment', columns: [0, 33] }],
    }) } }] });
  }
  if (++calls === 1) {
    assert.match(latest, /Profile calculated from ALL 43 uploaded rows/);
    assert.match(latest, /Complete uploaded table:[\s\S]*R42/);
    assert.equal(prompt, 'Analyze all rows and draw a comparison.');
    assert.equal(body.tools[0].function.name, 'read_rows');
    return Response.json({ choices: [{ message: { content: null, tool_calls: [{
      id: 'read-1', type: 'function', function: { name: 'read_rows', arguments: '{"offset":40,"limit":3}' },
    }] } }] });
  }
  const page = JSON.parse(body.messages.find((message) => message.role === 'tool').content);
  assert.equal(page.totalRows, 43);
  assert.equal(page.rows.at(-1)[0], 'R42');
  return Response.json({ choices: [{ message: { content: JSON.stringify({
    message: 'NVIDIA analyzed 43 rows.', charts: [{ chart: 'bar-vertical', title: 'Values', columns: [0, 1] }],
  }) } }] });
};
