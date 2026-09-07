/**
 * profile.js — what is actually in this table.
 *
 * The gallery could already answer "which charts can read this?", which is a
 * question about *shape*. It could not answer the question a reader holding a
 * spreadsheet actually has, which is "what is in here, is any of it wrong, and
 * what should I draw?" — and those need to know what the columns hold, not
 * merely how many there are.
 *
 * Everything here is a pure function of a `{ headers, rows }` table. No
 * rendering, no DOM, no library: the numbers have to be checkable, and a
 * reader who is told their revenue column has four bad cells has to be able to
 * go and find those four cells.
 *
 * Two rules it keeps, both borrowed from the rest of this codebase:
 *
 * - **Nothing is invented.** A column with no numbers gets no mean. A pair of
 *   columns with three rows between them gets no correlation. Where there is
 *   not enough to say something true, nothing is said.
 * - **A finding names its evidence.** "4 of 500 cells will read as 0" is
 *   actionable; "data quality issues detected" is not.
 */

import { looksNumeric } from './dataio.js';
import { toNumber, ID_NAME } from './transform.js';

/**
 * Is this an identifier?
 *
 * **By name, never by distinctness**, and that is a lesson this codebase has
 * already paid for once — `transform.js` says it plainly: "every value-based
 * rule breaks in one direction or the other — ids are often all-distinct
 * integers, and so was the revenue column in the first table this was tested
 * against, which a distinctness rule promptly discarded."
 *
 * Written here with a distinctness rule anyway, it flagged `revenue`,
 * `visits`, `value` and 41 of 42 measure columns in a wide export as
 * identifiers — which dropped them from the profile, so the most obvious table
 * in the world (five regions and one measure) produced no suggestion at all.
 *
 * The one value-based signal kept is exact: a column that counts 1, 2, 3 … in
 * order is a row number whatever it is called, and no measurement looks like
 * that by accident.
 */
const looksLikeIdName = (name) => ID_NAME.test(String(name || '').trim());
const isRowCounter = (nums) =>
  nums.length > 3 && nums[0] <= 1 && nums.every((n, i) => n === nums[0] + i);

/** A column of words distinct in every row is a name, not a class. */
const ALL_DISTINCT_MIN_ROWS = 6;

/** Above this many distinct values, a column of words is a name rather than a class. */
const CATEGORY_CEILING = 50;

const isBlank = (v) => v == null || String(v).trim() === '';

/** ISO dates, `2024/01/03`, `03-01-2024`, and month names. Deliberately narrow. */
const DATE_RE = /^(\d{4}[-/]\d{1,2}([-/]\d{1,2})?|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{0,4})$/i;

const median = (sorted) => {
  if (!sorted.length) return null;
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};

/** Trim float noise without lying about big numbers — the rule `transform.js` uses. */
const tidy = (n) => {
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n * 1e6) / 1e6;
  return Number.isInteger(r) ? r : +r.toFixed(4);
};

/**
 * One column, described.
 *
 * `type` is the useful distinction rather than the true one: a chart cares
 * whether a column *measures* something, *names* something, or *orders*
 * something, and those are the three that change what you should draw.
 */
