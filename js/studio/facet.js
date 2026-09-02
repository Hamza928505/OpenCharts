/**
 * facet.js — small multiples as an operation, rather than three charts that
 * happen to be small.
 *
 * A facet takes one chart and one column and returns a grid: the same
 * encoding, drawn once per value of that column. Vega-Lite's `facet` is the
 * reference, and the reason it is worth having here is that this library has
 * already solved the two hard halves of it. `rankCharts` will project a
 * 45-column export down to the columns a chart can read, and `transform.js`
 * will fold five hundred transactions into seven rows — but both of them
 * answer the wide-table problem by *throwing a column away*. A file of
 * `Region, Month, Sales` offered to a line chart loses Region, or lumps four
 * regions into one line. Faceting is the third answer: keep the column, and
 * spend it on panels.
 *
 * ── What a facet is allowed to be ────────────────────────────────────────
 *
 * The library's one hard rule is that **a renderer reads its data from the
 * spec and nothing else**. A facet does not bend it. It produces N *complete
 * specs*, each holding literal values, and hands each one to the very same
 * `draw` / `mount` / `build` the unfaceted chart uses. No renderer knows this
 * feature exists, and not one of the 114 was touched to add it — the same
 * bargain `annotate.js` made, and for the same reason: a contract that needs
 * every renderer to cooperate is a contract with 114 chances to be wrong.
 *
 * `panelSpecs()` is the one place panels are derived, and both the live
 * preview and the exported code go through it. It may use imports freely
 * because only its *return value* is serialised — the Chart.js `build()`
 * bargain, stated in "One build function, two outputs".
 *
 * ── Two ways to name the column ──────────────────────────────────────────
 *
 * Both are "facet by a column"; they differ in which way the table is cut.
 *
 * - **`series`** — one panel per series. In the layout most of this library
 *   uses, a series *is* a column: `Month, North, South` holds two of them. So
 *   this is a column split, and it is the one that needs no new data, which is
 *   what makes the feature reachable at all. A chart opens on its example and
 *   can be faceted immediately; a feature only usable after somebody pastes
 *   the right kind of file is a feature almost nobody finds.
 * - **`value`** — one panel per distinct value *down* a column. This is the
 *   wide-file case above, and the column it splits on is by definition one the
 *   chart could not read, so it appears only once a table carrying one has
 *   been brought in.
 *
 * ── Scales, and what is honestly on offer ────────────────────────────────
 *
 * Small multiples are comparable only if the panels share an axis, and this is
 * the one place the "ask the renderers for nothing" design has a real cost: a
 * domain lives inside whichever `draw` computed it, privately, inside the very
 * function that gets serialised. There is no scale object to resolve.
 *
 * So the offer is exact rather than generous. Where a chart already exposes an
 * axis bound as a control — `Axis maximum`, `Axis minimum`, `Scale maximum` —
 * the union extent across the panels is written into every panel's spec and
 * the scales genuinely match. Where it does not, the panels scale to their own
 * data, and **the control says so, in those words, and so does the accessible
 * description**. That is why `scaleSharing()` returns a sentence rather than a
 * boolean: a grid of small multiples that looks comparable and is not would be
 * a worse thing to ship than one that admits it.
 *
 * Nothing in this file is serialised into an export. The panels are baked to
 * literal specs before they get there and the grid is CSS, so an exported
 * faceted chart carries no facet engine — the trade `transform.js` makes, one
 * step further along.
 */

import { applyData } from './dataio.js';

/**
 * How many panels will be drawn, at most.
 *
 * A column with 137 distinct values is a real thing to be handed, and 137
 * charts is a dead tab rather than a visualisation. The cap is stated out loud
 * wherever it bites — see `facetNote()` — rather than quietly truncating,
 * because a grid silently missing two thirds of the data is the exact failure
 * this library is written against.
 */
export const MAX_PANELS = 24;

/**
 * Which spec field holds "the series", per data shape.
 *
 * Keyed by shape rather than sniffed from the spec: a generic "find an array
 * of objects with a label" would also find `items`, where each entry is one
 * bar rather than one series, and faceting a bar chart into one panel per bar
 * is a grid of single bars — legal, useless, and offered by mistake.
 */
const SERIES_SHAPES = {
  labelSeries: 'series',
  rowSeries: 'series',
  observations: 'groups',
  xyGroups: 'groups',
};

