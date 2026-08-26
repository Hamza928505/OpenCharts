/**
 * Distribution chart definitions: histogram, box plot, violin, heatmap.
 *
 * Sampled data is generated from a *seeded* generator rather than
 * Math.random(). That matters here more than anywhere else: the exported code
 * has to reproduce the exact picture the user was looking at when they copied
 * it, and an unseeded sample would draw something different on every load.
 */

import { C, DAYS, withAlpha } from '../palette.js';
import { baseOpts, xAxis, yAxis, TICK } from '../chartjs-base.js';
import { tickFormat, srcFn } from '../serialize.js';

/* ── Helpers shared with the exported code ───────────────────────────────── */
/* Declared as plain functions so they serialise cleanly into the JS tab. */

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gaussSample(rnd, mu, sigma) {
  // Box–Muller: two uniforms in, one normal out.
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function kde(data, min, max, bandwidth, step) {
  const points = [];
  const norm = bandwidth * Math.sqrt(2 * Math.PI);
  for (let v = min; v <= max; v += step) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const z = (v - data[i]) / bandwidth;
      sum += Math.exp(-0.5 * z * z) / norm;
    }
    points.push({ v: v, d: sum / data.length });
  }
  return points;
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next !== undefined ? sorted[base] + rest * (next - sorted[base]) : sorted[base];
}

