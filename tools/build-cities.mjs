/**
 * Generate the per-country city index that the studio's city picker uses.
 *
 * Run once against the GeoNames-derived cities.json; the output is committed
 * so the site needs no build step and no runtime dependency on that source.
 *
 *   node .cache/build-cities.mjs
 *
 * Output: data/cities/<ISO2>.json, each a compact [[name, lat, lon], …] array
 * so only the country a user picks is ever downloaded.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cleanCityName } from './place-names.mjs';

const raw = JSON.parse(readFileSync('.cache/cities-raw.json', 'utf8'));
const OUT = 'data/cities';
mkdirSync(OUT, { recursive: true });

// Cities that share a name within one country are almost always duplicates of
// the same place in the gazetteer; keep the first and drop the rest.
const byCountry = new Map();
for (const c of raw) {
  const iso = c.country;
  if (!iso) continue;
  const lat = Number(c.lat);
  const lon = Number(c.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  if (!byCountry.has(iso)) byCountry.set(iso, new Map());
  const seen = byCountry.get(iso);
  // The gazetteer occasionally carries a name in its own script, or the same
  // place spelled twice in one field. Neither is usable in a picker.
  const name = cleanCityName(c.name);
  if (!seen.has(name)) {
    // Three decimals is ~110m — far finer than any dot on a national map.
    seen.set(name, [name, +lat.toFixed(3), +lon.toFixed(3)]);
  }
}

const index = {};
let total = 0;
for (const [iso, seen] of byCountry) {
  const list = [...seen.values()].sort((a, b) => a[0].localeCompare(b[0]));
  writeFileSync(join(OUT, iso + '.json'), JSON.stringify(list));
  index[iso] = list.length;
  total += list.length;
}

writeFileSync(join(OUT, '_index.json'), JSON.stringify(index));

const size = readdirSync(OUT).reduce((n, f) => n + statSync(join(OUT, f)).size, 0);
console.log(`${Object.keys(index).length} countries, ${total} cities`);
console.log(`total ${(size / 1048576).toFixed(1)}MB, largest country ${(Math.max(...readdirSync(OUT).map((f) => statSync(join(OUT, f)).size)) / 1024).toFixed(0)}KB`);
