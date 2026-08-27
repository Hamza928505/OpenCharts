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
import { checkTableShape, expectedFormat, looksNumeric } from './dataio.js';

/** Where a table is handed to the studio, since it is too big for a URL. */
export const HANDOFF_KEY = 'opencharts.table';

/**
 * Sort every chart into the ones that can read this table and the ones that
 * cannot, with the reason.
 *
 * @param {{headers: string[], rows: string[][]}} table
 * @returns {{fits: Array, misses: Array, shape: object}}
 */
export function rankCharts(table) {
  const fits = [];
  const misses = [];

  for (const def of CHARTS) {
    if (!def.data) continue;
    const fit = checkTableShape(def, table);
    const expected = expectedFormat(def);
    const entry = { def, message: fit.message, columns: expected.columns, hint: expected.hint };
    if (fit.ok) fits.push(entry);
    else misses.push(entry);
  }

  // Charts that read the table exactly as wide as it is come first: a table of
  // four columns is more likely meant for a chart that reads four than for one
  // that reads the first two and drops the rest.
  const width = table.headers.length;
  fits.sort((a, b) => score(b, width) - score(a, width)
    || a.def.category.localeCompare(b.def.category)
    || a.def.title.localeCompare(b.def.title));

  return { fits, misses, shape: describe(table) };
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