/** The array a series facet splits, or null if this chart has no such thing. */
export function seriesKeyOf(def) {
  const desc = def && def.data;
  if (!desc) return null;
  const fallback = SERIES_SHAPES[desc.shape];
  if (!fallback) return null;
  return desc.key || fallback;
}

/** The control the registry attaches to every chart that takes a table. */
export const FACET_CONTROL = {
  group: 'Small multiples',
  type: 'facet',
  key: 'facet',
  label: 'Split into panels',
};

/** Whether this spec is asking for a grid. */
export const isFaceted = (spec) =>
  !!(spec && spec.facet && (spec.facet.kind === 'series' || spec.facet.kind === 'value'));

const clone = (v) => (typeof structuredClone === 'function'
  ? structuredClone(v)
  : JSON.parse(JSON.stringify(v)));

/**
 * The spec a panel starts from: everything the reader has set, minus the two
 * fields belonging to the grid rather than to any chart inside it.
 *
 * `annotations` is stripped for the same reason `specForCode` strips it — a
 * note is laid over the plate, and with a facet the plate is the whole grid.
 * Painting every note into every panel would multiply one remark by twelve.
 */
function baseSpec(spec) {
  const { facet, annotations, ...rest } = spec;
  return rest;
}

/* ── deriving the panels ─────────────────────────────────────────────────── */

/** One panel per series, by handing each panel a one-entry series list. */
function seriesPanels(def, base) {
  const key = seriesKeyOf(def);
  if (!key) return null;
  const list = base[key];
  if (!Array.isArray(list) || list.length < 2) return null;
  return list.slice(0, MAX_PANELS).map((entry, i) => ({
    name: String((entry && entry.label != null && entry.label !== '') ? entry.label : `Series ${i + 1}`),
    spec: { ...clone(base), [key]: [clone(entry)] },
  }));
}

/** Rows grouped by one column's value, first seen first — never sorted. */
export function groupRows(table, col) {
  const order = [];
  const buckets = new Map();
  for (const row of (table && table.rows) || []) {
    const key = String(row[col] == null ? '' : row[col]).trim();
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
    buckets.get(key).push(row);
  }
  return { order, buckets };
}

/**
 * One panel per distinct value down `facet.by`.
 *
 * The facet column is dropped from each sub-table before it is read, because a
 * chart's shape counts columns from the left and a spare one on the front
 * would be read as its labels. Each sub-table then goes through `applyData` —
 * the same door a paste comes in by — so a chart's own `onData` hook runs per
 * panel, and the shapes that rebuild a matrix or split a butterfly get their
 * chance on each one.
 */
function valuePanels(def, base, facet) {
  const src = facet.source;
  if (!src || !Array.isArray(src.rows) || !src.rows.length) return null;
  const col = (src.headers || []).indexOf(facet.by);
  if (col < 0) return null;

  const { order, buckets } = groupRows(src, col);
  const headers = src.headers.filter((_, i) => i !== col);

  const panels = [];
  for (const name of order.slice(0, MAX_PANELS)) {
    const rows = buckets.get(name).map((r) => r.filter((_, i) => i !== col));
    const panel = clone(base);
    const res = applyData(def, panel, { headers, rows });
    // A panel the chart cannot read is dropped rather than drawn empty: a
    // blank plate in a grid of twelve says nothing about which one went wrong.
    if (res.ok) panels.push({ name: name || '—', spec: panel });
  }
  return panels.length ? panels : null;
}

/* ── shared scales ───────────────────────────────────────────────────────── */

/**
 * The controls that genuinely name an axis bound.
 *
 * Matched on the label, not the key, and that is not fussiness: `opts.max` is
 * an axis maximum on fourteen charts, and `opts.maxRadius`, `opts.maxSize` and
 * `opts.maxWidth` are the largest circle, the largest word and the widest
 * route on four others. A key-shaped rule would write a data extent into a
 * radius and quietly ruin three maps.
 */
const AXIS_LABEL = /^(axis|scale)\s+(maximum|minimum)$/i;

/** `{ max, min }` — the dot-paths this chart exposes, either possibly null. */
export function boundKeys(def) {
  const out = { max: null, min: null };
  for (const c of (def && def.controls) || []) {
    if (!c || c.type !== 'slider' || !c.key) continue;
    if (!AXIS_LABEL.test(String(c.label || ''))) continue;
    if (/minimum/i.test(c.label)) { if (!out.min) out.min = c.key; }
    else if (!out.max) out.max = c.key;
  }
  return out;
}

