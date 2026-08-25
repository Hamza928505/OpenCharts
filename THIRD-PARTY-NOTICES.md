# Third-party notices

OpenCharts itself is MIT licensed — see [LICENSE](LICENSE).

This file lists the third-party software OpenCharts bundles in `lib/`, loads
from a CDN, or generates code against, together with the notices those
licences require to be preserved. Every one of them is permissive (MIT, ISC or
OFL); none imposes copyleft obligations on OpenCharts or on anything you build
with it.

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
| [world-atlas](https://github.com/topojson/world-atlas) | 2.0.2 | ISC | Copyright 2013–2020 Michael Bostock |

`world-atlas` is boundary *data* rather than a script. It is fetched at runtime
by the charts in the Geo category and is not committed to this repository. The
underlying geometry derives from [Natural Earth](https://www.naturalearthdata.com/),
which is released into the public domain.

## Used only by the legacy numbered pages

These remain in `lib/` for the older standalone chart pages. The current
gallery and studio do not load them.

| Library | Licence | Copyright |
|---|---|---|
| [Bootstrap](https://getbootstrap.com/) | MIT | Copyright 2011–2024 The Bootstrap Authors |
| [Bootstrap Icons](https://icons.getbootstrap.com/) | MIT | Copyright 2019–2024 The Bootstrap Authors |
| [SweetAlert2](https://sweetalert2.github.io/) | MIT | Copyright (c) 2014 Tristan Edwards & Limon Monte |

## Fonts

DM Sans, DM Mono and Instrument Serif are loaded from Google Fonts at runtime
and are **not** redistributed in this repository. They are licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org/).

---

## Licence texts

### MIT License

Applies to Chart.js, chartjs-chart-sankey, chartjs-chart-matrix,
chartjs-chart-treemap, @sgratzl/chartjs-chart-boxplot, Bootstrap, Bootstrap
Icons and SweetAlert2, each under its own copyright as listed above.

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
