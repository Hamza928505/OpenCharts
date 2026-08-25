/**
 * cdn.js — the single source of truth for every third-party library OpenCharts
 * uses, and which charts need which.
 *
 * Versions here are pinned to the exact builds vendored in `lib/`, so the code
 * a visitor copies loads the same library this site was tested against. If you
 * update a file in `lib/`, update the version and URL here in the same commit.
 *
 * Everything user-facing — the studio's Sources panel, the comment header in
 * the JS tab, the script tags in the Standalone export and the credits on the
 * gallery — is generated from this object.
 */

export const LIBRARIES = {
  chart: {
    key: 'chart',
    kind: 'script',
    name: 'Chart.js',
    version: '4.4.1',
    license: 'MIT',
    provider: 'jsDelivr',
    homepage: 'https://www.chartjs.org/',
    url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    local: 'lib/chart.umd.min.js',
    role: 'Canvas charting library',
  },

  d3: {
    key: 'd3',
    kind: 'script',
    name: 'D3',
    version: '7.8.5',
    license: 'ISC',
    provider: 'jsDelivr',
    homepage: 'https://d3js.org/',
    url: 'https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js',
    local: 'lib/d3.min.js',
    role: 'SVG data-visualisation toolkit',
  },

  sankey: {
    key: 'sankey',
    kind: 'script',
    name: 'chartjs-chart-sankey',
    version: '0.12.0',
    license: 'MIT',
    provider: 'unpkg',
    homepage: 'https://github.com/kurkle/chartjs-chart-sankey',
    url: 'https://unpkg.com/chartjs-chart-sankey@0.12.0/dist/chartjs-chart-sankey.min.js',
    local: 'lib/chartjs-chart-sankey.min.js',
    role: 'Sankey controller for Chart.js',
    requires: 'chart',
  },

  matrix: {
    key: 'matrix',
    kind: 'script',
    name: 'chartjs-chart-matrix',
    version: '2.0.1',
    license: 'MIT',
    provider: 'unpkg',
    homepage: 'https://github.com/kurkle/chartjs-chart-matrix',
    url: 'https://unpkg.com/chartjs-chart-matrix@2.0.1/dist/chartjs-chart-matrix.min.js',
    local: null,
    role: 'Matrix / heatmap controller for Chart.js',
    requires: 'chart',
  },

  treemap: {
    key: 'treemap',
    kind: 'script',
    name: 'chartjs-chart-treemap',
    version: '2.3.0',
    license: 'MIT',
    provider: 'unpkg',
    homepage: 'https://github.com/kurkle/chartjs-chart-treemap',
    url: 'https://unpkg.com/chartjs-chart-treemap@2.3.0/dist/chartjs-chart-treemap.min.js',
    local: null,
    role: 'Treemap controller for Chart.js',
    requires: 'chart',
  },

  topojson: {
    key: 'topojson',
    name: 'topojson-client',
    version: '3.1.0',
    license: 'ISC',
    provider: 'jsDelivr',
    homepage: 'https://github.com/topojson/topojson-client',
    url: 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js',
    local: null,
    kind: 'script',
    role: 'Converts TopoJSON boundaries to GeoJSON for D3',
  },

  worldAtlas: {
    key: 'worldAtlas',
    name: 'world-atlas (countries-110m)',
    version: '2.0.2',
    license: 'ISC',
    provider: 'jsDelivr',
    homepage: 'https://github.com/topojson/world-atlas',
    // Fetched at runtime rather than vendored: ~110KB of boundary data does
    // not belong in a chart library's repository.
    url: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json',
    local: null,
    kind: 'data',
    role: 'Natural Earth country boundaries, fetched at runtime',
  },

  boxplot: {
    key: 'boxplot',
    kind: 'script',
    name: '@sgratzl/chartjs-chart-boxplot',
    version: '4.2.4',
    license: 'MIT',
    provider: 'unpkg',
    homepage: 'https://github.com/sgratzl/chartjs-chart-boxplot',
    url: 'https://unpkg.com/@sgratzl/chartjs-chart-boxplot@4.2.4/build/index.umd.min.js',
    local: null,
    role: 'Box plot & violin controller for Chart.js',
    requires: 'chart',
  },
};

/**
 * The OpenCharts engine is not a CDN dependency — it ships with the project —
 * but the Sources panel still needs something to show for those charts.
 */
export const ENGINE_SOURCE = {
  key: 'opencharts',
  name: 'OpenCharts engine',
  version: '2.0',
  license: 'MIT',
  provider: 'bundled',
  homepage: null,
  url: null,
  local: 'js/core/ + js/charts/',
  kind: 'bundled',
  role: 'Dependency-free canvas engine, part of this project',
};

/** Nothing to load at all. */
export const NO_SOURCE = {
  key: 'none',
  name: 'No library',
  version: null,
  license: null,
  provider: 'none',
  homepage: null,
  url: null,
  local: null,
  kind: 'none',
  role: 'Drawn with the browser’s own APIs — nothing to install',
};

/**
 * Which libraries a chart definition needs, in load order.
 * Chart.js plugins must come after Chart.js itself.
 *
 * @param {object} def chart definition
 * @returns {Array<object>} library records
 */
export function dependenciesFor(def) {
  const engine = def.chartjs ? 'chartjs'
    : def.d3 ? 'd3'
    : def.canvas ? 'canvas'
    : def.native ? 'native'
    : 'dom';

  if (engine === 'chartjs') {
    const out = [LIBRARIES.chart];
    (def.chartjs.plugins || []).forEach((key) => {
      if (LIBRARIES[key]) out.push(LIBRARIES[key]);
      else console.warn(`[cdn] "${def.id}" names unknown plugin "${key}"`);
    });
    return out;
  }
  if (engine === 'd3') {
    const out = [LIBRARIES.d3];
    // Geo charts declare extra libraries and data the same way Chart.js
    // charts declare plugins.
    (def.d3.libraries || []).forEach((key) => {
      if (LIBRARIES[key]) out.push(LIBRARIES[key]);
      else console.warn(`[cdn] "${def.id}" names unknown library "${key}"`);
    });
    return out;
  }
  if (engine === 'native') return [ENGINE_SOURCE];
  return [NO_SOURCE];
}

/** Everything fetched from a CDN, scripts and data alike. */
export const cdnOnly = (deps) => deps.filter((d) => !!d.url);

/**
 * Only the entries that belong in a <script> tag.
 *
 * A data file such as world-atlas is a genuine CDN dependency and must appear
 * in the Sources panel, but emitting it as a script tag would be nonsense —
 * the chart fetches it itself.
 */
export const scriptsOnly = (deps) => deps.filter((d) => d.url && d.kind !== 'data');

/** `<script src="…"></script>` for one library. */
export const scriptTag = (lib) => `<script src="${lib.url}"></script>`;

/** "Chart.js 4.4.1 (MIT, via jsDelivr)" */
export function describe(lib) {
  if (!lib.url) return lib.version ? `${lib.name} ${lib.version}` : lib.name;
  return `${lib.name} ${lib.version} (${lib.license}, via ${lib.provider})`;
}

/** Every library the project ships, for the gallery credits. */
export const ALL_LIBRARIES = Object.values(LIBRARIES);
