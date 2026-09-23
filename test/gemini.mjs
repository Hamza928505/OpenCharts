import assert from 'node:assert/strict';
import { generateGemini, listGeminiModels } from '../js/studio/gemini.js';

const originalFetch = globalThis.fetch;
const key = 'test-key-not-a-real-credential';
const args = { key, system: 'system', message: 'message' };
const calls = [];
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
try {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.equal(url.includes(key), false);
    assert.equal(options.headers['x-goog-api-key'], key);
    if (url.includes('?')) return json({ models: [
      { name: 'models/gemini-test-embedding', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-test-flash-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
    ] });
    return json({ candidates: [] });
  };
  await generateGemini(args);
  assert.match(calls[1].url, /\/models\/gemini-3\.8-flash:generateContent$/);
  calls.length = 0;
  await generateGemini({ ...args, model: ' models/gemini-test-flash ' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/models\/gemini-test-flash:generateContent$/);
  assert.equal(calls[0].url.includes('%2F'), false);

  globalThis.fetch = async () => json({ error: { message: `Model unavailable ${key}` } }, 404);
  await assert.rejects(generateGemini({ ...args, model: 'gemini-retired' }), (error) => {
    assert.match(error.message, /404.*gemini-retired.*automatically/);
    assert.equal(error.message.includes(key), false);
    return true;
  });
  let quotaCalls = 0;
  globalThis.fetch = async () => { quotaCalls++; return json({ error: { message: 'Quota exhausted (503 mentioned in detail)' } }, 429); };
  await assert.rejects(generateGemini({ ...args, model: 'gemini-test-flash' }), /free-tier quota and billing/);
  assert.equal(quotaCalls, 1);
  let busyCalls = 0;
  globalThis.fetch = async () => { busyCalls++; return json({ error: { message: 'High demand' } }, 503); };
  await assert.rejects(generateGemini({ ...args, model: 'gemini-test-flash' }), /temporarily busy/);
  assert.equal(busyCalls, 3);

  calls.length = 0;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('?')) return json({ models: [
      { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
    ] });
    const attempted = calls.filter((call) => call.url.includes(':generateContent')).length;
    return attempted === 1
      ? json({ error: { message: 'Not available to this project' } }, 404)
      : json({ candidates: [] });
  };
  await generateGemini(args);
  const generations = calls.filter((call) => call.url.includes(':generateContent'));
  assert.match(generations[0].url, /gemini-3\.8-flash/);
  assert.match(generations[1].url, /gemini-3\.6-flash/);

  const overloadedCalls = [];
  const statuses = [];
  globalThis.fetch = async (url) => {
    overloadedCalls.push(url);
    return overloadedCalls.length === 1 ? json({ error: { message: 'High demand' } }, 503) : json({ candidates: [] });
  };
  await generateGemini({ ...args, onStatus: (message) => statuses.push(message) });
  assert.match(overloadedCalls[0], /gemini-3\.8-flash/);
  assert.match(overloadedCalls[1], /gemini-3\.6-flash/);
  assert.match(statuses[0], /Trying another Flash model/);

  const controller = new AbortController();
  let cancelledCalls = 0;
  globalThis.fetch = async () => { cancelledCalls++; return json({ error: { message: 'High demand' } }, 503); };
  await assert.rejects(generateGemini({ ...args, signal: controller.signal, onStatus: () => controller.abort() }), { name: 'AbortError' });
  assert.equal(cancelledCalls, 1);

  globalThis.fetch = async (url) => url.includes('pageToken=next')
    ? json({ models: [{ name: 'models/gemini-next-flash', supportedGenerationMethods: ['generateContent'] }] })
    : json({ models: [], nextPageToken: 'next' });
  assert.deepEqual(await listGeminiModels(key), ['gemini-next-flash']);
  globalThis.fetch = async (url) => url.includes('?') ? json({ models: [] }) : json({ error: { message: 'Model unavailable' } }, 404);
  await assert.rejects(generateGemini({ ...args, key: 'empty-model-test-key' }), /no stable Gemini Flash/);
  console.log('Gemini checks passed: discovery, pagination, model names, 404 recovery, quota errors and key redaction.');
} finally { globalThis.fetch = originalFetch; }