export const distributionCharts = [
  {
    id: 'histogram',
    title: 'Histogram',
    category: 'Distribution',
    blurb: 'Counts per bucket. Bin width is a real editorial choice — change it and see.',
    tags: ['histogram', 'distribution', 'bins', 'frequency', 'ages'],
    spec: {
      bins: 10,
      mean: 32,
      sd: 12,
      min: 18,
      max: 75,
      sample: 2400,
      seed: 11,
      color: C.purple,
      label: 'Customers',
      opts: { radius: 2, alpha: 0.8 },
    },
    controls: [
      { group: 'Bins',  type: 'slider', key: 'bins', label: 'Bin count', min: 4, max: 40, step: 1 },
      { group: 'Data',  type: 'slider', key: 'mean', label: 'Mean', min: 20, max: 65, step: 1 },
      { group: 'Data',  type: 'slider', key: 'sd',   label: 'Std deviation', min: 3, max: 25, step: 1 },
      { group: 'Data',  type: 'slider', key: 'sample', label: 'Sample size', min: 200, max: 6000, step: 100 },
      { group: 'Data',  type: 'slider', key: 'seed', label: 'Sample seed', min: 1, max: 60, step: 1 },
      { group: 'Style', type: 'colors', key: 'barColor', label: 'Bar colour' },
      { group: 'Style', type: 'slider', key: 'opts.radius', label: 'Corner radius', min: 0, max: 8, step: 1, format: (v) => v + 'px' },
      { group: 'Style', type: 'slider', key: 'opts.alpha', label: 'Fill opacity', min: 0.3, max: 1, step: 0.05, format: (v) => Math.round(v * 100) + '%' },
    ],
    onInit(spec) { spec.barColor = [spec.color]; },
    onChange(spec) { spec.color = spec.barColor[0]; },
    chartjs: {
      build(spec) {
        const rnd = makeRng(spec.seed * 7919);
        // Pasted observations replace the generated sample.
        const supplied = (spec.groups && spec.groups[0] && spec.groups[0].values) || null;
        const width = (spec.max - spec.min) / spec.bins;
        const bins = Array.from({ length: spec.bins }, (_, i) => ({
          label: `${Math.round(spec.min + i * width)}–${Math.round(spec.min + (i + 1) * width)}`,
          count: 0,
        }));
        const feed = supplied || Array.from({ length: spec.sample },
          () => Math.round(gaussSample(rnd, spec.mean, spec.sd)));
        feed.forEach((raw) => {
          const v = Math.round(raw);
          if (v < spec.min || v > spec.max) return;
          bins[Math.min(Math.floor((v - spec.min) / width), spec.bins - 1)].count++;
        });
        return {
          type: 'bar',
          data: {
            labels: bins.map((b) => b.label),
            datasets: [{
              label: spec.label,
              data: bins.map((b) => b.count),
              backgroundColor: withAlpha(spec.color, spec.opts.alpha),
              borderColor: spec.color,
              borderWidth: 1,
              borderRadius: spec.opts.radius,
              borderSkipped: false,
              // Histogram bars touch: the axis is continuous, not categorical.
              categoryPercentage: 1,
              barPercentage: 1,
            }],
          },
          options: baseOpts({
            scales: {
              x: xAxis({ ticks: { ...TICK, maxRotation: 45, autoSkip: spec.bins > 14 } }),
              y: yAxis({ ticks: { ...TICK, callback: tickFormat({ separator: true }) } }),
            },
            plugins: {
              tooltip: { callbacks: { title: (ctx) => 'Range ' + ctx[0].label } },
            },
          }),
        };
      },
    },
    legend: () => null,
  },

  {
    id: 'box-plot',
    title: 'Box Plot',
    category: 'Distribution',
    blurb: 'Median, quartiles, whiskers and outliers — five numbers that survive skew.',
    tags: ['box plot', 'quartiles', 'median', 'outliers', 'distribution'],
    spec: {
      groups: [
        { label: 'North',   color: C.purple, mean: 68, sd: 18 },
        { label: 'South',   color: C.teal,   mean: 55, sd: 14 },
        { label: 'East',    color: C.coral,  mean: 75, sd: 22 },
        { label: 'West',    color: C.blue,   mean: 62, sd: 16 },
        { label: 'Central', color: C.amber,  mean: 70, sd: 20 },
      ],
      sample: 80,
      seed: 5,
      opts: { alpha: 0.27, borderWidth: 1.5, outlierRadius: 3, prefix: '$' },
    },
    controls: [
      { group: 'Data',  type: 'series', key: 'groups', data: false, max: 7, min: 2 },
      { group: 'Data',  type: 'slider', key: 'sample', label: 'Points per group', min: 20, max: 300, step: 10 },
      { group: 'Data',  type: 'slider', key: 'seed',   label: 'Sample seed', min: 1, max: 60, step: 1 },
      { group: 'Style', type: 'slider', key: 'opts.alpha', label: 'Box fill', min: 0.05, max: 0.7, step: 0.02, format: (v) => Math.round(v * 100) + '%' },
      { group: 'Style', type: 'slider', key: 'opts.outlierRadius', label: 'Outlier size', min: 1, max: 7, step: 1, format: (v) => v + 'px' },
      { group: 'Axis',  type: 'text',   key: 'opts.prefix', label: 'Value prefix' },
    ],
    onChange(spec) {
      spec.groups.forEach((g, i) => {
        if (typeof g.mean !== 'number') { g.mean = 60 + i * 4; g.sd = 16; }
      });
    },
    chartjs: {
      plugins: ['boxplot'],
      build(spec) {
        return {
          type: 'boxplot',
          data: {
            labels: spec.groups.map((g) => g.label),
            datasets: spec.groups.map((g, gi) => {
              // Real observations win over the generated sample when supplied.
              const rnd = makeRng((spec.seed + gi) * 2654435761);
              const values = (g.values && g.values.length)
                ? g.values
                : Array.from({ length: spec.sample }, () =>
                  Math.max(5, Math.round(gaussSample(rnd, g.mean, g.sd))));
              return {
                label: g.label,
                // The boxplot controller takes one array of raw values per slot.
                data: [values],
                backgroundColor: withAlpha(g.color, spec.opts.alpha),
                borderColor: g.color,
                borderWidth: spec.opts.borderWidth,
                outlierBackgroundColor: g.color,
                outlierBorderColor: g.color,
                outlierRadius: spec.opts.outlierRadius,
                medianColor: g.color,
                itemRadius: 0,
              };
            }),
          },
          options: baseOpts({
            interaction: { intersect: false, mode: 'nearest' },
            scales: {
              x: xAxis(),
              y: yAxis({ ticks: { ...TICK, callback: tickFormat({ prefix: spec.opts.prefix }) } }),
            },
          }),
        };
      },
    },
    legend: (spec) => spec.groups.map((g, i) => ({ label: g.label, color: g.color, datasetIndex: i })),
  },

  {
    id: 'violin',
    title: 'Violin',
    category: 'Distribution',
    blurb: 'A mirrored kernel density estimate. Shows shape a box plot flattens — bimodality, skew.',
    tags: ['violin', 'kde', 'density', 'distribution', 'session length'],
    spec: {
      groups: [
        { label: 'Desktop', color: C.purple, mean: 8,   sd: 3   },
        { label: 'Mobile',  color: C.teal,   mean: 4.5, sd: 2   },
        { label: 'Tablet',  color: C.coral,  mean: 6.5, sd: 2.5 },
      ],
      sample: 300,
      seed: 3,
      opts: { min: 0, max: 18, bandwidth: 0.8, alpha: 0.22, showBox: true, suffix: 'm' },
    },
    controls: [
      { group: 'Data',  type: 'series', key: 'groups', data: false, max: 5, min: 1 },
      { group: 'Data',  type: 'slider', key: 'sample', label: 'Points per group', min: 50, max: 800, step: 50 },
      { group: 'Data',  type: 'slider', key: 'seed',   label: 'Sample seed', min: 1, max: 60, step: 1 },
      { group: 'Shape', type: 'slider', key: 'opts.bandwidth', label: 'Smoothing', min: 0.2, max: 2.5, step: 0.1, format: (v) => v.toFixed(1) },
      { group: 'Shape', type: 'slider', key: 'opts.alpha', label: 'Fill opacity', min: 0.05, max: 0.6, step: 0.02, format: (v) => Math.round(v * 100) + '%' },
      { group: 'Shape', type: 'toggle', key: 'opts.showBox', label: 'Show quartile box' },
      { group: 'Axis',  type: 'slider', key: 'opts.max', label: 'Axis maximum', min: 5, max: 60, step: 1 },
      { group: 'Axis',  type: 'text',   key: 'opts.suffix', label: 'Value suffix' },
    ],
    onChange(spec) {
      spec.groups.forEach((g, i) => {
        if (typeof g.mean !== 'number') { g.mean = 5 + i * 2; g.sd = 2; }
      });
    },
    canvas: {
      height: 360,
      helpers: [makeRng, gaussSample, kde, quantile],
      draw(ctx, spec, W, H) {
        const o = spec.opts;
        const pad = { t: 18, r: 24, b: 34, l: 46 };
        const colW = (W - pad.l - pad.r) / Math.max(1, spec.groups.length);
        const toY = (v) => H - pad.b - ((v - o.min) / (o.max - o.min)) * (H - pad.t - pad.b);

        // Value grid first so the shapes sit on top of it.
        ctx.font = '10px "DM Sans", system-ui, sans-serif';
        const stepV = (o.max - o.min) / 6;
        for (let v = o.min; v <= o.max + 0.001; v += stepV) {
          const y = toY(v);
          ctx.strokeStyle = 'rgba(128,128,128,.13)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pad.l, y);
          ctx.lineTo(W - pad.r, y);
          ctx.stroke();
          ctx.fillStyle = 'rgba(128,128,128,.75)';
          ctx.textAlign = 'right';
          ctx.fillText(Math.round(v) + o.suffix, pad.l - 6, y + 4);
        }

        spec.groups.forEach((g, gi) => {
          // Real observations win over the generated sample when supplied.
          let data = g.values;
          if (!data || !data.length) {
            const rnd = makeRng((spec.seed + gi) * 2654435761);
            data = [];
            for (let i = 0; i < spec.sample; i++) {
              data.push(Math.max(o.min + 0.2, gaussSample(rnd, g.mean, g.sd)));
            }
          }

          const cx = pad.l + colW * gi + colW / 2;
          const pts = kde(data, o.min, o.max, o.bandwidth, (o.max - o.min) / 60);
          const maxD = pts.reduce((m, p) => Math.max(m, p.d), 0) || 1;
          const scale = (colW * 0.42) / maxD;

          ctx.beginPath();
          pts.forEach((p, i) => {
            const x = cx + p.d * scale;
            const y = toY(p.v);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          for (let i = pts.length - 1; i >= 0; i--) {
            ctx.lineTo(cx - pts[i].d * scale, toY(pts[i].v));
          }
          ctx.closePath();
          const alphaHex = Math.round(o.alpha * 255).toString(16).padStart(2, '0');
          ctx.fillStyle = g.color + alphaHex;
          ctx.fill();
          ctx.strokeStyle = g.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          if (o.showBox) {
            const sorted = data.slice().sort((a, b) => a - b);
            const med = quantile(sorted, 0.5);
            const q1 = quantile(sorted, 0.25);
            const q3 = quantile(sorted, 0.75);
            ctx.fillStyle = g.color;
            ctx.fillRect(cx - 3, toY(q3), 6, Math.max(1, toY(q1) - toY(q3)));
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx - 7, toY(med));
            ctx.lineTo(cx + 7, toY(med));
            ctx.stroke();
          }

          ctx.fillStyle = 'rgba(128,128,128,.95)';
          ctx.font = '12px "DM Sans", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(g.label, cx, H - 10);
        });
      },
    },
    legend: (spec) => spec.groups.map((g) => ({ label: g.label, color: g.color, toggleable: false })),
  },

  {
    id: 'heatmap',
    title: 'Heatmap',
    category: 'Distribution',
    blurb: 'Density across two categorical axes. Colour carries the value, position carries the key.',
    tags: ['heatmap', 'matrix', 'density', 'calendar', 'tickets'],
    spec: {
      rows: [...DAYS],
      hours: 24,
      seed: 9,
      color: C.purple,
      opts: { weekdayBase: 8, weekendBase: 2, peakBoost: 15, gap: 2, minAlpha: 0.12 },
    },
    controls: [
      { group: 'Data',  type: 'labels', key: 'rows', label: 'Row labels' },
      { group: 'Data',  type: 'slider', key: 'opts.weekdayBase', label: 'Weekday base', min: 0, max: 25, step: 1 },
      { group: 'Data',  type: 'slider', key: 'opts.weekendBase', label: 'Weekend base', min: 0, max: 25, step: 1 },
      { group: 'Data',  type: 'slider', key: 'opts.peakBoost',   label: 'Peak boost',   min: 0, max: 40, step: 1 },
      { group: 'Data',  type: 'slider', key: 'seed', label: 'Sample seed', min: 1, max: 60, step: 1 },
      { group: 'Style', type: 'colors', key: 'heatColor', label: 'Scale colour' },
      { group: 'Style', type: 'slider', key: 'opts.gap', label: 'Cell gap', min: 0, max: 8, step: 1, format: (v) => v + 'px' },
      { group: 'Style', type: 'slider', key: 'opts.minAlpha', label: 'Floor opacity', min: 0, max: 0.5, step: 0.02, format: (v) => Math.round(v * 100) + '%' },
    ],
    onInit(spec) { spec.heatColor = [spec.color]; },
    onChange(spec) { spec.color = spec.heatColor[0]; },
    chartjs: {
      plugins: ['matrix'],
      build(spec) {
        const rnd = makeRng(spec.seed * 40503);
        const o = spec.opts;
        const rows = spec.rows;
        const data = [];
        rows.forEach((_, ri) => {
          for (let h = 0; h < spec.hours; h++) {
            const weekend = ri >= 5;
            const base = weekend ? o.weekendBase : o.weekdayBase;
            const peak = (h >= 9 && h <= 11) || (h >= 14 && h <= 16) ? o.peakBoost : 0;
            const jitter = Math.round((rnd() - 0.5) * 6);
            data.push({ x: h, y: ri, v: Math.max(0, base + peak + jitter) });
          }
        });
        const maxV = data.reduce((m, d) => Math.max(m, d.v), 1);
        const { r, g, b } = hexToRgb(spec.color);
        const labelsJSON = JSON.stringify(rows);

        // These callbacks are both executed live and printed into the exported
        // code, so every value they need is baked in as a literal rather than
        // captured from this scope — a closure would export as a dangling name.
        const fillFn = srcFn(
          `(ctx) => {\n`
          + `  const cell = ctx.dataset.data[ctx.dataIndex];\n`
          + `  if (!cell) return 'transparent';\n`
          + `  const t = cell.v / ${maxV};\n`
          + `  const alpha = ${o.minAlpha} + t * ${(1 - o.minAlpha).toFixed(3)};\n`
          + `  return 'rgba(${r}, ${g}, ${b}, ' + alpha.toFixed(3) + ')';\n`
          + `}`,
        );

        return {
          type: 'matrix',
          data: {
            datasets: [{
              label: 'Value',
              data,
              backgroundColor: fillFn,
              borderColor: 'transparent',
              borderWidth: o.gap,
              width: srcFn(`(ctx) => (ctx.chart.chartArea ? ctx.chart.chartArea.width : 400) / ${spec.hours}`),
              height: srcFn(`(ctx) => (ctx.chart.chartArea ? ctx.chart.chartArea.height : 200) / ${rows.length}`),
            }],
          },
          options: baseOpts({
            interaction: { intersect: true, mode: 'nearest' },
            scales: {
              // `offset: true` pads the scale by half a step at each end so a
              // cell centred on an integer sits fully inside the plot — and it
              // keeps the ticks on whole numbers, which the label callbacks
              // below depend on.
              x: {
                type: 'linear', offset: true, min: 0, max: spec.hours - 1,
                ticks: { ...TICK, stepSize: 3, autoSkip: false, callback: srcFn(`(v) => (v === 0 ? '12a' : v < 12 ? v + 'a' : v === 12 ? '12p' : (v - 12) + 'p')`) },
                grid: { display: false }, border: { display: false },
              },
              y: {
                type: 'linear', offset: true, min: 0, max: rows.length - 1, reverse: true,
                ticks: { ...TICK, stepSize: 1, autoSkip: false, callback: srcFn(`(v) => (${labelsJSON})[v] || ''`) },
                grid: { display: false }, border: { display: false },
              },
            },
            plugins: {
              tooltip: {
                callbacks: {
                  title: srcFn(`(ctx) => (${labelsJSON})[ctx[0].raw.y] + ' · ' + ctx[0].raw.x + ':00'`),
                  label: srcFn(`(ctx) => ctx.raw.v + ' events'`),
                },
              },
            },
          }),
        };
      },
    },
    legend: (spec) => [
      { label: 'Low',  color: withAlpha(spec.color, Math.max(0.12, spec.opts.minAlpha)), toggleable: false },
      { label: 'High', color: spec.color, toggleable: false },
    ],
  },
];

function hexToRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
