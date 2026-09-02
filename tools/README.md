# tools/

One-off scripts that generate committed files. Nothing here runs at page load
and the site never imports it — the output is committed so the no-build-step
promise holds.

The one exception is `build-wiki.mjs`, whose output lives in the separate
`OpenCharts.wiki` repository. Pass it a clone:

```bash
git clone https://github.com/Hamza928505/OpenCharts.wiki.git
node tools/build-wiki.mjs OpenCharts.wiki
```

| Script | Writes | Rerun when |
|---|---|---|
| `place-names.mjs` | nothing (the spelling rules the others import) | — |
| `build-cities.mjs` | `data/cities/*.json` | you want a newer gazetteer |
| `build-countries.mjs` | `data/countries.json` | after the above |
| `clean-place-names.mjs` | `data/countries.json`, `data/cities/*.json` | you changed a rule in `place-names.mjs` and do not want a full rebuild |
| `build-country-meta.mjs` | `data/country-meta.json` | `countries-source.json` changes |
| `build-flags.mjs` | `data/flags.json` | a country changes its flag, or a new one appears in either country list |
| `bake-data.mjs` | nothing (a library + a printer) | — |
| `write-sample-data.mjs` | `js/studio/charts/_data.js` | you want to change the data charts open with |
| `build-favicon.mjs` | `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | the brand mark in `css/studio.css` changes |
| `build-wiki.mjs` | the GitHub wiki's four reference pages, in a clone you pass it | any chart is added, renamed, re-blurbed or re-shaped |

## The data charts open with

`js/studio/charts/_data.js` holds the literal arrays every chart starts from.
Twenty-four charts used to draw a simulation from a seed and a row of parameter
sliders instead, which made them the only charts nobody could use — the numbers
were never anyone's numbers.

```bash
node tools/bake-data.mjs              # print every dataset
node tools/bake-data.mjs boxGroups    # print one
node tools/write-sample-data.mjs      # write js/studio/charts/_data.js
```

Two rules shaped the datasets, and both matter more than they look:

- **Each chart keeps its own story.** The violin was session lengths in minutes
  and the box plot regional dollars. One generic sample across all of them
  would have left every axis label and blurb quietly lying.
- **Small enough to edit.** A histogram fed 2,400 simulated observations looks
  impressive and is impossible to change. 140 rows say the same thing and fit
  in the grid the reader is about to open.

Renko, Kagi and Point & Figure take `REVERSAL_BARS` rather than `OHLC_BARS`:
they only lay a mark where price *reverses*, so they need a longer, choppier
series. A walk that drifts to one end leaves them with a single column.

## The place lists

| File | Shape | Used by |
|---|---|---|
| `data/countries.json` | `[[mapName, iso2, cityCount], …]` — 177 rows | the **Country** dropdown on every map |
| `data/cities/<ISO2>.json` | `[[name, lat, lon], …]`, 3dp coords | the **Pick cities** tab, fetched per country |
| `data/cities/_index.json` | `{ ISO2: cityCount }` | the build, to pair countries with their lists |

`mapName` is Natural Earth's own spelling, because that is what the map
features are keyed by — `"Bosnia and Herz."`, `"Dem. Rep. Congo"`. The studio
never asks anyone to type those; `findCountryEntry()` in
`js/studio/geodata.js` accepts the short names people actually use.

Cities are split one file per country deliberately. All of them together are
4.4MB; the country somebody actually picks is between 4KB and 363KB, and
nothing is fetched until they pick one.

## Rebuilding

Both scripts read from `.cache/`, which is gitignored. Fetch the two sources
first:

```bash
mkdir -p .cache

# 1. The gazetteer — GeoNames-derived, ~170k cities, MIT.
curl -L https://cdn.jsdelivr.net/npm/cities.json@1.1.61/cities.json \
  -o .cache/cities-raw.json

# 2. The map's country names, so the two sources can be paired.
node -e "
  const { execSync } = require('node:child_process');
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
    .then((r) => r.json())
    .then((topo) => {
      const names = topo.objects.countries.geometries
        .map((g) => g.properties.name)
        .filter(Boolean)
        .sort();
      require('node:fs').writeFileSync('.cache/topo-names.json', JSON.stringify(names));
      console.log(names.length + ' country names');
    });
"
```

Then, in order — `build-countries.mjs` reads the index the first script writes:

```bash
node tools/build-cities.mjs      # → data/cities/*.json
node tools/build-countries.mjs   # → data/countries.json
```

Run both from the project root. Each prints what it wrote, including the
countries it could not pair — those simply have no city picker, which the
studio handles by falling back to the table.

After rebuilding, run `npm test`: suite 9 checks the country and city lists
directly (ISO codes, coordinates, alphabetical order), so a bad regeneration
fails there rather than in someone's browser.

## Flags and country metadata

Two files behind the flag icons and the local-language names in the pickers.
They are a *presentation* layer and deliberately not part of the atlas:
`data/countries.json` decides what a map can draw, these decide how it is
labelled. Neither list is a superset of the other, which is why they are
merged by ISO2 at load rather than combined into one file — see the header of
`build-country-meta.mjs`.

```bash
node tools/build-country-meta.mjs      # data/country-meta.json  (35KB)
node tools/build-flags.mjs             # data/flags.json        (110KB, needs network)
```

Run them in that order: the flag set covers the union of both country lists,
so it reads `country-meta.json` to know what to fetch.

**The source has no coordinates**, which is the one thing to remember about
it. Every point on a map is still placed from `data/cities/<ISO2>.json`; the
966 curated cities only contribute their local-language spelling, matched to
a gazetteer entry by name.

Of those 966, 376 carry a spelling that differs from the English one and 324
of those also match a gazetteer entry, so that is how many cities can show a
local name. The rest either spell the same in both (`Paris`) or are the
gazetteer's alternate spelling of a city the curated list names differently —
Cologne/Köln, Ghent/Gent, Quebec City/Québec. Those simply do not get a local
name rather than being guessed at, the same rule that stops a chart inventing
its own data.

Three decisions in `build-flags.mjs` worth not re-litigating, each recorded in
full in its header:

- **PNG, not SVG.** The optimised SVGs run from 191 bytes for France to 249KB
  for El Salvador — all 194 come to several megabytes. The same set at 80px
  PNG is 110KB.
- **Vendored, not hotlinked.** An exported chart is a file people open from
  disk; a flag that is a remote URL is a broken image the moment it is
  offline.
- **Not emoji.** Windows ships no flag glyphs, so every flag would render as
  its two letters for a large share of readers.

## Transliterated city names

The gazetteer spells Jordan's حاتم as `Ḩātim` — scientific transliteration,
neither English nor the local language, and untypeable. `foldRomanisation()`
in `place-names.mjs` reduces those to the plain spelling, and
`clean-place-names.mjs` applies it:

```bash
node tools/clean-place-names.mjs           # report
node tools/clean-place-names.mjs --write   # apply
```

That pass changed 9,072 names across 52 countries and deleted none of them.

**It is keyed by country, not by character**, and that is the whole design.
`ā` is a romanisation in `Ḩātim` and a native letter in Latvian `Alūksne`; `ş`
is native Turkish in `Akkuş`; `‘` is the Hawaiian ʻokina in `‘Ewa Beach`. Only
countries in `NON_LATIN_SCRIPT` — those whose own writing system is not Latin,
where every Latin name is therefore a romanisation — are folded. If you add a
country to that set, check it is not one whose diacritics are its own.
