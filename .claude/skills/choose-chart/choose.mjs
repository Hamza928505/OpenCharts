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
 *   --save <file>            write the table the chart reads as CSV, for a studio upload
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
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { parseTable, transposeTable, applyData, expectedFormat, looksNumeric } from '../../../js/studio/dataio.js';
import { profileTable } from '../../../js/studio/profile.js';
import { toNumber } from '../../../js/studio/transform.js';
import { rankCharts } from '../../../js/studio/DataMatch.js';
import { recommendCharts, summarise } from '../../../js/studio/recommend.js';
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

const base = (option('--base') || 'https://hamza928505.github.io/OpenCharts/').replace(/\/?$/, '/');
const chartId = option('--chart');
const columns = option('--columns');
const skip = Number(option('--skip') || 0);
const save = option('--save');
const list = flag('--list');
const swap = flag('--swap');
const yes = flag('--header');
const no = flag('--no-header');
const header = yes ? true : no ? false : undefined;
const source = args[0];
const names = (table, using) => using.map((c) => table.headers[c]).join(', ');
const cells = (row) => row.slice(0, 8).map((c) => String(c).slice(0, 30)).join(', ') + (row.length > 8 ? ', …' : '');
const approx = (v) => Number(v.toPrecision(3)).toLocaleString('en-US');
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
  // parser would otherwise read as rows of prose above the header.
  const lines = bytes.toString('utf8').split(/\r?\n/);
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
  if (columns !== null) {
    const key = (s) => String(s).trim().toLowerCase();
    const picked = columns.split(',').map((name) => {
      const i = table.headers.findIndex((h) => key(h) === key(name));
      if (i < 0) fail(`No column called "${name.trim()}". The columns are: ${table.headers.join(', ')}`);
      return i;
    });
    table = { headers: picked.map((i) => table.headers[i]), rows: table.rows.map((r) => picked.map((i) => r[i])) };
  }
  return { ...parsed, table, comments, notes: skip ? null : notesAbove(text, parsed) };
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

/** The chart after reading the table: its spec, and the table it now holds. */
function held(def, table) {
  const spec = newSpec(def);
  if (!applyData(def, spec, table).ok || typeof def.toText !== 'function') return null;
  return { spec, ...parseTable(def.toText(spec), true) };
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
  // The reverse, on a distribution: a column of dates or names read as the
  // groups gives every row a group of its own, one value each.
  if (shape === 'observations' && h.rows.length > 1 && labels === h.rows.length) {
    out(`   ! every row is its own group (${labels} groups of one value). Keep only the measure,`
      + ' or a column of a few groups beside it, with --columns.');
  } else if (shape === 'observations' && h.rows.length > 1 && !named) {
    // dataio's reader takes a column with one blank cell for group names.
    out('   ! the groups are numbers, so a measure was read as group names. A blank cell in the'
      + ' measure does this; this chart cannot take the table as it is.');
  }
  const time = h.headers[0] === 'label' ? timeRuns(h.rows.map((r) => r[0])) : '';
  if (time) {
    out(`   ! ${time}: the rows hold more than one series, or more than one kind of period, so the chart`
      + ' draws the same dates more than once. Keep one (the studio\'s Shape tab can filter rows); a line per'
      + ' series needs a column per series, which the studio cannot make from these rows.');
  }
  if (PER_ROW.has(shape) && named && labels < h.rows.length && !time) {
    out(`   ! labels repeat: one mark per row, ${h.rows.length} rows, ${labels} different label${labels === 1 ? '' : 's'}.`
      + ' Fine for steps in time; for observations of a few groups, group them first (the studio\'s'
      + ' Shape tab) or choose a chart made for raw rows.');
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
  const zeros = (rows) => rows.reduce((n, r) => n + r.filter((c) => toNumber(c) === 0).length, 0);
  const holes = table.headers.map((_, c) => c).filter((c) =>
    table.rows.some((r) => r[c] === '') && table.rows.some((r) => Number.isFinite(toNumber(r[c]))));
  const blank = table.rows.reduce((n, r) => n + holes.filter((c) => r[c] === '').length, 0);
  const drawn = Math.min(blank, zeros(h.rows) - zeros(table.rows));
  if (drawn > 0) {
    out(`   ! ${drawn} blank cell${drawn === 1 ? '' : 's'} in ${holes.map((c) => `"${table.headers[c]}"`).join(', ')}`
      + ` ${drawn === 1 ? 'is' : 'are'} drawn as 0, a value nobody measured. Say so; if those rows should not be`
      + ' drawn, the studio\'s Shape tab can filter them out.');
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
      + ' GitHub Pages answers "414 URI Too Long". Paste or upload the table in the chart\'s data editor; '
      + (save ? `${save} holds the columns it reads.)` : 'rerun with --save <file.csv> for a file of the columns it reads.)'));
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
  if (columns !== null) out(`Kept columns: ${table.headers.join(', ')}`);
  out(`Header row: ${input.hadHeader ? 'yes' : 'no'}`
    + (header === undefined ? ' (guessed; rerun with --header or --no-header if that is wrong)' : '')
    + (input.skipped ? `; ${input.skipped} title row(s) above it skipped` : ''));
  if (input.notes) {
    const n = input.notes.length;
    out(`Note (bad): the first ${n} rows hold no numbers and the rows below do: `
      + `${input.notes.slice(0, 4).map((c) => JSON.stringify(c)).join(', ')}${n > 4 ? ', …' : ''}. Notes above the data?`
      + ` Rerun with --skip ${n}, or --skip ${n - 1} if the last of them is the header row.`);
  }
  if (table.rows.length <= 1) {
    out(`Note (bad): only ${table.rows.length} row. If this is JSON, the rows may sit inside another object`
      + ' or array (the World Bank API answers [metadata, rows]): save just the list of rows and run again.');
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
    const rank = rankCharts(input.table);
    const fit = rank.fits.find((e) => e.def.id === def.id);
    const part = rank.partial.find((e) => e.def.id === def.id);
    const miss = rank.misses.find((e) => e.def.id === def.id);
    out(fit ? 'Your table: it reads it as is.'
      : part ? `Your table: it reads only ${names(input.table, part.using)}.`
        : `Your table: it cannot read it — ${(miss && miss.message) || 'the shape does not match'}`);
    if (fit || part) h = report(def, input.table, (fit || part).table || input.table, null);
    if (h) fitToData(def, h, (fit || part).table || input.table);
    if (save && (fit || part)) saveTable((fit || part).table || input.table);
  }
  await link(def, h && h.spec, 'Open it');
} else {
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

  out();
  out(`${rank.fits.length} charts read this table as is; ${rank.partial.length} more read some of its columns.`);
  const top = suggestions.length ? readable.get(suggestions[0].id) : rank.fits[0] || rank.partial[0];
  if (top) {
    const h = holds.get(top.def.id) || held(top.def, top.table || table);
    if (h) fitToData(top.def, h, top.table || table);
    if (save) saveTable(top.table || table);
    await link(top.def, h && h.spec, `Open ${top.def.id}`);
    out('Another chart, or other columns: --chart <id> [--columns a,b,c] and the same input.');
  } else {
    out('No chart reads this table. Try --swap, or --header / --no-header.');
  }
}
