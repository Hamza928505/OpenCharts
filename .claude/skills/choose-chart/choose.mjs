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
 *   --swap                   turn the table rows-for-columns first
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

import { readFileSync } from 'node:fs';
import { parseTable, transposeTable, applyData, expectedFormat } from '../../../js/studio/dataio.js';
import { profileTable } from '../../../js/studio/profile.js';
import { toNumber } from '../../../js/studio/transform.js';
import { rankCharts } from '../../../js/studio/DataMatch.js';
import { recommendCharts, summarise } from '../../../js/studio/recommend.js';
import { CHARTS, getChart, newSpec, searchCharts } from '../../../js/studio/registry.js';
import { helpFor } from '../../../js/studio/chart-help.js';
import { encodeSpec, URL_COMFORTABLE } from '../../../js/studio/share.js';

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
const list = flag('--list');
const swap = flag('--swap');
const yes = flag('--header');
const no = flag('--no-header');
const header = yes ? true : no ? false : undefined;
const source = args[0];
const names = (table, using) => using.map((c) => table.headers[c]).join(', ');
const cells = (row) => row.slice(0, 8).map((c) => String(c).slice(0, 30)).join(', ') + (row.length > 8 ? ', …' : '');

/** Shapes that draw one mark per row, labelled by the first column. */
const PER_ROW = new Set(['labelSeries', 'labelValue', 'items', 'matrix', 'rowSeries', 'pairs']);

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
  const parsed = parseTable(lines.slice(lead).join('\n'), header);
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
  return { ...parsed, table, comments };
}

/** The chart after reading the table: its spec, and the table it now holds. */
function held(def, table) {
  const spec = newSpec(def);
  if (!applyData(def, spec, table).ok || typeof def.toText !== 'function') return null;
  return { spec, ...parseTable(def.toText(spec), true) };
}

/**
 * Print what the chart holds and say where that differs from what was meant.
 * Two checks, both from failures on public data: labels that repeat (raw
 * rows drawn one bar each), and a column the reason names whose first value
 * the chart does not hold (the reason argues one thing, the link draws another).
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
  if (PER_ROW.has(shape) && named && labels < h.rows.length) {
    out(`   ! labels repeat: one mark per row, ${h.rows.length} rows, ${labels} different label${labels === 1 ? '' : 's'}.`
      + ' Fine for steps in time; for observations of a few groups, group them first (the studio\'s'
      + ' Shape tab) or choose a chart made for raw rows.');
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
      return want.every((v) => have.has(v));
    }) : [];
    return hits.length === 1 ? hits[0] : '';
  };
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
      if (!Number.isFinite(hi)) continue;
      next = /maximum/i.test(label) ? niceUp(hi) : (lo >= 0 ? 0 : -niceUp(-lo));
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

/** The studio, opened on this chart — holding the table when a spec is given. */
async function link(def, spec) {
  const url = new URL('studio.html', base);
  url.searchParams.set('chart', def.id);
  if (spec) url.searchParams.set('s', await encodeSpec(spec));
  const text = url.toString();
  return text.length > URL_COMFORTABLE
    ? `${text}\n  (${text.length} characters: some apps cut long links. If it opens on the example, paste the table into the studio's data editor instead.)`
    : text;
}

function describeInput(input) {
  const { table } = input;
  if (input.comments) out(`Skipped ${input.comments} comment line(s) at the top.`);
  if (columns !== null) out(`Kept columns: ${table.headers.join(', ')}`);
  out(`Header row: ${input.hadHeader ? 'yes' : 'no'}`
    + (header === undefined ? ' (guessed; rerun with --header or --no-header if that is wrong)' : '')
    + (input.skipped ? `; ${input.skipped} title row(s) above it skipped` : ''));
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
  }
  out(h ? 'Open it with this data:' : 'Open it (example data):');
  out(`  ${await link(def, h && h.spec)}`);
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
    out(`Open ${top.def.id} with this data:`);
    out(`  ${await link(top.def, h && h.spec)}`);
    out('Another chart, or other columns: --chart <id> [--columns a,b,c] and the same input.');
  } else {
    out('No chart reads this table. Try --swap, or --header / --no-header.');
  }
}
