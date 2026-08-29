/**
 * build-wiki.mjs — regenerate the GitHub wiki from the registry.
 *
 *   node tools/build-wiki.mjs ../OpenCharts.wiki
 *
 * The wiki's four reference pages are the same four facts the studio already
 * maintains — a chart's title, blurb, engine, data shape and help lines — laid
 * out for reading rather than for a control panel. Written by hand they drift
 * the moment a chart is added, and they had: sixteen charts landed and the
 * wiki still said ninety-eight, down to the per-category counts.
 *
 * So they are generated, for the same reason `cdn.js` generates the Sources
 * panel and `prompt.js` generates the AI brief: a page that restates the
 * registry must be derived from it or it becomes a lie with a timestamp.
 *
 * FAQ.md is deliberately *not* generated. It is prose about things that go
 * wrong, and nothing in it comes from the registry.
 *
 * What is authored here rather than derived:
 *   SHAPE_BLURB   one editorial sentence per data shape, because `SHAPE_GUIDE`
 *                 in prompt.js is written to instruct an assistant mid-task
 *                 and reads oddly as a reference entry.
 * Everything else — every count, title, blurb, engine, column list and help
 * line — comes from the code.
 */

import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CHARTS, CATEGORIES, CATEGORY_ORDER } from '../js/studio/registry.js';
import { engineOf, ENGINE_LABEL } from '../js/studio/engines.js';
import { expectedFormat } from '../js/studio/dataio.js';
import { helpFor } from '../js/studio/chart-help.js';

const SITE = 'https://hamza928505.github.io/OpenCharts';
const REPO = 'https://github.com/Hamza928505/OpenCharts';

const out = process.argv[2];
if (!out) {
  console.error('usage: node tools/build-wiki.mjs <path-to-OpenCharts.wiki>');
  process.exit(1);
}
if (!existsSync(out)) {
  console.error(`no such directory: ${out}`);
  process.exit(1);
}

/** One sentence per shape, for a reader rather than for an assistant. */
const SHAPE_BLURB = {
  labelSeries: 'The first column names each row; every column after it becomes its own series. The ordinary spreadsheet layout.',
  rowSeries: 'The transpose: each *row* is one series and every column after the name is a point along it. Sparklines, horizon bands and Likert scales are written this way, and choosing the wrong one of these two silently transposes the chart.',
  labelValue: 'A label and a single value per row. The narrowest layout there is.',
  items: 'One row per item: a name and the number beside it. What that number means differs by chart — the columns below say which.',
  pairs: 'A fixed set of columns per row, usually a label and two values set against each other.',
  observations: 'Raw measurements, one per row, as a group name and a value — or one column per group. Repeated group names are the point: they are what gives the chart a distribution.',
  links: 'A row is a whole path, not one hop. `Ad, Visit, Checkout, 320` is 320 flowing Ad → Visit *and* Visit → Checkout. A hop appearing in two paths is summed into one ribbon.',
  dimensions: 'One column per dimension, named by its heading, then the count. The headings are part of the data here.',
  edges: 'A source and a target, and nothing else. The nodes are whatever names appear.',
  tree: 'A hierarchy: one level per column, a `Parent > Child` path in a single cell, or both in the same table.',
  xyGroups: 'A group name and an x/y position per row — or just x and y where there is one group.',
  places: 'A place and where it sits: a name, a longitude, a latitude and a value. Longitude first — swapping the pair puts every mark in the sea.',
  regions: 'A country name and its value. Spell countries out in full.',
  ohlc: 'Open, high, low and close, in that order. A leading date column is ignored, so it is safe to keep one.',
  matrix: 'A grid: the first column labels the row, every column after it is one cell.',
};

/* ── helpers ─────────────────────────────────────────────────────────────── */

const studioUrl = (id) => `${SITE}/studio.html?chart=${encodeURIComponent(id)}`;
const link = (def) => `[${def.title}](${studioUrl(def.id)})`;
/** A pipe would end the table cell it sits in. */
const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const anchor = (name) => name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');
const jumpBar = () => '**Jump to:** ' + CATEGORY_ORDER
  .filter((c) => CHARTS.some((d) => d.category === c))
  .map((c) => `[${c}](#${anchor(c)})`).join(' · ');

