# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

OpenCharts is a chart library of **97 chart types**, all reachable through one
studio page where they can be edited live and copied as HTML, CSS and JS.

- `index.html` — the gallery. Renders every chart live (lazily, via
  IntersectionObserver), searchable and filterable.
- `studio.html?chart=<id>` — the editor. Controls, live preview, generated code.

**The site uses ES modules and must be served over HTTP.** Opening the HTML
files from `file://` will not work — the browser blocks module imports. Use
`python -m http.server 8000` or any static server. There is still no build step.

Charts run on five renderers — Chart.js (39), raw Canvas 2D (36), D3 (15), the
dependency-free OpenCharts engine (5) and one DOM/CSS chart — across 15
categories. The studio treats them all uniformly.

## Architecture

### The registry is the source of truth

Everything — gallery tiles, search, the studio rail, the control panel, the code
generator — reads from `js/studio/registry.js`. Adding a chart means adding one
definition to a file in `js/studio/charts/` and exporting it from the registry.
Nothing else needs touching.

### Chart definition shape

```js
{
  id: 'bar-vertical',            // URL slug, must be unique
  title: 'Vertical Bar',
  category: 'Bar',               // must appear in CATEGORY_ORDER
  blurb: 'One sentence on when to use it.',
  tags: ['bar', 'compare'],      // feeds the gallery search index
  spec: { ... },                 // the editable state, deep-cloned per session
  controls: [ ... ],             // declarative widget schema (see below)

  // Exactly ONE renderer block:
  chartjs: { build(spec, env) -> config, plugins: ['sankey'] },
  canvas:  { height, draw(ctx, spec, W, H, env), helpers: [fn] },
  d3:      { height, mount(host, spec, W, H, env), helpers: [fn] },
  native:  { Class, className, build(spec, env) -> { data, config } },
  dom:     { height, mount(host, spec, env), helpers: [fn] },

  legend:  (spec) => [{ label, color, line?, datasetIndex? }] | null,
  metrics: (spec) => [{ label, value }],   // optional KPI row
  css:     '...',                          // optional per-chart CSS for the export
  onInit:  (spec) => {},                   // derive mirror fields after cloning
  onChange:(spec) => {},                   // normalise after any edit
}
```

### One build function, two outputs

`js/studio/engines.js` drives both the live preview and the exported code from
the *same* renderer block, so they cannot drift apart. This constrains how
renderer code may be written:

- **`canvas` / `d3` / `dom` renderers are serialised to source verbatim.** They
  must reference nothing but their own arguments and globals (`d3`). No imported
  helpers, no closures over module scope. Anything extra goes in `helpers: []`,
  which is emitted alongside.
- **Chart.js `build()` may use imports freely** — only its *return value* is
  serialised. But any function *inside* the returned config (tick callbacks,
  colour callbacks) is printed as source, so those must be self-contained too.
  Use `srcFn()` / `tickFormat()` from `js/studio/serialize.js` to build a
  callback with its values baked in as literals rather than captured.
- **Sampled data must come from a seeded generator**, never `Math.random()` —
  otherwise the exported code draws a different chart than the one copied.
- The `env` argument carries `{ width, height, compact }`. `compact` is true for
  gallery previews; use it to drop labels that cannot fit. It is absent in
  exported code, so a plain falsy check gives full output there.

### Dependency disclosure

`js/studio/cdn.js` holds every third-party library with its version, licence,
provider, homepage and URL, plus `dependenciesFor(def)`. Four surfaces are
generated from it and must never be hand-maintained: the studio's Sources
panel, the comment header on the JS tab, the labelled script tags in the
Standalone export, and the gallery footer credits.

Versions there are pinned to the exact builds in `lib/`. **Updating a file in
`lib/` without updating `cdn.js` ships visitors a snippet pinned to a version
this site never tested.** A chart declares its Chart.js plugins by key
(`plugins: ['matrix']`), which must match a key in `LIBRARIES`.

### Geo charts

The six charts in the `Geo` category fetch `world-atlas` boundaries at runtime
instead of vendoring them, and declare it with `libraries: ['topojson',
'worldAtlas']` on the `d3` block — the same mechanism Chart.js charts use for
`plugins`. Two consequences worth knowing:

- Their `mount` is **synchronous but populates asynchronously**: it creates the
  `<svg>` immediately and fills it when the fetch resolves. `renderChart` does
  not await it, which is fine — but a blank `<svg>` right after mounting is not
  evidence of failure.
- The topology is memoised on `window.__ocTopoCache`, deliberately rather than
  in module scope, because the helper is serialised into the exported code and
  must work there too.

`cdn.js` distinguishes `kind: 'script'` from `kind: 'data'`. Data entries appear
in the Sources panel and the code comments but are never emitted as a
`<script>` tag — use `scriptsOnly()` when generating tags, `cdnOnly()` when
listing dependencies.

### Seeded data

