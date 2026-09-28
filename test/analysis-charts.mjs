import assert from 'node:assert/strict';
import { recommendAnalysisCharts, buildAnalysisChart } from '../js/studio/analysis-charts.js';

const table = { headers: ['Batch', 'Baseline', 'Error', 'Copy of error', 'Constant', 'Record ID'], rows: [
  ['A', '2', '0', '0', '7', 'r1'], ['A', '2', '-4', '-4', '7', 'r2'],
  ['B', '5', '10', '10', '7', 'r3'], ['B', '5', '', '', '7', 'r4'],
  ['B', '5', 'N/A', 'N/A', '7', 'r5'], ['', '9', '1e-8', '1e-8', '7', 'r6'],
] };
const unchanged = JSON.stringify(table);
const plans = recommendAnalysisCharts(table);
assert.equal(new Set(plans.map((plan) => plan.key)).size, plans.length);
assert.ok(new Set(plans.slice(0, 4).map((plan) => plan.kind)).size >= 3, 'first page offers different analyses');
assert.ok(plans.every((plan) => !plan.columns.includes(3) && !plan.columns.includes(4) && !plan.columns.includes(5)), 'duplicate columns, constants and identifiers do not crowd out recommendations');
const count = buildAnalysisChart(table, plans.find((p) => p.kind === 'count' && p.group === 0));
assert.deepEqual(count.table.rows, [['B', '3'], ['A', '2'], ['(blank)', '1']]);
assert.equal(count.usedRows, 6);
assert.equal(count.excludedRows, 0);
const mean = buildAnalysisChart(table, plans.find((p) => p.kind === 'group' && p.group === 1 && p.measure === 2 && p.agg === 'mean'));
assert.deepEqual(mean.table.rows, [['2', '-2'], ['5', '10'], ['9', '1e-8']]);
assert.equal(mean.usedRows, 4);
assert.equal(mean.excludedRows, 2);
assert.match(mean.note, /All 6 source rows analyzed.*4 used.*2 excluded/);
const scatter = buildAnalysisChart(table, plans.find((p) => p.kind === 'relationship'));
assert.equal(scatter.spec.points.length, 4);
assert.ok(scatter.spec.opts.yMin < -4 && scatter.spec.opts.yMax > 10);
assert.equal(scatter.spec.opts.xTitle, 'Baseline');
assert.equal(scatter.spec.opts.xPrefix, '');
assert.equal(JSON.stringify(table), unchanged);

// Both late columns and late rows participate; a chart type is not a view limit.
const wide = { headers: Array.from({ length: 45 }, (_, i) => `Measure ${i}`),
  rows: Array.from({ length: 403 }, (_, i) => Array.from({ length: 45 }, (_, j) => String(100 + i * (j + 1) + j * j))) };
wide.rows[402][44] = '10000000';
const many = recommendAnalysisCharts(wide);
assert.ok(many.length > 115, `${many.length} distinct views`);
const late = buildAnalysisChart(wide, many.find((p) => p.kind === 'relationship' && p.x === 43 && p.y === 44));
assert.equal(late.sourceRows, 403);
assert.equal(late.usedRows, 403);
assert.equal(late.spec.points.at(-1).y, 10000000);
assert.ok(late.spec.opts.yMax > 10000000);
const histogram = buildAnalysisChart(wide, many.find((p) => p.kind === 'distribution' && p.measure === 44));
assert.equal(histogram.spec.groups[0].values.length, 403);
assert.ok(histogram.spec.min <= 2036 && histogram.spec.max >= 10000000, 'histogram covers late extremes');
assert.ok(many.every((p) => !('table' in p) && !('spec' in p)), 'plans do not duplicate whole datasets');

const groups = { headers: ['Location', 'Amount'], rows: Array.from({ length: 120 }, (_, i) => [`Place ${i % 60}`, String(i + 10)]) };
const allGroups = buildAnalysisChart(groups, recommendAnalysisCharts(groups).find((p) => p.kind === 'count'));
assert.equal(allGroups.table.rows.length, 60, 'no 30/50-group cutoff');
assert.equal(allGroups.table.rows.reduce((sum, row) => sum + Number(row[1]), 0), 120);
const dates = { headers: ['Date', 'Response'], rows: [
  ['2026-01-03', '6'], ['2026-01-01', '0'], ['2026-01-03', '10'],
  ['2026-01-02', '-4'], ['2026-01-04', ''],
] };
const trend = buildAnalysisChart(dates, recommendAnalysisCharts(dates).find((p) => p.kind === 'trend'));
assert.deepEqual(trend.table.rows.map((row) => row[1]), ['0', '-4', '8']);
assert.equal(trend.usedRows, 4);
assert.equal(trend.excludedRows, 1);
assert.ok(trend.table.rows[0][0].startsWith('2026-01-01'));
assert.ok(recommendAnalysisCharts({ headers: ['Region', 'Note'], rows: [['North', 'good'], ['North', 'good'], ['South', 'ready']] }).some((p) => p.kind === 'count'), 'text-only data can yield frequencies');
assert.deepEqual(recommendAnalysisCharts({ headers: ['Empty'], rows: [] }), []);
assert.deepEqual(recommendAnalysisCharts({ headers: ['Empty'], rows: [[''], ['']] }), []);
assert.ok(!recommendAnalysisCharts({ headers: ['A', 'B'], rows: [['5', ''], ['7', ''], ['', '9'], ['', '12']] }).some((p) => p.kind === 'relationship'), 'nonoverlapping numeric columns cannot form a scatter');
assert.throws(() => buildAnalysisChart(table, { ...plans[0], columns: [99] }), /columns/);
assert.throws(() => buildAnalysisChart({ headers: ['A'], rows: [['N/A']] }, { id: 'histogram', kind: 'distribution', measure: 0, columns: [0] }), /No valid observations/);
console.log(`Analysis recommendations: ${many.length} views, full 403 rows/45 columns, counts, grouped arithmetic, exclusions, dates, bounds and immutable data passed.`);
