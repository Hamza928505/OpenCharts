/**
 * registry.js — the single catalogue of every chart in the library.
 *
 * Adding a chart means adding one definition to a file in ./charts/ and
 * exporting it here. The gallery, the studio, the search index and the code
 * generator all read from this list, so nothing else needs touching.
 */

import { lineCharts } from './charts/line.js';
import { barCharts } from './charts/bar.js';
import { partToWholeCharts } from './charts/part-to-whole.js';
import { radarCharts, scatterCharts } from './charts/radar-scatter.js';
import { scatterExtraCharts } from './charts/scatter-extra.js';
import { distributionCharts } from './charts/distribution.js';
import { hierarchyCharts } from './charts/hierarchy.js';
import { flowCharts } from './charts/flow.js';
import { comparisonCharts } from './charts/comparison.js';
import { deviationCharts } from './charts/deviation.js';
import { distributionExtraCharts } from './charts/distribution-extra.js';
import { comparisonExtraCharts } from './charts/comparison-extra.js';
import { networkCharts } from './charts/network.js';
import { hierarchyExtraCharts } from './charts/hierarchy-extra.js';
import { unitCharts } from './charts/unit-charts.js';
import { kpiCharts } from './charts/kpi.js';
import { financeCharts } from './charts/finance.js';
import { geoCharts } from './charts/geo.js';
import { timeseriesCharts } from './charts/timeseries.js';
import { engineCharts } from './charts/engine.js';
import { engineOf, ENGINE_LABEL, ENGINE_CHIP } from './engines.js';
import { DATA_SCHEMAS, DATA_CONTROL } from './data-schemas.js';

/** Category display order in the gallery and the rail. */
export const CATEGORY_ORDER = [
  'Line & Area',
  'Bar',
  'Deviation',
  'Part to Whole',
  'Radar',
  'Scatter',
  'Distribution',
  'Hierarchy',
  'Network',
  'Flow',
  'Comparison',
  'Finance',
  'Geo',
  'KPI & Micro',
  'Custom Engine',
];

const ALL = [
  ...lineCharts,
  ...timeseriesCharts,
  ...deviationCharts,
  ...barCharts,
  ...partToWholeCharts,
  ...radarCharts,
  ...scatterCharts,
  ...scatterExtraCharts,
  ...distributionCharts,
  ...distributionExtraCharts,
  ...unitCharts,
  ...hierarchyCharts,
  ...hierarchyExtraCharts,
  ...networkCharts,
  ...flowCharts,
  ...comparisonCharts,
  ...comparisonExtraCharts,
  ...financeCharts,
  ...geoCharts,
  ...kpiCharts,
  ...engineCharts,
];

/* Decorate each definition with what the UI needs, once at module load. */
ALL.forEach((def) => {
  // Attach the data editor. A chart can already declare its own `data`
  // descriptor; the schema table fills in the rest so every chart in the
  // library accepts pasted input.
  const schema = DATA_SCHEMAS[def.id];
  if (schema && !def.data) {
    const { toText, onData, ...desc } = schema;
    def.data = desc;
    if (toText && !def.toText) def.toText = toText;
    if (onData && !def.onData) def.onData = onData;
  }
  if (def.data) {
    const controls = def.controls || (def.controls = []);
    const already = controls.some((c) => c.type === 'data');
    if (!already) controls.unshift({ ...DATA_CONTROL });
  }

  def.engine = engineOf(def);
  def.engineLabel = ENGINE_LABEL[def.engine];
  def.engineChip = ENGINE_CHIP[def.engine];
  def.searchText = [def.title, def.category, def.blurb, ...(def.tags || [])]
    .join(' ')
    .toLowerCase();
});

/* Fail loudly at load rather than silently serving a broken link. */
const seen = new Set();
ALL.forEach((def) => {
  if (seen.has(def.id)) console.error(`[registry] duplicate chart id "${def.id}"`);
  seen.add(def.id);
  if (!CATEGORY_ORDER.includes(def.category)) {
    console.warn(`[registry] "${def.id}" has uncategorised category "${def.category}"`);
  }
});

export const CHARTS = ALL;

export const CATEGORIES = CATEGORY_ORDER
  .map((name) => ({ name, charts: ALL.filter((c) => c.category === name) }))
  .filter((group) => group.charts.length);

export const CHART_COUNT = ALL.length;

export const getChart = (id) => ALL.find((c) => c.id === id) || null;

export const chartIndex = (id) => ALL.findIndex((c) => c.id === id);

/** Counts per rendering engine — used by the gallery hero. */
export function engineTally() {
  const tally = {};
  ALL.forEach((c) => { tally[c.engine] = (tally[c.engine] || 0) + 1; });
  return tally;
}

/**
 * A fresh, isolated copy of a chart's spec.
 *
 * Definitions are module-level singletons, so the studio must never edit
 * `def.spec` directly — one session's colour change would leak into every
 * gallery preview. `structuredClone` gives a clean deep copy; `onInit` then
 * derives any mirror fields the controls need.
 */
export function newSpec(def) {
  const clone = typeof structuredClone === 'function'
    ? structuredClone(def.spec)
    : JSON.parse(JSON.stringify(def.spec));
  if (typeof def.onInit === 'function') def.onInit(clone);
  if (typeof def.onChange === 'function') def.onChange(clone);
  return clone;
}

/** Filter helper shared by the gallery search box. */
export function searchCharts(query, category) {
  const q = String(query || '').trim().toLowerCase();
  return ALL.filter((c) => {
    if (category && category !== 'All' && c.category !== category) return false;
    if (!q) return true;
    return c.searchText.includes(q);
  });
}
