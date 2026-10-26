/**
 * recipe.js — a recipe turns a file into the table a chart should read.
 *
 *   {"chart": "line-multi", "steps": [{"pivot": "source", "rows": "year", "value": "net_generation"}]}
 *   {"chart": "box-plot", "roles": {"group": "day_of_week", "value": "births"}}
 *   {"chart": "line-basic", "columns": ["Year", "Deaths"], "facet": "Entity"}
 *
 * It is the part of the choose-chart skill that is not about talking: names in,
 * a table out, and an error that says which column was wrong and which exist.
 * The skill's CLI and the MCP adapter both call it, so a recipe means one thing
 * wherever it is run. Steps are `transform.js`'s own, the Shape tab's, so every
 * number on the chart was worked out by code that says what it did.
 *
 * Nothing here reads a file or prints. A bad recipe throws `RecipeError`.
 */
import { expectedFormat } from './dataio.js';
import { runSteps, describeStep, OPS, TESTS, AGGREGATES } from './transform.js';
import { CHARTS, getChart } from './registry.js';

export const RECIPE_KEYS = ['chart', 'skip', 'header', 'swap', 'columns', 'steps', 'roles', 'facet'];

export class RecipeError extends Error {}
const bad = (message) => { throw new RecipeError(message); };

/** A recipe object, checked for shape. Returns it, or throws saying what is wrong. */
export function checkRecipe(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) bad('A recipe is one JSON object, such as {"chart": "line-basic"}.');
  const unknown = Object.keys(r).filter((k) => !RECIPE_KEYS.includes(k));
  if (unknown.length) bad(`A recipe has no ${unknown.map((k) => `"${k}"`).join(', ')}. It takes: ${RECIPE_KEYS.join(', ')}.`);
  if (r.columns != null && !Array.isArray(r.columns)) bad('"columns" is a list of names, such as ["Year", "Mean"].');
  if (r.steps != null && !Array.isArray(r.steps)) bad('"steps" is a list, such as [{"filter": "Source", "is": "GCAG"}].');
  if (r.roles != null && !(r.roles.group && r.roles.value)) bad('"roles" takes {"group": "<column>", "value": "<column>"}.');
  return r;
}

/** A column by its name, as the reader wrote it; throws naming the ones there are. */
export function colIndex(headers, name, where) {
  const key = (s) => String(s ?? '').trim().toLowerCase();
  const i = headers.findIndex((h) => key(h) === key(name));
  if (i < 0) bad(`No column called "${String(name ?? '').trim()}"${where ? ` (${where})` : ''}. The columns are: ${headers.join(', ')}`);
  return i;
}

/**
 * A recipe step, by column name, as the `{op, col, …}` transform.js runs:
 * {"filter": "Source", "is": "GCAG"}, {"sort": "Year", "dir": "desc"},
 * {"pivot": "source", "rows": "year", "value": "net_generation"}.
 */
