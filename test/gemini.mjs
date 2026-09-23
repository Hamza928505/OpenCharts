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
  globalThis.fetch = async () => json({ error: { message: 'Quota exhausted' } }, 429);
  await assert.rejects(generateGemini({ ...args, model: 'gemini-test-flash' }), /free-tier quota and billing/);
  globalThis.fetch = async () => json({ error: { message: 'High demand' } }, 503);
  await assert.rejects(generateGemini({ ...args, model: 'gemini-test-flash' }), /temporarily busy/);

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

  globalThis.fetch = async (url) => url.includes('pageToken=next')
    ? json({ models: [{ name: 'models/gemini-next-flash', supportedGenerationMethods: ['generateContent'] }] })
    : json({ models: [], nextPageToken: 'next' });
  assert.deepEqual(await listGeminiModels(key), ['gemini-next-flash']);
  globalThis.fetch = async (url) => url.includes('?') ? json({ models: [] }) : json({ error: { message: 'Model unavailable' } }, 404);
  await assert.rejects(generateGemini({ ...args, key: 'empty-model-test-key' }), /no stable Gemini Flash/);
  console.log('Gemini checks passed: discovery, pagination, model names, 404 recovery, quota errors and key redaction.');
} finally { globalThis.fetch = originalFetch; }