Several families (distribution, finance, horizon, calendar) generate their data
from a seed rather than shipping literal arrays. `Math.random()` is never
acceptable here: the exported code must redraw the exact chart that was copied.
The finance charts additionally use a **mean-reverting** walk — a pure random
walk drifts to a boundary and stops reversing, which leaves Point & Figure,
Kagi and Renko with nothing to draw.

### The data editor

Every chart accepts pasted CSV/TSV. Three files carry this:

| File | Role |
|---|---|
| `dataio.js` | Sniffs the delimiter, detects a header row, and exposes `SHAPES` — one adapter per data layout (`labelSeries`, `rowSeries`, `items`, `pairs`, `observations`, `links`, `edges`, `tree`, `xyGroups`, `places`, `regions`, `ohlc`, `matrix`) |
| `data-schemas.js` | Maps every chart id to a shape, an example, a hint, and a `toText` writer. Kept in one table rather than in the chart files so the mapping is reviewable in one place |
| `ControlPanel.js` | The `data` widget, injected as the first control by `registry.js` |

**`labelSeries` vs `rowSeries` is the distinction to get right.** `labelSeries`
reads each *column* as a series (the usual spreadsheet layout). `rowSeries`
reads each *row* as one — which is what sparklines, horizon bands, Likert
scales and parallel coordinates actually want. Choosing the wrong one silently
transposes the chart.

An `onData(spec, table)` hook runs after the shape writes, for charts whose
internal layout differs from any generic shape — the butterfly splits rows into
two named sides, the chord rebuilds a symmetric matrix, the treemap flattens a
tree. **A hook must read the key its shape actually wrote**, which is `key` from
the descriptor, not `spec.series` by habit.

Charts with `generated: true` get a Sample/My data switch and set `spec.dataMode`
once real data arrives. Their renderers must check for supplied values first —
`g.values`, `spec.bars`, `spec.regionValues` — and only fall back to the seeded
generator. `hideGroups` then hides the now-irrelevant parameter sliders, though
never the data editor itself.

### Help content

`chart-help.js` holds a `read` and a `watch` line per chart, with a
category-level fallback so nothing is ever blank — the test suite enforces
that every chart resolves to both. `watch` is the part worth keeping honest:
it names how that chart type misleads, rather than pretending the choice of
chart is neutral.

### The data dialog

`DataDialog.js` is the full-size editor. It previews the parse before applying
— column names, the role of each column, and any cell that will not read as a
number. `looksNumeric()` in `dataio.js` backs both that highlight and header
detection, and it is deliberately **narrower** than "strip everything that is
not a digit": that looser rule makes `Q1` numeric and breaks header detection
on any table with quarter columns.

### Geo and the globe

`makeProjection(name, geo, W, H, rotate)` builds all four projections; `globe`
is `d3.geoOrthographic`. Two rules for it:

- **Fit the sphere, not the features.** `fitSize` against a clipped globe
  leaves it lopsided, so the globe path fits `{ type: 'Sphere' }`.
- **Cull the far side.** Orthographic projects the far hemisphere onto the same
  disc as the near one, so any *point* mark (symbols, flow endpoints, density
  dots) must be filtered through `isVisible()` or Sydney gets drawn on top of
  the Atlantic. Country *paths* are clipped by `clipAngle(90)` already.

### Control schema

`js/studio/ControlPanel.js` renders widgets from `controls: []`. Each entry has
a `group` (heading), a `type`, and a dot-path `key` into the spec. Types:
`series`, `colors`, `values`, `labels`, `toggle`, `seg`, `slider`, `select`,
`text`. Consecutive entries sharing a `group` are drawn under one numbered
heading.

### Studio modules (`js/studio/`)

| File | Role |
|---|---|
| `registry.js` | Catalogue, categories, `newSpec()` cloning, search |
| `engines.js` | Render + code generation for all five renderer kinds |
| `serialize.js` | JS value → readable source, `srcFn`, `tickFormat` |
| `ControlPanel.js` | Schema-driven controls |
| `CodePanel.js` | HTML/CSS/JS/Standalone tabs, copy, download |
| `StudioApp.js` | Studio page orchestration |
| `GalleryApp.js` | Gallery grid with lazy live previews |
| `highlight.js` | Small syntax highlighter for the code panel |
| `palette.js` | The one colour source for every chart |
| `theme.js` | Light/dark, persisted; charts re-render on change |
| `toast.js` | Transient notices |
| `chartjs-base.js` | Shared Chart.js option builders |
| `cdn.js` | **Single source of truth for every third-party library** |
| `SourcesPanel.js` | The studio's per-chart dependency disclosure |

### Custom engine (`js/core`, `js/charts`, `js/components`)

Unchanged from before and still used by the five `Custom Engine` charts.
`BaseChart` handles DPR-aware canvas sizing, the animation loop, resize
observation and three-layer config merging; subclasses implement
`processData()`, `computeLayout()` and `drawChart()`.

## Developing

No build step needed, but the site must be served over HTTP because it uses ES
modules — `python -m http.server 8000`, then open
`http://localhost:8000/index.html`. Opening from `file://` fails.