/** Write a dot-path into a spec, making the objects on the way if need be. */
function setPath(obj, path, value) {
  const parts = String(path).split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

/**
 * The numeric extent of what a panel is drawing.
 *
 * Read back out of `def.toText` rather than by walking the spec looking for
 * arrays of numbers. That writer is the one the suite already holds to a round
 * trip, so it is the only description of a chart's data guaranteed to be
 * complete — a spec walk would find a colour that happened to be a number, or
 * miss a nested one, per chart, silently.
 */
function panelExtent(def, spec) {
  if (typeof def.toText !== 'function') return null;
  let text = '';
  try { text = def.toText(spec) || ''; } catch { return null; }
  let lo = Infinity;
  let hi = -Infinity;
  // The header row is words by construction; a stray number in it would be a
  // year, which is a label rather than a value.
  text.split('\n').slice(1).forEach((line) => {
    line.split(/[,\t;]/).forEach((cell) => {
      const t = cell.trim();
      if (!t || !/^[-+]?[\d.,]+%?$/.test(t)) return;
      const n = Number(t.replace(/[,%]/g, ''));
      if (!Number.isFinite(n)) return;
      if (n < lo) lo = n;
      if (n > hi) hi = n;
    });
  });
  return Number.isFinite(lo) && Number.isFinite(hi) ? { lo, hi } : null;
}

/** Round a bound out to something a person would have typed. */
function nice(n, up) {
  if (!Number.isFinite(n) || n === 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(n))));
  const step = mag / (Math.abs(n) / mag < 2 ? 4 : 2);
  return (up ? Math.ceil(n / step) : Math.floor(n / step)) * step;
}

/**
 * What "matched scales" can actually mean for this chart, as a sentence.
 *
 * Returns `{ can, why }`. `why` is shown in the control and said in the
 * accessible description, because the alternative — a matched/independent
 * switch that silently does nothing on a hundred charts — would make the grid
 * claim a comparability it does not have.
 */
export function scaleSharing(def) {
  const keys = boundKeys(def);
  if (keys.max || keys.min) {
    return { can: true, why: 'Every panel is drawn to the same axis as the largest one.' };
  }
  return {
    can: false,
    why: 'This chart works its own axis out from the data, so each panel is scaled to itself. '
       + 'Compare shapes between panels, not heights.',
  };
}

/* ── the one place panels come from ──────────────────────────────────────── */

/**
 * The panels this spec draws, or `null` if it is an ordinary single chart.
 *
 * Both the live preview and the code generator call this and nothing else, so
 * the grid on screen and the grid in the export are the same grid — the rule
 * the whole `engines.js` bridge exists to keep.
 *
 * @returns {Array<{name: string, spec: object}> | null}
 */
export function panelSpecs(def, spec) {
  if (!isFaceted(spec)) return null;
  const facet = spec.facet;
  const base = baseSpec(spec);

  let panels = null;
  try {
    panels = facet.kind === 'series' ? seriesPanels(def, base) : valuePanels(def, base, facet);
  } catch {
    return null;
  }
  if (!panels || !panels.length) return null;

  if (facet.scales !== 'free') {
    const keys = boundKeys(def);
    if (keys.max || keys.min) {
      const spans = panels.map((p) => panelExtent(def, p.spec)).filter(Boolean);
      if (spans.length) {
        const hi = nice(Math.max(...spans.map((s) => s.hi)), true);
        const lo = Math.min(...spans.map((s) => s.lo));
        panels.forEach((p) => {
          if (keys.max && hi > 0) setPath(p.spec, keys.max, hi);
          // A floor is only worth forcing where the data actually goes below
          // zero; pinning a positive series to its own minimum would crop it.
          if (keys.min && lo < 0) setPath(p.spec, keys.min, nice(lo, false));
        });
      }
    }
  }

  return panels;
}

/** How many panels this spec draws, or 0. */
export function panelCount(def, spec) {
  const panels = panelSpecs(def, spec);
  return panels ? panels.length : 0;
}

/* ── laying them out ─────────────────────────────────────────────────────── */

/**
 * Columns for `n` panels.
 *
 * Squarish, and never more than four across: past that each panel is narrower
 * than its own axis labels, which is where a grid of small multiples stops
 * being a comparison and becomes a texture.
 */