function profileColumn(name, index, values) {
  const filled = values.filter((v) => !isBlank(v));
  const missing = values.length - filled.length;
  const distinct = new Set(filled.map((v) => String(v).trim())).size;

  const nums = filled.map(toNumber).filter(Number.isFinite);
  const numericShare = filled.length ? nums.length / filled.length : 0;
  const dateShare = filled.length
    ? filled.filter((v) => DATE_RE.test(String(v).trim())).length / filled.length
    : 0;

  const col = {
    name, index, missing, distinct,
    count: values.length,
    filled: filled.length,
    // How many cells a chart would silently read as zero. The single most
    // useful number here, and the one no other surface reports.
    unreadable: filled.filter((v) => !looksNumeric(v)).length,
    numericShare: tidy(numericShare),
    sample: filled.slice(0, 3).map((v) => String(v).trim()),
    type: 'text',
  };

  if (!filled.length) { col.type = 'empty'; return col; }

  // A date column is ordered, which is what makes a line chart honest.
  if (dateShare >= 0.9) { col.type = 'date'; return col; }

  if (numericShare >= 0.9) {
    const sorted = [...nums].sort((a, b) => a - b);
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
    const sd = Math.sqrt(variance);
    col.type = 'number';
    col.min = tidy(sorted[0]);
    col.max = tidy(sorted[sorted.length - 1]);
    col.mean = tidy(mean);
    col.median = tidy(median(sorted));
    col.stdev = tidy(sd);
    col.zeros = nums.filter((n) => n === 0).length;
    col.negatives = nums.filter((n) => n < 0).length;
    // Three standard deviations, reported as the values themselves rather than
    // a count — a reader wants to know *which* row is wrong.
    col.outliers = sd > 0
      ? nums.filter((n) => Math.abs(n - mean) > 3 * sd).slice(0, 5).map(tidy)
      : [];
    col.idLike = looksLikeIdName(name) || isRowCounter(nums);
    return col;
  }

  // Mostly numbers, with enough stragglers to fail the test above. This is the
  // single most useful thing the report can say and it nearly went unsaid: the
  // column is not treated as a measure, so no suggestion mentions it and no
  // "cells will read as 0" warning fires either — the reader is told nothing
  // about the column that is actually stopping them.
  col.nearlyNumeric = numericShare >= 0.5 && numericShare < 0.9;
  if (col.nearlyNumeric) {
    col.badCells = filled.filter((v) => !Number.isFinite(toNumber(v)))
      .slice(0, 4).map((v) => String(v).trim());
  }

  col.type = distinct <= CATEGORY_CEILING ? 'category' : 'text';
  // Words are the case where distinctness *does* mean something: a column with
  // a different value in every row names each row rather than grouping them,
  // so splitting by it gives one group per row and shows nothing.
  col.idLike = looksLikeIdName(name)
    || (distinct === filled.length && filled.length >= ALL_DISTINCT_MIN_ROWS);
  return col;
}

/** Pearson's r over the rows where both columns are numbers. */
function correlate(a, b) {
  const pairs = [];
  for (let i = 0; i < a.length && i < b.length; i++) {
    const x = toNumber(a[i]);
    const y = toNumber(b[i]);
    if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  // Under a dozen points a correlation is a shape somebody imagined.
  if (pairs.length < 12) return null;
  const n = pairs.length;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
  const my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let num = 0; let dx = 0; let dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  if (!dx || !dy) return null;
  return tidy(num / Math.sqrt(dx * dy));
}

/**
 * Which categorical column most separates a measure.
 *
 * "Worth plotting against what" is the question, and the answer is the column
 * whose groups have the most different means — the split that would actually
 * show something.
 */
function separation(rows, byCol, measureCol) {
  const groups = new Map();
  for (const r of rows) {
    const k = String(r[byCol.index] ?? '').trim();
    const v = toNumber(r[measureCol.index]);
    if (!k || !Number.isFinite(v)) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(v);
  }
  if (groups.size < 2) return null;
  const means = [...groups.values()].map((vs) => vs.reduce((a, b) => a + b, 0) / vs.length);
  const lo = Math.min(...means);
  const hi = Math.max(...means);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi === lo) return null;
  // As a share of the measure's own spread, so it compares across columns.
  const range = (measureCol.max ?? hi) - (measureCol.min ?? lo);
  return {
    by: byCol.name,
    measure: measureCol.name,
    groups: groups.size,
    spread: tidy(range ? (hi - lo) / range : 0),
  };
}

/**
 * Everything that is wrong, or worth a second look, before this becomes a chart.
 *
 * Ordered by how badly it would mislead: a cell that silently reads as zero
 * beats a duplicated row, which beats a column nobody will be able to read.
 */
