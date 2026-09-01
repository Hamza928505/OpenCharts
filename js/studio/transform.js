/**
 * transform.js — reshaping a table before it becomes a chart.
 *
 * The wide-table work solved half of this already: `rankCharts` takes a
 * 45-column export and projects out the columns a chart can read. But a
 * projection only *chooses* columns; it cannot combine rows. The file most
 * people actually have is five hundred transactions, and the chart they want
 * is revenue by region — seven bars. No amount of column-picking gets from one
 * to the other, and until now the answer was "aggregate it in a spreadsheet
 * first", which is the step the tool exists to remove.
 *
 * **Transforms are an edit, not a layer.** They run once, in the data editor,
 * and what comes out is written into the grid as literal values — exactly what
 * a paste or a file drop produces. Nothing is stored on the spec and nothing
 * re-derives at render time.
 *
 * That is a deliberate choice against the obvious alternative. Vega-Lite keeps
 * transforms in the spec and applies them when it draws; doing that here would
 * break the rule the whole library is built on — *a renderer reads its data
 * from the spec and nothing else* — and would mean every exported chart had to
 * carry a transform engine to reproduce numbers it could simply have been
 * given. The reader can see what the aggregation produced before they accept
 * it, which is also the honest way round: the numbers on the chart are numbers
 * they looked at.
 *
 * Steps apply in order and each one sees the table the previous one made, so
 * `filter → group → sort → limit` reads exactly as it is written.
 */

import { looksNumeric } from './dataio.js';

/** How a group's rows are folded into one. */
export const AGGREGATES = [
  { id: 'sum', label: 'Total' },
  { id: 'mean', label: 'Average' },
  { id: 'median', label: 'Median' },
  { id: 'min', label: 'Smallest' },
  { id: 'max', label: 'Largest' },
  { id: 'count', label: 'Number of rows' },
];

/** Comparisons a filter can make. `needs` is how many values the UI collects. */
export const TESTS = [
  { id: 'is', label: 'is', needs: 1 },
  { id: 'not', label: 'is not', needs: 1 },
  { id: 'contains', label: 'contains', needs: 1 },
  { id: 'gt', label: 'is more than', needs: 1, numeric: true },
  { id: 'lt', label: 'is less than', needs: 1, numeric: true },
  { id: 'between', label: 'is between', needs: 2, numeric: true },
  { id: 'filled', label: 'is not blank', needs: 0 },
];

/** The operations, in the order the editor offers them. */
export const OPS = [
  { id: 'filter', label: 'Keep rows where…' },
  { id: 'group', label: 'Group rows by…' },
  { id: 'bin', label: 'Bucket a number into ranges' },
  { id: 'sort', label: 'Sort by…' },
  { id: 'limit', label: 'Keep only the first…' },
];

/**
 * A cell as a number, or NaN.
 *
 * Tolerant in the same way `looksNumeric` is — currency, thousands separators
 * and a trailing percent all survive — because a column that reads as numeric
 * to the validator has to read as numeric to the arithmetic, or a filter would
 * silently drop every row of a table of prices.
 */
export function toNumber(cell) {
  if (cell == null) return NaN;
  const t = String(cell).trim();
  if (!t) return NaN;
  const core = t
    .replace(/^[-+]?\s*[$£€¥₹]?\s*/, '')
    .replace(/\s*[%$£€¥₹]?$/, '')
    .replace(/[\s,](?=\d{3}\b)/g, '')
    .replace(',', '.');
  const n = Number(core);
  return Number.isFinite(n) ? (t.trim().startsWith('-') ? -Math.abs(n) : n) : NaN;
}

/**
 * Which columns hold numbers.
 *
 * A column counts as numeric when most of its filled cells read as numbers,
 * not all of them: a real export has a `—` or an `n/a` in a few rows, and
 * refusing to total a column because of three placeholders would rule out most
 * of the files this is for. The same judgement `classifyColumns` makes.
 */
export function numericColumns(table) {
  const out = [];
  const n = table.headers.length || (table.rows[0] || []).length;
  for (let c = 0; c < n; c++) {
    let filled = 0;
    let numeric = 0;
    for (const row of table.rows) {
      const v = row[c];
      if (v == null || String(v).trim() === '') continue;
      filled++;
      if (looksNumeric(v) && Number.isFinite(toNumber(v))) numeric++;
    }
    if (filled && numeric / filled >= 0.8) out.push(c);
  }
  return out;
}

