# tools/

One-off scripts that generate committed files. Nothing here runs at page load
and the site never imports it — the output is committed so the no-build-step
promise holds.

| Script | Writes | Rerun when |
|---|---|---|
| `place-names.mjs` | nothing (the spelling rules the others import) | — |
| `build-cities.mjs` | `data/cities/*.json` | you want a newer gazetteer |
| `build-countries.mjs` | `data/countries.json` | after the above |
| `clean-place-names.mjs` | `data/countries.json`, `data/cities/*.json` | you changed a rule in `place-names.mjs` and do not want a full rebuild |
| `bake-data.mjs` | nothing (a library + a printer) | — |
| `write-sample-data.mjs` | `js/studio/charts/_data.js` | you want to change the data charts open with |
| `build-favicon.mjs` | `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | the brand mark in `css/studio.css` changes |

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
