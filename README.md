# OpenCharts

[![License: MIT](https://img.shields.io/badge/License-MIT-6C63D8.svg)](LICENSE)
[![Charts](https://img.shields.io/badge/charts-114-16916A.svg)](#the-two-pages)
[![No build step](https://img.shields.io/badge/build-none-2F76C9.svg)](#running-it)

A library of **114 chart types**. Every one opens in a studio where the data,
colours and options are live controls, and the HTML, CSS and JavaScript behind
it update as you edit — so the code you copy is the chart you built.

## Start from your data

The gallery asks the question the other way round too. **Match my data** at the
top of the index takes a pasted table or a spreadsheet and narrows the 114
charts to the ones that can actually read it — a `from, to, value` table finds
the Sankey and the chord diagram, a label and three numeric columns finds a
hundred and six. Every tile then draws *your* rows rather than its own example,
so you are choosing between charts of your data. Open one and your table is
already in it.

**A chart that cannot read your whole table is offered the part of it it can.**
A real export is forty-five columns of an experiment — an id, a date, a
category and forty numbers — and no chart in the library reads a table that
shape, because none reads forty-five columns. Asking every chart about the
whole thing used to return an empty gallery, which is not an answer. Each tile
now names the columns it takes, in your words, and opens on exactly those. The
maps are the honest exception: any three columns satisfy their arithmetic and
would draw a blank world, so they say no rather than pretend.

A spreadsheet written for people rarely starts at its header — there is a title
in A1, often a row of merged section banners under it. Those are skipped, and
the reader is told how many rows went.

Nothing is uploaded. The file is read in the browser, and the table travels to
the studio in session storage rather than over a network.

## Sharing a chart

Once you have a chart the way you want it, **Share** copies a link that
reproduces it exactly — data, colours and options included. The whole spec is
compressed into the URL, so there is no server, no account and nothing stored:
the link *is* the document.

**Embed** copies the same thing as an `<iframe>`, pointing at the chart with
the studio stripped away — no rail, no controls, no code panel, just the chart
and its title. It is the same page and the same renderer, one URL flag apart.

## Installing it

Published to GitHub Packages as
[`@hamza928505/opencharts`](https://github.com/Hamza928505/OpenCharts/packages).

GitHub's npm registry authenticates every read, **including public packages**,
so installing needs a one-off `.npmrc` and a personal access token with the
`read:packages` scope:

```
@hamza928505:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

```bash
npm install @hamza928505/opencharts
```

That gives you the whole site — `index.html`, `studio.html`, `css/`, `js/`,
`lib/` and `data/` — which is the same thing the repository holds, because
there is no build step. Serve the folder over HTTP and the gallery runs.

If you would rather not deal with a token, the
[Releases](https://github.com/Hamza928505/OpenCharts/releases) page carries the
identical contents as a zip, and cloning the repository works too.

Publishing happens on a tag, from the same workflow that cuts the Release, and
only after the test suite passes:

```bash
npm version 2.2.0        # writes package.json and tags it
git push --follow-tags
```

The workflow refuses to publish if the tag and `package.json` disagree, so a
`v2.2.0` tag on a `2.1.0` package fails loudly rather than shipping the wrong
version under the right name.

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

Each chart emits seven views:

- **HTML** — the markup fragment (`<canvas>` / `<div>` plus the legend slot)
- **CSS** — only the rules that chart actually uses
- **JS** — the chart code, with the data and options inlined as literals
- **Standalone** — a complete `<!DOCTYPE html>` page with all three inlined and
  the CDN script tags already in place. Download it and it runs.
- **AI Prompt** — the same chart written as a brief you can hand to an
  assistant along with your own spreadsheet.
- **Spec** — the chart as data: `{ chart, spec }` as JSON you can diff, check
  into a repo, or paste back. It carries its own chart id, so pasting one into
  the wrong studio opens the chart it belongs to.
- **Colours** — not code at all: the whole palette at once, a swatch and a name
  per series, with a warning if two of them merge for a colour-blind reader.

Undo and redo sit in that same bar and cover the whole chart — every colour,
slider, toggle, note and split, not just the data table.

## Handing it to an AI

Every chart comes with a prompt, reachable three ways:

| Where | |
|---|---|
| **Gallery tile** | A **Prompt** button in the corner of every preview — copies without opening the chart |
| **Chart page** | A **Prompt** button in the bar above the chart, beside Embed and Share |
| **Code panel** | The **AI Prompt** tab, which shows the text and lets you switch between the two forms |

Copy any of them, attach your own spreadsheet or CSV to ChatGPT, Claude or
anything else, and what comes back is that chart drawing your numbers. All
three copy the same text and honour the same Full / Data only choice.

If you have a table loaded in **Match my data**, a tile's prompt carries it —
the same table the tile would hand to the studio.

It works because the prompt carries the three things such a request usually
lacks:

- **the format** — the columns this chart reads, what each one holds, and a
  worked example, taken from the same schema the data editor validates against
- **the current table** — what the code below it is drawing right now, so the
  substitution is demonstrated rather than described
- **the code** — the whole Standalone export, already working, with the
  instruction to change nothing but the data

It asks for two things back: the reshaped CSV, which you can paste straight
into the data editor to keep working on it here, and the finished page.

### When it is the wrong chart

A brief that knows only one chart is a dead end the moment your data does not
suit it, so every prompt carries a way out. It tells the assistant not to force
your data in, and gives it two things to offer instead:

- **The charts that read exactly the same table.** Derived from the schema, so
  every one it names really does take your CSV unchanged — switching costs you
  nothing.
- **The library itself.** Paste your table into the gallery and it narrows to
  every chart that can read it, so you can pick from what actually fits.

It also says where the source is, that the data in the template is literal with
nothing fetched or generated at runtime, and — per renderer — what the code
calls the thing to edit, since the Chart.js charts carry a `config` and the
hand-drawn ones carry a `spec`.

### Full or data only

The prompt tab has a **Full / Data only** switch, and the tiles follow whatever
you last picked.

| | Size | What comes back |
|---|---|---|
| **Full** | ~12,000 chars | A page that runs — the working code travels with it |
| **Data only** | ~2,800 chars | Just your table, reshaped, ready to paste into the editor |

**Data only** is for when the chart is not the problem — you have the data and
you want it in the right shape. It drops the code and keeps the format, which
is roughly a quarter of the size.

It is not the default, because without the code the assistant writes the chart
from its own memory of Chart.js or D3. That renders *a* chart; it does not
render this one, and the options, palette and helpers all drift. And the code
is not bulk to be trimmed — a flow map is 13.5KB of JavaScript carrying 0.8KB
of data, and the rest is the projection and geo helpers nothing reconstructs
from memory.

The prompt follows whatever is on screen. Edit the colours, swap the data,
change the axis — copy it afterwards and the brief describes that chart, not
the library default.

## Not sure how to read a chart?

Every chart in the studio has a **How to read this chart** panel above it: what
the marks actually encode, and — more usefully — the specific way that chart
type misleads people. A stacked bar warns you that its middle segments float on
shifting baselines. A pie warns you that angles past five slices are guesswork.
A treemap warns you that long thin rectangles are hard to compare with square
ones.

The same panel lays out the loop for changing anything: your data, the
controls, then take the code — or hand the whole job to an AI.

## Using your own data

Every chart takes real data, and the first control in the studio shows the data
it is currently drawing. Click it, or **Edit data**, and a spreadsheet opens:
click a cell and type, <kbd>Tab</kbd> across, <kbd>Enter</kbd> down, **+ Row**
to grow it. The button beside it says what a column means on this chart —
**+ Stage** on a Sankey, **+ Level** on a treemap, **+ Dimension** on parallel
sets — and is simply absent where the chart reads a fixed set of columns. A cell that is not a number is flagged the moment
you type it, rather than quietly becoming a zero after you apply.

You never have to type a table you already have. Paste a block from Excel or
Sheets into any cell and it fills from there, or use the **Paste text** tab for
a whole CSV or TSV at once — the delimiter is detected, a header row is
detected, and formatted numbers (`1,234`, `$99`, `42%`) are read correctly.
That tab previews exactly what the parser read, with any unreadable cell
highlighted, which is the fastest way to see why a paste did not do what you
expected.

The columns each chart wants are described under the table, and **Load example**
fills it with correctly-shaped rows to edit. Structured charts take the same
treatment: flows want `from,to,value`, networks want `source,target`, and
hierarchies want a `Parent > Child > Leaf` path per row.

Every chart opens on real data you can read and replace — including the
distributions, the finance charts and the maps, which used to draw a simulation
from a "Sample seed" slider and had no way to accept anyone's actual numbers.
The datasets are deliberately small enough to edit: a histogram of 140 ages
rather than 2,400 simulated ones.

## Reshaping a table before you chart it

The file most people have is five hundred transactions; the chart they want is
revenue by region, seven bars. The **Shape** tab in the data editor closes that
gap with five operations — filter, group, bin, sort, limit — in a pipeline
where each step reads the table the one before it made.

They are an **edit, not a layer**. They run once, and what comes out is written
into the grid as literal values, exactly as a paste would be. Nothing is
re-derived at draw time, so an exported chart carries numbers rather than a
transform engine — and you see what the aggregation produced before you accept
it, which is the honest way round.

Order is the answer: `sort → limit` keeps the three biggest rows, `limit →
sort` keeps three arbitrary ones and puts them in order. And an `id` column is
never totalled by default, because summing it produces a number that means
nothing.

## Small multiples

Any chart can be split into a grid of panels — one per series, or one per
distinct value of a column. `Region, Month, Sales` becomes one chart per
region, side by side.

It is a general operation rather than three chart types that happen to be
small: the split produces one complete spec per panel and hands each to the
same renderer the chart already had, so all 114 charts can do it and none of
them had to be told how.

Where a chart can put every panel on **one axis**, it does, and says so. Where
it cannot — most charts work their scale out from their own data, privately —
it says that too, in words, under the control. A grid of panels that looks
comparable and is not would be worse than one that admits it.

## Notes on the chart

A label on the peak, a rule at the target, a shaded band over the quarter that
went wrong — the thing that turns a chart into an explanation. Drag one onto
the plate and it travels with the exported code.

They are positioned as a fraction of the chart's box rather than in data
coordinates, which is what makes them work identically on all five renderers.
The trade is honest and worth knowing: move the data and the note stays where
it was, which is why you place it by dragging rather than typing two numbers.

## Colours that work for everyone

Roughly one man in twelve has some form of red-green colour deficiency, and the
two colours a chart leans on to separate its series are exactly the two that
tend to merge. Every palette is checked, and you are told **which two series
just became one** — with a preview of the chart as that reader sees it.

The check is advisory, never a gate: matching a brand is your business. But the
default palette had to pass it too. It did not — seven of its pairs merged, and
the first bit at four series — so it was corrected. Every pair now clears the
threshold under all three deficiencies, and no chart in the library warns on the
data it ships with.

Colours are editable wherever you are looking at them: beside each series in
the sidebar, as a **Colour row** in the data table, or as the whole palette at
once in the Colours tab.

## Readable without seeing it

Every exported chart carries a text description and its data as a real `<table>`
— because a `<canvas>` is a rectangle of pixels with nothing inside it for a
screen reader, and these charts get pasted into other people's sites.

Both are derived from what the library already holds: the chart's own blurb,
the line that explains how it is read, and the writer that produces its data
table. A chart that gains a good data writer gains a good description for free.
It costs about 2.3KB.

## Cities without leaving the chart

On the city map, the symbol map and the flow map, the country you focus on
brings its own city list with it — search it in the sidebar, tick the places
you want, and they appear on the map with their real coordinates. A city
already on the map keeps its value; a new one starts at 1 for you to fill in.
**Add every city** takes the lot, and says how many that is first when the
answer runs to thousands.

## Maps of one country

Every map takes **as many countries as you want**, from a searchable list of
all 177 on the map — type a few letters, pick, repeat. Each one becomes a chip
you can remove. The map zooms to fit all of them together, fades the
neighbours, and the globe turns to face the middle of them.

It is a list rather than a text box on purpose: the atlas spells things its own
way (`Bosnia and Herz.`, `Dem. Rep. Congo`), so a reasonable guess used to
match nothing and leave the map silently on the world.

**City Map** is the chart for the common case where the statistic you have is
local rather than national: a circle at each city sized by its value. Its
editor has a **Pick cities** tab, and it opens on whatever country the chart is
already focused on with **that country's cities already listed** — 145 of them
for Jordan, 7,250 for Germany. Tick as many as you want and add them in one go;
search to narrow the list first if it is a big one.

Coordinates are filled in for you, so the only thing you ever type is the
number you actually have. Cities already in your table start ticked, so the
list reads as the state of the chart rather than a blank form — and unticking
one removes it.

The maps that colour whole countries have the same list as a **Pick
countries** tab, which is also how you stop guessing at Natural Earth
spellings. Cities
outside the focused country can be hidden, and if that would empty the map it
shows them anyway rather than leaving you with a blank frame.

Those lists are committed to the repository, not fetched from anyone: 177
countries and 156,576 cities across 246 of them, split one file per country so
only the country you pick is ever downloaded. See `tools/README.md` for where
they come from and how to rebuild them.

## Opening a file

**Upload a file** sits directly under **Edit data** in the sidebar, and the
data editor has an **Open a file** tab with the same thing plus drag-and-drop.
Either takes an `.xlsx`, `.csv`, `.tsv` or `.txt`. The first sheet of a
workbook is read using each cell's stored value — formulas are never run.

Under the buttons, the sidebar states the columns *this* chart reads —
`city, lon, lat, value` for a city map, `from, to, value` for a Sankey — so
you know the shape before you go looking for a file rather than after.

A file that is not a table at all is turned away by name. A .sql, a .py or a
JSON dump saved as .txt is still text, so no magic number can catch it — the
content is read instead, and the message says what it looks like: SQL, PHP,
Python, YAML, a Dockerfile, a diff, a log, prose. Thirty-odd of them are in
the test suite, alongside twenty-two awkward-but-real tables that must keep
working — a glossary of SQL keywords and a report of SQL queries among them,
because a check that rejects a valid CSV is worse than no check at all. (Nothing in
such a file is ever run, sent anywhere, or inserted as markup; the point is
simply not to draw a chart out of something that was never data.)

A file that is a table but does not match this chart is not quietly drawn wrong. It says what the chart
reads, what your file has, and offers to open the editor with your data already
in the grid, where a column can be renamed or dropped. Words in a value column
are caught the same way, because they would otherwise be drawn as zero.

**Nothing is uploaded.** The file is read in your browser and no request is
made while reading it. The format is decided by the file's actual bytes rather
than its name, so a ZIP renamed `sales.csv` is refused rather than guessed at;
so are old `.xls` files, anything binary, anything over 10MB, and any workbook
carrying a `DOCTYPE`. Archive size and entry count are capped, so a malicious
spreadsheet cannot expand until the tab dies.

## Reading a chart by hovering it

Every chart says what it is showing when you point at it — all 114, not just the
39 that Chart.js gives tooltips to for free. A canvas chart reports the shapes
it painted so they can be hit-tested; an SVG chart tags its marks. Radial charts
test the actual wedge rather than a bounding box, so pointing at a slice gives
you that slice.

The readouts say the thing the picture leaves out: a funnel names the drop-off
between stages, a dumbbell names the gap, a bullet chart says how far short of
target it is, and a distribution gives the five-number summary its silhouette
only implies.

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
| Canvas 2D | 48 | Hand-drawn, no charting library at all |
| D3 | 21 | SVG output, including all the maps and the globe |
| OpenCharts | 5 | The dependency-free engine in `js/core` + `js/charts` |
| DOM / CSS | 1 | The waffle chart is just styled divs |

Charts are grouped into 15 categories: Line & Area, Bar, Deviation, Part to
Whole, Radar, Scatter, Distribution, Hierarchy, Network, Flow, Comparison,
Finance, Geo, KPI & Micro, and Custom Engine.

## Tests

```bash
npm install          # once — pulls Playwright
npx playwright install chromium
npm test             # renders all 114 charts and checks them
```

The suite runs in a real headless browser, because two thirds of the library
draws to a canvas or measures real layout — jsdom would report a green run
while rendering nothing. For each chart it checks that it renders, that the
canvas is not blank, that the data editor accepts its own example, that the
chart survives that data, and that the generated code parses and declares its
dependencies. It also loads exported standalone files and confirms they
actually run, and checks that every chart's AI prompt carries that chart's own
format, code and current data.

Beyond that it drives the things a person does: pasting a wide export and
seeing which charts can read it, reshaping a table, splitting one into panels,
annotating a chart, undoing an edit, hovering a two-pixel mark, reading a
spreadsheet, and refusing six hostile ones. **655 checks**, and it fails if
anything writes to the console.

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

