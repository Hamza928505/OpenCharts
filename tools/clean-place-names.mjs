/**
 * clean-place-names.mjs — apply `place-names.mjs` to the committed data.
 *
 * The lists in `data/` were built from Natural Earth and a gazetteer, and both
 * carry spellings nobody would type: countries abbreviated to fit a map label,
 * and a handful of cities left in their own script or listed twice in one
 * field. Rebuilding from source would fix it, but that means re-downloading a
 * gazetteer to change 25 strings.
 *
 *   node tools/clean-place-names.mjs           report what would change
 *   node tools/clean-place-names.mjs --write   change it
 *
 * Idempotent: a second run reports nothing. The builders import the same rules,
 * so a full rebuild lands in the same place.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ENGLISH_COUNTRY, EXTRA_ISO, CORRECT_ISO, cleanCityName } from './place-names.mjs';

const write = process.argv.includes('--write');
const say = (...a) => console.log(...a);

/* ── countries ───────────────────────────────────────────────────────────── */

const countriesPath = 'data/countries.json';
const countries = JSON.parse(readFileSync(countriesPath, 'utf8'));
const cityIndex = JSON.parse(readFileSync('data/cities/_index.json', 'utf8'));

const renamed = [];
const coded = [];

const nextCountries = countries.map(([name, iso, cities]) => {
  const english = ENGLISH_COUNTRY[name] || name;
  if (english !== name) renamed.push(`${name} → ${english}`);

  let code = iso;
  if (CORRECT_ISO[english] && CORRECT_ISO[english] !== code) {
    coded.push(`${english} ${code || '—'} → ${CORRECT_ISO[english]} (was another country's)`);
    code = CORRECT_ISO[english];
  } else if (!code && EXTRA_ISO[english]) {
    code = EXTRA_ISO[english];
    coded.push(`${english} → ${code}`);
  }
  // A code the country list did not have may bring a city list with it.
  const count = code && cityIndex[code] ? cityIndex[code] : cities;
  return [english, code, count];
});

say(`countries: ${renamed.length} renamed, ${coded.length} given a code`);
renamed.forEach((r) => say('  ' + r));
coded.forEach((r) => say('  ' + r));

/* ── cities ──────────────────────────────────────────────────────────────── */

const CITY_DIR = 'data/cities';
let touchedFiles = 0;
let touchedNames = 0;
const examples = [];

const nextCities = new Map();
let merged = 0;
for (const file of readdirSync(CITY_DIR)) {
  if (file === '_index.json') continue;
  const iso2 = file.slice(0, 2);
  const rows = JSON.parse(readFileSync(join(CITY_DIR, file), 'utf8'));
  let changed = false;

  const next = rows.map((row) => {
    // The country decides whether this name is a transliteration.
    const clean = cleanCityName(row[0], iso2);
    if (clean === row[0]) return row;
    changed = true;
    touchedNames++;
    if (examples.length < 20) examples.push(`${iso2}  ${row[0]} → ${clean}`);
    return [clean, row[1], row[2]];
  });

  if (!changed) continue;
  touchedFiles++;

  // Folding can make two rows identical — the gazetteer carries `Ḩulwān` and
  // `Hulwan` for the same place. Only an exact match on name *and* both
  // coordinates is a duplicate; two real towns that happen to share a folded
  // name are still two towns, and dropping one would lose a place.
  const seen = new Set();
  const deduped = next.filter((r) => {
    const key = `${r[0]}|${r[1]}|${r[2]}`;
    if (seen.has(key)) { merged++; return false; }
    seen.add(key);
    return true;
  });

  // Renaming can reorder, and the picker lists cities alphabetically.
  deduped.sort((a, b) => a[0].localeCompare(b[0]));
  nextCities.set(file, deduped);
}

say(`cities: ${touchedNames} names in ${touchedFiles} countries, ${merged} exact duplicates merged`);
examples.forEach((e) => say('  ' + e));

/* ── write ───────────────────────────────────────────────────────────────── */

if (!write) {
  say('\nnothing written — rerun with --write');
} else {
  writeFileSync(countriesPath, JSON.stringify(nextCountries));
  for (const [file, rows] of nextCities) {
    writeFileSync(join(CITY_DIR, file), JSON.stringify(rows));
  }
  say(`\nwrote ${countriesPath} and ${nextCities.size} city files`);
}
