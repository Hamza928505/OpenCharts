const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
let cachedKey = '';
let cachedModels = null;

export function geminiModelName(value) {
  return String(value || '').trim().replace(/^models\//, '');
}

async function geminiError(response, key, model = '') {
  let detail = '';
  try { detail = String((await response.json()).error?.message || ''); } catch { /* Non-JSON gateway response. */ }
  if (key) detail = detail.split(key).join('[redacted]');
  const recovery = response.status === 404
    ? `Model "${model}" was not found or is unavailable. The app will select a current Flash model automatically on your next message.`
    : response.status === 429 ? 'Gemini quota is exhausted or unavailable for this model. Check your project’s free-tier quota and billing in Google AI Studio, or switch to a local model.'
    : response.status === 503 || response.status === 504 ? 'Gemini is temporarily busy. Wait a moment and send your message again.'
    : response.status === 400 || response.status === 401 || response.status === 403
      ? 'Check your Google AI Studio key, its restrictions, and model access.'
      : 'Try again later or check your Gemini configuration.';
  return new Error(`Gemini (${response.status}): ${recovery}${detail ? ' ' + detail.slice(0, 500) : ''}`);
}

/** Google's current catalogue, restricted to conversational text generation. */
export async function listGeminiModels(key, signal) {
  const models = [];
  let pageToken = '';
  const seen = new Set();
  do {
    const query = new URLSearchParams({ pageSize: '1000' });
    if (pageToken) query.set('pageToken', pageToken);
    const response = await fetch(`${BASE}?${query}`, { headers: { 'x-goog-api-key': key }, signal });
    if (!response.ok) throw await geminiError(response, key);
    const payload = await response.json();
    for (const model of payload.models || []) {
      const name = geminiModelName(model.name);
      if (/^gemini-[a-z0-9.-]+$/i.test(name)
        && !/image|tts|audio|robotics|computer-use|deep-research/i.test(name)
        && model.supportedGenerationMethods?.includes('generateContent')) models.push(name);
    }
    pageToken = payload.nextPageToken || '';
    if (seen.has(pageToken)) throw new Error('Gemini returned a repeated model-list page. Try again.');
    seen.add(pageToken);
  } while (pageToken);
  return [...new Set(models)];
}

export async function generateGemini({ key, model, system, message, signal, onStatus }) {
  let name = geminiModelName(model);
  if (!name) {
    if (cachedKey !== key) {
      cachedKey = key;
      cachedModels = listGeminiModels(key, signal).catch((error) => {
        cachedKey = '';
        cachedModels = null;
        throw error;
      });
    }
    const models = await cachedModels;
    const ranked = models.filter((id) => /flash/.test(id) && !/preview|exp|live|image|tts/i.test(id))
      .sort((a, b) => {
        const version = (id) => Number((id.match(/^gemini-(\d+(?:\.\d+)?)-flash/i) || [])[1] || 0);
        return version(b) - version(a);
      });
    if (!ranked.length) throw new Error('Google listed no stable Gemini Flash text model for this key. Check the key’s project and model access in AI Studio.');
    return generateWithFallback(ranked, key, system, message, signal, onStatus);
  }
  if (!/^gemini-[a-z0-9.-]+$/i.test(name)) throw new Error('Enter a Gemini model ID, or load Gemini models in AI provider.');
  return generateWithFallback([name], key, system, message, signal, onStatus);
}

function waitForRetry(ms, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

async function generateWithFallback(names, key, system, message, signal, onStatus) {
  let lastError;
  let index = 0;
  // Bound total requests, including fallback models, so a service outage never loops.
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted();
    const name = names[index];
    const response = await fetch(`${BASE}/${encodeURIComponent(name)}:generateContent`, {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    });
    if (response.ok) return response;
    lastError = await geminiError(response, key, name);
    const overloaded = [500, 503, 504].includes(response.status);
    if (attempt === 2) break;
    if (response.status === 404 && index + 1 < names.length) {
      index++;
      onStatus?.('This Gemini model is unavailable. Trying another Flash model…');
      continue;
    }
    if (!overloaded) throw lastError;
    const next = Math.min(index + 1, names.length - 1);
    onStatus?.(`Gemini is busy. ${next !== index ? 'Trying another Flash model' : 'Retrying'} (${attempt + 2}/3)…`);
    index = next;
    await waitForRetry(1000 * 2 ** attempt, signal);
  }
  if (lastError?.message.includes('404')) { cachedKey = ''; cachedModels = null; }
  throw lastError || new Error('No available Gemini Flash model was found for this key.');
}
