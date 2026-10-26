import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTable } from '../js/studio/dataio.js';
import { profileTable } from '../js/studio/profile.js';
import { repeatedWarning } from '../js/studio/layout.js';
import { runSteps, describeStep, defaultStep } from '../js/studio/transform.js';
import { toStep, applyRecipe, RecipeError } from '../js/studio/recipe.js';
import { recommendAnalysisCharts } from '../js/studio/analysis-charts.js';

const make = (headers, build, n = 30) => ({ headers, rows: Array.from({ length: n }, (_, i) => build(i).map(String)) });
const layout = (t) => profileTable(t).layout;
const notes = (t) => profileTable(t).quality.map((q) => q.text);

// Periods across: a row is a thing, so the swap is the suggestion; a row that is itself a period is a grid.
const years = Array.from({ length: 12 }, (_, i) => String(1960 + i));
const wide = make(['Country', ...years], (i) => [`Country ${i}`, ...years.map((_, j) => 100 + i * j)], 8);
assert.equal(layout(wide).periods.kind, 'years');
assert.equal(layout(wide).periods.rowsAre, 'things');
assert.ok(notes(wide).some((t) => /swap rows and columns/i.test(t) && /"Country"/.test(t)), 'the note names the row label and the step');
assert.ok(notes(wide).some((t) => /8 lines|keeping only the rows/.test(t)) === false, 'eight rows are readable; no advice to cut them');
const manyRows = make(['Country', ...years], (i) => [`Country ${i}`, ...years.map((_, j) => 100 + i * j)], 40);
assert.ok(notes(manyRows).some((t) => /40 lines cannot be read/.test(t)), 'forty countries are too many lines, and the note says so');
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const grid = make(['Year', ...months], (i) => [1990 + i, ...months.map((_, j) => i + j)], 10);
assert.equal(layout(grid).periods.rowsAre, 'periods', 'Year down the side as well makes a grid');
const plain = make(['Region', 'Sales', 'Cost'], (i) => [`R${i}`, 10 + i, 5 + i]);
assert.equal(layout(plain).periods, null, 'an ordinary table has no periods');
assert.equal(layout(make(['Name', 'a', 'b', 'c', 'd'], (i) => [`n${i}`, i, i, i, i])).periods, null, 'letters are not months');

// Several values in a cell: a list that recurs is one; a name, a constant label and prose with a comma are not.
const tags = make(['Movie', 'Genres', 'Gross'], (i) => [`m${i}`, ['Action; Comedy', 'Drama', 'Action; Drama', 'Comedy'][i % 4], 10 + i], 24);
const found = layout(tags).multiValue;
assert.equal(found.length, 1);
assert.deepEqual([found[0].column, found[0].sep, found[0].values], ['Genres', ';', 3]);
assert.ok(notes(tags).some((t) => /"Genres" holds several values/.test(t) && /\{"split": "Genres", "sep": ";"\}/.test(t)), 'the note carries the recipe step');
const names = make(['Person', 'Score'], (i) => [`Surname${i}, Given${i}`, i], 24);
assert.deepEqual(layout(names).multiValue, [], 'Surname, Given is a name, not a list');
const constant = make(['Series', 'Year', 'Value'], (i) => ['Population, total', 2000 + i, i], 24);
assert.deepEqual(layout(constant).multiValue, [], 'a cell that says one thing in every row is a label');
assert.deepEqual(layout(plain).multiValue, []);

// A repeated grain: the shipping cost belongs to the order, not to its lines. (Irregular, as a real cost is: a tidy run of steps reads as a counter.)
const orders = make(['Order', 'Line', 'Shipping', 'Amount'], (i) => [`O${Math.floor(i / 3)}`, i % 3, [12.5, 8, 31, 19.75, 6, 27, 14, 40, 9.5, 22][Math.floor(i / 3)], 3 + ((i * 37) % 11)], 30);
const rep = layout(orders).repeated;
assert.equal(rep.length, 1, 'only the measure that does not move within an order');
assert.deepEqual([rep[0].measure, rep[0].by], ['Shipping', 'Order']);
assert.equal(rep[0].groups, 10);
assert.ok(Math.abs(rep[0].factor - 3) < 1e-9, 'each order is repeated three times');
assert.ok(notes(orders).some((t) => /"Shipping" is the same on every row that shares a "Order"/.test(t)));
assert.deepEqual(layout(plain).repeated, [], 'a measure that varies is not a repeat');
const unique = make(['Order', 'Shipping'], (i) => [`O${i}`, 10 + i], 30);
assert.deepEqual(layout(unique).repeated, [], 'a value on a one-row group is not repeated');

// The warning a total carries: sum counts the repeats, mean weights by them, and grouping by the grain is exact for a mean.
const r = rep[0];
assert.match(repeatedWarning(r, 'sum', 0), /counts every repeat/);
assert.match(repeatedWarning(r, 'mean', 3), /weights each group/);
assert.equal(repeatedWarning(r, 'mean', r.byIndex), null, 'the mean of a value per its own grain is the value');
assert.match(repeatedWarning(r, 'sum', r.byIndex), /counts every repeat/, 'but a sum per grain still adds the repeats');
assert.equal(repeatedWarning(null, 'sum', 0), null);

