/**
 * DataMatch.js — answer "I have this table, what can I draw with it?"
 *
 * The gallery has always worked the other way round: pick a chart, then find
 * out what it wants. That is backwards for anyone who arrived holding a
 * spreadsheet, and it is the reason the shape descriptors exist at all — every
 * chart already declares the columns it reads, and `checkTableShape` already
 * answers the question for one of them. Asking it 98 times is the whole idea.
 *
 * Nothing here decides whether a chart is a *good* way to show the data. It
 * decides whether the chart can read it, which is a question with an answer.
 * Ranking beyond that would be an opinion dressed as a result.
 */

import { CHARTS } from './registry.js';
import {
  checkTableShape, expectedFormat, looksNumeric, columnRules, countOf,
} from './dataio.js';

/** Where a table is handed to the studio, since it is too big for a URL. */
export const HANDOFF_KEY = 'opencharts.table';

/* ── Reading part of a table ─────────────────────────────────────────────────
 * `checkTableShape` answers "does this whole table match this chart's shape?".
 * That is the right question for a file someone exported *for* a chart, and
 * the wrong one for the file most people actually have.
 *
 * A real export is forty-five columns of an experiment: an id, a date, a
 * category, and forty numbers. No chart in the library reads a table that
 * shape, because no chart reads forty-five columns — so asking every chart
 * about the whole table returned nothing at all, from a page whose entire
 * promise is to say what you can draw. A reader holding that file is not told
 * "no": they are told the tool does not work.
 *
 * So a chart that cannot read the table is asked a second question — can it
 * read *some* of it? — and the answer names the columns. That is still not an
 * opinion about whether the chart is a good way to show the data, which is the
 * line this module holds: the projection is offered only where the chart's own
 * `checkTableShape` passes on it, and the columns are shown so the reader can
 * see exactly what was picked.
 * ───────────────────────────────────────────────────────────────────────── */

/** A label plus the eight series `labelSeries` reads: past that nothing lands. */
const MAX_WIDTH = 9;
/** The window `checkTableShape` measures, so both agree about a column. */
const SAMPLE_ROWS = 200;

/**
 * Shapes whose word column has to *mean* something — a country the atlas
 * knows, a city in the gazetteer. Any three columns satisfy their arithmetic
 * and would draw an empty map, so they are never offered a projection. A miss
 * that says "this needs place names" beats a fit that renders a blank world.
 */
const NAMED_PLACE_SHAPES = new Set(['places', 'regions']);

/**
 * Shapes that read a column as the *nodes* of a diagram. Every column but the
 * last is a stage, so the width follows from how many categorical columns the
 * table has rather than from how wide the table is.
 */
const NODE_SHAPES = new Set(['links', 'dimensions', 'tree']);

/**
 * Shapes whose word columns have to name a category — the node shapes, plus
 * the edge list, which is two columns of node names and nothing else.
 */
const CATEGORICAL_SHAPES = new Set([...NODE_SHAPES, 'edges']);

/** The most nodes one stage of a flow or one level of a tree carries legibly. */
const MAX_NODES = 24;

/**
 * Sort the columns into the ones that hold numbers, the ones that hold words,
 * and the ones that name a category.
 *
 * The first two are strict, and have to be: `checkTableShape` fails a value
 * column on a *single* cell that will not read as a number, so a column with
 * one `—` in it is not one this chart can add up.
 *
 * `categorical` is the third question, and it is what keeps a flow diagram
 * honest. Two kinds of column pass the "holds words" test and are still no
 * kind of node:
 *
 *   - a column of measurements with a placeholder in 8% of its cells, which is
 *     a number wearing a disguise — `wordShare` is what tells them apart;
 *   - an id, distinct in every row, which draws one ribbon per row and reads
 *     as a hairball.
 */
function classifyColumns(table) {
  const words = [];
  const numbers = [];
  const categorical = [];
  const sample = table.rows.slice(0, SAMPLE_ROWS);
  const nodeCeiling = Math.min(MAX_NODES, Math.max(2, Math.floor(sample.length / 2)));

  table.headers.forEach((_, c) => {
    let seen = 0;
    let wordy = 0;
    const distinct = new Set();
    for (const row of sample) {
      const v = String(row[c] ?? '').trim();
      if (!v) continue;
      seen++;
      distinct.add(v);
      if (!looksNumeric(v)) wordy++;
    }
    // A column that is empty the whole way down is nobody's data.
    if (!seen) return;
    if (wordy) words.push(c); else numbers.push(c);
    if (wordy / seen >= 0.9 && distinct.size <= nodeCeiling) categorical.push(c);
  });
  return { words, numbers, categorical };
}

/** The table narrowed to these columns, in this order. */
function project(table, columns) {
  return {
    headers: columns.map((c) => table.headers[c]),
    rows: table.rows.map((r) => columns.map((c) => r[c] ?? '')),
    hadHeader: true,
    skipped: 0,
  };
}

/**
 * The column counts worth trying for this chart, best first — each a pair of
 * `[word columns, number columns]` taken from the front of what the table has.
 *
 * The families differ in what a further column *means*, and getting that wrong
 * produces a projection that passes the shape check and draws nothing: give
 * `ohlc` four columns beginning with a date and it reads the date as the open
 * and runs off the end of the row looking for the close.
 */