const withData = CHARTS.filter((d) => d.data);
const shapeTally = () => {
  const by = new Map();
  withData.forEach((d) => {
    const s = d.data.shape;
    if (!by.has(s)) by.set(s, []);
    by.get(s).push(d);
  });
  return [...by.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
};

const engineTally = () => {
  const by = {};
  CHARTS.forEach((d) => { const e = engineOf(d); by[e] = (by[e] || 0) + 1; });
  return by;
};

const FOOTER = '\n---\n\n*Generated from the registry by `tools/build-wiki.mjs`. '
  + 'Do not edit by hand — regenerate.*\n';

/* ── Home ────────────────────────────────────────────────────────────────── */

function home() {
  const e = engineTally();
  const libraryFree = (e.canvas || 0) + (e.native || 0) + (e.dom || 0);
  const shapes = shapeTally();

  return `# OpenCharts

**${CHARTS.length} chart types** you can edit live and copy as HTML, CSS and JavaScript.
No build step, no framework, no account.

**[Open the gallery](${SITE}/)**

## What is in this wiki

The [README](${REPO}#readme) is the guide — how to run it, paste your data, share a
chart, read a file. This wiki is the **reference**: the parts too long to sit in a README.

| Page | What it answers |
|---|---|
| [Chart Catalogue](Chart-Catalogue) | All ${CHARTS.length} charts, what each is for, which engine draws it |
| [Data Formats](Data-Formats) | "I have this table — what can draw it?" |
| [Reading a Chart](Reading-a-Chart) | How to read each chart, and how each one misleads |
| [FAQ](FAQ) | Nothing renders, my file will not read, my country is grey |

## The shape of it

| | |
|---|---|
| Charts | ${CHARTS.length} |
| Categories | ${CATEGORIES.length} |
| Table layouts accepted | ${shapes.length} |
| Charts needing no charting library at all | ${libraryFree} |

### Categories

${CATEGORY_ORDER
  .filter((c) => CHARTS.some((d) => d.category === c))
  .map((c) => `- **${c}** — ${plural(CHARTS.filter((d) => d.category === c).length, 'chart', 'charts')}`)
  .join('\n')}

### Engines

Each chart is drawn by whichever engine suits it; the badge on every gallery tile says which.

| Engine | Charts |
|---|---|
| Chart.js | ${e.chartjs || 0} |
| Canvas 2D — hand-drawn, no charting library | ${e.canvas || 0} |
| D3 — SVG, including every map | ${e.d3 || 0} |
| OpenCharts engine — dependency-free | ${e.native || 0} |
| DOM / CSS | ${e.dom || 0} |

## One thing worth knowing up front

No chart here invents its own numbers. Every one opens on literal data you can edit,
and a renderer that does not read its data from the spec is treated as a bug rather
than a demo. If a chart appears to be showing you something, it is showing you the
table underneath it.
${FOOTER}`;
}

/* ── Chart Catalogue ─────────────────────────────────────────────────────── */

function catalogue() {
  const sections = CATEGORY_ORDER
    .filter((c) => CHARTS.some((d) => d.category === c))
    .map((name) => {
      const list = CHARTS.filter((d) => d.category === name);
      const rows = list.map((d) => `| ${link(d)} | ${cell(d.blurb)} | ${ENGINE_LABEL[engineOf(d)]} `
        + `| ${d.data ? '`' + d.data.shape + '`' : '—'} |`).join('\n');
      return `## ${name}\n\n${plural(list.length, 'chart', 'charts')}.\n\n`
        + `| Chart | What it is for | Engine | Data |\n|---|---|---|---|\n${rows}\n`;
    }).join('\n');

  return `# Chart Catalogue

All ${CHARTS.length} charts, grouped by category. **Every title links straight into the studio**,
where the chart opens with editable data and a copyable snippet.

The *Data* column names the table layout it reads — see [Data Formats](Data-Formats)
for what each means and how to lay one out.

${jumpBar()}

${sections}${FOOTER}`;
}

/* ── Data Formats ────────────────────────────────────────────────────────── */

function dataFormats() {
  const shapes = shapeTally();

  const glance = shapes.map(([shape, list]) => {
    // The one-liner is the blurb's first sentence, so the two cannot disagree.
    const first = (SHAPE_BLURB[shape] || '').split(/(?<=\.)\s/)[0];
    return `| [\`${shape}\`](#${shape.toLowerCase()}) | ${list.length} | ${cell(first)} |`;
  }).join('\n');

  const sections = shapes.map(([shape, list]) => {
    const sample = list[0];
    const rows = list.map((d) => {
      const cols = expectedFormat(d).columns;
      return `| ${link(d)} | ${cols.length ? cols.map((c) => '`' + cell(c) + '`').join(', ') : '—'} |`;
    }).join('\n');
    return `## ${shape}

${SHAPE_BLURB[shape] || ''}

An example, as ${link(sample)} opens:

\`\`\`
${(sample.data.example || '').trim()}
\`\`\`

**${plural(list.length, 'chart reads', 'charts read')} this layout:**

| Chart | Columns it expects |
|---|---|
${rows}
`;
  }).join('\n---\n\n');

  return `# Data Formats

Every chart takes a table. There are ${shapes.length} layouts between them.

Paste, type or upload a table in the studio and the chart redraws on it. Commas, tabs
and semicolons all work; a header row is detected, and \`1,234\`, \`$99\` and \`42%\` all
read as numbers. A title row above the table is skipped, and the editor says how many
it dropped. The gallery can also go the other way — paste a table into it and it
narrows itself to the charts that can read it, offering the columns of your table a
chart can take where it cannot take all of them.

## At a glance

| Layout | Charts | In one line |
|---|---|---|
${glance}

---

${sections}${FOOTER}`;
}

/* ── Reading a Chart ─────────────────────────────────────────────────────── */

function reading() {
  const sections = CATEGORY_ORDER
    .filter((c) => CHARTS.some((d) => d.category === c))
    .map((name) => {
      const body = CHARTS.filter((d) => d.category === name).map((d) => {
        const help = helpFor(d) || {};
        return `### ${link(d)}\n\n**Reading it.** ${help.read || ''}\n\n`
          + `**Watch for.** ${help.watch || ''}\n`;
      }).join('\n');
      return `## ${name}\n\n${body}`;
    }).join('\n');

  return `# Reading a Chart

Choosing a chart is not a neutral act. Each one makes something easy to see and
something else easy to miss, and the second half is usually the part left out.

So every chart below gets two lines: **how to read it**, and **what to watch** — the
way that particular chart misleads. The same text appears in the studio beside the
chart itself.

${jumpBar()}

${sections}${FOOTER}`;
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

const sidebar = () => `### OpenCharts

- [Home](Home)
- [Chart Catalogue](Chart-Catalogue)
- [Data Formats](Data-Formats)
- [Reading a Chart](Reading-a-Chart)
- [FAQ](FAQ)

---

- [Gallery](${SITE}/)
- [Repository](${REPO})
- [README](${REPO}#readme)
`;

/* ── write ───────────────────────────────────────────────────────────────── */

const pages = {
  'Home.md': home(),
  'Chart-Catalogue.md': catalogue(),
  'Data-Formats.md': dataFormats(),
  'Reading-a-Chart.md': reading(),
  '_Sidebar.md': sidebar(),
};

// Every chart must resolve to both help lines, or the page ships a blank
// "Reading it." — the same rule the test suite enforces for the studio.
const silent = CHARTS.filter((d) => {
  const h = helpFor(d);
  return !h || !h.read || !h.watch;
});
if (silent.length) {
  console.error('no help for: ' + silent.map((d) => d.id).join(', '));
  process.exit(1);
}

Object.entries(pages).forEach(([name, body]) => {
  writeFileSync(join(out, name), body, 'utf8');
  console.log(`${name.padEnd(22)} ${body.split('\n').length} lines`);
});
console.log(`\n${CHARTS.length} charts · ${CATEGORIES.length} categories · `
  + `${shapeTally().length} layouts → ${out}`);
