/**
 * analyst.js — "revenue by region, highlight the North", answered as a chart.
 *
 * The AI Prompt tab hands a brief to an assistant somewhere else and asks the
 * reader to carry the answer back. This closes that loop inside the studio: the
 * table already on screen, the catalogue of what this library can draw, and one
 * sentence from the reader go to the Anthropic Messages API, and what comes
 * back is a `{ chart, spec }` — the same object the Spec view prints.
 *
 * Four rules, and the first two are why this is only a hundred lines:
 *
 * - **The answer lands through the door a pasted spec uses.** `_applySpec`
 *   merges over `newSpec`, opens another chart when the id differs, and joins
 *   the undo history. So there is no second way into the studio's state, and
 *   nothing the model says can reach past that one function.
 * - **Nothing is applied unseen.** The reply is previewed as JSON with a
 *   summary of what it changes, and Apply is a button. A model that renamed
 *   every series would otherwise do it silently.
 * - **The request goes straight from the browser to Anthropic.** There is no
 *   server in this project and this does not add one: the key is read out of
 *   `ai-config.js` into a header and never into the body, and the reader pays
 *   for their own calls.
 * - **A failure is a message.** No key, a refused key, a blocked request and a
 *   reply that is not a spec are four different things, and each says which.
 */

import { CHARTS, getChart } from './registry.js';
import { expectedFormat, toCSV } from './dataio.js';
import { SHAPE_GUIDE } from './prompt.js';
import { facetSource } from './facet.js';
import { getAiSettings, getStoredApiKey } from './ai-config.js';
import { generateGemini } from './gemini.js';
import { resolveProvider, listProviderModels } from './ai-providers.js';
import { CHAT_SCHEMA, CHAT_SYSTEM, parseChatAnswer, buildChatCharts, unsupportedFormat } from './ai-response.js';
export { parseChatAnswer } from './ai-response.js';

export const ENDPOINT = 'https://api.anthropic.com/v1/messages';
export const API_VERSION = '2023-06-01';
const MAX_TOKENS = 4096;

/** How much of a long table to send. The shape matters; five hundred rows do not. */
const TABLE_ROWS = 40;

const SYSTEM = [
  'You configure charts for OpenCharts, a chart library whose charts are plain',
  'JSON specs. You are given the table a reader is working on, the chart they',
  'are looking at, the catalogue of charts available, and one sentence saying',
  'what they want.',
  '',
  'Reply with exactly one JSON object and nothing else — no prose, no markdown',
  'fence, no explanation:',
  '',
  '  { "chart": "<a chart id from the catalogue>", "spec": { ... } }',
  '',
  'Rules:',
  '- "chart" must be one of the ids listed. Keep the current chart unless the',
  '  request calls for a different one.',
  '- "spec" is merged over the chart\'s own defaults, so send only the fields',
  '  you are changing. The current spec is given so you can see the shape.',
  '- Every number you put in the spec must come from the reader\'s table. Never',
  '  invent data, and never write a placeholder value.',
  '- Colours are "#rrggbb" strings. To highlight one item, give it a different',
  '  colour from the rest rather than adding anything new.',
  '- A title or a source line goes in "caption": { "title", "subtitle",',
  '  "source", "sourceUrl", "byline" }.',
].join('\n');

/* ── the brief ───────────────────────────────────────────────────────────── */

/** One catalogue line per chart: what it is, and what table it reads. */
export function catalogueLines() {
  return CHARTS.map((def) => {
    const shape = (def.data && def.data.shape) || '';
    return `${def.id} — ${def.title} (${def.category}; data shape: ${shape || 'n/a'}). ${def.blurb}`;
  });
}

/** The table the reader is actually looking at, cut to a readable length. */
export function tableFor(def, spec) {
  // A faceted spec no longer holds the column it was split by, so `toText`
  // would write a table with the split already spent — the same substitution
  // `a11y.js` and the prompt make.
  let text = '';
  try {
    const source = facetSource(spec);
    text = source
      ? toCSV(source.headers, source.rows)
      : (typeof def.toText === 'function' ? def.toText(spec) : '');
  } catch { text = ''; }
  const lines = String(text || '').trim().split('\n');
  if (lines.length <= TABLE_ROWS + 1) return { text: lines.join('\n'), cut: 0 };
  return { text: lines.slice(0, TABLE_ROWS + 1).join('\n'), cut: lines.length - (TABLE_ROWS + 1) };
}

/**
 * The message body. Exported so the suite can assert what is sent — and what
 * is not: the key belongs in a header and nowhere else.
 */
