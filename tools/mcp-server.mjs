#!/usr/bin/env node
/**
 * mcp-server.mjs — the choose-chart skill, as three MCP tools.
 *
 *   profile_table     what is in a table: types, roles, units, places, problems
 *   recommend_charts  which charts read it, why, what to watch for, and the
 *                     aggregated views with the recipe that draws each
 *   build_chart       run a recipe on the table, check what the chart now holds,
 *                     and return a studio link (and optionally a one-file page)
 *
 * It decides nothing and holds no copy of the logic: each call runs
 * `.claude/skills/choose-chart/choose.mjs --json`, the same code the skill's
 * prose output comes from, so the three tools and the page cannot disagree.
 * What it adds is what a shell cannot give an assistant: arguments that are
 * typed instead of quoted (a recipe is an object, not a string to escape through
 * two shells), a table passed as text, and a refusal to read outside the folder
 * it was started in.
 *
 * This is not the AI-chat bridge that was removed from the site. It talks to no
 * page, makes no request and needs no account; it is for a coding assistant
 * working on a file. It speaks MCP's stdio transport (newline-delimited
 * JSON-RPC 2.0) directly, so it adds no dependency.
 *
 *   claude mcp add opencharts -- node tools/mcp-server.mjs
 *
 * Files are read, and pages written, only inside the starting folder, or inside
 * OPENCHARTS_MCP_ROOT when that is set.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = realpathSync(resolve(process.env.OPENCHARTS_MCP_ROOT || process.cwd()));
const CHOOSE = fileURLToPath(new URL('../.claude/skills/choose-chart/choose.mjs', import.meta.url));
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const MAX_BYTES = 25 * 1024 * 1024;
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

class ToolError extends Error {}
const bad = (message) => { throw new ToolError(message); };

/** A path the caller named, resolved, and refused unless it is inside ROOT. */
function inside(p, { mustExist }) {
  const full = resolve(ROOT, String(p));
  // A file that does not exist yet is judged by the folder it would be in.
  const real = mustExist ? realpathSync(full) : resolve(realpathSync(dirname(full)), basename(full));
  const rel = relative(ROOT, real);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) bad(`${p} is outside the folder this server was started in (${ROOT}).`);
  return real;
}

const TABLE_PROPERTIES = {
  path: { type: 'string', description: 'A CSV, TSV or JSON file inside the working folder. Prefer this to text for anything large.' },
  text: { type: 'string', description: 'The table itself, when there is no file.' },
};
const READING_PROPERTIES = {
  skip: { type: 'integer', minimum: 0, description: 'Lines of notes above the data to drop before reading.' },
  header: { type: 'boolean', description: 'Whether the first row is the header. Leave out to let it be guessed; table.header.guessed says which happened.' },
  swap: { type: 'boolean', description: 'Turn the table rows-for-columns first.' },
};

