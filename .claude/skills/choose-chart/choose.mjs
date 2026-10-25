#!/usr/bin/env node
/**
 * choose.mjs — the library's own answer to "which chart?", for an assistant.
 *
 *   node .claude/skills/choose-chart/choose.mjs <file|->              rank the charts for a table
 *   node .claude/skills/choose-chart/choose.mjs --chart <id> [file|-]  one chart: what it reads, and a link
 *   node .claude/skills/choose-chart/choose.mjs --list                 every chart, one line each
 *
 *   --header / --no-header   settle the header row instead of guessing it
 *   --swap                   turn the table rows-for-columns first
 *   --base <url>             point links at another copy of the site
 *
 * Nothing here holds an opinion of its own. `profile.js` describes the table,
 * `rankCharts` decides what can read it, `recommend.js` orders and explains,
 * and `chart-help.js` says how each chart misleads — the calls the gallery's
 * matcher makes, so an assistant and the page cannot disagree.
 */

import { readFileSync } from 'node:fs';
import { parseTable, transposeTable, applyData, expectedFormat } from '../../../js/studio/dataio.js';
import { profileTable } from '../../../js/studio/profile.js';
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
const list = flag('--list');
const swap = flag('--swap');
const yes = flag('--header');
const no = flag('--no-header');
const header = yes ? true : no ? false : undefined;
const source = args[0];
const names = (table, using) => using.map((c) => table.headers[c]).join(', ');

function readTable() {
  if (!source) return null;
  const bytes = readFileSync(source === '-' ? 0 : source);
  // .xlsx is a ZIP and .xls an OLE file; the browser reads both, Node here
  // has no DOMParser to do it with.
  if ((bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf)) {
    fail('That is a spreadsheet file, not text. Save it as CSV, or upload it in the studio, which reads .xlsx.');
  }
  const parsed = parseTable(bytes.toString('utf8'), header);
  if (!parsed.headers.length) fail('No table in that input — expected CSV, TSV or JSON rows.');
  // A headerless table is turned without the `Label, Series 1` it was given.
  const table = swap
    ? transposeTable({ headers: parsed.hadHeader ? parsed.headers : [], rows: parsed.rows })
    : { headers: parsed.headers, rows: parsed.rows };
  return { ...parsed, table };
}

/** The studio, opened on this chart — holding this table when one is given. */
async function link(def, table) {
  const url = new URL('studio.html', base);
  url.searchParams.set('chart', def.id);
  if (table) {
    const spec = newSpec(def);
    if (!applyData(def, spec, table).ok) return `${url} (the table did not apply, so this opens on the example)`;
    url.searchParams.set('s', await encodeSpec(spec));
  }
  const text = url.toString();
  return text.length > URL_COMFORTABLE
    ? `${text}\n  (${text.length} characters: some apps cut long links. If it opens on the example, paste the table into the studio's data editor instead.)`
    : text;
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

  const input = def.data ? readTable() : null;
  let entry = null;
  if (input) {
    const rank = rankCharts(input.table);
    const fit = rank.fits.find((e) => e.def.id === def.id);
    const part = rank.partial.find((e) => e.def.id === def.id);
    const miss = rank.misses.find((e) => e.def.id === def.id);
    entry = fit || part;
    out(fit ? 'Your table: it reads it as is.'
      : part ? `Your table: it reads only ${names(input.table, part.using)}.`
        : `Your table: it cannot read it — ${(miss && miss.message) || 'the shape does not match'}`);
  }
  out(entry ? 'Open it with this data:' : 'Open it (example data):');
  out(`  ${await link(def, entry ? entry.table || input.table : null)}`);
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
  out(`Header row: ${input.hadHeader ? 'yes' : 'no'}`
    + (header === undefined ? ' (guessed; rerun with --header or --no-header if that is wrong)' : '')
    + (input.skipped ? `; ${input.skipped} title row(s) above it skipped` : ''));
  prof.quality.forEach((q) => out(`Note (${q.level}): ${q.text}`));

  if (suggestions.length) {
    suggestions.forEach((s, i) => {
      const e = readable.get(s.id);
      out();
      out(`${i + 1}. ${s.id} — ${s.def.title}`);
      out(`   why: ${s.why}`);
      if (s.caution) out(`   watch: ${s.caution}`);
      if (e.using) out(`   uses only: ${names(table, e.using)}`);
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
    out(`Open ${top.def.id} with this data:`);
    out(`  ${await link(top.def, top.table || table)}`);
    out('Another chart with this data: --chart <id> and the same input.');
  } else {
    out('No chart reads this table. Try --swap, or --header / --no-header.');
  }
}
