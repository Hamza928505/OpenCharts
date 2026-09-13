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
import { getStoredApiKey } from './ai-config.js';

export const ENDPOINT = 'https://api.anthropic.com/v1/messages';
export const MODEL = 'claude-sonnet-5';
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

/* ── the call ────────────────────────────────────────────────────────────── */

/**
 * Ask, and hand back either a spec or a reason.
 *
 * @returns {Promise<{ ok: boolean, answer?: object, error?: string, reason?: string, raw?: string }>}
 */
export async function askAnalyst({ def, spec, request, key }) {
  const sentence = String(request || '').trim();
  if (!sentence) return { ok: false, reason: 'empty', error: 'Say what you want the chart to show.' };

  const apiKey = key || await getStoredApiKey();
  if (!apiKey) {
    return {
      ok: false,
      reason: 'no-key',
      error: 'No API key on this browser. Add one in AI Settings — it is stored here and sent only to Anthropic.',
    };
  }

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    messages: [{ role: 'user', content: buildAnalystMessage(def, spec, sentence) }],
  };

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        // Without this the API refuses a request made from a page, which is
        // exactly what this is. There is no server here to route through.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      error: `Could not reach api.anthropic.com — ${err.message}. `
        + 'A browser call is blocked by a network, a proxy or an extension far more often than by the API.',
    };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: 'auth', error: `The key was refused (${res.status}). Check it in AI Settings.` };
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch { /* nothing to add */ }
    return { ok: false, reason: 'http', error: `Anthropic answered ${res.status}. ${detail}` };
  }

  let payload;
  try { payload = await res.json(); } catch {
    return { ok: false, reason: 'malformed', error: 'That answer was not JSON.', raw: '' };
  }
  const text = (payload && Array.isArray(payload.content)
    ? payload.content.filter((p) => p && p.type === 'text').map((p) => p.text).join('')
    : '') || '';

  const parsed = parseAnswer(text);
  if (!parsed.ok) return { ok: false, reason: 'malformed', error: parsed.error, raw: text };
  return { ok: true, answer: parsed.answer, raw: text };
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