export function buildAnalystMessage(def, spec, request) {
  const expected = expectedFormat(def);
  const shape = (def.data && def.data.shape) || '';
  const table = tableFor(def, spec);

  return [
    `The reader asks: ${String(request || '').trim()}`,
    '',
    `They are looking at "${def.title}" (id: ${def.id}).`,
    shape ? `Its data shape is "${shape}": ${SHAPE_GUIDE[shape] || ''}` : '',
    expected && expected.columns && expected.columns.length
      ? `Its columns are: ${expected.columns.join(', ')}.`
      : '',
    '',
    'Their table, as CSV:',
    '```',
    table.text,
    '```',
    table.cut ? `(${table.cut} more rows follow in the same shape.)` : '',
    '',
    'The current spec:',
    '```json',
    JSON.stringify(spec, null, 2),
    '```',
    '',
    'The charts available, one per line:',
    '```',
    catalogueLines().join('\n'),
    '```',
    '',
    'Reply with the one JSON object.',
  ].filter((line) => line !== '').join('\n');
}

async function callProvider(settings, message, system, signal, schema, onStatus, budget) {
  const apiKey = settings.key;
  let res;
  try {
    if (settings.provider === 'gemini') {
      res = await generateGemini({ key: apiKey, model: settings.model, system, message, signal, schema, onStatus, budget });
    } else if (settings.provider === 'anthropic') {
      res = await fetch(ENDPOINT, {
        method: 'POST', signal, credentials: 'omit', redirect: 'error',
        headers: {
          'content-type': 'application/json', 'x-api-key': apiKey,
          'anthropic-version': API_VERSION, 'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: settings.model, max_tokens: MAX_TOKENS, system,
          messages: [{ role: 'user', content: message }],
          ...(schema ? { output_config: { format: { type: 'json_schema', schema } } } : {}),
        }),
      });
    } else {
      const headers = { 'content-type': 'application/json' };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      res = await fetch(settings.endpoint, {
        method: 'POST', headers, signal, credentials: 'omit', redirect: 'error',
        body: JSON.stringify({
          model: settings.model, max_tokens: MAX_TOKENS,
          messages: [{ role: 'system', content: system }, { role: 'user', content: message }],
          ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: 'opencharts_reply', strict: true, schema } } } : {}),
        }),
      });
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    if (schema && err.unsupportedFormat) return { ok: false, reason: 'format', error: err.message };
    if (settings.provider === 'gemini') return { ok: false, reason: 'provider', error: err instanceof TypeError ? 'Could not reach Gemini. Check your network and browser access.' : err.message };
    return { ok: false, reason: 'network', error: 'Could not reach this AI provider. Check its address and network. If it blocks browser access (CORS), use a trusted local proxy in Advanced settings.' };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: 'auth', error: `The API key was refused (${res.status}). Check AI Settings.` };
  if (res.status === 429) return { ok: false, reason: 'limit', error: 'This provider is out of free capacity. Try again later, or switch to your own API key or local model in AI Settings.' };
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (schema && unsupportedFormat(res.status, detail)) return { ok: false, reason: 'format', error: 'This endpoint does not support native structured output.' };
    return { ok: false, reason: 'http', error: `The AI provider answered ${res.status}. Check this model’s availability and chat support; choose another model in Advanced settings if needed.` };
  }

  let payload;
  try { payload = await res.json(); } catch { return { ok: false, reason: 'malformed', error: 'That answer was not JSON.', raw: '' }; }
  const candidate = payload?.candidates?.[0];
  const choice = payload?.choices?.[0];
  const finish = candidate?.finishReason || choice?.finish_reason || payload?.stop_reason;
  if (['MAX_TOKENS', 'length', 'max_tokens'].includes(finish)) return { ok: false, reason: 'malformed', error: 'The model reached its output limit. Return only a short message and compact chart plans.', raw: '' };
  if (payload?.promptFeedback?.blockReason || choice?.message?.refusal || ['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'content_filter', 'refusal'].includes(finish)) {
    return { ok: false, reason: 'blocked', error: 'The provider declined this request. Try rephrasing it; no chart was drawn.' };
  }
  const content = settings.provider === 'gemini' ? candidate?.content?.parts
    : settings.provider === 'anthropic' ? payload?.content : choice?.message?.content;
  const text = typeof content === 'string' && settings.provider !== 'anthropic' && settings.provider !== 'gemini'
    ? content : Array.isArray(content) ? content.filter((part) => part && !part.thought
      && (settings.provider !== 'anthropic' || part.type === 'text'))
      .map((part) => typeof part.text === 'string' ? part.text : '').join('') : '';
  return { ok: true, raw: text };
}

/* ── the call ────────────────────────────────────────────────────────────── */

/**
 * Ask, and hand back either a spec or a reason.
 *
 * @returns {Promise<{ ok: boolean, answer?: object, error?: string, reason?: string, raw?: string }>}
 */
