#!/usr/bin/env node
/**
 * choose.mjs — the library's own answer to "which chart?", for an assistant.
 *
 *   node .claude/skills/choose-chart/choose.mjs <file|->              rank the charts for a table
 *   node .claude/skills/choose-chart/choose.mjs --chart <id> [file|-]  one chart: what it reads, and a link
 *   node .claude/skills/choose-chart/choose.mjs --list                 every chart, one line each
 *
 *   --columns a,b,c          keep only these columns, in this order, before anything reads them
 *   --header / --no-header   settle the header row instead of guessing it
 *   --skip N                 drop the first N lines, notes above the data, before reading
 *   --swap                   turn the table rows-for-columns first
 *   --recipe <json|file>     all of the above as one object, plus steps, roles and a split
 *   --save <file>            write the table the chart reads as CSV, for a studio upload
 *   --html <file>            write the chart and its data as one page, which no link limit stops
 *   --base <url>             point links at another copy of the site
 *
 * Nothing here holds an opinion of its own. `profile.js` describes the table,
 * `rankCharts` decides what can read it, `recommend.js` orders and explains,
 * and `chart-help.js` says how each chart misleads — the calls the gallery's
 * matcher makes, so an assistant and the page cannot disagree.
 *
 * What it adds is a look at the result. Each suggestion prints what the chart
 * holds once it has read the table — `def.toText(spec)`, the table the data
 * editor would open on — because "can read it" and "draws what the reason
 * says" came apart on real files: a bar per row of a 150-row table, a line of
 * the `year` column where the reason was about passengers.
 *
 * And a way to say what the table should become. Seven of twelve public files
 * needed a row filter written by hand into a scratch file, or a group column
 * the reader took for one more group of numbers: an assistant could see what
 * was wrong and had no way to ask for it. A recipe asks, and the steps are
 * `transform.js`'s own — the Shape tab's — so every number on the chart was
 * worked out by code that says what it did, never typed by the assistant:
 *
 *   {"chart": "line-multi", "steps": [{"pivot": "source", "rows": "year", "value": "net_generation"}]}
 *   {"chart": "box-plot", "roles": {"group": "day_of_week", "value": "births"}}
 *   {"chart": "line-basic", "columns": ["Year", "Deaths"], "facet": "Entity"}
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { parseTable, transposeTable, applyData, expectedFormat, looksNumeric } from '../../../js/studio/dataio.js';
import { profileTable } from '../../../js/studio/profile.js';
import { toNumber, runSteps, describeStep, numericColumns, OPS, TESTS, AGGREGATES } from '../../../js/studio/transform.js';
import { facetByColumn } from '../../../js/studio/facet.js';
import { generateCode } from '../../../js/studio/engines.js';
import { rankCharts } from '../../../js/studio/DataMatch.js';
import { recommendCharts, summarise } from '../../../js/studio/recommend.js';
import { recommendAnalysisCharts, recipeOf } from '../../../js/studio/analysis-charts.js';
import { CHARTS, getChart, newSpec, searchCharts } from '../../../js/studio/registry.js';
import { helpFor } from '../../../js/studio/chart-help.js';
import { encodeSpec, URL_COMFORTABLE } from '../../../js/studio/share.js';
import { parseDateLabel, dateOrder, isDateLabels } from '../../../js/studio/timeaxis.js';
import { PALETTE } from '../../../js/studio/palette.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] || '' : null;
};
const out = (line = '') => console.log(line);
const fail = (message) => { console.error(message); process.exit(1); };

const RECIPE_KEYS = ['chart', 'skip', 'header', 'swap', 'columns', 'steps', 'roles', 'facet'];

/** The recipe, from JSON or a file of it; a flag given as well wins. */
function readRecipe(arg) {
  if (arg === null) return {};
  let r;
  try {
    r = JSON.parse(/^\s*[{[]/.test(arg) ? arg : readFileSync(arg, 'utf8'));
  } catch (e) {
    fail(`--recipe takes JSON, or a file holding it: ${e.message}`);
  }
  if (!r || typeof r !== 'object' || Array.isArray(r)) fail('A recipe is one JSON object, such as {"chart": "line-basic"}.');
  const unknown = Object.keys(r).filter((k) => !RECIPE_KEYS.includes(k));
  if (unknown.length) fail(`A recipe has no ${unknown.map((k) => `"${k}"`).join(', ')}. It takes: ${RECIPE_KEYS.join(', ')}.`);
  if (r.columns != null && !Array.isArray(r.columns)) fail('"columns" is a list of names, such as ["Year", "Mean"].');
  if (r.steps != null && !Array.isArray(r.steps)) fail('"steps" is a list, such as [{"filter": "Source", "is": "GCAG"}].');
  if (r.roles != null && !(r.roles.group && r.roles.value)) fail('"roles" takes {"group": "<column>", "value": "<column>"}.');
  return r;
}

const recipe = readRecipe(option('--recipe'));
const base = (option('--base') || 'https://hamza928505.github.io/OpenCharts/').replace(/\/?$/, '/');
const chartId = option('--chart') ?? recipe.chart ?? null;
const columnList = option('--columns');
const columns = columnList !== null ? columnList.split(',') : recipe.columns || null;
const skip = Number(option('--skip') ?? recipe.skip ?? 0);
const save = option('--save');
const html = option('--html');
const list = flag('--list');
const swap = flag('--swap') || recipe.swap === true;
const yes = flag('--header');
const no = flag('--no-header');
const header = yes ? true : no ? false : typeof recipe.header === 'boolean' ? recipe.header : undefined;
const source = args[0];
const names = (table, using) => using.map((c) => table.headers[c]).join(', ');
const cells = (row) => row.slice(0, 8).map((c) => String(c).slice(0, 30)).join(', ') + (row.length > 8 ? ', …' : '');
const approx = (v) => Number(v.toPrecision(3)).toLocaleString('en-US');
const recipeFor = (o) => `--recipe '${JSON.stringify(o)}'`;
if (!Number.isInteger(skip) || skip < 0) fail('--skip takes a number of lines, such as --skip 8.');

/** Shapes that draw one mark per row, labelled by the first column. */
const PER_ROW = new Set(['labelSeries', 'labelValue', 'items', 'matrix', 'rowSeries', 'pairs']);

/** Past 8 KB of path a web server refuses the request: GitHub Pages answers 414. */
const SERVER_LIMIT = 8192;

function readTable() {
  if (!source) return null;
  const bytes = readFileSync(source === '-' ? 0 : source);
  // .xlsx is a ZIP and .xls an OLE file; the browser reads both, Node here
  // has no DOMParser to do it with.
  if ((bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf)) {
    fail('That is a spreadsheet file, not text. Save it as CSV, or upload it in the studio, which reads .xlsx.');
  }
  // Scientific files open with a block of `#` comments (NOAA's do), which the
  // parser would otherwise read as rows of prose above the header. A World
  // Bank file opens with a byte-order mark, which would be part of its first
  // column's name.
  const lines = bytes.toString('utf8').replace(/^﻿/, '').split(/\r?\n/);
  let lead = 0;
  while (lead < lines.length && /^\s*(#|$)/.test(lines[lead])) lead++;
  const comments = lines.slice(0, lead).filter((l) => l.trim()).length;
  // Notes that look like rows go only when asked; --skip counts filled lines.
  const rest = lines.slice(lead);
  for (let dropped = 0; dropped < skip && rest.length;) if (rest.shift().trim()) dropped++;
  const text = rest.join('\n');
  const parsed = parseTable(text, header);
  if (!parsed.headers.length) fail('No table in that input — expected CSV, TSV or JSON rows.');
  // A headerless table is turned without the `Label, Series 1` it was given.
  let table = swap
    ? transposeTable({ headers: parsed.hadHeader ? parsed.headers : [], rows: parsed.rows })
    : { headers: parsed.headers, rows: parsed.rows };
  // Each step names its columns as they stand when it runs: a pivot makes
  // the columns a later sort names.
  const steps = (recipe.steps || []).map((raw, i) => {
    const step = toStep(raw, table.headers, i + 1);
    const run = runSteps(table, [step]);
    if (run.errors.length) {
      fail(`Step ${i + 1} (${step.op}) did not run: ${run.errors[0].replace(/^Step 1 \(\w+\) failed: /, '')}.`
        + ` The columns there are: ${table.headers.join(', ')}`);
    }
    const said = `Step ${i + 1}: ${describeStep(step, table.headers)} — ${table.rows.length} rows in,`
      + ` ${run.table.rows.length} out, columns ${run.table.headers.join(', ')}`;
    table = run.table;
    return said;
  });
  if (columns !== null) {
    // The column a facet splits by is part of the table whether named or not.
    const named = [...columns, ...(recipe.facet == null ? [] : [recipe.facet])];
    const picked = [...new Set(named.map((name) => colIndex(table.headers, name)))];
    table = { headers: picked.map((i) => table.headers[i]), rows: table.rows.map((r) => picked.map((i) => r[i])) };
  }
  if (recipe.roles) table = byRoles(table);
  return { ...parsed, table, comments, steps, notes: skip ? null : notesAbove(text, parsed) };
}

/** A column by its name, as the reader wrote it; fails naming the ones there are. */
function colIndex(headers, name, where) {
  const key = (s) => String(s ?? '').trim().toLowerCase();
  const i = headers.findIndex((h) => key(h) === key(name));
  if (i < 0) fail(`No column called "${String(name ?? '').trim()}"${where ? ` (${where})` : ''}. The columns are: ${headers.join(', ')}`);
  return i;
}

/**
 * A recipe step, by column name, as the `{op, col, …}` transform.js runs:
 * {"filter": "Source", "is": "GCAG"}, {"sort": "Year", "dir": "desc"},
 * {"pivot": "source", "rows": "year", "value": "net_generation"}.
 */
function toStep(raw, headers, n) {
  const ops = OPS.map((o) => o.id);
  const has = raw && typeof raw === 'object' ? ops.filter((op) => op in raw) : [];
  if (has.length !== 1) fail(`Step ${n} needs exactly one of ${ops.join(', ')}; it has ${has.join(', ') || 'none'}.`);
  const op = has[0];
  const col = (name, part = op) => colIndex(headers, name, `step ${n}, ${part}`);
  const agg = (a, none) => {
    if (a == null || a === '') return none;
    if (!AGGREGATES.some((x) => x.id === a)) fail(`Step ${n}: "agg" is one of ${AGGREGATES.map((x) => x.id).join(', ')}.`);
    return a;
  };
  switch (op) {
    case 'filter': {
      const tests = TESTS.map((t) => t.id).filter((t) => t in raw);
      if (tests.length !== 1) fail(`Step ${n} (filter) needs one test of ${TESTS.map((t) => t.id).join(', ')}.`);
      const test = tests[0];
      const both = test === 'between' ? raw.between : [raw[test], ''];
      if (!Array.isArray(both) || both.length !== 2) fail(`Step ${n}: "between" takes two values, such as [1950, 2000].`);
      return { op, col: col(raw.filter), test, a: String(both[0] ?? ''), b: String(both[1] ?? '') };
    }
    case 'group':
      return { op, col: col(raw.group), agg: agg(raw.agg, 'sum'), vals: raw.values && raw.values.map((v) => col(v, 'values')) };
    case 'bin': return { op, col: col(raw.bin), bins: raw.bins || 10 };
    case 'sort': return { op, col: col(raw.sort), dir: raw.dir === 'desc' ? 'desc' : 'asc' };
    case 'limit':
      if (!(raw.limit >= 1)) fail(`Step ${n}: "limit" is how many rows to keep, such as {"limit": 10}.`);
      return { op, n: raw.limit };
    case 'transpose': return { op };
    case 'pivot': {
      const c = col(raw.pivot);
      const v = col(raw.value, 'value');
      // Year, Source, Mean: the rows are the one column left.
      const k = raw.rows == null ? headers.findIndex((_, i) => i !== c && i !== v) : col(raw.rows, 'rows');
      return { op, col: c, key: k, val: v, agg: agg(raw.agg, '') };
    }
    default: return { op };
  }
}

/**
 * The column a distribution chart should take its groups from, named. Its
 * reader takes a first column of words for the groups, and reads a table of
 * numbers as one group per column — so a weekday (1–7) or a wine's quality
 * score (3–8) was drawn as one more group beside the measure. Headed `group`,
 * as the data editor writes it, the column is read as the group names.
 */
function byRoles(table) {
  const def = chartId && getChart(chartId);
  if (!def || !def.data || expectedFormat(def).shape !== 'observations') {
    const takers = CHARTS.filter((d) => d.data && expectedFormat(d).shape === 'observations').map((d) => d.id);
    fail(`"roles" names the group and the value for a chart drawing one distribution per group (${takers.join(', ')}).`
      + ' For any other chart, choose and order its columns with "columns".');
  }
  const g = colIndex(table.headers, recipe.roles.group, 'roles.group');
  const v = colIndex(table.headers, recipe.roles.value, 'roles.value');
  return { headers: ['group', table.headers[v]], rows: table.rows.map((r) => [r[g], r[v]]) };
}

/**
 * Rows of notes above the data. An ONS download opens with "Title", "CDID",
 * "Unit" and five more, two cells each like the rows under them, so neither
 * the parser's title rule nor its header guess can tell them from data; every
 * chart then reads a column of words and numbers. They hold no number where
 * the rows below do. A header is one such row, and a title the parser already
 * dropped is another, so it takes more than those. Returns their first cells.
 */
function notesAbove(text, parsed) {
  const rows = parseTable(text, false).rows;
  const number = (r) => r.some((c) => c !== '' && looksNumeric(c));
  const k = rows.findIndex(number);
  const below = rows.slice(k);
  const known = (parsed.skipped || 0) + (parsed.hadHeader ? 1 : 0);
  return k > Math.max(1, known) && below.length >= 3 && below.filter(number).length >= 0.9 * below.length
    ? rows.slice(0, k).map((r) => r[0])
    : null;
}

/**
 * The chart after reading the table: its spec, and the table it now holds.
 * A recipe's facet splits it into one panel per value of that column, read
 * by the chart's own reader, as the studio's small multiples are.
 */
function held(def, table) {
  const spec = newSpec(def);
  const by = recipe.facet == null ? -1 : colIndex(table.headers, recipe.facet, 'facet');
  const res = by < 0 ? applyData(def, spec, table) : facetByColumn(def, spec, table, by);
  if (!res.ok || typeof def.toText !== 'function') return null;
  return { spec, split: by < 0 ? '' : res.message, ...parseTable(def.toText(spec), true) };
}

/** The table without one column: what a chart split by that column reads. */
const without = (t, c) => ({ headers: t.headers.filter((_, i) => i !== c), rows: t.rows.map((r) => r.filter((_, i) => i !== c)) });

/** Put the split-by column back on the front of what a chart reads from the rest. */
const withSplit = (read, whole, c) => (c < 0 ? read : {
  headers: [whole.headers[c], ...read.headers],
  rows: read.rows.map((r, i) => [whole.rows[i][c], ...r]),
});

/**
 * A long table: dates down one column, repeating once for each value of a
 * column of words. Year, Source, Mean holds GCAG's years and then GISTEMP's,
 * and Year with Source is one row each. A chart reads a series from a column,
 * so drawn as it is the series come one after another — whichever column the
 * chart happens to take its labels from. Null when the table is not one.
 */
function longTable(t) {
  const nums = numericColumns(t);
  const col = (c) => t.rows.map((r) => String(r[c] ?? '').trim());
  for (let d = 0; d < t.headers.length; d++) {
    const dates = col(d);
    if (new Set(dates).size === dates.length || !isDateLabels(dates)) continue;
    const by = t.headers.findIndex((_, c) => c !== d && !nums.includes(c)
      && new Set(col(c).map((v, i) => `${dates[i]}\u0000${v}`)).size === t.rows.length);
    const measures = nums.filter((c) => c !== d && c !== by).map((c) => t.headers[c]);
    if (by >= 0 && measures.length) return { date: t.headers[d], by: t.headers[by], measures, names: [...new Set(col(by))] };
  }
  return null;
}

/**
 * Labels that are dates but do not run one way. A long table (symbol, date,
 * price) holds one run of dates per symbol, one after another, and an ONS
 * download holds its years, then its quarters, then its months. A chart
 * through either doubles back in time. Says how, or returns ''.
 */
function timeRuns(labels) {
  if (!isDateLabels(labels)) return '';
  const { dayFirst } = dateOrder(labels);
  const t = labels.map((l) => parseDateLabel(l, dayFirst));
  const back = t.map((v, i) => i > 0 && v < t[i - 1]);
  const first = back.indexOf(true);
  // Newest first is an order too; only a column that goes both ways is mixed.
  if (first > 0 && t.some((v, i) => i > 0 && v > t[i - 1])) {
    const n = back.filter(Boolean).length;
    return `the dates run backwards ${n} time${n === 1 ? '' : 's'}, first "${labels[first - 1]}" → "${labels[first]}"`;
  }
  const known = t.filter(Number.isFinite);
  const repeats = known.length - new Set(known).size;
  return repeats ? `${repeats} of the ${known.length} dates repeat an earlier one` : '';
}

/**
 * Print what the chart holds and say where that differs from what was meant.
 * Each check is a failure on public data: labels that repeat (raw rows drawn
 * one bar each), dates that double back (a long table), measures a hundredfold
 * apart on one axis, blank cells drawn as 0, more colour groups than colours,
 * and a column the reason names whose first value the chart does not hold
 * (the reason argues one thing, the link draws another).
 */
function report(def, whole, table, why) {
  const h = held(def, table);
  if (!h) { out('   holds: nothing — the table did not apply, so the link opens on the example'); return null; }
  out(`   holds: ${h.headers.join(', ')} — ${h.rows.length} rows, first: ${cells(h.rows[0] || [])}`);
  // Only where the first column is words: a scatter shares the label-value
  // shape, and its first column is x, where repeats mean nothing.
  const labels = new Set(h.rows.map((r) => r[0])).size;
  const named = h.rows.filter((r) => Number.isFinite(toNumber(r[0]))).length * 2 < h.rows.length;
  const shape = expectedFormat(def).shape;
  const long = !recipe.facet && longTable(whole);
  if (h.split) out(`   split: ${h.split}`);
  const groups = shape === 'observations' ? [...new Set(h.rows.map((r) => r[0]))] : [];
  // The reverse, on a distribution: a column of dates or names read as the
  // groups gives every row a group of its own, one value each.
  if (shape === 'observations' && h.rows.length > 1 && labels === h.rows.length) {
    out(`   ! every row is its own group (${labels} groups of one value). Keep only the measure,`
      + ' or a column of a few groups beside it, with --columns.');
  } else if (shape === 'observations' && h.rows.length > 1 && !named && !recipe.roles) {
    // dataio's reader takes a column with one blank cell for group names.
    out('   ! the groups are numbers, so a measure was read as group names. A blank cell in the measure'
      + ' does this: drop those rows with a step, {"filter": "<measure>", "filled": true}. If the numbers'
      + ' do name the groups, say so with "roles".');
  } else if (groups.length > 1 && groups.every((g) => table.headers.includes(g))) {
    // Read one group per column, a weekday or a score beside the measure is
    // drawn as a group of its own numbers. Few whole numbers, each in many
    // rows, is what a column naming groups looks like.
    const spread = table.headers.map((name, c) => {
      const vals = table.rows.map((r) => r[c]).filter((v) => String(v ?? '').trim() !== '');
      const n = new Set(vals.map((v) => toNumber(v))).size;
      const few = vals.length && n >= 2 && n <= 24 && n * 2 <= vals.length && vals.every((v) => Number.isInteger(toNumber(v)));
      return { name, n, few };
    });
    // The fewest values first, and the measure that varies most: births by
    // weekday, not by year or by day of the month.
    const few = spread.filter((s) => s.few).sort((a, b) => a.n - b.n);
    const value = (spread.filter((s) => !s.few).sort((a, b) => b.n - a.n)[0] || {}).name;
    if (few.length && value) {
      out(`   ! ${few.slice(0, 3).map((f) => `"${f.name}" holds ${f.n} different whole numbers`).join(', ')}`
        + `, drawn as ${few.length === 1 ? 'a group' : 'groups'} of ${few.length === 1 ? 'its' : 'their'} own values.`
        + ` If one names the groups: ${recipeFor({ chart: def.id, roles: { group: few[0].name, value } })}`);
    }
  }
  if (recipe.roles && groups.length > 1) {
    const n = groups.map(toNumber);
    if (n.every(Number.isFinite) && n.some((v, i) => i && v < n[i - 1])) {
      out(`   ! the groups are in the order first seen (${groups.slice(0, 4).join(', ')}, …). Put`
        + ` {"sort": "${recipe.roles.group}"} first in the steps to draw them in order.`);
    }
  }
  const time = h.headers[0] === 'label' && !h.split ? timeRuns(h.rows.map((r) => r[0])) : '';
  if (time) {
    out(`   ! ${time}: the rows hold more than one series, or more than one kind of period, so the chart`
      + ' draws the same dates more than once. ' + (long ? 'The long-table note above has the recipes that turn it.'
        : 'Keep one with a step in a recipe, {"steps": [{"filter": "<column>", "is": "<value>"}]};'
          + ' the studio\'s Shape tab has the same steps.'));
  }
  if (PER_ROW.has(shape) && named && labels < h.rows.length && !time && !h.split) {
    out(`   ! labels repeat: one mark per row, ${h.rows.length} rows, ${labels} different label${labels === 1 ? '' : 's'}.`
      + (long ? ' It is the long table in the note above: a recipe there turns it.'
        : ' Fine for steps in time; for observations of a few groups, group them first (a "group" step,'
          + ' or the studio\'s Shape tab) or choose a chart made for raw rows.'));
  }
  if (shape === 'xyGroups' && labels > PALETTE.length) {
    out(`   ! ${labels} groups and ${PALETTE.length} colours${labels === h.rows.length ? ' (every row is its own group)' : ''}:`
      + ' the colours repeat, so the groups cannot be told apart. Keep a column of a few groups, or none, with --columns.');
  }
  // Measures a fiftyfold apart share one axis badly: CO₂'s uncertainty beside
  // its mean, a stock's volume beside its price. A chart with a right axis
  // is made for exactly that.
  if (shape === 'labelSeries' && !(def.controls || []).some((c) => /^right axis/i.test(String(c.label || '')))) {
    const peaks = h.headers.slice(1).map((name, i) =>
      [name, h.rows.reduce((m, r) => Math.max(m, Math.abs(toNumber(r[i + 1])) || 0), 0)]);
    const top = Math.max(0, ...peaks.map(([, p]) => p));
    const small = peaks.filter(([, p]) => p > 0 && p * 50 < top).map(([name]) => `"${name}"`);
    if (small.length) {
      const one = small.length === 1;
      out(`   ! "${peaks.find(([, p]) => p === top)[0]}" reaches ${approx(top)} and ${small.slice(0, 3).join(', ')}${small.length > 3 ? ', …' : ''}`
        + ` ${one ? 'stays' : 'stay'} under a fiftieth of that: on one axis ${one ? 'it is' : 'they are'} too small to see.`
        + ' Leave one side out with --columns, or give the small side its own axis (mixed-bar-line has two).');
    }
  }
  // dataio reads a blank cell as 0: a month nobody measured draws as zero
  // unemployment, and a penguin with no measurements sits at the origin.
  // A cell that is not a number at all is said once, of the table.
  const zeros = (rows) => rows.reduce((n, r) => n + r.filter((c) => toNumber(c) === 0).length, 0);
  // Where the chart names its series after the columns, only those it kept:
  // a line chart takes eight of NASA's eighteen.
  const kept = numericColumns(table).filter((c) => !h.headers.some((n) => table.headers.includes(n))
    || h.headers.includes(table.headers[c]));
  const holes = kept.map((c) => [c, table.rows.filter((r) => String(r[c] ?? '').trim() === '').length])
    .filter(([, n]) => n);
  const drawn = Math.min(holes.reduce((n, [, k]) => n + k, 0), zeros(h.rows) - zeros(table.rows));
  if (drawn > 0) {
    const one = drawn === 1;
    out(`   ! ${drawn} blank cell${one ? '' : 's'} in ${holes.map(([k]) => `"${table.headers[k]}"`).join(', ')} ${one ? 'is' : 'are'}`
      + ' drawn as 0, a value nobody measured. Say so; to leave those rows out, a recipe step:'
      + ` ${JSON.stringify({ filter: table.headers[holes[0][0]], filled: true })}${holes.length > 1 ? ', one per column' : ''}.`);
  }
  const first = h.rows[0] || [];
  const same = (a, b) => String(a).trim() === String(b).trim() || toNumber(a) === toNumber(b);
  const missing = [...new Set([...(why || '').matchAll(/"([^"]+)"/g)].map((m) => m[1]))].filter((name) => {
    const value = whole.rows[0] && whole.rows[0][whole.headers.indexOf(name)];
    return whole.headers.includes(name) && String(value ?? '').trim() && !first.some((v) => same(v, value));
  });
  if (missing.length) {
    out(`   ! the reason is about ${missing.map((n) => `"${n}"`).join(', ')}, which this chart does not hold.`
      + ' Choose its columns with --columns.');
  }
  return h;
}

const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, path, value) => {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((a, k) => (a[k] ??= {}), o)[last] = value;
};
/** Round up to 1, 1.5, 2, 2.5 … of a power of ten, for an axis end. */
const niceUp = (v) => {
  if (!(v > 0)) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  return +(Math.ceil((v / p) * 2) / 2 * p).toPrecision(12);
};
/** 1, 2, 2.5 or 5 of a power of ten: a tick step that reads cleanly. */
const niceStep = (span) => {
  const p = 10 ** Math.floor(Math.log10(span));
  return [1, 2, 2.5, 5, 10].find((f) => f * p >= span) * p;
};
/**
 * Where an axis should run for data from lo to hi. Zero stays in, unless the
 * chart lets its minimum be set, which says a position rather than a length
 * is read off it: then data far from zero (penguin flippers of 172–231mm, the
 * years 1565–1821) gets an axis of its own instead of one two-thirds empty.
 */
const bounds = (lo, hi, positional) => {
  if (positional && (lo > 0 ? lo : -hi) > 2 * (hi - lo)) {
    const s = niceStep((hi - lo) / 5);
    return [Math.floor(lo / s) * s, Math.ceil(hi / s) * s].map((v) => +v.toPrecision(12));
  }
  return [lo >= 0 ? 0 : -niceUp(-lo), niceUp(hi)];
};

/**
 * Take the example's presentation off a chart that now holds someone else's
 * numbers — the "$…K" on 3,260 commits, the "Avg order value ($)" title and
 * the 0–100 axis that squashed 150 iris flowers into a corner. Found by
 * control label, as facet.js finds bounds, because `opts.max` is an axis on
 * one chart and a circle size on another. Says what it changed.
 */
function fitToData(def, h, table) {
  const changed = [];
  const kept = [];
  const example = newSpec(def);
  const col = (name) => h.headers.indexOf(name);
  // Every column but a leading label or group is a measure.
  const measures = h.headers.map((_, c) => c).filter((c) => c > 0 || h.headers[0] === 'x');
  // An error bar reaches past its mean by the error, and the axis is a hard scale.
  const [mean, err] = [col('mean'), col('error')];
  const cells = (r, cols) => (mean >= 0 && err >= 0
    ? [toNumber(r[mean]) - Math.abs(toNumber(r[err])), toNumber(r[mean]) + Math.abs(toNumber(r[err]))]
    : cols.map((c) => toNumber(r[c])));
  const extent = (cols) => h.rows.flatMap((r) => cells(r, cols)).filter(Number.isFinite)
    .reduce(([lo, hi], v) => [Math.min(lo, v), Math.max(hi, v)], [Infinity, -Infinity]);
  // The reader's column a held one came from: the only one holding all its
  // numbers. Position is no guide — a chart may put the first column on x.
  const source = (i) => {
    const want = h.rows.map((r) => toNumber(r[i])).filter(Number.isFinite);
    const hits = want.length ? table.headers.filter((_, c) => {
      const have = new Set(table.rows.map((r) => toNumber(r[c])));
      // A blank the chart drew as 0 is still that column's.
      if (table.rows.some((r) => r[c] === '')) have.add(0);
      return want.every((v) => have.has(v));
    }) : [];
    return hits.length === 1 ? hits[0] : '';
  };
  const settable = (def.controls || []).some((c) => /^(axis|scale) minimum$/i.test(String(c.label || '')));
  for (const c of def.controls || []) {
    const label = String(c.label || '');
    const now = c.key ? getPath(h.spec, c.key) : undefined;
    let next;
    if (c.type === 'text' && /\b(prefix|suffix|unit name)$/i.test(label) && now) next = '';
    else if (c.type === 'text' && /^[xy] axis (title|label)$/i.test(label) && now) {
      const i = col(label[0].toLowerCase());
      next = i >= 0 ? source(i) : '';
    } else if (c.type === 'slider' && /^(axis|scale|x|y) (maximum|minimum)$/i.test(label)) {
      const axis = /^[xy] /i.test(label) ? col(label[0].toLowerCase()) : -1;
      const [lo, hi] = extent(axis >= 0 ? [axis] : measures);
      // One value, or none, says nothing about where an axis should run.
      if (!(hi > lo)) continue;
      const [min, max] = bounds(lo, hi, axis >= 0 || settable);
      next = /maximum/i.test(label) ? max : min;
      // A scatter's minimum and units have no control of their own. They sit
      // beside its maximum (opts.xMax, opts.xMin, opts.xPrefix), and an
      // example's yMin of 2 hides every point below it.
      for (const [part, value] of axis >= 0 ? [['Min', min], ['Prefix', ''], ['Suffix', '']] : []) {
        const key = c.key.replace(/Max$/, part);
        const was = getPath(h.spec, key);
        if (key === c.key || was === undefined || was === value) continue;
        setPath(h.spec, key, value);
        changed.push(`${label.replace(/maximum$/i, part === 'Min' ? 'minimum' : part.toLowerCase())} ${JSON.stringify(was)} → ${JSON.stringify(value)}`);
      }
    } else if (c.type === 'text' && now && now === getPath(example, c.key)) {
      // Wording the reader did not rewrite. Which of it still fits is a judgement.
      kept.push(`${label} ${JSON.stringify(now)}`);
    }
    if (next !== undefined && next !== now) {
      setPath(h.spec, c.key, next);
      changed.push(`${label} ${JSON.stringify(now)} → ${JSON.stringify(next)}`);
    }
  }
  if (changed.length) out(`Reset from the example: ${changed.join(', ')}.`);
  if (kept.length) out(`Still the example's: ${kept.join(', ')}.`);
}

/** The table the chart reads, as CSV, for a studio upload when no link can hold it. */
function saveTable(t) {
  const cell = (v) => (/[",\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  writeFileSync(save, [t.headers, ...t.rows].map((r) => r.map(cell).join(',')).join('\n') + '\n');
  out(`Saved the ${t.rows.length} rows of ${t.headers.join(', ')} it reads to ${save}.`);
}

/**
 * The chart and its data as one page: the studio's Standalone export, built
 * by the same `generateCode`. A link carries the spec in its address and a
 * server refuses an address past 8 KB; a file has no such limit, and opened
 * from disk it draws the chart, fetching its libraries from their CDNs.
 */
function writePage(def, spec) {
  if (!spec) { out(`Wrote nothing to ${html}: the table did not apply.`); return; }
  writeFileSync(html, generateCode(def, spec).standalone);
  out(`Wrote ${def.id} holding this data to ${html}: one page, which opens in a browser.`);
}

/**
 * Print the studio link: this chart, holding the table when a spec is given.
 * A server refuses a link past 8 KB before the page can read it, so that one
 * opens on the example and says how the table gets in instead.
 */
async function link(def, spec, title) {
  const url = new URL('studio.html', base);
  url.searchParams.set('chart', def.id);
  const plain = url.toString();
  if (spec) url.searchParams.set('s', await encodeSpec(spec));
  const text = url.toString();
  if (spec && url.pathname.length + url.search.length > SERVER_LIMIT) {
    out(`${title} on its example, since no link can hold this table:`);
    out(`  ${plain}`);
    out(`  (With the table the link is ${text.length} characters, and web servers refuse links past ${SERVER_LIMIT}:`
      + ' GitHub Pages answers "414 URI Too Long". '
      + (html ? `${html} holds the chart with it.)`
        : 'Rerun with --html <file.html> for the chart and its data as one page, or --save <file.csv>'
          + ' for the columns it reads, to upload in the chart\'s data editor.)'));
    return;
  }
  out(spec ? `${title} with this data:` : `${title} (example data):`);
  out(`  ${text}`);
  if (text.length > URL_COMFORTABLE) {
    out(`  (${text.length} characters: some apps cut long links. If it opens on the example, paste the table into the studio's data editor instead.)`);
  }
}

function describeInput(input) {
  const { table } = input;
  if (input.comments) out(`Skipped ${input.comments} comment line(s) at the top.`);
  if (skip) out(`Skipped the first ${skip} line(s), as asked.`);
  out(`Header row: ${input.hadHeader ? 'yes' : 'no'}`
    + (header === undefined ? ' (guessed; rerun with --header or --no-header if that is wrong)' : '')
    + (input.skipped ? `; ${input.skipped} title row(s) above it skipped` : ''));
  input.steps.forEach((s) => out(s));
  if (columns !== null) out(`Kept columns: ${table.headers.join(', ')}`);
  if (recipe.roles) out(`Groups from "${recipe.roles.group}", values from "${recipe.roles.value}".`);
  if (input.notes) {
    const n = input.notes.length;
    out(`Note (bad): the first ${n} rows hold no numbers and the rows below do: `
      + `${input.notes.slice(0, 4).map((c) => JSON.stringify(c)).join(', ')}${n > 4 ? ', …' : ''}. Notes above the data?`
      + ` Rerun with --skip ${n}, or --skip ${n - 1} if the last of them is the header row; add --header`
      + ' if the columns then come out as Label, Series 1, … (a header of years looks like data).');
  }
  if (table.rows.length <= 1) {
    out(`Note (bad): only ${table.rows.length} row. If this is JSON, the rows may sit inside another object`
      + ' or array (the World Bank API answers [metadata, rows]): save just the list of rows and run again.');
  }
  // NASA's "***" for a year not over yet: the reader fails a column of
  // numbers on one such cell, so Year with J-D drew nothing at all.
  const strays = table.headers.map((name, c) => {
    const vals = table.rows.map((r) => String(r[c] ?? '').trim()).filter(Boolean);
    const bad = vals.filter((v) => !(looksNumeric(v) && Number.isFinite(toNumber(v))));
    return { name, bad: [...new Set(bad)], share: vals.length ? 1 - bad.length / vals.length : 0 };
  }).filter((s) => s.bad.length && s.share >= 0.5);
  if (strays.length) {
    const [s] = strays;
    out(`Note (bad): ${strays.slice(0, 3).map((o) => `"${o.name}"`).join(', ')}${strays.length > 3 ? ', …' : ''}`
      + ` ${strays.length === 1 ? 'holds' : 'hold'} cells that are not numbers (${s.bad.slice(0, 3).map((v) => `"${v}"`).join(', ')}),`
      + ' which a chart reads as 0 or will not read at all. To drop those rows, a recipe step per column charted:'
      + ` ${JSON.stringify({ filter: s.name, not: s.bad[0] })}`);
  }
  // Said once, of the table, rather than under every chart that draws it so.
  const long = !recipe.facet && longTable(table);
  if (long) {
    const { date, by, measures, names } = long;
    const one = chartId || 'line-basic';
    const value = measures[0];
    out(`Note (bad): a long table. "${date}" repeats once for each "${by}" (${names.length}: `
      + `${names.slice(0, 3).join(', ')}${names.length > 3 ? ', …' : ''}), so a chart reading it as it is draws`
      + ' those series one after another. A recipe turns it:');
    out(`  a line each:  ${recipeFor({ chart: 'line-multi', steps: [{ pivot: by, rows: date, value }] })}`
      + (names.length > PALETTE.length ? ` (${names.length} lines and ${PALETTE.length} colours)` : ''));
    out(`  a panel each: ${recipeFor({ chart: one, columns: [date, value], facet: by })}`);
    out(`  one of them:  ${recipeFor({ chart: one, steps: [{ filter: by, is: names[0] }], columns: [date, value] })}`);
    if (measures.length > 1) out(`  "value" can be any of ${measures.map((m) => `"${m}"`).join(', ')}.`);
  }
}

if (list) {
  for (const d of CHARTS) {
    // The columns are the example's, so they illustrate the layout rather
    // than name what the reader's table must call its columns.
    out(`${d.id} | ${d.category} | ${d.title} | ${d.blurb} | ${d.data ? `e.g. ${expectedFormat(d).columns.join(', ')}` : 'no table'}`);
  }
} else if (chartId !== null) {
  const def = getChart(chartId);
  if (!def) {
    const near = searchCharts(chartId).slice(0, 6).map((d) => d.id);
    fail(`No chart called "${chartId}".${near.length ? ` Close: ${near.join(', ')}.` : ''} --list shows them all.`);
  }
  // Read first, so a bad file or column name fails before anything prints.
  const input = def.data ? readTable() : null;
  const fmt = expectedFormat(def);
  const help = helpFor(def) || {};
  out(`${def.id} — ${def.title} (${def.category})`);
  out(def.blurb);
  if (def.data) {
    out(`Reads: ${fmt.columns.join(', ')}${fmt.hint ? ` — ${fmt.hint}` : ''}`);
    out('Example:');
    String(def.data.example || '').split('\n').slice(0, 6).forEach((l) => out(`  ${l}`));
  } else {
    out('Takes no table — it is set up from the studio controls.');
  }
  if (help.read) out(`How to read it: ${help.read}`);
  if (help.watch) out(`Watch: ${help.watch}`);

  let h = null;
  if (input) {
    out();
    describeInput(input);
    // Split by a column, the chart reads the rest of the table, once a panel.
    const by = recipe.facet == null ? -1 : colIndex(input.table.headers, recipe.facet, 'facet');
    const body = by < 0 ? input.table : without(input.table, by);
    const rank = rankCharts(body);
    const fit = rank.fits.find((e) => e.def.id === def.id);
    const part = rank.partial.find((e) => e.def.id === def.id);
    const miss = rank.misses.find((e) => e.def.id === def.id);
    out(fit ? 'Your table: it reads it as is.'
      : part ? `Your table: it reads only ${names(body, part.using)}.`
        : `Your table: it cannot read it — ${(miss && miss.message) || 'the shape does not match'}`);
    const read = (fit || part) && ((fit || part).table || body);
    if (read) h = report(def, input.table, withSplit(read, input.table, by), null);
    if (h) fitToData(def, h, read);
    if (save && read) saveTable(withSplit(read, input.table, by));
    if (html) writePage(def, h && h.spec);
  }
  await link(def, h && h.spec, 'Open it');
} else {
  if (recipe.facet != null) fail('"facet" splits one chart into panels, so the recipe needs a "chart" too.');
  const input = readTable();
  if (!input) fail('Give a file, "-" for stdin, --chart <id> or --list.');
  const { table } = input;
  const prof = profileTable(table);
  const rank = rankCharts(table);
  const readable = new Map([...rank.fits, ...rank.partial].map((e) => [e.def.id, e]));
  const { suggestions } = recommendCharts(prof, new Set(readable.keys()));

  out(`Table: ${summarise(prof)}`);
  out(`Columns: ${prof.columns.map((c) => `${c.name} (${c.idLike ? 'id, ignored' : c.type})`).join(', ')}`);
  describeInput(input);
  prof.quality.forEach((q) => out(`Note (${q.level}): ${q.text}`));

  const holds = new Map();
  if (suggestions.length) {
    suggestions.forEach((s, i) => {
      const e = readable.get(s.id);
      out();
      out(`${i + 1}. ${s.id} — ${s.def.title}`);
      out(`   why: ${s.why}`);
      if (s.caution) out(`   watch: ${s.caution}`);
      if (e.using) out(`   from: ${names(table, e.using)}`);
      holds.set(s.id, report(s.def, table, e.table || table, s.why));
    });
  } else {
    out();
    out('No rule fits this table, so there is no recommendation. Charts that can read it:');
    [...rank.fits, ...rank.partial].slice(0, 8).forEach((e) => out(`  ${e.def.id} — ${e.def.title}`));
  }

  // The analysis panel's views: charts of the table *aggregated*, which is
  // what a long file usually needs and the whole-table list above cannot say.
  // Each prints the recipe that draws it, from the same plans the panel shows.
  const views = recommendAnalysisCharts(table, prof).map((p) => ({ p, recipe: recipeOf(p, table.headers) }))
    .filter((v) => v.recipe).slice(0, 5);
  if (views.length) {
    out();
    out('Views of this table, aggregated (run one to see what the chart holds):');
    views.forEach(({ p, recipe: r }) => {
      out(`  ${p.id} — ${p.title} [${p.goal}]`);
      out(`    why: ${p.why}`);
      if (p.caution) out(`    watch: ${p.caution}`);
      out(`    ${recipeFor(r)}`);
    });
  }

  out();
  out(`${rank.fits.length} charts read this table as is; ${rank.partial.length} more read some of its columns.`);
  const top = suggestions.length ? readable.get(suggestions[0].id) : rank.fits[0] || rank.partial[0];
  if (top) {
    const h = holds.get(top.def.id) || held(top.def, top.table || table);
    if (h) fitToData(top.def, h, top.table || table);
    if (save) saveTable(top.table || table);
    if (html) writePage(top.def, h && h.spec);
    await link(top.def, h && h.spec, `Open ${top.def.id}`);
    out('Another chart, other columns or rows: --chart <id> [--columns a,b,c], or --recipe, and the same input.');
  } else {
    out('No chart reads this table. Try --swap, or --header / --no-header.');
  }
}
