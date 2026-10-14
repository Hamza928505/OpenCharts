# Third-party notices

OpenCharts itself is MIT licensed — see [LICENSE](LICENSE).

This file lists the third-party software OpenCharts bundles in `lib/`, loads
from a CDN, or generates code against, together with the notices those
licences require to be preserved. Every one of them is permissive (MIT, ISC,
BSD-3-Clause or Apache-2.0); none imposes copyleft obligations on OpenCharts or
on anything you build with it. The committed data is listed further down; the
city list is CC BY 4.0, which asks for credit but is not copyleft either.

Versions are pinned in [`js/studio/cdn.js`](js/studio/cdn.js), which is the
single source of truth for the studio's Sources panel, the exported code and
the gallery credits.

---

## Bundled in `lib/` and/or loaded from a CDN

| Library | Version | Licence | Copyright |
|---|---|---|---|
| [Chart.js](https://www.chartjs.org/) | 4.4.1 | MIT | (c) 2023 Chart.js Contributors |
| [D3](https://d3js.org/) | 7.8.5 | ISC | Copyright 2010–2023 Mike Bostock |
| [chartjs-chart-sankey](https://github.com/kurkle/chartjs-chart-sankey) | 0.12.0 | MIT | (c) 2022 Jukka Kurkela |
| [chartjs-chart-matrix](https://github.com/kurkle/chartjs-chart-matrix) | 2.0.1 | MIT | (c) Jukka Kurkela |
| [chartjs-chart-treemap](https://github.com/kurkle/chartjs-chart-treemap) | 2.3.0 | MIT | (c) Jukka Kurkela |
| [@sgratzl/chartjs-chart-boxplot](https://github.com/sgratzl/chartjs-chart-boxplot) | 4.2.4 | MIT | (c) Samuel Gratzl |
| [topojson-client](https://github.com/topojson/topojson-client) | 3.1.0 | ISC | Copyright 2012–2019 Michael Bostock |
| [world-atlas](https://github.com/topojson/world-atlas) | 2.0.2 | ISC | Copyright 2013–2019 Michael Bostock |
| [Arquero](https://uwdata.github.io/arquero/) | 5.4.1 | BSD-3-Clause | University of Washington Interactive Data Lab |
| [Apache ECharts](https://echarts.apache.org/) | 5.5.0 | Apache-2.0 | Copyright 2017–2024 The Apache Software Foundation |

All runtime chart scripts are bundled in `lib/` and served from the site's own
origin. Standalone exports still reference the pinned CDN URLs. Original
license texts for the newly bundled libraries and world-atlas, including
ECharts' NOTICE and D3 subcomponent license, are preserved in
[`lib/licenses/`](lib/licenses/). Refresh these copies with
`node tools/vendor-libraries.mjs`.

`world-atlas` is boundary *data* rather than a script. Its `countries-110m.json`
is committed as `data/countries-110m.json` and served from the site's own
origin, so opening a map contacts no third party; an exported map fetches the
same file from jsDelivr. The underlying geometry derives from
[Natural Earth](https://www.naturalearthdata.com/), which is released into the
public domain.

## Committed data

| Data | Source | Licence |
|---|---|---|
| `data/cities/*.json` | [cities.json](https://github.com/lutangar/cities.json) 1.1.61 by lutangar, derived from [GeoNames](https://www.geonames.org/); **modified** (see below) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `data/countries.json` | the above, paired with Natural Earth country names via `world-atlas` | as above |
| `data/countries-110m.json` | [world-atlas](https://github.com/topojson/world-atlas) 2.0.2, unmodified; geometry from Natural Earth | ISC (geometry: public domain) |
| `data/flags.json` | [Flagpedia / flagcdn](https://flagcdn.com/), 80px PNG, vendored by `tools/build-flags.mjs` | Public domain, [per provider terms](https://flagpedia.net/terms) |
| `data/country-meta.json` | built from `tools/countries-source.json` (see below) — ISO3, region, local-language names | Not a third-party dataset (names, codes and regions are facts) |

The provider states that its flag images are in the public domain and carry no attribution requirement.
They are credited here, in the gallery footer and in `js/studio/cdn.js` anyway,
because a reader should be able to find out where a picture in the interface
came from without reading the build scripts.

These files are committed, so that picking a country or a city, or drawing a
map, needs no network call to a third party and no build step.
`tools/README.md` documents how to regenerate them.

### City data — attribution

City names and coordinates © [GeoNames](https://www.geonames.org/), via
[cities.json](https://github.com/lutangar/cities.json) by lutangar, licensed
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). They are
credited here, in `tools/README.md` and in the site's footer.

OpenCharts' copy is **modified**: 156,576 cities across 246 countries, split
into one file per country; coordinates reduced to three decimal places; names
in scientific transliteration simplified to plain spellings and some names
respelled by the rules in `tools/place-names.mjs`; and rows identical in name
and both coordinates merged. GeoNames and lutangar do not endorse these changes
or this project.

### Country metadata — provenance

`tools/countries-source.json` was compiled for this project and added in commit
`bc22a91` (September 2026); its history names no third-party dataset as a
source. It holds country names in English and local languages, ISO 3166 codes,
regions and well-known city names, which are facts rather than creative work.
Its flag references point at the Flagpedia images above.

## Fonts

The app uses system font fallbacks and does not request a third-party font
service. Some chart definitions still name optional font families; the browser
uses a local fallback when those fonts are not installed.

---

## Licence texts

### MIT License

Applies to Chart.js, chartjs-chart-sankey, chartjs-chart-matrix,
chartjs-chart-treemap and @sgratzl/chartjs-chart-boxplot, each under its own
copyright as listed above.

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### ISC License

Applies to D3, topojson-client and world-atlas, each under its own copyright as
listed above.

```
Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

---

If you believe an attribution here is missing or wrong, please open an issue —
it will be corrected.
