/**
 * build-counts.mjs — write the registry's counts into the prose that quotes them.
 *
 *   node tools/build-counts.mjs            rewrite README.md, CLAUDE.md, package.json
 *   node tools/build-counts.mjs --check    exit 1 and list what is stale, write nothing
 *
 * The README opened with "114 chart types" and CLAUDE.md with "five renderers"
 * while the registry held 115 charts on six — an ECharts heatmap had landed
 * and every sentence that quoted a count kept the old one. The wiki is
 * generated from the registry so that exactly this cannot happen to it; the
 * README, the badge and the guide are prose that quotes the same facts, and a
 * fact quoted by hand becomes a lie with a timestamp.
 *
 * So the prose carries markers and this tool fills them:
 *
 *   <!-- count:charts -->115<!-- /count -->
 *
 * The comment is invisible where markdown renders and the number between the
 * two halves is replaced. Two places cannot carry a comment — the shields
 * badge URL and package.json's description — and are matched by pattern
 * instead. The suite runs `--check`, so a chart added without re-running this
 * fails the build rather than shipping a README that is off by one.
 *
 * Only *present-tense* claims are marked. A sentence recording that "all 114
 * charts gained annotations" the afternoon they did is history, and history
 * is allowed to keep its numbers.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARTS, CATEGORY_ORDER } from '../js/studio/registry.js';
import { engineOf, ENGINE_LABEL } from '../js/studio/engines.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

/* ── the facts ───────────────────────────────────────────────────────────── */

const tally = {};
CHARTS.forEach((d) => { const e = engineOf(d); tally[e] = (tally[e] || 0) + 1; });

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n) => WORDS[n] || String(n);

/** The renderer sentence, in the order the guide has always listed them. */
const rendererLine = () => {
  const order = ['chartjs', 'canvas', 'd3', 'native', 'dom', 'echarts'];
  const phrase = {
    chartjs: (n) => `Chart.js (${n})`,
    canvas: (n) => `raw Canvas 2D (${n})`,
    d3: (n) => `D3 (${n})`,
    native: (n) => `the dependency-free OpenCharts engine (${n})`,
    dom: (n) => (n === 1 ? 'one DOM/CSS chart' : `DOM/CSS (${n})`),
    echarts: (n) => (n === 1 ? 'one on Apache ECharts' : `Apache ECharts (${n})`),
  };
  const parts = order.filter((e) => tally[e]).map((e) => phrase[e](tally[e]));
  const last = parts.pop();
  return `${parts.join(', ')} and ${last}`;
};

export const COUNTS = {
  charts: CHARTS.length,
  categories: CATEGORY_ORDER.length,
  renderers: Object.keys(tally).length,
  'renderers-word': word(Object.keys(tally).length),
  chartjs: tally.chartjs || 0,
  canvas: tally.canvas || 0,
  d3: tally.d3 || 0,
  native: tally.native || 0,
  dom: tally.dom || 0,
  echarts: tally.echarts || 0,
  // The two libraries loaded eagerly serve this many charts between them.
  eager: (tally.chartjs || 0) + (tally.d3 || 0),
  // Charts whose export carries a finished config and no `spec` at all.
  'no-spec': (tally.chartjs || 0) + (tally.native || 0),
  'renderer-line': rendererLine(),
};

/* ── the rewrite ─────────────────────────────────────────────────────────── */

const MARK = /<!-- count:([a-z-]+) -->([^<]*)<!-- \/count -->/g;

/** Every marker in a text, filled — and which ones were stale. */
function fill(text, file) {
  const stale = [];
  const out = text.replace(MARK, (whole, key, was) => {
    if (!(key in COUNTS)) {
      stale.push(`${file}: unknown count "${key}"`);
      return whole;
    }
    const now = String(COUNTS[key]);
    if (was !== now) stale.push(`${file}: count:${key} says ${JSON.stringify(was)}, registry says ${now}`);
    return `<!-- count:${key} -->${now}<!-- /count -->`;
  });
  return { out, stale };
}

/** The two spots that cannot hold a comment. */
const PATTERNS = [
  {
    file: 'README.md',
    label: 'the shields badge',
    re: /(img\.shields\.io\/badge\/charts-)(\d+)(-)/,
    value: () => String(COUNTS.charts),
  },
  {
    file: 'package.json',
    label: 'the package description',
    re: /("description":\s*")(\d+)( chart types)/,
    value: () => String(COUNTS.charts),
  },
];

const stale = [];
const touched = [];

for (const file of ['README.md', 'CLAUDE.md', 'package.json']) {
  const path = join(ROOT, file);
  const before = readFileSync(path, 'utf8');
  let after = before;

  const filled = fill(after, file);
  after = filled.out;
  stale.push(...filled.stale);

  PATTERNS.filter((p) => p.file === file).forEach((p) => {
    const m = after.match(p.re);
    if (!m) { stale.push(`${file}: ${p.label} not found`); return; }
    if (m[2] !== p.value()) stale.push(`${file}: ${p.label} says ${m[2]}, registry says ${p.value()}`);
    after = after.replace(p.re, `$1${p.value()}$3`);
  });

  if (after !== before) {
    touched.push(file);
    if (!check) writeFileSync(path, after);
  }
}

/* ── the report ──────────────────────────────────────────────────────────── */

const summary = `${COUNTS.charts} charts · ${COUNTS.categories} categories · ${COUNTS.renderers} renderers `
  + `(${Object.entries(tally).map(([e, n]) => `${ENGINE_LABEL[e] || e} ${n}`).join(', ')})`;

if (check) {
  if (stale.length) {
    console.error('Counts in the prose disagree with the registry:\n  ' + stale.join('\n  '));
    console.error('\nRun `node tools/build-counts.mjs` to bring them up to date.');
    process.exit(1);
  }
  console.log(`counts agree — ${summary}`);
} else {
  console.log(touched.length ? `updated ${touched.join(', ')} — ${summary}` : `nothing to update — ${summary}`);
  if (stale.length) console.log('  ' + stale.join('\n  '));
}