export async function askAnalyst({ def, spec, request, key, conversation, table, chartContext, signal, onStatus }) {
  const sentence = String(request || '').trim();
  if (!sentence) return { ok: false, reason: 'empty', error: 'Say what you want the chart to show.' };

  let settings = await getAiSettings();
  const apiKey = key || settings.key || await getStoredApiKey();
  if (!apiKey && settings.provider !== 'openai') {
    return {
      ok: false,
      reason: 'no-key',
      error: 'Add your API key in AI Settings, or configure a local model in Advanced settings to start chatting.',
    };
  }
  try {
    settings = resolveProvider({ ...settings, key: apiKey });
    if (!settings.model && settings.provider !== 'gemini') {
      onStatus?.('Finding an available chat model…');
      settings.model = (await listProviderModels(settings, signal))[0];
    }
  } catch (error) {
    return { ok: false, reason: 'provider', error: error.message };
  }

  const chat = Array.isArray(conversation);
  const system = chat ? CHAT_SYSTEM + '\nResponse JSON schema: ' + JSON.stringify(CHAT_SCHEMA) : SYSTEM;
  const message = chat ? JSON.stringify({
    request: sentence, conversation: conversation.slice(-12),
    table: table ? { headers: table.headers, rows: table.rows.slice(0, TABLE_ROWS), totalRows: table.rows.length } : null,
    columns: table?.headers.map((name, index) => ({ index, name })) || [],
    currentChart: chartContext || (def ? { chart: def.id, spec } : null),
    catalogue: table || def ? CHARTS.filter((item) => item.data).map((item) => {
      const expected = expectedFormat(item);
      return { id: item.id, title: item.title, shape: expected.shape, columns: item.id === 'histogram' ? ['numeric value'] : expected.columns, min: expected.min, exact: item.id === 'histogram' ? 1 : expected.exact };
    }) : [],
    shapes: table || def ? SHAPE_GUIDE : {},
    note: 'Only the first 40 rows are sent for reasoning. Chart plans are applied to ALL rows locally. Do not copy sampled values into the reply.',
  }) : buildAnalystMessage(def, spec, sentence);
  let schema = chat ? CHAT_SCHEMA : null;
  let repair = '';
  const budget = { remaining: 3 };
  // At most one unsupported-format fallback and one content-repair request.
  // HTTP/auth/quota failures are not malformed content and are never repaired.
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted();
    const brief = repair ? JSON.stringify({ ...JSON.parse(message), repair: `Your previous answer failed validation: ${repair} Regenerate a complete, compact response matching the schema.` }) : message;
    const response = await callProvider(settings, brief, system, signal, schema, onStatus, budget);
    if (!response.ok && response.reason === 'format' && schema) {
      schema = null;
      onStatus?.('This model needs prompt-based JSON. Keeping the same response validation…');
      continue;
    }
    if (!response.ok && response.reason !== 'malformed') return response;
    let parsed = response.ok ? (chat ? parseChatAnswer(response.raw) : parseAnswer(response.raw)) : response;
    if (parsed.ok && chat) parsed = buildChatCharts(parsed.answer, table);
    if (parsed.ok) return { ok: true, answer: parsed.answer, raw: response.raw };
    if (!chat || repair) return { ok: false, reason: 'malformed', error: chat
      ? `The model could not produce a valid chart reply after one repair. ${parsed.error} Your data is unchanged; try a different model or more specific columns.`
      : parsed.error, raw: response.raw || '' };
    repair = parsed.error;
    onStatus?.('Checking the chart response and asking the model to correct its format…');
  }
  return { ok: false, reason: 'malformed', error: 'The model could not produce a supported chart response. Try another model; your data is unchanged.' };
}

/**
 * Read the one JSON object out of a reply.
 *
 * A fence is tolerated because models add them; anything else is refused with
 * the raw text kept, so the reader can see what came back rather than a blank
 * panel where a chart should be.
 */
export function parseAnswer(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const body = fenced ? fenced[1] : trimmed;
  let parsed;
  try { parsed = JSON.parse(body); } catch (err) {
    return { ok: false, error: `That answer was not one JSON object — ${err.message}` };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'That answer was not a JSON object.' };
  }
  if (typeof parsed.chart !== 'string' || !getChart(parsed.chart)) {
    return { ok: false, error: `That answer names "${parsed.chart}", which is not a chart in this library.` };
  }
  if (!parsed.spec || typeof parsed.spec !== 'object' || Array.isArray(parsed.spec)) {
    return { ok: false, error: 'That answer carried no "spec" object.' };
  }
  return { ok: true, answer: { chart: parsed.chart, spec: parsed.spec } };
}

/**
 * What applying it would change — the chart, and which top-level fields.
 *
 * A preview that showed only JSON would make the reader diff two documents by
 * eye; this is the sentence above it.
 */
export function diffSummary(def, spec, answer) {
  const parts = [];
  if (answer.chart !== def.id) {
    const next = getChart(answer.chart);
    parts.push(`opens ${next ? next.title : answer.chart}`);
  }
  const changed = Object.keys(answer.spec).filter((key) => {
    if (key.startsWith('_')) return false;
    return JSON.stringify(spec[key]) !== JSON.stringify(answer.spec[key]);
  });
  if (changed.length) parts.push(`changes ${changed.join(', ')}`);
  if (!parts.length) parts.push('changes nothing');
  return parts.join('; ');
}
