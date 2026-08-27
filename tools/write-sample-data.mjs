/**
 * write-sample-data.mjs — emit `js/studio/charts/_data.js` from the bakery.
 *
 *   node tools/write-sample-data.mjs
 *
 * Run this only to change the shipped datasets. The output is committed; the
 * site imports it, and nothing regenerates it at runtime.
 */

import { writeFileSync } from 'node:fs';
import { BAKE, src } from './bake-data.mjs';

const HEADER = `/**
 * _data.js — the data every chart opens with.
 *
 * These are literal arrays on purpose. Twenty-four charts used to draw a
 * simulation from a seed and a row of parameter sliders, which made them the
 * only charts in the library nobody could actually use: the numbers were never
 * anyone's numbers, the sliders were not editing anything real, and the
 * exported code shipped a random-number generator where a dataset belonged.
 *
 * Now every chart starts from a table you can open, read, and replace.
 *
 * Kept in one module rather than inline in the definitions so a spec stays a
 * shape rather than a wall of digits. Importing from a \`spec\` is safe — a spec
 * is serialised as *data*. Referencing this from a \`draw\`/\`mount\` body would
 * not be: those are serialised as source, and the import would not travel with
 * them. See "One build function, two outputs" in CLAUDE.md.
 *
 * Regenerate with \`node tools/write-sample-data.mjs\`.
 */
`;

/* export name  ←  bakery key */
const EXPORTS = [
  ['HISTOGRAM_VALUES', 'histogramValues',
    '140 customer ages. The histogram bins them; the bin width stays the reader\'s call.'],
  ['BOX_GROUPS', 'boxGroups',
    'Order value by region, in dollars — 30 orders per region.'],
  ['VIOLIN_GROUPS', 'violinGroups',
    'Session length in minutes, by device.'],
  ['DENSITY_GROUPS', 'densityGroups',
    'An A/B test score, control against treatment.'],
  ['RIDGELINE_ROWS', 'ridgelineRows',
    'Daily temperature by month, in °C.'],
  ['ECDF_GROUPS', 'ecdfGroups',
    'Response time in milliseconds, across two releases.'],
  ['BEESWARM_GROUPS', 'beeswarmGroups',
    'Weekly active hours by plan. The group sizes differ on purpose — real ones do.'],
  ['BARCODE_ROWS', 'barcodeRows',
    'Order value by region, one tick per order.'],
  ['WIND_ROSE', 'windRose',
    'Wind frequency by compass point — a prevailing south-westerly.'],
  ['HEATMAP_CELLS', 'heatmapCells',
    'Support tickets by day and hour: office hours on weekdays, a weekend trickle.'],
  ['SCATTER_POINTS', 'scatterPoints',
    'Price against rating for 60 products — a mild positive relationship.'],
  ['SCATTER_CLUSTERS', 'scatterClusters',
    'Three customer segments as x/y clouds: order value against purchase frequency.'],
  ['OHLC_BARS', 'ohlcBars',
    '70 sessions, for the OHLC and candlestick charts.'],
  ['REVERSAL_BARS', 'reversalBars',
    '120 sessions for Renko, Kagi and Point & Figure. Those three only draw where the price reverses, so they need a longer series that keeps turning — a walk that drifts to one end leaves them with a single column.'],
  ['HORIZON_ROWS', 'horizonRows',
    'Four server metrics as departures from their own baseline, 96 periods each.'],
  ['SPIRAL_VALUES', 'spiralValues',
    'Four years of weekly figures with a real annual cycle — a spiral is only worth drawing when the same phase lands on the same spoke.'],
  ['CALENDAR_DAYS', 'calendarDays',
    'A year of daily commits: quiet weekends, a summer lull, a December push.'],
  ['PARALLEL_RECORDS', 'parallelRecords',
    'Twelve products across five measures, in three tiers.'],
  ['REGION_VALUES', 'regionValues',
    'A value for 54 countries, spelled the way the world atlas spells them. The rest draw in the no-data colour, which is what a real dataset looks like.'],
];

const out = [HEADER];
for (const [name, key, doc] of EXPORTS) {
  if (!BAKE[key]) throw new Error(`bakery has no "${key}"`);
  out.push('');
  // Wrap the note so the generated file reads like something a person wrote.
  const words = doc.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line.length + w.length + 1 > 72) { lines.push(line); line = ''; }
    line += (line ? ' ' : '') + w;
  }
  if (line) lines.push(line);
  out.push(lines.length === 1 ? `/** ${lines[0]} */` : `/**\n * ${lines.join('\n * ')}\n */`);
  out.push(`export const ${name} = ${src(BAKE[key](), 0)};`);
}
out.push('');

const body = out.join('\n');
writeFileSync('js/studio/charts/_data.js', body);
console.log(`js/studio/charts/_data.js — ${EXPORTS.length} datasets, ${(body.length / 1024).toFixed(1)}KB`);
