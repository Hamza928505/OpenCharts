/**
 * build-flags.mjs — writes `data/flags.json`, the vendored flag icon set.
 *
 * Flags are fetched once here and committed as base64 PNG, rather than linked
 * to flagcdn.com at page load. Three reasons, in the order they bit:
 *
 * - **Emoji flags do not render on Windows.** Segoe UI Emoji ships no glyphs
 *   for the regional-indicator pairs, so Chrome draws the two letters instead
 *   and every flag in the picker reads `FR`, `DE`, `JP`. The one format that
 *   costs nothing is the one format that does not work for a large share of
 *   the people using this.
 * - **A hotlinked CDN breaks the exports.** `engines.js` serialises a chart to
 *   a standalone file people open from disk and mail around. A flag that is a
 *   remote URL is a broken image the moment that file is offline, and the
 *   project's disclosure rule (`cdn.js`) would have to carry a third-party
 *   host that no chart actually needs.
 * - **SVG is the wrong vendored format here, by an order of magnitude.** The
 *   optimised SVGs are 191 bytes for France and 249KB for El Salvador, because
 *   a coat of arms is a coat of arms; all 194 come to several megabytes. The
 *   same set as 80px-wide PNG is ~140KB, which is small enough to ship whole.
 *
 * 80px is chosen to survive a 2× display at the ~40px a legend or tooltip may
 * want, and 4× at the ~20px a picker row uses.
 *
 * The set covers the union of both country lists — the atlas in
 * `data/countries.json` and the curated list in `data/country-meta.json` — so
 * `flagFor()` can answer for any country either one names. Ten atlas entries
 * (Greenland, Taiwan, Kosovo, Israel…) are absent from the curated list and
 * would otherwise be the only flagless rows in the picker.
 *
 * Source: flagcdn.com, whose images are public domain. Re-run when a country
 * changes its flag, which is rarer than it sounds.
 *
 *   node tools/build-flags.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(ROOT, 'data', 'flags.json');
const WIDTH = 80;

/** Every ISO2 either list names, so no picker row can be left flagless. */
function wanted() {
  const codes = new Set();
  const atlas = path.join(ROOT, 'data', 'countries.json');
  if (existsSync(atlas)) {
    for (const [, iso2] of JSON.parse(readFileSync(atlas, 'utf8'))) {
      if (iso2) codes.add(String(iso2).toUpperCase());
    }
  }
  const meta = path.join(ROOT, 'data', 'country-meta.json');
  if (existsSync(meta)) {
    for (const iso2 of Object.keys(JSON.parse(readFileSync(meta, 'utf8')))) {
      codes.add(iso2.toUpperCase());
    }
  }
  return [...codes].sort();
}

/**
 * flagcdn serves a handful of codes under a different name, and answers 404
 * for a few the atlas carries as polygons but nobody issues a flag for.
 * A miss is reported rather than retried forever — `flagFor()` falls back to
 * a neutral swatch, which is a better answer than a broken image.
 */
async function fetchFlag(iso2, tries = 3) {
  const url = `https://flagcdn.com/w${WIDTH}/${iso2.toLowerCase()}.png`;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length) throw new Error('empty');
      // A PNG starts with the eight-byte signature. Anything else is an error
      // page with a 200 on it, which would otherwise be committed as a flag.
      if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
      return buf.toString('base64');
    } catch (err) {
      if (i === tries - 1) { console.warn(`  ${iso2}: ${err.message}`); return null; }
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return null;
}

/** Six at a time — enough to be quick, few enough to be a polite guest. */
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

const codes = wanted();
console.log(`fetching ${codes.length} flags at ${WIDTH}px…`);

const b64 = await pool(codes, 6, fetchFlag);

const flags = {};
const missing = [];
codes.forEach((code, i) => {
  if (b64[i]) flags[code] = b64[i]; else missing.push(code);
});

writeFileSync(OUT, JSON.stringify(flags), 'utf8');

const bytes = Buffer.byteLength(readFileSync(OUT));
console.log(`data/flags.json — ${Object.keys(flags).length} flags, ${(bytes / 1024).toFixed(1)}KB`);
if (missing.length) console.log(`  no flag for: ${missing.join(', ')}`);