/**
 * Column names that hold a number without meaning a quantity.
 *
 * Totalling an id column produces 124,750 and means nothing, so the group step
 * leaves these out by default. Matched on the *name* rather than the values on
 * purpose: every value-based rule that separates ids from measurements gets it
 * wrong in one direction or the other. Ids are frequently all-distinct
 * integers — and so was the revenue column in the first table this was tested
 * against, which a distinctness rule promptly discarded.
 *
 * A default, never a verdict: the editor shows which columns are being folded
 * and lets any of them be ticked back in.
 */
const ID_NAME = /^(id|.*[_ -]id|.*id|code|key|uuid|guid|index|idx|no|num|number|row|rank|year|yr)$/i;

/** The columns a group step folds unless told otherwise. */
export function defaultValueCols(table, keyCol) {
  return numericColumns(table).filter((c) => {
    if (c === keyCol) return false;
    return !ID_NAME.test(String(table.headers[c] || '').trim());
  });
}

const clone = (t) => ({ headers: [...t.headers], rows: t.rows.map((r) => [...r]) });

/* ── the operations ──────────────────────────────────────────────────────── */

function opFilter(table, step) {
  const c = step.col | 0;
  const test = step.test || 'is';
  const a = step.a == null ? '' : String(step.a);
  const na = toNumber(step.a);
  const nb = toNumber(step.b);
  const lower = a.toLowerCase();

  const keep = (row) => {
    const raw = row[c] == null ? '' : String(row[c]);
    const text = raw.trim().toLowerCase();
    const num = toNumber(raw);
    switch (test) {
      case 'is': return text === lower.trim();
      case 'not': return text !== lower.trim();
      case 'contains': return text.includes(lower.trim());
      case 'gt': return Number.isFinite(num) && Number.isFinite(na) && num > na;
      case 'lt': return Number.isFinite(num) && Number.isFinite(na) && num < na;
      case 'between':
        return Number.isFinite(num) && Number.isFinite(na) && Number.isFinite(nb)
          && num >= Math.min(na, nb) && num <= Math.max(na, nb);
      case 'filled': return raw.trim() !== '';
      default: return true;
    }
  };

  return { headers: [...table.headers], rows: table.rows.filter(keep) };
}

function fold(values, agg) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (agg === 'count') return values.length;
  if (!nums.length) return '';
  switch (agg) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'mean': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'median': {
      const s = [...nums].sort((a, b) => a - b);
      const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
    default: return nums.reduce((a, b) => a + b, 0);
  }
}

/** Trim the float noise `0.1 + 0.2` leaves, without lying about big numbers. */
const tidyNumber = (n) => {
  if (!Number.isFinite(n)) return '';
  const r = Math.round(n * 1e6) / 1e6;
  return String(Number.isInteger(r) ? r : +r.toFixed(4));
};

function opGroup(table, step) {
  const by = step.col | 0;
  const agg = step.agg || 'sum';
  // An explicit list wins; otherwise fold what looks like a measurement.
  const chosen = Array.isArray(step.vals) ? step.vals : null;
  const valueCols = (chosen || defaultValueCols(table, by))
    .filter((c) => c !== by && c >= 0 && c < (table.headers.length || 0));

  const order = [];
  const buckets = new Map();
  for (const row of table.rows) {
    const key = row[by] == null ? '' : String(row[by]).trim();
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
    buckets.get(key).push(row);
  }

  // `count` answers a question about rows rather than about a column, so it
  // produces one new column instead of folding the ones already there.
  if (agg === 'count' || !valueCols.length) {
    return {
      headers: [table.headers[by] || 'Group', 'Count'],
      rows: order.map((k) => [k, String(buckets.get(k).length)]),
    };
  }

  return {
    headers: [table.headers[by] || 'Group', ...valueCols.map((c) => table.headers[c] || `Column ${c + 1}`)],
    rows: order.map((k) => {
      const group = buckets.get(k);
      return [k, ...valueCols.map((c) => tidyNumber(fold(group.map((r) => toNumber(r[c])), agg)))];
    }),
  };
}

function opSort(table, step) {
  const c = step.col | 0;
  const dir = step.dir === 'desc' ? -1 : 1;
  const rows = [...table.rows].sort((x, y) => {
    const nx = toNumber(x[c]);
    const ny = toNumber(y[c]);
    // Numbers compare as numbers; anything else compares as words, so a column
    // of names sorts alphabetically instead of all landing equal.
    if (Number.isFinite(nx) && Number.isFinite(ny)) return (nx - ny) * dir;
    return String(x[c] ?? '').localeCompare(String(y[c] ?? '')) * dir;
  });
  return { headers: [...table.headers], rows };
}

function opLimit(table, step) {
  const n = Math.max(1, step.n | 0 || 10);
  return { headers: [...table.headers], rows: table.rows.slice(0, n) };
}

