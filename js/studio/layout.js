/**
 * layout.js — how a table is laid out, as opposed to what is in it.
 *
 * `profile.js` says what each column holds. This says three things about the
 * arrangement, each a way a file that is perfectly good as a spreadsheet is
 * wrong as chart input, and each reported with the evidence and the step that
 * changes it, in the reader's own column names:
 *
 *  - **Periods across.** The columns are years, quarters or months and each row
 *    is a thing: `Country, 1960, 1961, …`. A chart reads a series from a
 *    column, so it draws a series per year instead of a line per country.
 *  - **Several values in one cell.** `red; green`, `Action|Comedy`. Grouped as
 *    it is, every combination is its own group.
 *  - **A repeated grain.** A measure that is the same on every row sharing some
 *    other column, because it belongs to that column and not to the row: an
 *    order's shipping cost on each of its lines, a day's national total on each
 *    region. Summed per row it is counted once for every row it is repeated on.
 *
 * It only detects and suggests. Nothing here rewrites a table: the fix is a
 * Shape-tab step the reader runs and watches, which is the rule `transform.js`
 * keeps. Every check is on what the cells say, never on a guess about intent,
 * and a column named like a measure is trusted to be one by its role alone.
 */
import { toNumber } from './transform.js';

const MAX_SCAN_ROWS = 20000;

