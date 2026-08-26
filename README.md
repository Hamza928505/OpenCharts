# OpenCharts

[![License: MIT](https://img.shields.io/badge/License-MIT-6C63D8.svg)](LICENSE)
[![Charts](https://img.shields.io/badge/charts-96-16916A.svg)](#the-two-pages)
[![No build step](https://img.shields.io/badge/build-none-2F76C9.svg)](#running-it)

A library of **97 chart types**. Every one opens in a studio where the data,
colours and options are live controls, and the HTML, CSS and JavaScript behind
it update as you edit — so the code you copy is the chart you built.

## Sharing a chart

Once you have a chart the way you want it, **Share** copies a link that
reproduces it exactly — data, colours and options included. The whole spec is
compressed into the URL, so there is no server, no account and nothing stored:
the link *is* the document.

## Running it

The site uses ES modules, so it needs to be served over HTTP.
Opening `index.html` from the file system will not work (the browser blocks
module imports on `file://`).

```bash
python -m http.server 8000
# then open http://localhost:8000/index.html
```

Any static server works — `npx serve`, `php -S localhost:8000`, VS Code Live
Server, and so on. There is no build step and nothing to install.

## The two pages

| Page | What it is |
|---|---|
| `index.html` | The gallery. Every chart rendered live, searchable and filterable by category. |
| `studio.html?chart=<id>` | The editor. Controls on the left, live preview top right, generated code below. |

## Code output

Each chart emits four views:

- **HTML** — the markup fragment (`<canvas>` / `<div>` plus the legend slot)
- **CSS** — only the rules that chart actually uses
- **JS** — the chart code, with the data and options inlined as literals
- **Standalone** — a complete `<!DOCTYPE html>` page with all three inlined and
  the CDN script tags already in place. Download it and it runs.

## Using your own data

Every chart takes real data. The first control in the studio is a paste box
that accepts CSV or TSV — copy a range straight out of Excel, Sheets or a
`.csv` and press **Use this data**. The delimiter is detected, a header row is
detected, and formatted numbers (`1,234`, `$99`, `42%`) are read correctly.

The columns each chart wants are described under the box, and **Example** fills
it with correctly-shaped rows you can edit. Structured charts take the same
treatment: flows want `from,to,value`, networks want `source,target`, and
hierarchies want a `Parent > Child > Leaf` path per row.

Charts whose sample data is simulated — the distributions, the finance charts,
the maps — get a **Sample data / My data** switch. Sample mode keeps the
parameter sliders for exploring; My data replaces them with your observations.

## Knowing what you are loading

Nothing here loads a library behind your back.

- The studio shows a **Sources** panel under every chart: each library it needs,
  with version, licence, CDN provider and the exact URL, copyable on its own.
- The **JS** tab opens with a comment block naming the `<script>` tags that must
  be on the page for the snippet to run — so copying the JS alone cannot leave
  you with a silent blank canvas.
- The **Standalone** export labels every script tag with what it is and where it
  came from.
- The gallery footer lists every library the project ships.

Charts that need nothing say so plainly — 42 of the 96 load no library at all.

Versions are pinned in `js/studio/cdn.js`, which is the single source of truth
for all of the above. It matches the builds vendored in `lib/`; if you update
one, update the other in the same commit.

The map charts are the one case that fetches *data* rather than a script: the
`world-atlas` country boundaries (~110KB) are pulled from a CDN at runtime
rather than committed here. That entry appears in the Sources panel like any
other dependency, and is labelled as data rather than a script tag.

## Rendering engines

Charts are built on whichever engine suits them; the badge on each tile says which.

| Engine | Count | Notes |
|---|---|---|
| Chart.js | 39 | Plus the sankey, matrix, treemap and boxplot plugins |
| Canvas 2D | 36 | Hand-drawn, no charting library at all |
| D3 | 16 | SVG output, including all the maps and the globe |
| OpenCharts | 5 | The dependency-free engine in `js/core` + `js/charts` |
| DOM / CSS | 1 | The waffle chart is just styled divs |

Charts are grouped into 15 categories: Line & Area, Bar, Deviation, Part to
Whole, Radar, Scatter, Distribution, Hierarchy, Network, Flow, Comparison,
Finance, Geo, KPI & Micro, and Custom Engine.

## Tests

```bash
npm install          # once — pulls Playwright
npx playwright install chromium
npm test             # renders all 97 charts and checks them
```

The suite runs in a real headless browser, because two thirds of the library
draws to a canvas or measures real layout — jsdom would report a green run
while rendering nothing. For each chart it checks that it renders, that the
canvas is not blank, that the data editor accepts its own example, that the
chart survives that data, and that the generated code parses and declares its
dependencies. It also loads seven exported standalone files and confirms they
actually run.

```bash
npm test -- --only geo     # just the charts whose id contains "geo"
npm test -- --headed       # watch it happen
```

CI runs the same suite on every push and pull request.

## Adding a chart

1. Add a definition to the right file in `js/studio/charts/`.
2. Export it from `js/studio/registry.js`.

That is the whole job. The gallery, the search index, the studio rail, the
control panel and the code generator all read from the registry, so nothing
else needs touching. See `CLAUDE.md` for the definition shape.

## Licence

OpenCharts is MIT licensed — free to use, modify and ship, commercially or
otherwise. The libraries it builds on carry their own licences (MIT, except D3
which is ISC); the gallery footer and the studio's Sources panel name them.

