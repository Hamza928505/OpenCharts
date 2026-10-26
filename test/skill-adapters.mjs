/**
 * The choose-chart skill's three faces - its prose, its --json, and the MCP
 * tools over it - have to say the same thing, and the recipe they all run has
 * to mean one thing. Offline, from the benchmark's files.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RecipeError, checkRecipe, colIndex, toStep, applyRecipe } from '../js/studio/recipe.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const skill = join(root, '.claude/skills/choose-chart/choose.mjs');
const server = join(root, 'tools/mcp-server.mjs');
const data = (id) => join(root, `test/benchmark/data/${id}.csv`);
const PIVOT = { chart: 'line-multi', steps: [{ pivot: 'source', rows: 'year', value: 'net_generation' }] };

const choose = (args, input) => spawnSync(process.execPath, [skill, ...args], { cwd: root, input, encoding: 'utf8' });
const json = (args, input) => {
  const run = choose(['--json', ...args], input);
  return { status: run.status, body: JSON.parse(run.stdout) };
};

// recipe.js: one meaning for a recipe, and an error that names the columns there are.
const headers = ['year', 'source', 'net_generation'];
assert.equal(colIndex(headers, ' SOURCE '), 1, 'a column is found as the reader wrote it, in any case');
assert.throws(() => colIndex(headers, 'nope', 'step 1'), (e) => e instanceof RecipeError && /No column called "nope" \(step 1\)\. The columns are: year, source, net_generation/.test(e.message));
assert.throws(() => checkRecipe({ chart: 'line-basic', stpes: [] }), /A recipe has no "stpes"/);
assert.throws(() => checkRecipe([]), /one JSON object/);
assert.throws(() => toStep({ filter: 'year', is: 'x', between: [1, 2] }, headers, 1), /needs one test/);
assert.throws(() => toStep({ sort: 'year', limit: 3 }, headers, 2), /Step 2 needs exactly one of/);
const table = { headers, rows: [['2001', 'a', '1'], ['2001', 'b', '2'], ['2002', 'a', '3'], ['2002', 'b', '4']] };
const pivoted = applyRecipe(table, { steps: PIVOT.steps }, 'line-multi');
assert.deepEqual(pivoted.table.headers, ['year', 'a', 'b']);
assert.equal(pivoted.table.rows.length, 2);
assert.equal(pivoted.steps.length, 1);
assert.deepEqual(applyRecipe(table, { columns: ['net_generation', 'year'] }).table.headers, ['net_generation', 'year']);
assert.throws(() => applyRecipe(table, { roles: { group: 'source', value: 'net_generation' } }, 'line-basic'), /names the group and the value/);
assert.throws(() => applyRecipe(table, { steps: [{ pivot: 'nope', value: 'net_generation' }] }), RecipeError);

// --json: the same run, as one object.
const rank = json([data('drinks'), '--question', 'which country drinks the most']);
assert.equal(rank.status, 0);
assert.equal(rank.body.mode, 'rank');
assert.equal(rank.body.intent, 'ranking');
assert.ok(rank.body.table.columns.some((c) => c.name === 'country' && c.geo === 'country' && c.role === 'label'), 'the profile reaches the object, places and roles included');
assert.ok(rank.body.suggestions.length > 0 && rank.body.suggestions.every((s, i) => s.rank === i + 1 && s.scoreType === 'relative' && s.why && s.caution && s.holds && s.verify), 'every suggestion carries a reason, a caution and what it holds');
assert.ok(rank.body.views.length > 0 && rank.body.views.every((v) => v.recipe && v.recipe.chart === v.chart), 'every view carries the recipe that draws it');
assert.ok(typeof rank.body.text === 'string' && rank.body.text.includes('Views of this table'), 'the prose is still there for a person');
assert.ok(rank.body.link.url.startsWith('https://') && rank.body.link.withData !== undefined);
const prose = choose([data('drinks'), '--question', 'which country drinks the most']).stdout;
assert.equal(prose, `${rank.body.text}\n`, 'the prose mode and the text in --json are the same words');

const long = json([data('iowa')]);
assert.equal(long.body.table.longTable.by, 'source');
assert.deepEqual(long.body.table.longTable.fixes.map((f) => f.how), ['a line each', 'a panel each', 'one of them']);
assert.deepEqual(long.body.table.longTable.fixes[0].recipe, PIVOT, 'the fix the object offers is the recipe that works');

const built = json(['--recipe', JSON.stringify(PIVOT), data('iowa')]);
assert.equal(built.body.mode, 'chart');
assert.equal(built.body.readable, 'fits');
assert.deepEqual(built.body.holds.headers.slice(1), ['Fossil Fuels', 'Nuclear Energy', 'Renewables']);
assert.equal(built.body.verify.ok, true);
assert.equal(built.body.verify.clean, true);
assert.equal(built.body.verify.rendered, null, 'drawing is not claimed');
assert.ok(built.body.link.withData, 'the link carries the data');

const unpivoted = json(['--chart', 'line-multi', data('iowa')]);
assert.equal(unpivoted.body.readable, 'partial', 'the long table is read, but only some of its columns');
assert.ok(unpivoted.body.warnings.some((w) => /dates run backwards/.test(w)), 'and the object says why it is not the chart wanted');
assert.equal(unpivoted.body.verify.clean, false);

const wrong = json(['--recipe', JSON.stringify({ chart: 'line-multi', steps: [{ pivot: 'nope', value: 'x' }] }), data('iowa')]);
assert.equal(wrong.status, 1, 'a bad recipe still exits non-zero');
assert.match(wrong.body.error, /No column called "nope"/);
assert.equal(choose([data('iowa'), '--recipe', JSON.stringify({ chart: 'line-multi', steps: [{ pivot: 'nope', value: 'x' }] })]).status, 1);

const listed = json(['--list']);
assert.equal(listed.body.mode, 'list');
assert.ok(listed.body.charts.length >= 115 && listed.body.charts.every((c) => c.id && c.title));

// MCP: typed arguments in, the same objects out, and nothing read from outside the folder.
const dir = mkdtempSync(join(tmpdir(), 'opencharts-mcp-'));
const child = spawn(process.execPath, [server], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
let buffer = '';
const waiting = new Map();
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  for (let i = buffer.indexOf('\n'); i >= 0; i = buffer.indexOf('\n')) {
    const message = JSON.parse(buffer.slice(0, i));
    buffer = buffer.slice(i + 1);
    waiting.get(message.id)?.(message);
  }
});
let next = 0;
const ask = (method, params) => new Promise((resolve) => {
  const id = ++next;
  waiting.set(id, resolve);
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
});
const tool = async (name, args) => {
  const reply = await ask('tools/call', { name, arguments: args });
  assert.ok(reply.result, `${name}: ${JSON.stringify(reply.error)}`);
  return { isError: !!reply.result.isError, body: reply.result.content[0].text };
};

try {
  const init = await ask('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(init.result.serverInfo.name, 'opencharts');
  assert.deepEqual(init.result.capabilities, { tools: {} });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

  const tools = (await ask('tools/list')).result.tools;
  assert.deepEqual(tools.map((t) => t.name), ['profile_table', 'recommend_charts', 'build_chart']);
  assert.ok(tools.every((t) => t.inputSchema.type === 'object' && t.description.length > 40));
  assert.deepEqual(tools[2].inputSchema.required, ['recipe']);

  const csv = readFileSync(data('iowa'), 'utf8');
  const profiled = await tool('profile_table', { text: csv });
  assert.equal(profiled.isError, false);
  assert.equal(JSON.parse(profiled.body).table.columns[1].role, 'dimension');
  assert.equal(JSON.parse(profiled.body).text, undefined, 'the prose is left out of a tool result');

  const recommended = JSON.parse((await tool('recommend_charts', { path: 'test/benchmark/data/drinks.csv', question: 'any outliers?' })).body);
  assert.equal(recommended.intent, 'anomaly');
  assert.ok(recommended.suggestions.length > 0 && recommended.suggestions.every((s) => s.scoreType === 'relative'));

  const page = join(dir, 'chart.html');
  const outside = await tool('build_chart', { path: 'test/benchmark/data/iowa.csv', recipe: PIVOT, page });
  assert.equal(outside.isError, true, 'a page is not written outside the folder');
  assert.match(outside.body, /outside the folder/);

  const drawn = await tool('build_chart', { path: 'test/benchmark/data/iowa.csv', recipe: PIVOT });
  assert.equal(drawn.isError, false);
  const verdict = JSON.parse(drawn.body);
  assert.equal(verdict.verify.clean, true);
  assert.deepEqual(verdict.holds, built.body.holds, 'the tool and the command line hold the same chart');

  const typed = await tool('build_chart', { text: csv, recipe: { chart: 'line-multi', steps: [{ pivot: 'nope', value: 'x' }] } });
  assert.equal(typed.isError, true);
  assert.match(typed.body, /No column called "nope"/);

  assert.match((await tool('build_chart', { path: 'test/benchmark/data/iowa.csv', recipe: {} })).body, /at least a chart/);
  assert.match((await tool('profile_table', {})).body, /Give a table/);
  assert.equal((await tool('profile_table', { path: 'test/benchmark/data/nothing.csv' })).isError, true);
  assert.match((await tool('profile_table', { path: join(dir, '..') })).body, /outside the folder|not a file/);

  const unknown = await ask('tools/call', { name: 'draw_everything', arguments: {} });
  assert.equal(unknown.error.code, -32602);
  assert.equal((await ask('resources/list')).error.code, -32601);
  assert.equal(existsSync(page), false, 'and nothing was written');
} finally {
  child.kill();
  rmSync(dir, { recursive: true, force: true });
}

console.log('Skill adapters: one recipe meaning, --json as the prose says it, three MCP tools confined to the folder passed.');
