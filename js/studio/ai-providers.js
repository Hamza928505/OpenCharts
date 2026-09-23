import { listGeminiModels } from './gemini.js';

export const PROVIDERS = {
  auto: { label: 'Automatic — detect from key' },
  gemini: { label: 'Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models' },
  anthropic: { label: 'Anthropic', endpoint: 'https://api.anthropic.com/v1/messages' },
  nvidia: { label: 'NVIDIA', endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions' },
  xai: { label: 'xAI / Grok', endpoint: 'https://api.x.ai/v1/chat/completions' },
  openai: { label: 'Custom / local (OpenAI-compatible)' },
};

/** A local hint, not key validation. Never probe multiple services with a secret. */
export function detectProvider(key) {
  const value = String(key || '').trim();
  if (/^AIza[\w-]+$/.test(value)) return 'gemini';
  if (/^sk-ant-[\w-]+$/.test(value)) return 'anthropic';
  if (/^nvapi-[\w-]+$/.test(value)) return 'nvidia';
  if (/^xai-[\w-]+$/.test(value)) return 'xai';
  return null; // Generic sk- keys are shared by unrelated providers.
}

export function safeEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a valid API endpoint in Advanced settings.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Use an endpoint without credentials, query parameters or fragments. Put your key in the API key field.');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('Use HTTPS, or an HTTP endpoint on this device.');
  }
  return url.href;
}

export function resolveProvider(settings) {
  if (!settings.key && settings.provider !== 'openai') throw new Error('Enter your API key, or configure a local model in Advanced settings.');
  const provider = settings.provider === 'auto' ? detectProvider(settings.key) : settings.provider;
  if (!provider || !Object.hasOwn(PROVIDERS, provider) || provider === 'auto') {
    throw new Error('This key format does not identify its service. Open Advanced settings and choose the provider or enter its endpoint. Nothing was sent.');
  }
  let endpoint = PROVIDERS[provider].endpoint || settings.endpoint;
  endpoint = safeEndpoint(endpoint);
  if (provider === 'openai') {
    // Accept either a base URL or the full chat endpoint.
    const url = new URL(endpoint);
    url.pathname = url.pathname.replace(/\/$/, '');
    if (!url.pathname.endsWith('/chat/completions')) url.pathname += '/chat/completions';
    endpoint = url.href;
  }
  return { ...settings, provider, endpoint };
}

/** Only the selected destination receives the key; never follow credential redirects. */
export async function listProviderModels(settings, signal) {
  const config = resolveProvider(settings);
  if (config.provider === 'gemini') return listGeminiModels(config.key, signal);
  const headers = config.provider === 'anthropic'
    ? { 'x-api-key': config.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
    : config.key ? { Authorization: `Bearer ${config.key}` } : {};
  const url = new URL(config.endpoint);
  url.pathname = url.pathname.replace(/\/(chat\/completions|messages)$/, '/models');
  if (config.provider === 'anthropic') url.searchParams.set('limit', '1000');
  let response;
  try {
    response = await fetch(url.href, { headers, signal, credentials: 'omit', redirect: 'error' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Cannot load models. Check the endpoint and network. If the provider blocks browser access (CORS), use a trusted local proxy in Advanced settings.');
  }
  if (!response.ok) throw new Error(`Model discovery failed (${response.status}). Check your key and quota, or specify a model in Advanced settings if this endpoint does not support listing models.`);
  const payload = await response.json();
  // ponytail: compatible APIs do not share capability metadata; filter obvious non-chat
  // IDs and prefer instruct/chat names. Advanced model override covers unusual catalogues.
  const models = [...new Set((Array.isArray(payload.data) ? payload.data : [])
    .filter((m) => !Array.isArray(m.output_modalities) || m.output_modalities.includes('text'))
    .map((m) => m.id).filter((id) => typeof id === 'string' && id.trim()
      && !/embed|rerank|reward|moderation|whisper|tts|audio|image|video|diffusion|flux|dall-e|guard/i.test(id)))];
  const score = (id) => Number(/instruct|chat|grok|claude|nemotron/i.test(id)) * 2
    + Number(/flash|fast|mini|nano|haiku/i.test(id)) - Number(/preview|experimental/i.test(id));
  models.sort((a, b) => score(b) - score(a) || b.localeCompare(a, 'en', { numeric: true }));
  if (!models.length) throw new Error('No chat models were listed. Choose a model in Advanced settings or check this key’s model access.');
  return models;
}
