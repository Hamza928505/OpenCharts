/**
 * Pair each map country with the ISO code its city list is filed under.
 *
 * The two sources spell a number of countries differently, so matching is done
 * on a normalised name with an explicit table for the ones that will never
 * match automatically. Anything still unmatched is reported rather than
 * silently dropped — a country without a code simply has no city picker.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { ENGLISH_COUNTRY, EXTRA_ISO, CORRECT_ISO } from './place-names.mjs';

const names = JSON.parse(readFileSync('.cache/topo-names.json', 'utf8'));
const raw = JSON.parse(readFileSync('.cache/cities-raw.json', 'utf8'));
const cityIndex = JSON.parse(readFileSync('data/cities/_index.json', 'utf8'));

// ISO2 → the country names that appear alongside it in the gazetteer is not
// available, so use a static ISO2 → English name table derived from the
// Intl API, which every supported browser and Node ships.
const display = new Intl.DisplayNames(['en'], { type: 'region' });
const isoToName = {};
for (const iso of Object.keys(cityIndex)) {
  try {
    const n = display.of(iso);
    if (n && n !== iso) isoToName[iso] = n;
  } catch { /* not a region code */ }
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');

// Spellings the two sources genuinely disagree on.
const MANUAL = {
  'United States of America': 'US',
  'Dem. Rep. Congo': 'CD',
  'Dominican Rep.': 'DO',
  'Falkland Is.': 'FK',
  'Fr. S. Antarctic Lands': 'TF',
  'Bosnia and Herz.': 'BA',
  'Central African Rep.': 'CF',
  'Eq. Guinea': 'GQ',
  'eSwatini': 'SZ',
  'Solomon Is.': 'SB',
  'N. Cyprus': 'CY',
  'Somaliland': 'SO',
  'S. Sudan': 'SS',
  'Czechia': 'CZ',
  'Côte d’Ivoire': 'CI',
  "Côte d'Ivoire": 'CI',
  'W. Sahara': 'EH',
  'Myanmar': 'MM',
  'Macedonia': 'MK',
  'North Macedonia': 'MK',
  'Turkey': 'TR',
  'Türkiye': 'TR',
  'South Korea': 'KR',
  'North Korea': 'KP',
  'Laos': 'LA',
  'Vietnam': 'VN',
  'Russia': 'RU',
  'Iran': 'IR',
  'Syria': 'SY',
  'Venezuela': 'VE',
  'Bolivia': 'BO',
  'Tanzania': 'TZ',
  'Moldova': 'MD',
  'Brunei': 'BN',
  'Cape Verde': 'CV',
  'Timor-Leste': 'TL',
  'Palestine': 'PS',
  'Kosovo': 'XK',
};

const byNorm = {};
for (const [iso, name] of Object.entries(isoToName)) byNorm[norm(name)] = iso;

const out = [];
const unmatched = [];
for (const name of names) {
  let iso = MANUAL[name] || byNorm[norm(name)] || null;
  // Try a prefix match for the "Rep."-style abbreviations.
  if (!iso) {
    const key = norm(name);
    const hit = Object.keys(byNorm).find((k) => k.startsWith(key) || key.startsWith(k));
    if (hit) iso = byNorm[hit];
  }
  // The atlas spells to fit a label; the list is read by people. And a prefix
  // match cannot tell "Congo" from "Congo - Kinshasa", so the ones it gets
  // wrong are stated outright rather than left to the fallback.
  const label = ENGLISH_COUNTRY[name] || name;
  iso = CORRECT_ISO[label] || iso || EXTRA_ISO[label] || null;

  if (iso && cityIndex[iso]) out.push([label, iso, cityIndex[iso]]);
  else { out.push([label, iso || '', 0]); unmatched.push(label); }
}

writeFileSync('data/countries.json', JSON.stringify(out));
console.log(`${out.length} countries written, ${out.filter((c) => c[2] > 0).length} with a city list`);
if (unmatched.length) console.log(`no cities for ${unmatched.length}: ${unmatched.slice(0, 12).join(', ')}`);
