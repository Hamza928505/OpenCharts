const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function geminiModelName(value) {
  return String(value || '').trim().replace(/^models\//, '');
}

async function geminiError(response, key, model = '') {
  let detail = '';
  try { detail = String((await response.json()).error?.message || ''); } catch { /* Non-JSON gateway response. */ }
  if (key) detail = detail.split(key).join('[redacted]');
  const recovery = response.status === 404
    ? `Model "${model}" was not found or is unavailable for this request. Open AI provider, load Gemini models and choose a supported model.`
    : response.status === 429 ? 'Quota or rate limit reached. Check your Gemini quota, try later, or choose a local provider.'
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

export async function generateGemini({ key, model, system, message, signal }) {
  let name = geminiModelName(model);
  if (!name) {
    const models = await listGeminiModels(key, signal);
    name = models.find((id) => /flash/.test(id) && !/preview|exp/.test(id))
      || models.find((id) => /flash/.test(id));
    if (!name) throw new Error('No Gemini Flash model was listed. Open AI provider, load Gemini models and select a model explicitly.');
  }
  if (!/^gemini-[a-z0-9.-]+$/i.test(name)) throw new Error('Enter a Gemini model ID, or load Gemini models in AI provider.');
  const response = await fetch(`${BASE}/${encodeURIComponent(name)}:generateContent`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: message }] }],
    }),
  });
  if (!response.ok) throw await geminiError(response, key, name);
  return response;
}
