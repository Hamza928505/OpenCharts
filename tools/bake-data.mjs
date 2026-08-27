/**
 * bake-data.mjs — turn the studio's seeded generators into literal data.
 *
 * Twenty-four charts used to draw a simulation from a seed and a handful of
 * parameter sliders. That made them the only charts nobody could actually use:
 * the numbers on screen were never anyone's numbers, the sliders were not
 * editing anything real, and the exported code shipped a random-number
 * generator where a dataset belonged.
 *
 * This produced the literal arrays that replaced them. It is kept for
 * provenance and so the sizes can be revisited — it is not part of the site
 * and the site never imports it.
 *
 *   node tools/bake-data.mjs                 print every dataset
 *   node tools/bake-data.mjs boxPlot         print one
 *   node tools/write-sample-data.mjs         write js/studio/charts/_data.js
 *
 * Two rules shaped every dataset here:
 *
 * 1. **Keep each chart's own story.** The violin was session lengths in
 *    minutes and the box plot was regional dollars; swapping in one generic
 *    sample would have left every axis label lying. Labels, units and rough
 *    magnitudes match what each chart drew before.
 *
 * 2. **Small enough to edit.** A histogram fed 2,400 simulated observations
 *    looks impressive and is impossible to change. 140 rows tell the same
 *    story and fit in the grid the reader is about to open.
 */