const TOOLS = [
  {
    name: 'profile_table',
    description: 'Describe a table without choosing a chart: each column\'s type and role (measure, dimension, time, identifier, label, ordinal), units, places, and the problems found in it.',
    inputSchema: { type: 'object', properties: { ...TABLE_PROPERTIES, ...READING_PROPERTIES }, additionalProperties: false },
  },
  {
    name: 'recommend_charts',
    description: 'Which of the library\'s charts can read this table and are worth drawing, each with the reason in the table\'s own column names and what that chart can mislead about. Also the aggregated views (a chart of a grouped or pivoted table) with the recipe that draws each. `score` is a relative ordering, never a probability.',
    inputSchema: {
      type: 'object',
      properties: {
        ...TABLE_PROPERTIES,
        ...READING_PROPERTIES,
        question: { type: 'string', description: 'What the reader wants to know, in their words ("which region is highest", "any outliers"). Reorders the suggestions; `intent` says how it was read.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'build_chart',
    description: 'Run a recipe on the table and report what the chart will hold. Check verify (ok, clean) and warnings before showing the link: they name blank cells drawn as zero, dates that double back, groups that are really numbers. rendered is always null: drawing is not checked here.',
    inputSchema: {
      type: 'object',
      properties: {
        ...TABLE_PROPERTIES,
        recipe: {
          type: 'object',
          description: 'What to draw and how to get the table there. {"chart": "line-multi", "steps": [{"pivot": "source", "rows": "year", "value": "net_generation"}]}. Keys: chart (required), skip, header, swap, columns, steps (filter, group, bin, sort, limit, transpose, pivot), roles {group, value}, facet.',
          properties: { chart: { type: 'string' } },
          required: ['chart'],
        },
        page: { type: 'string', description: 'A .html file to write inside the working folder: the chart and its data as one page that opens from disk.' },
      },
      required: ['recipe'],
      additionalProperties: false,
    },
  },
];

/** Run choose.mjs --json and return what it said, or throw what it complained of. */
function choose(args, input, text) {
  const source = input.path != null ? inside(input.path, { mustExist: true }) : null;
  if (source) {
    if (!statSync(source).isFile()) bad(`${input.path} is not a file.`);
    if (statSync(source).size > MAX_BYTES) bad(`${input.path} is over ${MAX_BYTES / 1024 / 1024} MB.`);
  } else if (typeof input.text !== 'string' || !input.text.trim()) {
    bad('Give a table: path (a file in the working folder) or text.');
  } else if (Buffer.byteLength(input.text) > MAX_BYTES) {
    bad('That table is too large to pass as text; save it to a file and give path.');
  }
  const run = spawnSync(process.execPath, [CHOOSE, '--json', ...args, source || '-'], {
    input: source ? undefined : text, encoding: 'utf8', timeout: 120000, maxBuffer: 100 * 1024 * 1024, cwd: ROOT,
  });
  let result;
  try { result = JSON.parse(run.stdout); } catch { bad(`The chooser did not answer: ${(run.stderr || run.error?.message || 'no output').slice(0, 300)}`); }
  if (result.error) bad(result.error);
  delete result.text;
  return result;
}

/** The reading options as the chooser's own flags. */
function reading(input) {
  const out = [];
  if (input.skip != null) {
    if (!Number.isInteger(input.skip) || input.skip < 0) bad('skip is a number of lines, such as 2.');
    out.push('--skip', String(input.skip));
  }
  if (input.header === true) out.push('--header');
  if (input.header === false) out.push('--no-header');
  if (input.swap === true) out.push('--swap');
  return out;
}

const HANDLERS = {
  profile_table(input) {
    const r = choose(reading(input), input, input.text);
    return { table: r.table, notes: r.notes };
  },
  recommend_charts(input) {
    const question = input.question == null ? [] : ['--question', String(input.question)];
    return choose([...reading(input), ...question], input, input.text);
  },
  build_chart(input) {
    const recipe = input.recipe;
    if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe) || !recipe.chart) {
      bad('recipe is an object with at least a chart, such as {"chart": "line-basic"}.');
    }
    const page = input.page == null ? [] : ['--html', (() => {
      if (extname(String(input.page)).toLowerCase() !== '.html') bad('page is a .html file name.');
      return inside(input.page, { mustExist: false });
    })()];
    return choose(['--recipe', JSON.stringify(recipe), ...page], input, input.text);
  },
};

function call(name, args) {
  const handler = HANDLERS[name];
  if (!handler) return null;
  try {
    return { content: [{ type: 'text', text: JSON.stringify(handler(args || {}), null, 2) }] };
  } catch (e) {
    if (e instanceof ToolError || e.code === 'ENOENT') {
      return { isError: true, content: [{ type: 'text', text: e instanceof ToolError ? e.message : `No such file: ${args?.path}` }] };
    }
    throw e;
  }
}

function handle(message) {
  const { id, method, params } = message;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, text) => ({ jsonrpc: '2.0', id, error: { code, message: text } });
  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: PROTOCOLS.includes(params?.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'opencharts', version: VERSION },
      });
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: TOOLS });
    case 'tools/call': {
      const result = call(params?.name, params?.arguments);
      return result ? reply(result) : fail(-32602, `Unknown tool: ${params?.name}`);
    }
    default:
      // A notification has no id and gets no answer.
      return id === undefined ? null : fail(-32601, `Method not found: ${method}`);
  }
}

function main() {
  const lines = createInterface({ input: process.stdin });
  lines.on('line', (line) => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`);
      return;
    }
    let response;
    try { response = handle(message); } catch (e) {
      response = { jsonrpc: '2.0', id: message.id ?? null, error: { code: -32603, message: String(e.message || e) } };
    }
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  });
}

main();