export function panelColumns(n, requested) {
  const asked = Number(requested) | 0;
  if (asked > 0) return Math.min(asked, Math.max(1, n));
  if (n <= 1) return 1;
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  return 4;
}

/** The height one panel gets, given what the chart asks for on its own. */
export function panelHeight(full, cols) {
  const base = Number(full) || 340;
  // Two across is a little over half height; four across is nearer a third.
  // Never below 140px, where the axis furniture alone fills the plate.
  const scaled = Math.round(base / (cols <= 1 ? 1 : cols <= 2 ? 1.7 : cols <= 3 ? 2.1 : 2.4));
  return Math.max(140, scaled);
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * The grid, as markup.
 *
 * One function for both outputs, deliberately: the studio sets it as
 * `innerHTML` and fills each plate by rendering into it, and the export prints
 * the same string into its HTML tab. Two builders would be two ideas of what a
 * plate is called, and the annotation overlay looks the plate up by class.
 *
 * @param {string[]} names   panel titles, in order
 * @param {object} opts
 * @param {number} [opts.cols]     columns across
 * @param {Function} [opts.inner]  `(i) => html` for the inside of each plate;
 *   empty in the studio, where the renderer builds its own canvas
 * @param {string} [opts.idPrefix] ids for the plate bodies
 */
export function facetMarkup(names, opts = {}) {
  const cols = opts.cols || panelColumns(names.length);
  const inner = typeof opts.inner === 'function' ? opts.inner : () => '';
  const prefix = opts.idPrefix || 'oc-panel';
  const plates = names.map((name, i) => [
    `  <div class="oc-facet">`,
    `    <div class="oc-facet-name" title="${esc(name)}">${esc(name)}</div>`,
    `    <div class="oc-facet-plate" id="${esc(prefix + '-' + i)}">${inner(i)}</div>`,
    `  </div>`,
  ].join('\n'));
  return [
    `<div class="oc-facets" style="--oc-facet-cols:${cols}">`,
    ...plates,
    `</div>`,
  ].join('\n');
}

/* ── turning it on ───────────────────────────────────────────────────────── */

/**
 * Which columns of `table` could be split on.
 *
 * The same judgement `classifyColumns` makes for the wide-table matcher, and
 * for the same reason: a column of measurements with a placeholder in a few
 * cells reads as "holds words", and an id distinct in every row reads as a
 * category. A facet gets one more constraint than the matcher — the number of
 * distinct values *is* the number of charts, so two is the floor and
 * `MAX_PANELS` the ceiling.
 */
export function facetableColumns(table) {
  if (!table || !Array.isArray(table.rows) || !table.rows.length) return [];
  const out = [];
  const headers = table.headers || [];
  const n = headers.length || (table.rows[0] || []).length;
  for (let c = 0; c < n; c++) {
    let seen = 0;
    let wordy = 0;
    const distinct = new Set();
    for (const row of table.rows) {
      const v = String(row[c] == null ? '' : row[c]).trim();
      if (!v) continue;
      seen++;
      distinct.add(v);
      if (!/^[-+]?[\d.,]+%?$/.test(v)) wordy++;
    }
    if (!seen || !distinct.size) continue;
    if (wordy / seen < 0.9) continue;
    if (distinct.size < 2 || distinct.size > MAX_PANELS) continue;
    // Every row its own panel is a partition that explains nothing.
    if (distinct.size === table.rows.length) continue;
    out.push({ col: c, name: headers[c] || `Column ${c + 1}`, values: distinct.size });
  }
  return out;
}

/**
 * Split `spec` into panels by one column of `table`, and read the whole table
 * into the base spec while we are here.
 *
 * That second half matters more than it looks. The base spec is what the
 * legend, the metrics row and `def.toText` all read, so leaving it holding the
 * pre-facet import would make the legend describe one thing while the grid
 * drew another. Reading the combined table means the base spec is exactly the
 * chart you get when the facet is switched off — which is also what makes
 * switching it off a no-op rather than an edit.
 *
 * @returns {{ok: boolean, message: string}}
 */
export function facetByColumn(def, spec, table, colIndex) {
  const headers = (table.headers || []).map((h) => String(h == null ? '' : h));
  const col = colIndex | 0;
  if (col < 0 || col >= headers.length) return { ok: false, message: 'No such column to split by.' };

  const rows = (table.rows || []).map((r) => headers.map((_, i) => String(r[i] == null ? '' : r[i])));
  const rest = {
    headers: headers.filter((_, i) => i !== col),
    rows: rows.map((r) => r.filter((_, i) => i !== col)),
  };
  const res = applyData(def, spec, rest);
  if (!res.ok) return res;

  spec.facet = {
    kind: 'value',
    by: headers[col],
    source: { headers, rows },
    cols: 0,
    scales: 'shared',
  };

  const panels = panelSpecs(def, spec);
  if (!panels) {
    delete spec.facet;
    return { ok: false, message: `Splitting by ${headers[col]} did not produce anything to draw.` };
  }
  return { ok: true, message: `Split into ${panels.length} panels by ${headers[col]}.` };
}

/** One panel per series. Needs no table at all — see the note at the top. */
export function facetBySeries(def, spec) {
  const key = seriesKeyOf(def);
  if (!key) return { ok: false, message: 'This chart does not draw more than one series.' };
  spec.facet = { kind: 'series', by: '', cols: 0, scales: 'shared' };
  const panels = panelSpecs(def, spec);
  if (!panels) {
    delete spec.facet;
    return { ok: false, message: 'There is only one series to split.' };
  }
  return { ok: true, message: `Split into ${panels.length} panels, one per series.` };
}

/** The table the data editor should open on, when the facet is holding one. */
export function facetSource(spec) {
  return (isFaceted(spec) && spec.facet.kind === 'value' && spec.facet.source) || null;
}

/* ── saying what it is ───────────────────────────────────────────────────── */

/** The whole grid in one phrase, for the control and for the description. */
export function describeFacet(def, spec) {
  const panels = panelSpecs(def, spec);
  if (!panels) return '';
  const by = spec.facet.kind === 'series' ? 'series' : spec.facet.by;
  const share = scaleSharing(def);
  const scaled = (spec.facet.scales === 'free' || !share.can)
    ? 'Each panel is scaled to its own data, so compare their shapes rather than their heights.'
    : 'Every panel is drawn to the same axis, so their heights can be compared directly.';
  return `Shown as ${panels.length} small multiples, one per ${by}. ${scaled}`;
}

/**
 * The caveat worth printing next to the grid, or ''.
 *
 * Only where something was actually dropped — a note that appears every time
 * is a note nobody reads.
 */
export function facetNote(def, spec) {
  if (!isFaceted(spec)) return '';
  const facet = spec.facet;
  if (facet.kind !== 'value' || !facet.source) return '';
  const col = (facet.source.headers || []).indexOf(facet.by);
  if (col < 0) return '';
  const { order } = groupRows(facet.source, col);
  if (order.length <= MAX_PANELS) return '';
  return `${facet.by} has ${order.length} values — showing the first ${MAX_PANELS}. `
       + 'Filter the table in the data editor to choose which.';
}

/* ── the grid's own styles, which the export carries ─────────────────────── */

/**
 * Emitted only for a chart that is actually faceted, so the other exports stay
 * byte-for-byte what they were — the rule `ANNOTATION_CSS` follows.
 *
 * Literal colours rather than the studio's tokens: this lands in somebody
 * else's stylesheet, where none of them are defined.
 */
export const FACET_CSS = `.oc-facets {
  display: grid;
  grid-template-columns: repeat(var(--oc-facet-cols, 2), minmax(0, 1fr));
  gap: 18px 20px;
  position: relative;
}

.oc-facet { min-width: 0; }

.oc-facet-name {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: .02em;
  margin: 0 0 6px;
  padding-bottom: 5px;
  border-bottom: 1px solid #e3e0d7;
  color: #56544d;
  /* A panel title is a key, not a paragraph: one line, clipped, with the whole
     name on hover. A wrapped title would push one plate below its row and
     break the grid's baseline. */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oc-facet-plate { position: relative; min-width: 0; }
.oc-facet-plate canvas { display: block; width: 100%; }

@media (max-width: 640px) {
  /* Below this, a third of the width is narrower than the axis labels, so the
     grid stops being a comparison and becomes a texture. */
  .oc-facets { grid-template-columns: minmax(0, 1fr); }
}

@media (prefers-color-scheme: dark) {
  .oc-facet-name { color: #a3a09a; border-bottom-color: rgba(255,255,255,.09); }
}`;
