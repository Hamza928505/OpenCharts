import assert from 'node:assert/strict';
import { profileTable } from '../js/studio/profile.js';
import { recommendCharts, intentFromQuestion, GOALS, RULE_IDS, namedCharts } from '../js/studio/recommend.js';
import { RULE_WEIGHTS, SCORING } from '../js/studio/recommend-weights.js';
import { CHARTS, getChart } from '../js/studio/registry.js';

const all = new Set(CHARTS.map((d) => d.id));
const make = (headers, build, n = 30) => ({ headers, rows: Array.from({ length: n }, (_, i) => build(i).map(String)) });
const ids = (r) => r.suggestions.map((s) => s.id);
const cats = (r, n) => new Set(r.suggestions.slice(0, n).map((s) => s.def.category));

const dated = make(['Day', 'Region', 'Sales'], (i) => [`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, ['N', 'S', 'E', 'W'][i % 4], 100 + i * 5]);
const plain = make(['Region', 'Sales'], (i) => [['N', 'S', 'E', 'W'][i % 4], 100 + i * 5]);
const spiky = make(['Id', 'Score'], (i) => [`r${i}`, i === 3 ? 900 : 10 + (i % 7)], 40);

// The weights are a config: one per rule, none orphaned, all of them numbers.
assert.deepEqual([...RULE_IDS].sort(), Object.keys(RULE_WEIGHTS).sort(), 'every rule has a weight and every weight a rule');
assert.ok(Object.values(RULE_WEIGHTS).every(Number.isFinite));
assert.ok(SCORING.intentBoost > SCORING.redundancyPenalty, 'asking outweighs variety');
assert.ok(namedCharts().every((id) => getChart(id)), 'every chart a rule names exists, the outlier rule included');

// A question becomes a goal; a goal passes through; nothing is invented.
const asked = {
  'any outliers in this?': 'anomaly',
  'show it on a map': 'geographic',
  'which region is highest': 'ranking',
  'how has revenue grown over time': 'trend',
  'is price related to rating': 'relationship',
  'what is the distribution of ages': 'distribution',
  'what share does each product make up': 'composition',
  'compare the regions': 'comparison',
  'hello': null,
  '': null,
};
for (const [q, goal] of Object.entries(asked)) assert.equal(intentFromQuestion(q), goal, q);
assert.equal(intentFromQuestion(undefined), null);
assert.ok(GOALS.includes('ranking') && GOALS.includes('anomaly'));

// Without a question the order is the general one, and it is the same every time.
const base = recommendCharts(profileTable(dated), all);
assert.equal(base.suggestions[0].goal, 'trend', 'a dated table leads with a trend');
assert.deepEqual(ids(recommendCharts(profileTable(dated), all)), ids(base), 'equal inputs, equal order');
assert.equal(base.intent, null);
assert.equal(base.intentNote, null);

// A question reorders; it never invents a chart the table cannot draw.
const ranked = recommendCharts(profileTable(dated), all, 6, { intent: 'which region is highest' });
assert.equal(ranked.intent, 'ranking');
assert.equal(ranked.suggestions[0].def.category, 'Bar', 'asking for a ranking leads with bars even on a dated table');
assert.ok(ids(ranked).includes('line-basic'), 'the trend is still on offer, lower down');
assert.equal(recommendCharts(profileTable(dated), all, 6, { intent: 'trend' }).suggestions[0].goal, 'trend');
const named = recommendCharts(profileTable(dated), all, 6, { intent: 'distribution' });
assert.equal(named.intent, 'distribution', 'a goal name is accepted as it is');
assert.match(named.intentNote, /No rule answers "distribution"/, 'and a question nothing answers says so');

// Diversity: the lead stays the lead, the rest stop being one chart in three coats.
const diverse = recommendCharts(profileTable(plain), all);
const flat = recommendCharts(profileTable(plain), all, 6, { diversity: false });
assert.equal(ids(diverse)[0], ids(flat)[0], 'variety never changes the best suggestion');
assert.equal(cats(flat, 3).size, 1, 'by score alone, three bar variants fill the top three');
assert.ok(cats(diverse, 3).size >= 2, 'with variety the top three span at least two families');
assert.deepEqual([...new Set(ids(diverse))].sort(), [...new Set(ids(flat))].sort(), 'the same charts, in a different order');
const asking = recommendCharts(profileTable(plain), all, 6, { intent: 'ranking' });
assert.equal(cats(asking, 3).size, 1, 'a reader who asks for a ranking is not given a pie to be varied');

// Every suggestion is readable, explained, cautioned, and its score says what it is.
const readable = new Set(['bar-vertical', 'pie']);
const limited = recommendCharts(profileTable(plain), readable);
assert.ok(limited.suggestions.length > 0 && limited.suggestions.every((s) => readable.has(s.id)), 'only charts that can read the table');
for (const s of base.suggestions.concat(ranked.suggestions)) {
  assert.equal(s.scoreType, 'relative', 'a score is a relative ordering, never a probability');
  assert.ok(s.why && s.caution, `${s.id} states a reason and a caution`);
}
assert.deepEqual(base.suggestions.map((s) => s.rank), base.suggestions.map((_, i) => i + 1));

// Outliers: a rule of its own, with the values named, and only when there is a table to speak of.
const spikyOut = recommendCharts(profileTable(spiky), all, 6, { intent: 'any outliers?' });
assert.equal(spikyOut.suggestions[0].id, 'box-plot');
assert.equal(spikyOut.suggestions[0].goal, 'anomaly');
assert.match(spikyOut.suggestions[0].why, /"Score" has 1 value more than three deviations out \(900\)/);
assert.equal(spikyOut.intentNote, null);
assert.ok(!ids(recommendCharts(profileTable(make(['Id', 'Score'], (i) => [`r${i}`, i === 3 ? 900 : 10], 6)), all)).includes('beeswarm'), 'six rows are not enough to call anything an outlier');
assert.match(recommendCharts(profileTable(plain), all, 6, { intent: 'anomaly' }).intentNote, /No rule answers "anomaly"/);

console.log('Recommend ranking: weights, intent, variety, readability and the outlier rule passed.');
