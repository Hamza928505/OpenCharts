import assert from 'node:assert/strict';
import { profileTable, LIMITS } from '../js/studio/profile.js';
import { recommendCharts, namedCharts } from '../js/studio/recommend.js';
import { getChart } from '../js/studio/registry.js';

const make = (headers, build, n = 30) => ({ headers, rows: Array.from({ length: n }, (_, i) => build(i).map(String)) });
const roleOf = (p, name) => p.columns.find((c) => c.name === name).role;

// What a column is for, from its name and values, with the evidence named.
const wide = make(['Zip', 'Phone number', 'Order no', 'Account balance', 'Rating', 'Region', 'Store', 'SKU', 'Revenue'], (i) => [
  10000 + ((i * 37) % 9000), 5550000 + i, 700 + i, 100 + i * 7, 1 + ((i * 7) % 5), ['N', 'S', 'E'][i % 3], `Shop ${i}`, `P-${100 + i}`, 1000 + i * 25]);
const p = profileTable(wide);
assert.deepEqual(['Zip', 'Phone number', 'Order no'].map((n) => roleOf(p, n)), ['identifier', 'identifier', 'identifier'], 'codes are identifiers by name');
assert.equal(roleOf(p, 'Account balance'), 'measure', 'an account balance is a quantity; the head noun decides');
assert.equal(roleOf(p, 'Revenue'), 'measure');
assert.equal(roleOf(p, 'Region'), 'dimension');
assert.equal(roleOf(p, 'Store'), 'label');
assert.equal(roleOf(p, 'SKU'), 'identifier', 'a SKU is an identifier even when it is words');
assert.ok(p.columns.find((c) => c.name === 'Zip').roleWhy.includes('zip code'), 'the reason is stated in the column name');
assert.ok(!p.numbers.some((c) => ['Zip', 'Phone number', 'Order no'].includes(c.name)), 'identifiers are not measures');

// The lesson this codebase already paid for: revenue as all-distinct integers is still a measure.
const revenue = make(['Region', 'Revenue', 'Visits', 'Value'], (i) => [`R${i}`, 520 + i * 90, 41 + i * 3, 7 + i], 5);
assert.deepEqual(['Revenue', 'Visits', 'Value'].map((n) => roleOf(profileTable(revenue), n)), ['measure', 'measure', 'measure']);

// A scale is ambiguous, says so, and groups only where a measure remains and no date is present.
const survey = make(['Stars', 'Spend', 'Segment'], (i) => [1 + ((i * 7) % 5), 20 + i * 3.5, ['a', 'b', 'c'][i % 3]]);
const s = profileTable(survey);
const stars = s.columns[0];
assert.equal(stars.role, 'ordinal');
assert.equal(stars.ambiguous, true);
assert.deepEqual(stars.alternatives, ['measure']);
assert.ok(s.categories.some((c) => c.name === 'Stars') && !s.numbers.some((c) => c.name === 'Stars'), 'a scale joins the groups and leaves the measures');
assert.ok(s.quality.some((q) => q.column === 'Stars' && q.level === 'info'), 'and the report says it chose');
const loneScale = profileTable(make(['Stars'], (i) => [1 + ((i * 7) % 5)]));
assert.ok(loneScale.numbers.some((c) => c.name === 'Stars'), 'a lone scale stays something to draw');
const dated = profileTable(make(['Day', 'Visits', 'Sales'], (i) => [`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, 1 + (i % 4), 100 + i * 5]));
assert.ok(dated.numbers.some((c) => c.name === 'Visits'), 'beside a date, small whole numbers stay measures');
assert.ok(LIMITS.fewCategories >= 5, 'the scale ceiling is the shared limit');

// Units come from the cells or the heading, never from a guess.
const units = profileTable(make(['Growth', 'Price', 'Share (%)', 'Cost (USD)', 'Plain'], (i) => [`${i % 50}%`, `$${10 + i}`, i % 40, 5 + i, 3 + i * 1.5]));
const unitOf = (n) => units.columns.find((c) => c.name === n).unit;
assert.deepEqual([unitOf('Growth'), unitOf('Price')], [{ kind: 'percent', basis: 'cells' }, { kind: 'currency', symbol: '$', basis: 'cells' }]);
assert.deepEqual([unitOf('Share (%)').basis, unitOf('Cost (USD)').code], ['heading', 'USD']);
assert.equal(unitOf('Plain'), undefined);

// Places: by heading, and a coordinate has to fit on the globe.
const places = profileTable(make(['Country', 'Latitude', 'Longitude', 'Lat', 'Litres'], (i) => [['DE', 'FR', 'JP'][i % 3], 40 + i / 10, -100 + i, 200 + i, 3 + i]));
const geo = (n) => places.columns.find((c) => c.name === n).geo;
assert.deepEqual([geo('Country').kind, geo('Latitude').kind, geo('Longitude').kind], ['country', 'latitude', 'longitude']);
assert.equal(geo('Lat'), undefined, 'a "latitude" of 230 is not one');
assert.equal(places.geo.length, 3);
const readable = new Set(['choropleth', 'bar-horizontal', 'bar-vertical', 'treemap']);
const { suggestions } = recommendCharts(places, readable);
assert.equal(suggestions[0].id, 'choropleth', 'a country column and a measure lead with a map');
assert.equal(suggestions[0].goal, 'geographic');
assert.match(suggestions[0].why, /"Country" names countries/);
assert.ok(namedCharts().every((id) => getChart(id)), 'every chart a rule names exists, geographic included');
assert.ok(!recommendCharts(profileTable(make(['Region', 'Litres'], (i) => [['N', 'S'][i % 2], i])), readable).suggestions.some((x) => x.id === 'choropleth'), 'a "Region" column is not assumed to be countries');

// What was true before stays true.
const before = profileTable(make(['Year', 'Sales'], (i) => [2000 + i, 100 + i]));
assert.equal(before.columns[0].type, 'date');
assert.equal(before.columns[0].role, 'time');
console.log('Profile roles: identifiers by name, scales flagged ambiguous, units, places, revenue integers still measures passed.');