function candidateWidths(expected, rules, words, numbers) {
  const out = [];
  const push = (t, n) => {
    if (t <= words.length && n <= numbers.length && t + n >= expected.min) out.push([t, n]);
  };

  if (NODE_SHAPES.has(expected.shape)) {
    // Stages, then one value. The width is however many stages there are.
    const most = Math.min(words.length, 4);
    const fewest = expected.shape === 'tree' ? 1 : 2;
    for (let t = most; t >= fewest; t--) push(t, 1);
    return out;
  }
  if (expected.exact) {
    const stub = new Array(expected.exact).fill('');
    const t = Math.min(countOf(rules.text, stub), expected.exact);
    push(t, expected.exact - t);
    if (t !== rules.minText) push(rules.minText, expected.exact - rules.minText);
    return out;
  }
  if (expected.reads === Infinity) {
    // Every further column is more data, so the widest that fits is the best.
    const widest = Math.min(MAX_WIDTH - 1, numbers.length);
    // A box plot or a histogram reads columns of bare observations; naming one
    // of them is optional, so the unnamed form is offered first.
    if (expected.shape === 'observations') {
      for (let n = Math.min(MAX_WIDTH, numbers.length); n >= 1; n--) push(0, n);
    }
    for (let n = widest; n >= 1; n--) push(1, n);
    return out;
  }
  // A fixed run of positions, with or without a name in front of it.
  push(1, expected.min);
  push(1, expected.min - 1);
  push(0, expected.min);
  return out;
}

/**
 * The best slice of this table the chart can read, or null if there is none.
 *
 * @returns {{using: number[], table: object, message: string}|null}
 */
function projectFor(def, table, cls) {
  const expected = expectedFormat(def);
  if (!expected.shape || NAMED_PLACE_SHAPES.has(expected.shape)) return null;

  const words = CATEGORICAL_SHAPES.has(expected.shape) ? cls.categorical : cls.words;
  const rules = columnRules(expected.shape);
  for (const [t, n] of candidateWidths(expected, rules, words, cls.numbers)) {
    const using = [...words.slice(0, t), ...cls.numbers.slice(0, n)];
    if (using.length === table.headers.length) continue;   // that is the whole table
    const sub = project(table, using);
    if (checkTableShape(def, sub).ok) {
      return {
        using,
        table: sub,
        message: `Reads ${sub.headers.join(', ')} out of your ${table.headers.length} columns.`,
      };
    }
  }
  return null;
}

/**
 * Sort every chart into the ones that can read this table, the ones that can
 * read part of it, and the ones that cannot read it at all — with the reason.
 *
 * @param {{headers: string[], rows: string[][]}} table
 * @returns {{fits: Array, partial: Array, misses: Array, shape: object}}
 */
export function rankCharts(table) {
  const fits = [];
  const partial = [];
  const misses = [];
  const cls = classifyColumns(table);

  for (const def of CHARTS) {
    if (!def.data) continue;
    const fit = checkTableShape(def, table);
    const expected = expectedFormat(def);
    const entry = { def, message: fit.message, columns: expected.columns, hint: expected.hint };
    if (fit.ok) { fits.push(entry); continue; }

    const slice = projectFor(def, table, cls);
    if (slice) {
      partial.push({ ...entry, message: slice.message, using: slice.using, table: slice.table });
    } else {
      misses.push(entry);
    }
  }

  // Charts that read the table exactly as wide as it is come first: a table of
  // four columns is more likely meant for a chart that reads four than for one
  // that reads the first two and drops the rest.
  const width = table.headers.length;
  const byName = (a, b) => a.def.category.localeCompare(b.def.category)
    || a.def.title.localeCompare(b.def.title);
  fits.sort((a, b) => score(b, width) - score(a, width) || byName(a, b));
  // Among the partial ones, the chart that uses the most of the table first —
  // eight of someone's columns is a better answer than two of them.
  partial.sort((a, b) => b.using.length - a.using.length || byName(a, b));

  return { fits, partial, misses, shape: describe(table) };
}

function score(entry, width) {
  const expected = expectedFormat(entry.def);
  if (expected.exact === width) return 3;
  if (expected.reads === Infinity) return 2;      // reads every column it is given
  if (expected.min === width) return 2;
  return 1;
}

/**
 * What this table looks like, in the same words the descriptors use.
 *
 * Shown above the results so a reader can tell at a glance whether the parser
 * saw what they meant — a wrong delimiter or a missing header row shows up
 * here rather than as a puzzling list of charts.
 */
export function describe(table) {
  const rows = table.rows.length;
  const cols = table.headers.length;
  // A column of words is one with a cell that will not read as a number. Forty
  // rows is plenty to tell, and keeps this instant on a long table.
  const roles = table.headers.map((_, c) =>
    (table.rows.slice(0, 40).some((r) => r[c] && !looksNumeric(r[c])) ? 'words' : 'numbers'));
  const textCols = roles.filter((r) => r === 'words').length;
  return {
    rows,
    cols,
    roles,
    textCols,
    numberCols: cols - textCols,
    summary: `${rows} row${rows === 1 ? '' : 's'} · ${cols} column${cols === 1 ? '' : 's'}`
      + ` · ${textCols} of words, ${cols - textCols} of numbers`,
  };
}

/** The column names this chart's own example uses, for a one-line "reads …". */
export function expectedColumnsFor(def) {
  return expectedFormat(def).columns;
}

/** Hand a table to the studio, which is a page load away. */
export function handOff(table) {
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
      headers: table.headers,
      rows: table.rows,
    }));
    return true;
  } catch {
    // Private mode, or a table larger than the quota. The chart still opens,
    // it just opens on its own example.
    return false;
  }
}

/** Take the table the gallery left, once. */
export function takeHandOff() {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(HANDOFF_KEY);
    const table = JSON.parse(raw);
    return table && Array.isArray(table.rows) && table.rows.length ? table : null;
  } catch {
    return null;
  }
}