const plans = recommendAnalysisCharts(orders, profileTable(orders)).filter((p) => p.kind === 'group');
const shipping = plans.filter((p) => p.measure === 2);
const amount = plans.filter((p) => p.measure === 3);
assert.ok(shipping.length && amount.length);
assert.ok(shipping.filter((p) => p.agg === 'sum').every((p) => /counts every repeat/.test(p.warning)), 'every total of the repeated measure says so');
assert.ok(shipping.filter((p) => p.agg === 'median').every((p) => !p.warning), 'a median is not a total or an average');
assert.ok(amount.every((p) => !p.warning), 'a measure that varies is never warned about');
assert.ok(shipping.some((p) => p.group === 0 && p.agg === 'mean') === true && shipping.filter((p) => p.group === 0 && p.agg === 'mean').every((p) => !p.warning), 'the mean by its own grain is clean');

// The split step: one row per value, the rest repeated, nothing lost, nothing invented.
const split = runSteps(tags, [{ op: 'split', col: 1, sep: ';' }]);
assert.deepEqual(split.errors, []);
const wanted = tags.rows.reduce((n, row) => n + row[1].split(';').length, 0);
assert.equal(split.table.rows.length, wanted, 'a row for each value');
assert.deepEqual(split.table.rows.slice(0, 2), [['m0', 'Action', '10'], ['m0', 'Comedy', '10']], 'the other columns are copied and the parts trimmed');
assert.ok(split.table.rows.every((row) => !row[1].includes(';') && row[1] === row[1].trim()));
assert.equal(new Set(split.table.rows.map((row) => row[1])).size, 3, 'three genres, not four combinations');
const blank = runSteps({ headers: ['K', 'V'], rows: [['a; ;b', '1'], ['', '2'], ['c', '3'], [' ; ', '4']] }, [{ op: 'split', col: 0, sep: ';' }]);
assert.deepEqual(blank.table.rows, [['a', '1'], ['b', '1'], ['', '2'], ['c', '3'], [' ; ', '4']], 'empty parts are dropped, and a row with nothing to split keeps its place');
assert.deepEqual(runSteps(tags, [{ op: 'split', col: 1 }]).table.rows.length, wanted, 'no separator given is a semicolon');
assert.match(describeStep({ op: 'split', col: 1, sep: ';' }, tags.headers), /Genres.*counts a row once per value/);
assert.deepEqual(defaultStep('split', tags), { op: 'split', col: 0, sep: ';' }, 'a new step starts on the first column of words');

// A recipe says it by name, and has to say what the separator is.
assert.deepEqual(toStep({ split: 'Genres', sep: ';' }, tags.headers, 1), { op: 'split', col: 1, sep: ';' });
assert.throws(() => toStep({ split: 'Genres' }, tags.headers, 1), RecipeError);
assert.throws(() => toStep({ split: 'Nope', sep: ';' }, tags.headers, 1), /No column called "Nope"/);
const viaRecipe = applyRecipe(tags, { steps: [{ split: 'Genres', sep: ';' }, { group: 'Genres', agg: 'count' }] });
assert.deepEqual(viaRecipe.table.rows.map((row) => row[0]).sort(), ['Action', 'Comedy', 'Drama'], 'then the groups are the values');

// The benchmark's sixteen real tables: the detectors find what is there and invent nothing.
const labels = JSON.parse(readFileSync(new URL('./benchmark/labels.json', import.meta.url), 'utf8'));
const seen = {};
for (const set of labels.datasets) {
  const lines = readFileSync(new URL(`./benchmark/data/${set.id}.csv`, import.meta.url), 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  let lead = 0;
  while (lead < lines.length && /^\s*(#|$)/.test(lines[lead])) lead++;
  const rest = lines.slice(lead);
  for (let dropped = 0; dropped < ((set.read || {}).skip || 0) && rest.length;) if (rest.shift().trim()) dropped++;
  const t = parseTable(rest.join('\n'), (set.read || {}).header);
  const l = profileTable({ headers: t.headers, rows: t.rows }).layout;
  seen[set.id] = l;
  assert.deepEqual(l.multiValue, [], `${set.id}: no list in a cell`);
  assert.deepEqual(l.repeated, [], `${set.id}: no repeated grain`);
}
assert.equal(seen.wbpop.periods && seen.wbpop.periods.kind, 'years', 'the World Bank file runs by year across');
assert.equal(seen.wbpop.periods.rowsAre, 'things');
assert.equal(seen.gistemp.periods && seen.gistemp.periods.kind, 'months', 'the NASA file runs by month across');
assert.equal(seen.gistemp.periods.rowsAre, 'periods', 'with a year down the side');
assert.deepEqual(Object.keys(seen).filter((id) => seen[id].periods).sort(), ['gistemp', 'wbpop'], 'and nothing else is called wide');

console.log('Layout: periods across, lists in a cell, repeated grain, the split step and its recipe passed.');
