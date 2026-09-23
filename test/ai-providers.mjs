import assert from 'node:assert/strict';
import { detectProvider, resolveProvider, safeEndpoint, listProviderModels } from '../js/studio/ai-providers.js';
import { setAiSettings, clearAiSettings } from '../js/studio/ai-config.js';
import { askAnalyst } from '../js/studio/analyst.js';

const originalFetch = globalThis.fetch;
const cases = [
  ['AIza-test', 'gemini', 'generativelanguage.googleapis.com', 'gemini-3.8-flash'],
  ['sk-ant-test', 'anthropic', 'api.anthropic.com', 'claude-haiku-test'],
  ['nvapi-test', 'nvidia', 'integrate.api.nvidia.com', 'nvidia/nemotron-nano-test'],
  ['xai-test', 'xai', 'api.x.ai', 'grok-fast-test'],
];
try {
  for (const [key, provider, host, model] of cases) {
    assert.equal(detectProvider(` ${key} `), provider);
    await setAiSettings({ provider: 'auto', key });
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      assert.equal(new URL(url).host, host, 'key must only go to its detected service');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.ok(Object.values(options.headers).includes(provider === 'gemini' || provider === 'anthropic' ? key : `Bearer ${key}`));
      assert.ok(!String(url).includes(key));
      assert.ok(!String(options.body).includes(key));
      if (!options.body) return Response.json(provider === 'gemini'
        ? { models: [{ name: `models/${model}`, supportedGenerationMethods: ['generateContent'] }] }
        : { data: [{ id: 'image-generator' }, { id: 'embed-large' }, { id: model }] });
      if (provider !== 'gemini') assert.equal(JSON.parse(options.body).model, model);
      const text = '{"message":"Hello from your chosen service."}';
      return Response.json(provider === 'gemini' ? { candidates: [{ content: { parts: [{ text }] } }] }
        : provider === 'anthropic' ? { content: [{ type: 'text', text }] }
          : { choices: [{ message: { content: text } }] });
    };
    assert.equal((await askAnalyst({ request: 'hi', conversation: [] })).ok, true);
    assert.equal(calls.length, 2, 'one discovery and one generation, no cross-provider probing');
  }

  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Unexpected request'); };
  for (const key of ['sk-ambiguous', 'unknown-key', '']) {
    assert.equal(detectProvider(key), null);
    await setAiSettings({ provider: 'auto', key });
    assert.equal((await askAnalyst({ request: 'hi', conversation: [] })).ok, false);
  }
  for (const endpoint of ['http://remote.example/v1', 'https://user:secret@host.example/v1', 'https://host.example/v1?key=secret', 'file:///tmp/key', 'not-a-url']) {
    assert.throws(() => safeEndpoint(endpoint));
    await setAiSettings({ provider: 'openai', endpoint, key: 'secret' });
    assert.equal((await askAnalyst({ request: 'hi', conversation: [] })).ok, false);
  }
  assert.equal(requests, 0, 'unknown keys and unsafe endpoints never make requests');
  assert.equal(resolveProvider({ provider: 'openai', endpoint: 'http://localhost:11434/v1', key: '' }).endpoint,
    'http://localhost:11434/v1/chat/completions');

  // Explicit custom models bypass discovery, including provider-specific model IDs.
  await setAiSettings({ provider: 'openai', endpoint: 'https://custom.example/api/v1/', model: 'some-owner/random-model', key: 'custom-secret' });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://custom.example/api/v1/chat/completions');
    assert.equal(JSON.parse(options.body).model, 'some-owner/random-model');
    return Response.json({ choices: [{ message: { content: '{"message":"Custom model works."}' } }] });
  };
  assert.equal((await askAnalyst({ request: 'hi', conversation: [] })).ok, true);

  const local = { provider: 'openai', endpoint: 'http://localhost:11434/v1', key: '' };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:11434/v1/models');
    assert.equal(options.headers.Authorization, undefined);
    return Response.json({ data: [{ id: 'embed-small' }, { id: 'local-chat' }] });
  };
  assert.deepEqual(await listProviderModels(local), ['local-chat']);
  globalThis.fetch = async () => Response.json({ data: [{ id: 'embed-only' }] });
  await assert.rejects(listProviderModels(local), /No chat models/);
  for (const status of [401, 429, 503]) {
    globalThis.fetch = async () => new Response('secret error body', { status });
    await assert.rejects(listProviderModels(local), new RegExp(`failed \\(${status}\\)`));
  }
  globalThis.fetch = async () => { throw new TypeError('secret network detail'); };
  await assert.rejects(listProviderModels(local), /CORS/);
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_, { signal }) => signal.throwIfAborted();
  await assert.rejects(listProviderModels(local, controller.signal), { name: 'AbortError' });
  console.log('AI providers: key-only routing, model discovery, custom/local overrides and credential boundaries passed.');
} finally {
  globalThis.fetch = originalFetch;
  clearAiSettings();
}
