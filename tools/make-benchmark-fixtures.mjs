#!/usr/bin/env node
/**
 * make-benchmark-fixtures.mjs — fetch the public files `test/benchmark.mjs`
 * scores the recommender on, and cut each to a size that can be committed.
 *
 *   node tools/make-benchmark-fixtures.mjs [id ...]
 *
 * Kept for provenance, like the other builders here: the suite itself never
 * touches the network, it reads what this wrote to `test/benchmark/data/`.
 *
 * A file longer than MAX_ROWS keeps every k-th row rather than the first N, so
 * a file sorted by group (a disasters table opens with one entity for a
 * hundred rows) still holds every group. Lines above the header are kept as
 * they were: they are part of what the reader has to cope with.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export const MAX_ROWS = 150;
const RAW = 'https://raw.githubusercontent.com';

/** `pre` is how many lines sit above the header row. */
export const SOURCES = [
  { id: 'drinks', url: `${RAW}/fivethirtyeight/data/master/alcohol-consumption/drinks.csv` },
  { id: 'births', url: `${RAW}/fivethirtyeight/data/master/births/US_births_2000-2014_SSA.csv` },
  { id: 'sealevel', url: `${RAW}/datasets/sea-level-rise/main/data/epa-sea-level.csv` },
  { id: 'globtemp', url: `${RAW}/datasets/global-temp/main/data/annual.csv` },
  { id: 'gold', url: `${RAW}/datasets/gold-prices/main/data/monthly.csv` },
  { id: 'wine', url: 'https://archive.ics.uci.edu/ml/machine-learning-databases/wine-quality/winequality-red.csv' },
  { id: 'iowa', url: `${RAW}/vega/vega-datasets/main/data/iowa-electricity.csv` },
  { id: 'disasters', url: `${RAW}/vega/vega-datasets/main/data/disasters.csv` },
  { id: 'healthexp', url: `${RAW}/mwaskom/seaborn-data/master/healthexp.csv` },
  { id: 'planets', url: `${RAW}/mwaskom/seaborn-data/master/planets.csv` },
  { id: 'gistemp', url: 'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv', pre: 1 },
  { id: 'wbpop', url: 'https://api.worldbank.org/v2/en/indicator/SP.POP.TOTL?downloadformat=csv', pre: 4, zip: /^API_SP\.POP\.TOTL.*\.csv$/ },
  // Held out: labelled before the recommender was ever run on them.
  { id: 'stocks', url: `${RAW}/vega/vega-datasets/main/data/stocks.csv` },
  { id: 'weather', url: `${RAW}/vega/vega-datasets/main/data/seattle-weather.csv` },
  { id: 'penguins', url: `${RAW}/mwaskom/seaborn-data/master/penguins.csv` },
  { id: 'flights', url: `${RAW}/mwaskom/seaborn-data/master/flights.csv` },
];

/** The first entry of a ZIP whose name matches, inflated. Central directory, deflate or stored. */
export function unzip(buf, pattern) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a ZIP file');
  let at = buf.readUInt32LE(eocd + 16);
  for (let n = buf.readUInt16LE(eocd + 10); n > 0; n--) {
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const skip = nameLen + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    at += 46 + skip;
    if (!pattern.test(name)) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + size);
    return method === 8 ? inflateRawSync(body) : body;
  }
  throw new Error(`no entry matches ${pattern}`);
}

/** Header and preamble intact, at most `max` rows, evenly spread. */
export function sample(text, pre = 0, max = MAX_ROWS) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const head = lines.slice(0, pre + 1);
  const rows = lines.slice(pre + 1).filter((l) => l.trim());
  const stride = Math.max(1, Math.ceil(rows.length / max));
  return [...head, ...rows.filter((_, i) => i % stride === 0)].join('\n') + '\n';
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const want = process.argv.slice(2);
  const dir = new URL('../test/benchmark/data/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const s of SOURCES.filter((x) => !want.length || want.includes(x.id))) {
    const res = await fetch(s.url, { headers: { 'user-agent': 'opencharts-benchmark-fixtures' } });
    if (!res.ok) throw new Error(`${s.id}: ${res.status} from ${s.url}`);
    let bytes = Buffer.from(await res.arrayBuffer());
    if (s.zip) bytes = unzip(bytes, s.zip);
    const text = sample(bytes.toString('utf8'), s.pre || 0);
    writeFileSync(new URL(`${s.id}.csv`, dir), text);
    console.log(`${s.id}: ${text.split('\n').length - 1} lines`);
  }
}