export function toStep(raw, headers, n) {
  const ops = OPS.map((o) => o.id);
  const has = raw && typeof raw === 'object' ? ops.filter((op) => op in raw) : [];
  if (has.length !== 1) bad(`Step ${n} needs exactly one of ${ops.join(', ')}; it has ${has.join(', ') || 'none'}.`);
  const op = has[0];
  const col = (name, part = op) => colIndex(headers, name, `step ${n}, ${part}`);
  const agg = (a, none) => {
    if (a == null || a === '') return none;
    if (!AGGREGATES.some((x) => x.id === a)) bad(`Step ${n}: "agg" is one of ${AGGREGATES.map((x) => x.id).join(', ')}.`);
    return a;
  };
  switch (op) {
    case 'filter': {
      const tests = TESTS.map((t) => t.id).filter((t) => t in raw);
      if (tests.length !== 1) bad(`Step ${n} (filter) needs one test of ${TESTS.map((t) => t.id).join(', ')}.`);
      const test = tests[0];
      const both = test === 'between' ? raw.between : [raw[test], ''];
      if (!Array.isArray(both) || both.length !== 2) bad(`Step ${n}: "between" takes two values, such as [1950, 2000].`);
      return { op, col: col(raw.filter), test, a: String(both[0] ?? ''), b: String(both[1] ?? '') };
    }
    case 'group':
      return { op, col: col(raw.group), agg: agg(raw.agg, 'sum'), vals: raw.values && raw.values.map((v) => col(v, 'values')) };
    case 'bin': return { op, col: col(raw.bin), bins: raw.bins || 10 };
    case 'sort': return { op, col: col(raw.sort), dir: raw.dir === 'desc' ? 'desc' : 'asc' };
    case 'limit':
      if (!(raw.limit >= 1)) bad(`Step ${n}: "limit" is how many rows to keep, such as {"limit": 10}.`);
      return { op, n: raw.limit };
    case 'transpose': return { op };
    case 'pivot': {
      const c = col(raw.pivot);
      const v = col(raw.value, 'value');
      // Year, Source, Mean: the rows are the one column left.
      const k = raw.rows == null ? headers.findIndex((_, i) => i !== c && i !== v) : col(raw.rows, 'rows');
      return { op, col: c, key: k, val: v, agg: agg(raw.agg, '') };
    }
    case 'split':
      if (typeof raw.sep !== 'string' || raw.sep === '') bad(`Step ${n}: "sep" is what sits between the values in a cell, such as ";" or "|".`);
      return { op, col: col(raw.split), sep: raw.sep };
    default: return { op };
  }
}

/**
 * The column a distribution chart should take its groups from, named. Its
 * reader takes a first column of words for the groups, and reads a table of
 * numbers as one group per column — so a weekday (1–7) or a wine's quality
 * score (3–8) was drawn as one more group beside the measure. Headed `group`,
 * as the data editor writes it, the column is read as the group names.
 */
export function byRoles(table, roles, chartId) {
  const def = chartId && getChart(chartId);
  if (!def || !def.data || expectedFormat(def).shape !== 'observations') {
    const takers = CHARTS.filter((d) => d.data && expectedFormat(d).shape === 'observations').map((d) => d.id);
    bad(`"roles" names the group and the value for a chart drawing one distribution per group (${takers.join(', ')}).`
      + ' For any other chart, choose and order its columns with "columns".');
  }
  const g = colIndex(table.headers, roles.group, 'roles.group');
  const v = colIndex(table.headers, roles.value, 'roles.value');
  return { headers: ['group', table.headers[v]], rows: table.rows.map((r) => [r[g], r[v]]) };
}

/**
 * Run a recipe's steps, then keep its columns, then read its roles.
 *
 * @param {{headers: string[], rows: string[][]}} table the file as parsed
 * @param {{steps?: object[], columns?: string[], roles?: object, facet?: string}} recipe
 * @param {string|null} chartId the chart it is for, which "roles" needs
 * @returns {{table: object, steps: string[]}} the table, and a sentence per step
 */
export function applyRecipe(table, recipe, chartId = null) {
  const said = [];
  // Each step names its columns as they stand when it runs: a pivot makes
  // the columns a later sort names.
  (recipe.steps || []).forEach((raw, i) => {
    const step = toStep(raw, table.headers, i + 1);
    const run = runSteps(table, [step]);
    if (run.errors.length) {
      bad(`Step ${i + 1} (${step.op}) did not run: ${run.errors[0].replace(/^Step 1 \(\w+\) failed: /, '')}.`
        + ` The columns there are: ${table.headers.join(', ')}`);
    }
    said.push(`Step ${i + 1}: ${describeStep(step, table.headers)} — ${table.rows.length} rows in,`
      + ` ${run.table.rows.length} out, columns ${run.table.headers.join(', ')}`);
    table = run.table;
  });
  if (recipe.columns != null) {
    // The column a facet splits by is part of the table whether named or not.
    const named = [...recipe.columns, ...(recipe.facet == null ? [] : [recipe.facet])];
    const picked = [...new Set(named.map((name) => colIndex(table.headers, name)))];
    table = { headers: picked.map((i) => table.headers[i]), rows: table.rows.map((r) => picked.map((i) => r[i])) };
  }
  if (recipe.roles) table = byRoles(table, recipe.roles, chartId);
  return { table, steps: said };
}