function opBin(table, step) {
  const c = step.col | 0;
  const wanted = Math.max(2, Math.min(50, step.bins | 0 || 10));
  const values = table.rows.map((r) => toNumber(r[c])).filter(Number.isFinite);
  if (!values.length) return { headers: ['Range', 'Count'], rows: [] };

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // Every value identical is one bucket, not a division by zero.
  if (lo === hi) return { headers: ['Range', 'Count'], rows: [[tidyNumber(lo), String(values.length)]] };

  const width = (hi - lo) / wanted;
  const counts = new Array(wanted).fill(0);
  for (const v of values) {
    // The top value belongs in the last bucket, not one past the end.
    const i = Math.min(wanted - 1, Math.floor((v - lo) / width));
    counts[i]++;
  }
  return {
    headers: [`${table.headers[c] || 'Value'} range`, 'Count'],
    rows: counts.map((n, i) => [
      `${tidyNumber(lo + i * width)}–${tidyNumber(lo + (i + 1) * width)}`,
      String(n),
    ]),
  };
}

const RUNNERS = { filter: opFilter, group: opGroup, sort: opSort, limit: opLimit, bin: opBin };

/**
 * Run every step in order.
 *
 * Returns the table after each step as well as the final one, because the
 * editor has to offer each step the columns that exist *at that point* —
 * grouping renames and drops columns, so a sort added after it cannot be
 * choosing from the original headings.
 *
 * A step that throws is skipped and reported rather than taking the run down:
 * half-built steps exist while somebody is still typing one.
 *
 * @returns {{ table: {headers:string[],rows:string[][]}, stages: Array, errors: string[] }}
 */
export function runSteps(table, steps) {
  let current = clone(table);
  const stages = [clone(current)];
  const errors = [];

  (steps || []).forEach((step, i) => {
    const run = RUNNERS[step && step.op];
    if (!run) { errors.push(`Step ${i + 1} does nothing.`); stages.push(clone(current)); return; }
    try {
      const next = run(current, step);
      current = {
        headers: next.headers.map((h) => String(h ?? '')),
        rows: next.rows.map((r) => r.map((c) => (c == null ? '' : String(c)))),
      };
    } catch (err) {
      errors.push(`Step ${i + 1} (${step.op}) failed: ${err.message}`);
    }
    stages.push(clone(current));
  });

  return { table: current, stages, errors };
}

/** One step, in the words the editor shows. */
export function describeStep(step, headers) {
  const name = (i) => headers[i] || `column ${(i | 0) + 1}`;
  switch (step && step.op) {
    case 'filter': {
      const t = TESTS.find((x) => x.id === step.test);
      const label = t ? t.label : 'is';
      if (t && t.needs === 0) return `Keep rows where ${name(step.col)} ${label}`;
      if (t && t.needs === 2) return `Keep rows where ${name(step.col)} ${label} ${step.a} and ${step.b}`;
      return `Keep rows where ${name(step.col)} ${label} ${step.a}`;
    }
    case 'group': {
      const a = AGGREGATES.find((x) => x.id === step.agg);
      const verb = (a ? a.label : 'Total').toLowerCase();
      if (step.agg === 'count') return `Group by ${name(step.col)} and count the rows`;
      // Naming the columns is the point: a fold that silently picked them is a
      // fold nobody can check.
      const cols = Array.isArray(step.vals) && step.vals.length
        ? step.vals.map(name).join(', ')
        : 'the number columns';
      return `Group by ${name(step.col)}, ${verb} of ${cols}`;
    }
    case 'bin': return `Bucket ${name(step.col)} into ${step.bins || 10} ranges`;
    case 'sort': return `Sort by ${name(step.col)}, ${step.dir === 'desc' ? 'largest first' : 'smallest first'}`;
    case 'limit': return `Keep the first ${step.n || 10} rows`;
    default: return 'Unknown step';
  }
}

/** A sensible new step of this kind for the table as it currently stands. */
export function defaultStep(op, table) {
  const nums = numericColumns(table);
  const firstText = table.headers.findIndex((_, i) => !nums.includes(i));
  switch (op) {
    case 'filter': return { op, col: 0, test: 'is', a: '', b: '' };
    case 'group': {
      const key = firstText < 0 ? 0 : firstText;
      return { op, col: key, agg: 'sum', vals: defaultValueCols(table, key) };
    }
    case 'bin': return { op, col: nums[0] ?? 0, bins: 10 };
    case 'sort': return { op, col: nums[0] ?? 0, dir: 'desc' };
    case 'limit': return { op, n: 10 };
    default: return { op };
  }
}
