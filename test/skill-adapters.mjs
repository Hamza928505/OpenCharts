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

  // Table-free calls: when the user only describes what they want (no data yet).
  const mcpList = JSON.parse((await tool('recommend_charts', {})).body);
  assert.equal(mcpList.mode, 'list');
  assert.ok(mcpList.charts.length >= 115);
  const mcpChartInfo = JSON.parse((await tool('build_chart', { recipe: { chart: 'sankey' } })).body);
  assert.equal(mcpChartInfo.mode, 'chart');
  assert.equal(mcpChartInfo.chart.id, 'sankey');
  assert.ok(Array.isArray(mcpChartInfo.chart.reads.columns) && mcpChartInfo.link.withData === false);

  // Row identifiers (rownames, id) are excluded from projections and box-plot roles hints.
  const withRownames = 'rownames,group,speed,dist\n'
    + Array.from({ length: 12 }, (_, i) => `${i + 1},${i % 2 ? 'A' : 'B'},${10 + i},${20 + i * 3}`).join('\n') + '\n';
  const rRanked = JSON.parse((await tool('recommend_charts', { text: withRownames })).body);
  assert.ok(rRanked.suggestions.every((s) => !s.using || !s.using.includes('rownames')), 'projections leave out rownames when real measures exist');
  assert.notEqual(rRanked.views[0].recipe.steps[0].agg, 'count', 'measure-bearing views lead ahead of row counts');
  assert.ok(rRanked.notes.some((n) => /"rownames" looks like an identifier/.test(n)), 'profile quality notes reach the top-level notes array');

  // Calling build_chart with only {"chart": id} preserves the missing-column warning when a partial projection dropped a column named in why.
  const pairs = [[5, 1], [1, 2], [4, 3], [2, 4], [6, 5], [3, 6], [5, 7], [1, 8], [4, 9], [2, 10], [6, 11], [3, 12]];
  const offTopicCsv = 'name,noise,x,y\n' + pairs.map(([n, x], i) => `${'pqr'[i % 3]},${n},${x},${x * 2}`).join('\n') + '\n';
  const offRanked = JSON.parse((await tool('recommend_charts', { text: offTopicCsv })).body);
  const missingPick = offRanked.suggestions.find((s) => s.warnings.some((w) => /the reason is about/.test(w)));
  assert.ok(missingPick, 'a partial pick that drops the column named in why warns in recommend_charts');
  const unfixedBuild = JSON.parse((await tool('build_chart', { text: offTopicCsv, recipe: { chart: missingPick.id } })).body);
  assert.equal(unfixedBuild.verify.clean, false, 're-running build_chart without columns keeps verify.clean false');
  assert.ok(unfixedBuild.warnings.some((w) => /the reason is about/.test(w)));

  // Large all-numeric tables (like 4,971 x 12 weather ensemble forecasts) do not match flow/node charts or stall.
  const bigNumeric = Array.from({ length: 12 }, (_, c) => `m${c}`).join(',') + '\n'
    + Array.from({ length: 2000 }, (_, r) => Array.from({ length: 12 }, (__, c) => ((r * 13 + c * 7) % 997) / 10).join(',')).join('\n') + '\n';
  const t0 = Date.now();
  const bigRanked = JSON.parse((await tool('recommend_charts', { text: bigNumeric })).body);
  assert.ok(Date.now() - t0 < 5000, `large all-numeric table ranked in ${Date.now() - t0}ms`);
  assert.ok(bigRanked.suggestions.every((s) => !['chord', 'sankey', 'parallel-sets'].includes(s.id)));

  // Finding 11: box-plot places each group's values at its own x-axis tick slot, not all at slot 0.
  const { getChart, newSpec } = await import('../js/studio/registry.js');
  const boxDef = getChart('box-plot');
  const boxCfg = boxDef.chartjs.build(newSpec(boxDef));
  assert.equal(boxCfg.options.scales.x.stacked, true, 'box-plot x-axis stacks slots so each group centers on its tick');
  boxCfg.data.datasets.forEach((ds, i) => {
    assert.equal(ds.data.length, boxCfg.data.labels.length);
    assert.ok(Array.isArray(ds.data[i]) && ds.data[i].length > 0, `group ${i} sits at tick ${i}`);
    ds.data.forEach((slot, j) => { if (j !== i) assert.equal(slot, null); });
  });

  // Finding 12: repair recipe on a box-plot never picks an identifier column (rownames, id) as the value column.
  const gravCsv = 'rownames,g,series\n'
    + Array.from({ length: 24 }, (_, i) => `${i + 1},${70 + (i % 8)},${i < 12 ? 7 : 8}`).join('\n') + '\n';
  const gravBox = json(['--chart', 'box-plot', '--columns', 'rownames,g,series', '-'], gravCsv);
  assert.ok(gravBox.body.warnings.some((w) => w.includes('"group":"series","value":"g"') && !w.includes('rownames')),
    'box-plot repair recipe names g as value, never rownames');

  // Finding 13: a two-column year/value table (with or without rownames) reads year as time, not as a second series.
  const yearValCsv = 'rownames,year,incidence\n'
    + Array.from({ length: 32 }, (_, i) => `${i + 1},${1950 + i},${(1.1 + (i % 7) * 0.4).toFixed(1)}`).join('\n') + '\n';
  const yearValRanked = json(['-'], yearValCsv).body;
  const linePick = yearValRanked.suggestions.find((s) => s.id === 'line-basic');
  assert.ok(linePick && linePick.verify.clean, 'year/value line-basic is clean');
  assert.deepEqual(linePick.holds.headers, ['label', 'incidence'], 'year is the x-axis label, not a second series');
  const histPick = yearValRanked.suggestions.find((s) => s.id === 'histogram');
  assert.ok(histPick && histPick.verify.clean, 'year/value histogram drops year and holds only the measure');

  // Finding 3: MCP server uses async spawn so a running tool call does not block ping, and refuses oversized tables.
  const order = [];
  const slowCall = tool('recommend_charts', { path: 'test/benchmark/data/wbpop.csv' }).then((r) => { order.push('tool'); return r; });
  const fastPing = ask('ping').then((r) => { order.push('ping'); return r; });
  await Promise.all([slowCall, fastPing]);
  assert.deepEqual(order, ['ping', 'tool'], 'ping answers while a tool call is still running in its child process');
  const tooManyRows = 'a,b\n' + '1,2\n'.repeat(50005);
  const refusedOversized = await tool('profile_table', { text: tooManyRows });
  assert.equal(refusedOversized.isError, true, 'oversized table is refused');
  assert.match(refusedOversized.body, /over 50,000 rows; filter or aggregate it first/);

  // Findings 5 & 6: missing file in --json answers {"error": ...} (no stack trace), and links past 8,192 chars set linkTooLong and return the plain studio link.
  const missingRun = choose(['--json', 'test/benchmark/data/does-not-exist.csv']);
  assert.equal(missingRun.status, 1);
  assert.equal(missingRun.stderr, '', 'no raw stack trace on stderr in --json mode');
  assert.match(JSON.parse(missingRun.stdout).error, /No such file/);
  const bigLinkCsv = 'item,v1,v2,v3,v4\n'
    + Array.from({ length: 1200 }, (_, i) => `item_${i}_${(i * 7919) % 104729},${(i * 31) % 997},${(i * 47) % 991},${(i * 59) % 983},${(i * 73) % 977}`).join('\n') + '\n';
  const bigLinkRun = json(['-'], bigLinkCsv);
  assert.equal(bigLinkRun.body.linkTooLong, true, 'large link exceeds 8,192 chars and sets linkTooLong: true');
  assert.equal(bigLinkRun.body.link.linkTooLong, true);
  assert.equal(bigLinkRun.body.link.withData, false);
  assert.ok(!bigLinkRun.body.link.url.includes('&s='), 'JSON link holds the plain studio URL when too long');

  // Finding 14: flow charts over > 500 raw rows are not offered un-aggregated, and parallel-sets folds duplicate dimension tuples.
  const longFlowCsv = 'dept,status,amount\n'
    + Array.from({ length: 800 }, (_, i) => `${['Sales', 'Eng', 'Ops'][i % 3]},${['Open', 'Won'][i % 2]},${10 + (i % 5)}`).join('\n') + '\n';
  const longFlowRanked = json(['-'], longFlowCsv).body;
  assert.ok(longFlowRanked.suggestions.every((s) => !['sankey', 'chord', 'parallel-sets', 'alluvial'].includes(s.id)),
    'flow charts are not offered un-aggregated over > 500 raw rows');
  const dupSetsCsv = 'channel,device,outcome,count\n'
    + 'Organic,Desktop,Purchase,10\nOrganic,Desktop,Purchase,15\nPaid,Mobile,Bounce,20\n';
  const dupSetsBuilt = json(['--chart', 'parallel-sets', '-'], dupSetsCsv).body;
  assert.equal(dupSetsBuilt.holds.rows, 2, 'parallel-sets folds duplicate dimension tuples into one record per distinct combination');
  assert.deepEqual(dupSetsBuilt.holds.first, ['Organic', 'Desktop', 'Purchase', '25']);

  // Finding 10: standalone export CSS uses border-box and a shrinkable grid track so the page does not overflow a 390 px window.
  const { generateCode } = await import('../js/studio/engines.js');
  const standaloneHtml = generateCode(boxDef, newSpec(boxDef)).standalone;
  assert.match(standaloneHtml, /grid-template-columns:\s*minmax\(0,\s*1fr\)/, 'standalone body grid shrinks below max-width on narrow viewports');
  assert.match(standaloneHtml, /\.chart-card\s*\{[\s\S]*?box-sizing:\s*border-box;\s*min-width:\s*0;/, 'chart-card includes border-box and min-width: 0');

  const unknown = await ask('tools/call', { name: 'draw_everything', arguments: {} });
  assert.equal(unknown.error.code, -32602);
  assert.equal((await ask('resources/list')).error.code, -32601);
  assert.equal(existsSync(page), false, 'and nothing was written');
} finally {
  child.kill();
  rmSync(dir, { recursive: true, force: true });
}

console.log('Skill adapters: one recipe meaning, --json as the prose says it, three MCP tools confined to the folder passed.');
