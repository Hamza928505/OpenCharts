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
      { name: 'models/gemini-test-flash', supportedGenerationMethods: ['generateContent'] },
    ] });
    return json({ candidates: [] });
  };
  await generateGemini(args);
  assert.match(calls[1].url, /\/models\/gemini-test-flash:generateContent$/);
  calls.length = 0;
  await generateGemini({ ...args, model: ' models/gemini-test-flash ' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/models\/gemini-test-flash:generateContent$/);
  assert.equal(calls[0].url.includes('%2F'), false);

  globalThis.fetch = async () => json({ error: { message: `Model unavailable ${key}` } }, 404);
  await assert.rejects(generateGemini({ ...args, model: 'gemini-retired' }), (error) => {
    assert.match(error.message, /404.*gemini-retired.*load Gemini models/);
    assert.equal(error.message.includes(key), false);
    return true;
  });
  globalThis.fetch = async () => json({ error: { message: 'Quota exhausted' } }, 429);
  await assert.rejects(generateGemini({ ...args, model: 'gemini-test-flash' }), /Quota or rate limit/);

  globalThis.fetch = async (url) => url.includes('pageToken=next')
    ? json({ models: [{ name: 'models/gemini-next-flash', supportedGenerationMethods: ['generateContent'] }] })
    : json({ models: [], nextPageToken: 'next' });
  assert.deepEqual(await listGeminiModels(key), ['gemini-next-flash']);
  globalThis.fetch = async () => json({ models: [] });
  await assert.rejects(generateGemini(args), /No Gemini Flash model/);
  console.log('Gemini checks passed: discovery, pagination, model names, 404 recovery, quota errors and key redaction.');
} finally { globalThis.fetch = originalFetch; }
