import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { recommendAnalysisCharts, buildAnalysisChart, recipeOf, GOAL_OF_KIND } from '../js/studio/analysis-charts.js';
import { recommendCharts, LIMITS, GOALS } from '../js/studio/recommend.js';
import { profileTable } from '../js/studio/profile.js';

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

// Variety: a table with two groups, two measures and a date offers more than the original five chart types.
const rich = { headers: ['Day', 'Region', 'Tier', 'Sales', 'Cost'], rows: Array.from({ length: 24 }, (_, i) => [
  `2026-01-${String(i % 6 + 1).padStart(2, '0')}`, ['N', 'S', 'E'][i % 3], ['gold', 'basic'][i % 2], String(10 + i * 3), String(5 + i)]) };
rich.rows[5][4] = '';
const richPlans = recommendAnalysisCharts(rich);
const ids = new Set(richPlans.map((p) => p.id));
for (const id of ['box-plot', 'pie', 'heatmap', 'line-multi', 'line-basic', 'bar-vertical']) assert.ok(ids.has(id), `offers ${id}`);
for (const plan of richPlans) {
  const built = buildAnalysisChart(rich, plan);
  assert.equal(built.usedRows + built.excludedRows, rich.rows.length, `${plan.key} accounts for every row`);
}
const grid = buildAnalysisChart(rich, richPlans.find((p) => p.kind === 'crosstab'));
assert.equal(grid.table.rows.flatMap((r) => r.slice(1)).reduce((n, v) => n + Number(v), 0), 24, 'crosstab counts every row once');
const box = buildAnalysisChart(rich, richPlans.find((p) => p.kind === 'spread' && p.measure === 4));
assert.equal(box.table.rows.length, 23, 'box plot keeps every valid value, drops the blank');
const multi = buildAnalysisChart(rich, richPlans.find((p) => p.kind === 'trendMulti'));
assert.ok(multi.table.rows.every((r) => r.slice(1).every((v) => v !== '' && Number.isFinite(Number(v)))), 'no blank or zero-filled cells');

// One threshold, two surfaces: at the edge of "few categories" the analysis panel and the report agree.
const withGroups = (n) => ({ headers: ['Group', 'Score'], rows: Array.from({ length: n * 3 }, (_, i) => [`G${i % n}`, String(i * 2 + (i % 7))]) });
const readable = new Set(['bar-vertical', 'bar-horizontal', 'box-plot', 'treemap', 'bar-lollipop']);
for (const [n, few] of [[LIMITS.fewCategories, true], [LIMITS.fewCategories + 1, false]]) {
  const t = withGroups(n);
  assert.equal(recommendAnalysisCharts(t).some((p) => p.id === 'box-plot'), few, `${n} groups: box plot ${few ? 'offered' : 'not offered'}`);
  const { suggestions } = recommendCharts(profileTable(t), readable);
  assert.equal(suggestions[0].id === 'bar-vertical', few, `${n} groups: report leads with ${few ? 'vertical' : 'horizontal'} bars`);
}
assert.ok(richPlans.every((p) => GOALS.includes(p.goal) && p.goal === GOAL_OF_KIND[p.kind]), 'every plan names a known goal');
assert.ok(richPlans.every((p) => typeof p.caution === 'string' && p.caution.length), 'every plan carries a caution');
assert.ok(recommendCharts(profileTable(rich), new Set(['line-basic', 'bar-vertical'])).suggestions.every((s) => GOALS.includes(s.goal)), 'report suggestions name a goal');

// A plan's recipe draws what the panel draws: the choose-chart skill, given the recipe and the raw file,
// holds as many rows as the panel's own table. Every plan, so the column with the blank is covered too.
const skill = fileURLToPath(new URL('../.claude/skills/choose-chart/choose.mjs', import.meta.url));
const rawCsv = [rich.headers, ...rich.rows].map((r) => r.join(',')).join('\n') + '\n';
let checked = 0;
for (const plan of richPlans) {
  const recipe = recipeOf(plan, rich.headers);
  if (!recipe) { assert.equal(plan.kind, 'crosstab', `${plan.key} has no recipe, and only a crosstab may lack one`); continue; }
  const run = spawnSync(process.execPath, [skill, '--recipe', JSON.stringify(recipe), '-'], { input: rawCsv, encoding: 'utf8' });
  assert.equal(run.status, 0, `${plan.key}: ${(run.stderr || run.stdout).slice(0, 200)}`);
  const rows = Number((run.stdout.match(/holds: .* — (\d+) rows/) || [])[1]);
  assert.equal(rows, buildAnalysisChart(rich, plan).table.rows.length, `${plan.key}: recipe and panel hold the same rows`);
  checked++;
}
assert.ok(checked >= 15, `${checked} recipes checked`);
const listing = spawnSync(process.execPath, [skill, '-'], { input: rawCsv, encoding: 'utf8' }).stdout;
assert.match(listing, /Views of this table, aggregated/);
assert.match(listing, /--recipe '\{"chart":"/, 'the skill prints a recipe for each view');
console.log(`Analysis recommendations: ${many.length} views, full 403 rows/45 columns, counts, grouped arithmetic, exclusions, dates, bounds and immutable data passed.`);
