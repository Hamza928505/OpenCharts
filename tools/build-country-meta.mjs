/**
 * build-country-meta.mjs — writes `data/country-meta.json` from the curated
 * country file in `tools/countries-source.json`.
 *
 * This is a *second* country list and deliberately not a replacement for
 * `data/countries.json`. The two answer different questions:
 *
 * - `countries.json` is the **atlas**. Its names are Natural Earth's, its
 *   entries are the polygons the maps can actually draw, and its city counts
 *   come from the gazetteer. It decides what a map can focus on.
 * - `country-meta.json` is the **presentation layer** — flag, local-language
 *   name, ISO3, region, and a handful of well-known cities with their local
 *   spellings. It decides how a country is *shown* once picked.
 *
 * Merging them into one file would have meant choosing one list's countries,
 * and neither is a superset: the atlas carries ten territories the curated
 * list omits (Greenland, Taiwan, Kosovo…) and the curated list carries
 * twenty-nine microstates too small to be their own polygon at 110m
 * (San Marino, Tuvalu, Monaco…). Keyed by ISO2 and merged at load, both keep
 * their own coverage and neither has to lie about the other's.
 *
 * The source has no coordinates, which is why it cannot feed the maps: every
 * point on a map is placed from `data/cities/<ISO2>.json`. What the curated
 * city names are good for is *labelling* — a gazetteer entry matched to one of
 * these gains its local-language spelling.
 *
 *   node tools/build-country-meta.mjs [source.json]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SOURCE = process.argv[2] || path.join(HERE, 'countries-source.json');
const OUT = path.join(ROOT, 'data', 'country-meta.json');

const raw = JSON.parse(readFileSync(SOURCE, 'utf8'));
const rows = Array.isArray(raw) ? raw : raw.countries;
if (!Array.isArray(rows)) throw new Error(`${SOURCE}: no "countries" array`);

/**
 * One entry per country, keyed by ISO2.
 *
 * `cities` pairs an English name with its local spelling and is omitted
 * entirely where the source says the two are the same — 99 of the 194
 * countries, so writing `null` 99 times would be a third of the file spent
 * saying nothing. A reader of the output can take a missing local name to
 * mean "the English one is already local".
 */
const out = {};
for (const c of rows) {
  const iso2 = String(c.iso2 || '').toUpperCase();
  if (!iso2) continue;

  const en = Array.isArray(c.cities_en) ? c.cities_en : [];
  const local = Array.isArray(c.cities_local) ? c.cities_local : null;

  const entry = { name: c.name, iso3: c.iso3 || '', region: c.region || '' };
  if (c.name_local && c.name_local !== c.name) entry.local = c.name_local;
  if (c.local_language) entry.lang = c.local_language;

  // [english, local?] — the second slot is dropped when it adds nothing.
  if (en.length) {
    entry.cities = en.map((name, i) => {
      const loc = local && local[i];
      return loc && loc !== name ? [name, loc] : [name];
    });
  }
  out[iso2] = entry;
}

writeFileSync(OUT, JSON.stringify(out), 'utf8');

const withLocal = Object.values(out).filter((c) => c.local).length;
const cities = Object.values(out).reduce((n, c) => n + (c.cities?.length || 0), 0);
const localCities = Object.values(out)
  .reduce((n, c) => n + (c.cities || []).filter((r) => r.length > 1).length, 0);

console.log(`data/country-meta.json — ${Object.keys(out).length} countries`);
console.log(`  ${withLocal} with a local-language name`);
console.log(`  ${cities} cities, ${localCities} with a local spelling`);
console.log(`  ${(Buffer.byteLength(readFileSync(OUT)) / 1024).toFixed(1)}KB`);