const MONTH_NAME = /^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\.?$/i;
const PERIODS = [
  { kind: 'years', one: 'year', min: 4, test: (h) => /^(1[5-9]\d\d|20\d\d)$/.test(h) },
  { kind: 'quarters', one: 'quarter', min: 3, test: (h) => /^(Q[1-4]|[1-4]Q)([ _'-]?(\d{2}|\d{4}))?$|^(19|20)\d\d[ _-]?Q[1-4]$/i.test(h) },
  { kind: 'months', one: 'month', min: 4, test: (h) => MONTH_NAME.test(h) || /^(19|20)\d\d[-/](0?[1-9]|1[0-2])$/.test(h) },
];

const clean = (v) => String(v ?? '').trim();
const percent = (x) => `${Math.round(x * 100)}%`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Columns named for periods, each holding numbers, and what the rows then are. */
function periodsAcross(columns, rows) {
  for (const p of PERIODS) {
    const named = columns.filter((c) => p.test(clean(c.name)) && c.type === 'number');
    if (named.length < p.min || named.length * 2 < columns.length) continue;
    const lead = columns.find((c) => !named.includes(c));
    const leadPeriod = !!lead && (lead.type === 'date' || lead.role === 'time'
      || PERIODS.some((q) => rows.slice(0, 20).every((r) => q.test(clean(r[lead.index])))));
    return {
      kind: p.kind,
      one: p.one,
      count: named.length,
      first: named[0].name,
      last: named[named.length - 1].name,
      lead: lead ? lead.name : null,
      // `Year` down the side as well makes a grid, not a list of things.
      rowsAre: !lead ? 'unknown' : leadPeriod ? 'periods' : 'things',
      rows: rows.length,
    };
  }
  return null;
}

/** Text columns whose cells list several values that recur across rows. */
function multiValued(columns, rows) {
  const found = [];
  for (const c of columns) {
    if (c.type !== 'text' && c.type !== 'category') continue;
    if (c.idLike) continue;
    const cells = rows.map((r) => clean(r[c.index])).filter(Boolean);
    // A column that says one thing in every row is a label, not a list.
    if (cells.length < 6 || new Set(cells).size < 3) continue;
    for (const sep of [';', '|', ',']) {
      const joined = cells.filter((v) => v.includes(sep));
      // A comma is also how a name or an address is written, so it has to be
      // most of the column and the pieces have to be short, to be a list.
      if (joined.length / cells.length < (sep === ',' ? 0.3 : 0.15) || joined.length < 3) continue;
      const parts = cells.flatMap((v) => v.split(sep).map(clean).filter(Boolean));
      const short = parts.filter((p) => p.length <= (sep === ',' ? 20 : 40)).length;
      if (short / parts.length < 0.9) continue;
      const distinct = new Set(parts);
      // A tag comes round again; a name does not. This is what separates a list
      // of values from free text that happens to contain a separator.
      if (distinct.size < 2 || distinct.size > 0.6 * parts.length) continue;
      found.push({
        column: c.name,
        index: c.index,
        sep,
        share: joined.length / cells.length,
        values: distinct.size,
        cells: cells.length,
        example: joined[0],
      });
      break;
    }
  }
  return found;
}

/**
 * Measures that hold one value for each of some other column, repeated down its
 * rows. The finest column that explains it wins, because that is the grain the
 * value really belongs to.
 */
function repeatedGrain(columns, rows) {
  const scan = rows.length > MAX_SCAN_ROWS ? rows.slice(0, MAX_SCAN_ROWS) : rows;
  if (scan.length < 10) return [];
  const keys = columns
    .filter((c) => c.role !== 'measure' && c.type !== 'empty' && c.distinct >= 2 && c.distinct * 2 <= c.filled)
    .sort((a, b) => b.distinct - a.distinct)
    .slice(0, 12)
    .map((c) => {
      const ids = new Map();
      const of = new Int32Array(scan.length);
      scan.forEach((r, i) => {
        const k = clean(r[c.index]);
        if (!ids.has(k)) ids.set(k, ids.size);
        of[i] = ids.get(k);
      });
      return { column: c, of, groups: ids.size };
    });
  const out = [];
  const measures = columns.filter((c) => c.type === 'number' && !c.idLike && c.role === 'measure' && c.distinct >= 4).slice(0, 20);
  for (const m of measures) {
    const values = scan.map((r) => toNumber(r[m.index]));
    for (const key of keys) {
      if (key.column.index === m.index) continue;
      const first = new Float64Array(key.groups).fill(NaN);
      const count = new Int32Array(key.groups);
      const varies = new Uint8Array(key.groups);
      let finite = 0;
      values.forEach((v, i) => {
        if (!Number.isFinite(v)) return;
        finite++;
        const g = key.of[i];
        count[g]++;
        if (Number.isNaN(first[g])) first[g] = v; else if (first[g] !== v) varies[g] = 1;
      });
      let repeated = 0;
      let constant = 0;
      let inRepeated = 0;
      for (let g = 0; g < key.groups; g++) {
        if (count[g] < 2) continue;
        repeated++;
        inRepeated += count[g];
        if (!varies[g]) constant++;
      }
      // Several groups, most rows in them, and the value never moving inside one.
      if (repeated >= 3 && inRepeated / finite >= 0.5 && constant / repeated >= 0.98) {
        out.push({
          measure: m.name,
          measureIndex: m.index,
          by: key.column.name,
          byIndex: key.column.index,
          groups: repeated,
          rows: inRepeated,
          factor: inRepeated / repeated,
        });
        break;
      }
    }
  }
  return out;
}

/** The sentence a surface prints when it totals `measure` with `agg` grouped by `groupIndex`. */
export function repeatedWarning(repeated, agg, groupIndex) {
  // Only a total and an average are moved by a repeat; a min, a max or a count is not.
  if (!repeated || (agg !== 'sum' && agg !== 'mean')) return null;
  if (groupIndex === repeated.byIndex && agg !== 'sum') return null;
  return `"${repeated.measure}" is the same on every row that shares a "${repeated.by}", so each reading is repeated about `
    + `${repeated.factor.toFixed(1)} times. ${agg === 'sum' ? 'This total counts every repeat' : 'This average weights each group by its number of rows'}; `
    + `take it once per "${repeated.by}" first.`;
}

/**
 * @param {string[]} headers
 * @param {string[][]} rows
 * @param {object[]} columns from `profileColumn`
 * @returns {{ periods: object|null, multiValue: object[], repeated: object[], notes: object[] }}
 */
export function layoutOf(headers, rows, columns) {
  const periods = periodsAcross(columns, rows);
  const multiValue = multiValued(columns, rows);
  const repeated = repeatedGrain(columns, rows);
  const notes = [];

  if (periods) {
    const span = `"${periods.first}" to "${periods.last}"`;
    if (periods.rowsAre === 'things') {
      notes.push({
        level: 'info',
        text: `${plural(periods.count, periods.one)} run across (${span}) and each row is a "${periods.lead}". A chart reads a series from a column, `
          + `so as it stands this draws a series per ${periods.one}. To draw a line per "${periods.lead}", swap rows and columns`
          + ' (the data editor\'s "Swap rows and columns" step; in a recipe, {"transpose": true})'
          + `${periods.rows > 12 ? `, after keeping only the rows to compare, since ${periods.rows} lines cannot be read` : ''}.`,
      });
    } else if (periods.rowsAre === 'periods') {
      notes.push({
        level: 'info',
        text: `"${periods.lead}" runs down and ${plural(periods.count, periods.one)} run across (${span}): a grid of ${periods.lead.toLowerCase()} by ${periods.one}. `
          + 'A heatmap reads it as it is; one line over time needs a single column of values, which this layout does not have.',
      });
    }
  }

  for (const m of multiValue) {
    notes.push({
      level: 'warn',
      column: m.column,
      text: `"${m.column}" holds several values in one cell (${percent(m.share)} of cells, such as "${m.example}", separated by "${m.sep}"). `
        + `Grouped or counted as it is, each combination is a group of its own. Split it into one row per value `
        + `(the data editor's "One row per value in a cell" step; in a recipe, {"split": "${m.column}", "sep": "${m.sep}"}). `
        + 'A total of any other column then counts a row once for each value it was split into.',
    });
  }

  for (const r of repeated) {
    notes.push({
      level: 'warn',
      column: r.measure,
      text: `"${r.measure}" is the same on every row that shares a "${r.by}" (${r.rows} rows, ${r.groups} values of "${r.by}"), `
        + `so it is one reading per "${r.by}" repeated down the rows. Totalled per row it is counted about ${r.factor.toFixed(1)} times over; `
        + `take it once per "${r.by}" first, grouping by "${r.by}" and taking its average, then total.`,
    });
  }

  return { periods, multiValue, repeated, notes };
}