Chart.js, D3 and the plugins load from `lib/` where vendored and from unpkg for
the three plugins that are not (matrix, treemap, boxplot).

### Development Workflow
1. **Making changes**: Edit the chart definition in `js/studio/charts/`
2. **Viewing changes**: Save and hard-refresh (Ctrl+Shift+R — modules cache aggressively)
3. **Testing a chart**: Open `studio.html?chart=<id>` and work the controls
4. **Testing the export**: Copy the Standalone tab into a file and open it — it should render identically
5. **Debugging**: Browser devtools; render failures surface in the chart area rather than throwing

## Testing

`npm test` runs `test/run.mjs` — a Playwright suite against a real headless
Chromium, which is not negotiable here: most of the library draws to canvas or
measures layout, and jsdom would pass while rendering nothing.

Eleven suites cover the registry, every chart (render + non-blank canvas +
legend + data round-trip + codegen), the gallery, search, the studio, live
editing, the data editor, share links, standalone exports, responsive
breakpoints, and console cleanliness.

**Two lessons already learned the hard way, both encoded as checks:**

- A generated `<script>` block must never contain a literal `</script>` — even
  inside a comment, HTML closes the element there and dumps the rest as text.
  `safeForInlineScript()` in `engines.js` escapes it.
- Anything a serialised helper closes over must live *inside* that helper.
  `makeProjection` builds its projection table locally for exactly this reason;
  referencing a module-level const produced a `ReferenceError` in every
  exported map.

Exports are served over http from the project root during tests rather than
via `setContent`, so relative imports and CDN scripts resolve the way they
would for a real user.

## Development Commands

This project does not use formal build tools, test runners, or linters. All development is done through direct file editing and browser refresh:

- **Build**: None required
- **Serve**: `python -m http.server 8000` (mandatory — ES modules need HTTP)
- **Test**: No automated suite. The fastest smoke test is to import the registry
  in the page console and render every chart:
  ```js
  const reg = await import('/js/studio/registry.js');
  const eng = await import('/js/studio/engines.js');
  const host = document.createElement('div');
  host.style.cssText = 'width:820px;height:400px;position:fixed;left:-9999px';
  document.body.appendChild(host);
  for (const def of reg.CHARTS) {
    const inst = eng.renderChart(def, host, reg.newSpec(def));
    if (inst.engine === 'error') console.error(def.id);
    eng.generateCode(def, reg.newSpec(def));
    eng.destroyInstance(inst);
  }
  ```
- **Lint**: No linting configuration — `node --check js/studio/**/*.js` catches syntax errors

## Key Patterns

- **Canvas DPR**: `BaseChart._sizeCanvas()` sets `canvas.width = rect.width * devicePixelRatio` and scales the context. Use `this._cssWidth` / `this._cssHeight` for layout math.
- **Animation progress**: `this.progress` (0→1) is driven by `BaseChart._startAnimation()`. Use in `drawChart()` to animate reveals.
- **Config merging**: `BaseChart._mergeConfig()` deep-merges `BASE_DEFAULTS` → chart `getDefaultConfig()` → user config.
- **Sparse data**: LineChart uses `toSegments()` (from `js/utils/data.js`) to split null values into separate polylines, avoiding line artifacts across gaps.
- **Legend toggle**: `LegendSystem` fires `onChange(index, hidden)` — chart reads `this._datasets[index].hidden` and filters `this._visibleDatasets` before calling `update()`.

## Dependencies

No npm install. The studio pages load:
- Chart.js 4.4.1 + the sankey plugin from `lib/`
- D3 v7 from `lib/`
- chartjs-chart-matrix, chartjs-chart-treemap and chartjs-chart-boxplot from unpkg
  (not vendored — these three are the only reason the studio needs a network)
- Google Fonts: DM Sans, DM Mono, Instrument Serif

Bootstrap and SweetAlert2 have been **removed from the project entirely** — the
design system in `css/studio.css` and `js/studio/toast.js` replaced them.

## File Naming

| Pattern | Meaning |
|---|---|
| `index.html` / `studio.html` | The two live pages |
| `js/studio/charts/*.js` | Chart definitions, grouped by family |
| `js/studio/*.js` | Studio framework |
| `css/studio.css` | The whole design system |
| `js/charts/LineChart.js` | Custom engine chart class |

## Adding a Chart

1. Add a definition to the right file in `js/studio/charts/` (see the shape above).
2. Export it from `js/studio/registry.js`.

Respect the serialisation constraints in "One build function, two outputs" —
they are the only non-obvious rule in this codebase, and breaking them produces
code that renders on the page but throws when pasted elsewhere.

## Adding a New Custom-Engine Chart Class

1. Create `js/charts/NewChart.js` extending `BaseChart`, implementing `processData()`, `computeLayout()`, `drawChart()`.
2. Add `getDefaultConfig()` for chart-specific defaults.
3. Add a definition with a `native:` block in `js/studio/charts/engine.js`.