/* The site's own RNG, so the baked data keeps the shapes people already saw. */
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gauss(rnd, mu, sigma) {
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const round = (v, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Observations for a set of labelled groups, keeping each group's own centre. */
function groupSamples(seed, groups, { dp = 1, lo = -Infinity, hi = Infinity } = {}) {
  const rnd = makeRng(seed);
  return groups.map(({ label, mean, sd, n }) => ({
    label,
    values: Array.from({ length: n }, () => round(clamp(gauss(rnd, mean, sd), lo, hi), dp)),
  }));
}

/** A mean-reverting walk. A pure one drifts to a boundary and stops turning. */
function walk(rnd, { start, n, drift = 0, vol, pull = 0.02 }) {
  const out = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v += drift + (start - v) * pull + (rnd() - 0.5) * vol;
    out.push(v);
  }
  return out;
}

/** OHLC bars from a close-price walk, each bar opening where the last closed. */
function ohlcBars(seed, { start, n, vol, pull }) {
  const rnd = makeRng(seed);
  const closes = walk(rnd, { start, n, vol, pull });
  let prev = start;
  return closes.map((c) => {
    const o = prev;
    const spread = 1 + rnd() * (vol * 0.6);
    const bar = {
      o: round(o, 2),
      h: round(Math.max(o, c) + rnd() * spread, 2),
      l: round(Math.min(o, c) - rnd() * spread, 2),
      c: round(c, 2),
    };
    prev = c;
    return bar;
  });
}

/* ── the datasets ────────────────────────────────────────────────────────── */

export const BAKE = {};

/* Distribution — raw observations. ---------------------------------------- */

/** Customer ages. The histogram bins them; the bin width stays the user's call. */
BAKE.histogramValues = () => groupSamples(11 * 7919, [
  { label: 'Customers', mean: 34, sd: 11, n: 140 },
], { dp: 0, lo: 18, hi: 75 })[0].values;

/** Order value by region, in dollars. */
BAKE.boxGroups = () => groupSamples(5 * 7919, [
  { label: 'North', mean: 68, sd: 18, n: 30 },
  { label: 'South', mean: 55, sd: 14, n: 30 },
  { label: 'East', mean: 75, sd: 22, n: 30 },
  { label: 'West', mean: 62, sd: 16, n: 30 },
  { label: 'Central', mean: 70, sd: 20, n: 30 },
], { dp: 0, lo: 5 });

/** Session length in minutes, by device. */
BAKE.violinGroups = () => groupSamples(3 * 7919, [
  { label: 'Desktop', mean: 8, sd: 3, n: 45 },
  { label: 'Mobile', mean: 4.5, sd: 2, n: 45 },
  { label: 'Tablet', mean: 6.5, sd: 2.5, n: 45 },
], { dp: 1, lo: 0.2, hi: 17.5 });

/** An A/B test score, control against treatment. */
BAKE.densityGroups = () => groupSamples(5 * 7919 + 1, [
  { label: 'Control', mean: 52, sd: 12, n: 60 },
  { label: 'Treatment', mean: 64, sd: 9, n: 60 },
], { dp: 1, lo: 11, hi: 99 });

/** Daily temperature by month, in °C. */
BAKE.ridgelineRows = () => groupSamples(12 * 7919, [
  { label: 'Jan', mean: 4, sd: 3, n: 34 },
  { label: 'Mar', mean: 9, sd: 4, n: 34 },
  { label: 'May', mean: 16, sd: 4, n: 34 },
  { label: 'Jul', mean: 23, sd: 4, n: 34 },
  { label: 'Sep', mean: 18, sd: 4, n: 34 },
  { label: 'Nov', mean: 8, sd: 3, n: 34 },
], { dp: 1, lo: -5, hi: 35 });

/** Response time in milliseconds, two releases. */
BAKE.ecdfGroups = () => groupSamples(7 * 7919, [
  { label: 'Version A', mean: 420, sd: 130, n: 60 },
  { label: 'Version B', mean: 330, sd: 90, n: 60 },
], { dp: 0, lo: 40, hi: 890 });

/** Weekly active hours by plan. Uneven group sizes on purpose — real ones are. */
BAKE.beeswarmGroups = () => groupSamples(4 * 7919, [
  { label: 'Free', mean: 34, sd: 14, n: 45 },
  { label: 'Pro', mean: 58, sd: 16, n: 38 },
  { label: 'Enterprise', mean: 74, sd: 12, n: 26 },
], { dp: 0, lo: 2, hi: 108 });

/** Order value by region again, but every observation drawn as its own tick. */
BAKE.barcodeRows = () => groupSamples(6 * 7919, [
  { label: 'North', mean: 68, sd: 18, n: 40 },
  { label: 'South', mean: 55, sd: 14, n: 40 },
  { label: 'East', mean: 75, sd: 22, n: 40 },
  { label: 'West', mean: 62, sd: 16, n: 40 },
  { label: 'Central', mean: 70, sd: 20, n: 40 },
], { dp: 0, lo: 3, hi: 138 });

/** Wind frequency by compass point — a prevailing south-westerly. */
BAKE.windRose = () => {
  const rnd = makeRng(9 * 7919);
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  // Peak at SW, tapering both ways around the circle.
  return dirs.map((label, i) => {
    const offset = Math.min(Math.abs(i - 10), 16 - Math.abs(i - 10));
    const weight = Math.exp(-(offset ** 2) / 12);
    return { label, value: Math.max(2, Math.round(120 * weight + gauss(rnd, 0, 5))) };
  });
};

/* Distribution — a matrix. ------------------------------------------------- */

/** Support tickets by day and hour: office hours on weekdays, a weekend trickle. */
BAKE.heatmapCells = () => {
  const rnd = makeRng(9 * 7919 + 3);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((_, r) =>
    Array.from({ length: 24 }, (_, h) => {
      const office = h >= 8 && h <= 18 ? 1 : h >= 6 && h <= 21 ? 0.45 : 0.12;
      const weekend = r >= 5 ? 0.3 : 1;
      const lunchDip = h === 13 ? 0.75 : 1;
      return Math.max(0, Math.round(16 * office * weekend * lunchDip + gauss(rnd, 0, 2)));
    }));
};

/* Scatter ------------------------------------------------------------------ */

/** Price against rating for 60 products — a mild positive relationship. */
BAKE.scatterPoints = () => {
  const rnd = makeRng(7 * 9301 + 49297);
  return Array.from({ length: 60 }, () => {
    const x = round(20 + rnd() * 230, 0);
    const y = round(clamp(2.6 + (x / 260) * 1.6 + gauss(rnd, 0, 0.32), 2, 5), 1);
    return { x, y };
  });
};

/** Three customer segments as x/y clouds — order value against frequency. */
BAKE.scatterClusters = () => {
  const rnd = makeRng(1337);
  const cloud = (label, cx, cy, spread, n) => ({
    label,
    points: Array.from({ length: n }, () => ({
      x: round(clamp(cx + (rnd() - 0.5) * spread * 2, 2, 98), 1),
      y: round(clamp(cy + (rnd() - 0.5) * spread * 2, 2, 98), 1),
    })),
  });
  return [
    cloud('High-value', 75, 80, 12, 22),
    cloud('Regular', 45, 45, 15, 28),
    cloud('Occasional', 20, 25, 12, 24),
  ];
};

/* Finance — OHLC bars. ----------------------------------------------------- */

/** 70 sessions for the OHLC and candlestick charts. */
BAKE.ohlcBars = () => ohlcBars(9 * 7919, { start: 148, n: 70, vol: 7, pull: 0.015 });

/**
 * 120 sessions for Renko, Kagi and Point & Figure.
 *
 * Those three only draw when the price actually reverses, so they need a
 * longer series and a stronger pull back to the middle than a candlestick
 * chart does — a walk that drifts to one end leaves them with a single column.
 */
BAKE.reversalBars = () => ohlcBars(21 * 7919, { start: 148, n: 120, vol: 9, pull: 0.045 });

/* Time series -------------------------------------------------------------- */

/** Four server metrics as departures from their own baseline. */
BAKE.horizonRows = () => {
  const seeds = [3, 11, 21, 31];
  return ['CPU', 'Memory', 'Disk IO', 'Network'].map((label, k) => ({
    label,
    values: walk(makeRng(seeds[k] * 7919), { start: 0, n: 96, vol: 24 + k * 5, pull: 0.05 })
      .map((v) => round(v, 1)),
  }));
};

/** Four years of weekly figures, with a real annual cycle to coil around. */
BAKE.spiralValues = () => {
  const rnd = makeRng(8 * 7919);
  return Array.from({ length: 208 }, (_, i) => {
    const season = Math.sin((i / 52) * Math.PI * 2 - Math.PI / 2);
    return Math.max(0, Math.round(120 + season * 58 + (i / 208) * 34 + gauss(rnd, 0, 8)));
  });
};

/** A year of daily commits: quiet weekends, a summer lull, a December push. */
BAKE.calendarDays = () => {
  const rnd = makeRng(14 * 7919);
  return Array.from({ length: 365 }, (_, i) => {
    const dow = (i + 3) % 7;                        // 2025-01-01 was a Wednesday
    const weekend = dow >= 5 ? 0.3 : 1;
    const summer = i > 190 && i < 240 ? 0.5 : 1;
    const december = i > 335 ? 1.5 : 1;
    return Math.max(0, Math.round(7 * weekend * summer * december + gauss(rnd, 0, 2.4)));
  });
};

/* Comparison --------------------------------------------------------------- */

/** Twelve products across five measures, in three tiers. */
BAKE.parallelRecords = () => {
  const rnd = makeRng(6 * 7919);
  const tiers = [
    { group: 0, price: 1450, rating: 4.5, reviews: 320, margin: 38, returns: 3 },
    { group: 1, price: 780, rating: 4.1, reviews: 910, margin: 27, returns: 6 },
    { group: 2, price: 320, rating: 3.6, reviews: 1650, margin: 16, returns: 11 },
  ];
  const names = ['Aster', 'Basalt', 'Cinder', 'Dune', 'Ember', 'Flint',
    'Grove', 'Harbour', 'Ingot', 'Juniper', 'Kestrel', 'Lumen'];
  return names.map((name, i) => {
    const t = tiers[i % 3];
    return {
      name,
      group: t.group,
      Price: Math.round(gauss(rnd, t.price, t.price * 0.14)),
      Rating: round(clamp(gauss(rnd, t.rating, 0.25), 2.5, 5), 1),
      Reviews: Math.round(Math.max(20, gauss(rnd, t.reviews, t.reviews * 0.3))),
      'Margin%': Math.round(clamp(gauss(rnd, t.margin, 4), 5, 55)),
      'Returns%': Math.round(clamp(gauss(rnd, t.returns, 2), 1, 20)),
    };
  });
};

/* Geo ---------------------------------------------------------------------- */

/**
 * A value for 54 countries, spelled the way the world atlas spells them.
 *
 * Deliberately not all 177: the countries left out draw in the no-data colour,
 * which is what a real dataset looks like and shows the reader that a gap is a
 * gap rather than a zero.
 */
BAKE.regionValues = () => ({
  'United States of America': 78, Canada: 71, Mexico: 44, Brazil: 51,
  Argentina: 47, Chile: 55, Colombia: 39, Peru: 36,
  'United Kingdom': 74, France: 69, Germany: 76, Spain: 62, Italy: 58,
  Portugal: 57, Netherlands: 80, Belgium: 70, Ireland: 73, Denmark: 82,
  Sweden: 81, Norway: 84, Finland: 79, Poland: 54, Czechia: 56,
  Austria: 68, Switzerland: 83, Greece: 49, Romania: 43, Hungary: 48,
  Ukraine: 31, Russia: 38, Turkey: 45,
  China: 52, Japan: 72, 'South Korea': 75, India: 33, Indonesia: 35,
  Thailand: 41, Vietnam: 37, Malaysia: 50, Philippines: 32, Singapore: 85,
  Australia: 77, 'New Zealand': 76,
  'Saudi Arabia': 53, 'United Arab Emirates': 66, Israel: 67, Jordan: 40,
  Egypt: 30, Morocco: 34, Nigeria: 26, Kenya: 29, Ghana: 28,
  Ethiopia: 22, 'South Africa': 46,
});

/* ── output ──────────────────────────────────────────────────────────────── */

/** Compact JS source: numbers inline, wrapped at a readable width. */
export function src(value, indent = 2) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'number')) {
      const lines = [];
      let line = '';
      for (const p of value.map(String)) {
        if (line.length + p.length + 2 > 76) { lines.push(line); line = ''; }
        line += (line ? ', ' : '') + p;
      }
      if (line) lines.push(line);
      return '[\n' + lines.map((l) => pad + '  ' + l).join(',\n') + '\n' + pad + ']';
    }
    return '[\n' + value.map((v) => pad + '  ' + src(v, indent + 2)).join(',\n') + '\n' + pad + ']';
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    const flat = keys.every((k) => typeof value[k] !== 'object');
    const body = keys.map((k) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`;
      return `${key}: ${src(value[k], indent + 2)}`;
    });
    if (flat && body.join(', ').length < 72) return `{ ${body.join(', ')} }`;
    return '{\n' + body.map((b) => pad + '  ' + b).join(',\n') + '\n' + pad + '}';
  }
  return typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : String(value);
}

if (process.argv[1] && process.argv[1].endsWith('bake-data.mjs')) {
  const only = process.argv[2];
  for (const [name, make] of Object.entries(BAKE)) {
    if (only && name !== only) continue;
    console.log(`\n/* ── ${name} */`);
    console.log(src(make(), 0));
  }
}
