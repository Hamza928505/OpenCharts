/**
 * benchmark.mjs — what the recommender offers for sixteen real public tables,
 * scored against labels, with a guard that it does not get worse.
 *
 *   node test/benchmark.mjs            score, print, and fail on a regression
 *   node test/benchmark.mjs --update   write the result as the new baseline
 *
 * Read `test/benchmark/README.md` before quoting a number from this. The labels
 * are one reader's opinion and are marked unreviewed; the held-out split was
 * labelled before it was scored but is not independent of whoever labelled it;
 * sixteen tables is enough to notice a regression and not enough to claim an
 * accuracy. The scores here are for comparing one version of the recommender
 * with the next, and nothing else.
 *
 * It runs entirely offline from `test/benchmark/data`, and nothing in it is
 * random, so equal code gives equal numbers.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseTable } from '../js/studio/dataio.js';
import { profileTable } from '../js/studio/profile.js';
import { rankCharts } from '../js/studio/DataMatch.js';
import { recommendCharts } from '../js/studio/recommend.js';
import { recommendAnalysisCharts, recipeOf } from '../js/studio/analysis-charts.js';
import { CHARTS, getChart } from '../js/studio/registry.js';

const here = (p) => new URL(`./benchmark/${p}`, import.meta.url);
const labels = JSON.parse(readFileSync(here('labels.json'), 'utf8'));
const TOLERANCE = 0.01;
const GOOD = 2;

/** The file as `choose.mjs` reads it: comment lines and notes dropped, then parsed. */
function load({ id, read = {} }) {
  const lines = readFileSync(here(`data/${id}.csv`), 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  let lead = 0;
  while (lead < lines.length && /^\s*(#|$)/.test(lines[lead])) lead++;
  const rest = lines.slice(lead);
  for (let dropped = 0; dropped < (read.skip || 0) && rest.length;) if (rest.shift().trim()) dropped++;
  const parsed = parseTable(rest.join('\n'), read.header);
  return { headers: parsed.headers, rows: parsed.rows };
}

/** What the skill prints for a table: the whole-table suggestions, then the aggregated views. */
function offer(table) {
  const prof = profileTable(table);
  const rank = rankCharts(table);
  const readable = new Set([...rank.fits, ...rank.partial].map((e) => e.def.id));
  const suggestions = recommendCharts(prof, readable).suggestions.map((s) => s.id);
  const views = recommendAnalysisCharts(table, prof)
    .map((p) => recipeOf(p, table.headers)).filter(Boolean).slice(0, 5).map((r) => r.chart);
  const offered = [...new Set([...suggestions, ...views])];
  return { suggestions, views, offered, readable };
}

const gradeOf = (set, id) => set.relevant[id] || 0;
const dcg = (grades) => grades.reduce((sum, g, i) => sum + g / Math.log2(i + 2), 0);

function score(set, list, readable) {
  const top = (k) => list.slice(0, k);
  const grades = (k) => top(k).map((id) => gradeOf(set, id));
  const ideal = Object.values(set.relevant).sort((a, b) => b - a).slice(0, 5);
  return {
    // Precision divides by K even for a shorter list: offering two charts is not a better answer than offering three.
    p1: grades(1).filter((g) => g >= GOOD).length / 1,
    p3: grades(3).filter((g) => g >= GOOD).length / 3,
    ndcg5: ideal.length ? dcg(grades(5)) / dcg(ideal) : 0,
    top1Gold: gradeOf(set, list[0]) === 3 ? 1 : 0,
    // Is the chart reachable at all, anywhere in the list? This is what an assistant reading the whole output can act on.
    reachGold: list.some((id) => gradeOf(set, id) === 3) ? 1 : 0,
    reachGood: list.some((id) => gradeOf(set, id) >= GOOD) ? 1 : 0,
    // Offered ids the registry does not have, or (for the whole-table list) that cannot read the table.
    invalid: list.filter((id) => !getChart(id) || (readable && !readable.has(id))).length,
    count: list.length,
  };
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (n) => Math.round(n * 1000) / 1000;

function run() {
  const rows = labels.datasets.map((set) => {
    const o = offer(load(set));
    return {
      id: set.id,
      split: set.split,
      top1: o.suggestions[0] || null,
      offered: o.offered,
      suggestions: score(set, o.suggestions, o.readable),
      views: score(set, o.views),
      offeredScore: score(set, o.offered, null),
      categories: new Set(o.offered.slice(0, 3).map((id) => getChart(id)?.category)).size / Math.min(3, o.offered.length || 1),
    };
  });
  const summarise = (subset) => {
    const part = (name) => ({
      p1: round(mean(subset.map((r) => r[name].p1))),
      p3: round(mean(subset.map((r) => r[name].p3))),
      ndcg5: round(mean(subset.map((r) => r[name].ndcg5))),
      top1Gold: round(mean(subset.map((r) => r[name].top1Gold))),
      reachGold: round(mean(subset.map((r) => r[name].reachGold))),
      reachGood: round(mean(subset.map((r) => r[name].reachGood))),
      invalidRate: round(subset.reduce((a, r) => a + r[name].invalid, 0) / Math.max(1, subset.reduce((a, r) => a + r[name].count, 0))),
    });
    return {
      datasets: subset.length,
      suggestions: part('suggestions'),
      views: part('views'),
      offered: part('offeredScore'),
      // Variety across tables: the same chart at the top of every one is the complaint this measures.
      distinctTop1: round(new Set(subset.map((r) => r.top1)).size / subset.length),
      distinctOffered: new Set(subset.flatMap((r) => r.offered)).size,
      // Variety within one answer: how many chart families the top three span.
      diversity: round(mean(subset.map((r) => r.categories))),
    };
  };
  return {
    rows,
    all: summarise(rows),
    dev: summarise(rows.filter((r) => r.split === 'dev')),
    heldout: summarise(rows.filter((r) => r.split === 'heldout')),
  };
}

// The labels have to describe charts that exist, and every file has to be there.
assert.ok(Array.isArray(labels.datasets) && labels.datasets.length >= 12);
for (const set of labels.datasets) {
  assert.ok(['dev', 'heldout'].includes(set.split), `${set.id}: split is dev or heldout`);
  assert.ok(Object.keys(set.relevant).length && Object.keys(set.relevant).every((id) => getChart(id)), `${set.id}: every labelled chart exists`);
  assert.ok(Object.values(set.relevant).every((g) => [1, 2, 3].includes(g)), `${set.id}: grades are 1, 2 or 3`);
}
assert.equal(new Set(labels.datasets.map((d) => d.id)).size, labels.datasets.length, 'dataset ids are unique');
assert.ok(CHARTS.length > 0);

const first = run();
assert.deepEqual(run(), first, 'two runs on equal code give equal numbers');

// What a reader of the log needs to know, before any number.
console.log(labels.reviewed ? 'Labels: reviewed.' : 'Labels: PROPOSED, NOT REVIEWED by the project owner. Read these numbers as a regression signal, not as accuracy.');
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad('table', 11)}${pad('split', 9)}${pad('top pick', 18)}${pad('p@3', 6)}${pad('ndcg@5', 8)}${pad('best', 6)}offered`);
for (const r of first.rows) {
  const best = r.offeredScore.reachGold ? 'yes' : r.offeredScore.reachGood ? 'good' : 'no';
  console.log(`${pad(r.id, 11)}${pad(r.split, 9)}${pad(r.top1 || '-', 18)}${pad(round(r.offeredScore.p3), 6)}${pad(round(r.offeredScore.ndcg5), 8)}${pad(best, 6)}${r.offered.join(' ')}`);
}
for (const name of ['all', 'dev', 'heldout']) {
  const s = first[name];
  console.log(`\n${name} (${s.datasets} tables)`);
  for (const list of ['suggestions', 'views', 'offered']) {
    const m = s[list];
    console.log(`  ${pad(list, 12)}P@1 ${m.p1}  P@3 ${m.p3}  NDCG@5 ${m.ndcg5}  first is the best ${m.top1Gold}  best offered anywhere ${m.reachGold}  a good one offered ${m.reachGood}  invalid ${m.invalidRate}`);
  }
  console.log(`  variety: ${s.distinctTop1} distinct top picks per table, ${s.distinctOffered} distinct charts offered in all, top three from different chart families ${s.diversity} (1 = always)`);
}

const result = { labelsReviewed: labels.reviewed, all: first.all, dev: first.dev, heldout: first.heldout };

if (process.argv.includes('--update')) {
  writeFileSync(here('baseline.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('\nBaseline written.');
} else {
  let base;
  try { base = JSON.parse(readFileSync(here('baseline.json'), 'utf8')); } catch { base = null; }
  assert.ok(base, 'test/benchmark/baseline.json is missing. Run: node test/benchmark.mjs --update');
  const higher = [];
  for (const split of ['all', 'dev', 'heldout']) {
    for (const list of ['suggestions', 'views', 'offered']) {
      for (const m of ['p1', 'p3', 'ndcg5', 'top1Gold', 'reachGold', 'reachGood']) higher.push([`${split}.${list}.${m}`, first[split][list][m], base[split][list][m]]);
      assert.equal(first[split][list].invalidRate, 0, `${split}.${list}: nothing offered may be unreadable or unknown`);
    }
    for (const m of ['distinctTop1', 'diversity']) higher.push([`${split}.${m}`, first[split][m], base[split][m]]);
    higher.push([`${split}.distinctOffered`, first[split].distinctOffered, base[split].distinctOffered]);
  }
  const worse = higher.filter(([, now, then]) => now < then - TOLERANCE * (then > 1 ? then : 1));
  const better = higher.filter(([, now, then]) => now > then + TOLERANCE * (then > 1 ? then : 1));
  assert.equal(worse.length, 0, `The recommender got worse than the baseline on: ${worse.map(([k, n, t]) => `${k} ${t} -> ${n}`).join('; ')}. If that is intended, run node test/benchmark.mjs --update and say why in the commit.`);
  if (better.length) console.log(`\nBetter than the baseline on ${better.length} measures. Lock it in with: node test/benchmark.mjs --update`);
  console.log('\nBenchmark: determinism, label integrity, no invalid offers, and no regression from the baseline passed.');
}