function qualityNotes(cols, table) {
  const out = [];

  for (const c of cols) {
    if (c.type === 'empty') {
      out.push({ level: 'warn', column: c.name, text: `"${c.name}" is empty — every cell is blank.` });
      continue;
    }
    // The one that actually ruins charts: mostly-numbers with a few that are not.
    if (c.type === 'number' && c.unreadable) {
      out.push({
        level: 'bad',
        column: c.name,
        text: `${c.unreadable} of ${c.filled} cells in "${c.name}" will be read as 0 — they are not numbers.`,
      });
    }
    if (c.nearlyNumeric) {
      out.push({
        level: 'bad',
        column: c.name,
        text: `"${c.name}" is ${Math.round(c.numericShare * 100)}% numbers — `
          + `${c.filled - Math.round(c.numericShare * c.filled)} cell`
          + `${c.filled - Math.round(c.numericShare * c.filled) === 1 ? '' : 's'} `
          + `(${c.badCells.join(', ')}) stop it being read as a measure at all.`,
      });
    }
    if (c.missing) {
      out.push({
        level: c.missing / c.count > 0.2 ? 'warn' : 'info',
        column: c.name,
        text: `"${c.name}" is missing ${c.missing} of ${c.count} values.`,
      });
    }
    if (c.idLike && c.type === 'number') {
      out.push({
        level: 'warn',
        column: c.name,
        text: `"${c.name}" looks like an identifier — totalling it produces a number that means nothing.`,
      });
    }
    if (c.type === 'number' && c.outliers && c.outliers.length) {
      out.push({
        level: 'info',
        column: c.name,
        text: `"${c.name}" has ${c.outliers.length === 5 ? '5+' : c.outliers.length} `
          + `value${c.outliers.length === 1 ? '' : 's'} more than three deviations out (${c.outliers.join(', ')}) — `
          + 'they will set the axis for everything else.',
      });
    }
    // A date stored as text still sorts as text, so 10 March lands before 2 March.
    if (c.type === 'text' && c.sample.some((v) => DATE_RE.test(v))) {
      out.push({
        level: 'warn',
        column: c.name,
        text: `"${c.name}" looks like dates in an inconsistent format — they will sort as words, not as time.`,
      });
    }
  }

  const seen = new Set();
  let dupes = 0;
  for (const r of table.rows) {
    const k = r.join(' ');
    if (seen.has(k)) dupes++;
    else seen.add(k);
  }
  if (dupes) {
    out.push({
      level: 'warn',
      text: `${dupes} row${dupes === 1 ? ' is a duplicate' : 's are duplicates'} of an earlier one — `
        + 'totals will count them twice.',
    });
  }

  const order = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/**
 * Describe a table.
 *
 * @param {{headers: string[], rows: string[][]}} table
 * @returns {object} columns, quality notes and relationships
 */
export function profileTable(table) {
  const headers = table.headers || [];
  const rows = table.rows || [];

  const columns = headers.map((h, i) =>
    profileColumn(h || `Column ${i + 1}`, i, rows.map((r) => r[i])));

  const numbers = columns.filter((c) => c.type === 'number' && !c.idLike);
  const categories = columns.filter((c) => c.type === 'category' && !c.idLike);
  const dates = columns.filter((c) => c.type === 'date');

  // Every numeric pair, strongest first, and only the ones worth a sentence.
  const correlations = [];
  for (let i = 0; i < numbers.length; i++) {
    for (let j = i + 1; j < numbers.length; j++) {
      const r = correlate(
        rows.map((row) => row[numbers[i].index]),
        rows.map((row) => row[numbers[j].index]),
      );
      if (r != null && Math.abs(r) >= 0.5) {
        correlations.push({ a: numbers[i].name, b: numbers[j].name, r });
      }
    }
  }
  correlations.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));

  const separators = [];
  for (const cat of categories) {
    for (const num of numbers) {
      const s = separation(rows, cat, num);
      if (s && s.spread >= 0.25) separators.push(s);
    }
  }
  separators.sort((a, b) => b.spread - a.spread);

  return {
    rows: rows.length,
    cols: headers.length,
    columns,
    numbers,
    categories,
    dates,
    quality: qualityNotes(columns, table),
    correlations: correlations.slice(0, 5),
    separators: separators.slice(0, 3),
  };
}
