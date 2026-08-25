/**
 * chartjs-base.js — shared Chart.js option builders.
 *
 * IMPORTANT: whatever these return is serialised verbatim into the exported
 * code, so every value here must be a literal. Colours are deliberately
 * neutral greys (rgba(128,128,128,…)) rather than theme variables: a grey at
 * that alpha reads correctly on both the light and the dark page, and it keeps
 * the copied snippet working anywhere without carrying our CSS with it.
 */

export const TICK_COLOR = '#8a8880';
export const GRID_COLOR = 'rgba(128,128,128,.14)';

export const TICK = { font: { size: 11 }, color: TICK_COLOR };

/** X axis: labels, no vertical grid — the usual reading direction. */
export const xAxis = (extra = {}) => ({
  ticks: { ...TICK },
  grid: { display: false },
  border: { color: GRID_COLOR },
  ...extra,
});

/** Y axis: value scale with horizontal guides. */
export const yAxis = (extra = {}) => ({
  ticks: { ...TICK },
  grid: { color: GRID_COLOR },
  border: { display: false },
  ...extra,
});

/** Radial axis for radar and polar charts. */
export const rAxis = (extra = {}) => ({
  min: 0,
  ticks: { stepSize: 20, font: { size: 10 }, color: TICK_COLOR, backdropColor: 'transparent' },
  pointLabels: { font: { size: 12 }, color: TICK_COLOR },
  grid: { color: GRID_COLOR },
  angleLines: { color: GRID_COLOR },
  ...extra,
});

/**
 * Base options every chart in the library starts from.
 *
 * Chart.js's own legend is switched off throughout: the library renders a DOM
 * legend outside the canvas instead, so it can be styled with CSS and stay
 * crisp at any pixel ratio.
 */
export function baseOpts(extra = {}) {
  const { plugins = {}, scales, ...rest } = extra;
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    animation: { duration: 620, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(23,22,20,.92)',
        titleColor: '#f5f4ef',
        bodyColor: '#d8d6cf',
        borderColor: 'rgba(255,255,255,.1)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        boxPadding: 4,
        displayColors: true,
        ...plugins.tooltip,
      },
      ...Object.fromEntries(Object.entries(plugins).filter(([k]) => k !== 'tooltip' && k !== 'legend')),
    },
    ...(scales ? { scales } : {}),
    ...rest,
  };
}

/** Legend descriptor built from a spec's series list. */
export const seriesLegend = (spec, line = false) =>
  (spec.series || []).map((s, i) => ({ label: s.label, color: s.color, line, datasetIndex: i }));

/** Legend descriptor for a single dataset painted with many colours. */
export const sliceLegend = (spec) =>
  (spec.labels || []).map((label, i) => ({
    label,
    color: (spec.colors || [])[i],
    toggleable: false,
  }));
