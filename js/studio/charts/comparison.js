/**
 * Comparison and time-series chart definitions: slope, candlestick, parallel
 * coordinates, bump, and the two mixed bar/line combinations.
 */

import { C, MONTHS6, QUARTERS, withAlpha } from '../palette.js';
import { baseOpts, xAxis, yAxis, TICK, seriesLegend } from '../chartjs-base.js';
import { tickFormat, srcFn } from '../serialize.js';

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const comparisonCharts = [
  {
    id: 'slope-chart',
    title: 'Slope Chart',
    category: 'Comparison',
    blurb: 'Two points per item joined by a line. Rank change and direction, nothing else.',
    tags: ['slope', 'before after', 'change', 'ranking', 'two periods'],
    spec: {
      items: [
        { label: 'Outerwear',   from: 28, to: 35, color: C.teal   },
        { label: 'Dresses',     from: 22, to: 18, color: C.coral  },
        { label: 'Footwear',    from: 18, to: 21, color: C.blue   },
        { label: 'Basics',      from: 16, to: 14, color: C.gray   },
        { label: 'Accessories', from: 10, to: 7,  color: C.amber  },
        { label: 'Living',      from: 6,  to: 5,  color: C.purple },
      ],
      startLabel: '2022',
      endLabel: '2024',
      upColor: C.teal,
      downColor: C.coral,
      opts: { dotRadius: 6, lineWidth: 2, gutter: 140, suffix: '%', showDelta: true },
    },
    controls: [
      { group: 'Data',  type: 'series', key: 'items', data: false, max: 10, min: 2 },
      { group: 'Data',  type: 'text',   key: 'startLabel', label: 'Left period' },
      { group: 'Data',  type: 'text',   key: 'endLabel',   label: 'Right period' },
      { group: 'Style', type: 'colors', key: 'trend', label: 'Rise / fall', names: () => ['Rising', 'Falling'] },
      { group: 'Style', type: 'slider', key: 'opts.dotRadius', label: 'Dot size', min: 3, max: 12, step: 1, format: (v) => v + 'px' },
      { group: 'Style', type: 'slider', key: 'opts.lineWidth', label: 'Line width', min: 1, max: 6, step: 0.5, format: (v) => v + 'px' },
      { group: 'Style', type: 'slider', key: 'opts.gutter', label: 'Label gutter', min: 80, max: 220, step: 10, format: (v) => v + 'px' },
      { group: 'Style', type: 'toggle', key: 'opts.showDelta', label: 'Show change' },
    ],
    onInit(spec) { spec.trend = [spec.upColor, spec.downColor]; },
    onChange(spec) {
      [spec.upColor, spec.downColor] = spec.trend;
      spec.items.forEach((it, i) => {
        if (typeof it.from !== 'number') { it.from = 15; it.to = 15 + i; }
      });
    },
    canvas: {
      height: 380,
      draw(ctx, spec, W, H, env) {
        const o = spec.opts;
        const compact = !!(env && env.compact);
        const items = spec.items;
        if (!items.length) return;

        const all = items.flatMap((d) => [d.from, d.to]);
        const minV = Math.min(...all) - 4;
        const maxV = Math.max(...all) + 4;
        // Preview tiles have no room for the label gutters.
        const gutter = compact ? 26 : o.gutter;
        const pad = { t: 32, r: gutter, b: 26, l: gutter };
        const toY = (v) => pad.t + ((maxV - v) / (maxV - minV || 1)) * (H - pad.t - pad.b);
        const xA = pad.l;
        const xB = W - pad.r;


        ctx.fillStyle = 'rgba(128,128,128,.85)';
        ctx.font = '500 12px "DM Sans", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(spec.startLabel, xA, 18);
        ctx.fillText(spec.endLabel, xB, 18);

        ctx.strokeStyle = 'rgba(128,128,128,.22)';
        ctx.lineWidth = 1;
        [xA, xB].forEach((x) => {
          ctx.beginPath();
          ctx.moveTo(x, 24);
          ctx.lineTo(x, H - pad.b + 8);
          ctx.stroke();
        });

        items.forEach((d) => {
          const ya = toY(d.from);
          const yb = toY(d.to);
          const rising = d.to > d.from;

          ctx.strokeStyle = d.color + (rising ? 'dd' : '99');
          ctx.lineWidth = o.lineWidth;
          ctx.beginPath();
          ctx.moveTo(xA, ya);
          ctx.lineTo(xB, yb);
          ctx.stroke();

          ctx.fillStyle = d.color;
          [[xA, ya], [xB, yb]].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, o.dotRadius, 0, Math.PI * 2);
            ctx.fill();
          });

          if (compact) return;

          ctx.fillStyle = 'rgba(128,128,128,.95)';
          ctx.font = '12px "DM Sans", system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${d.label}  ${d.from}${o.suffix}`, xA - 14, ya + 4);

          ctx.textAlign = 'left';
          if (o.showDelta) {
            ctx.fillStyle = rising ? spec.upColor : spec.downColor;
            const arrow = rising ? '▲' : '▼';
            ctx.fillText(`${d.to}${o.suffix}  ${arrow}${Math.abs(d.to - d.from)}`, xB + 14, yb + 4);
          } else {
            ctx.fillText(`${d.to}${o.suffix}`, xB + 14, yb + 4);
          }
        });
      },
    },
    legend: () => null,
  },

  {
    id: 'candlestick',
    title: 'Candlestick',
    category: 'Comparison',
    blurb: 'Open, high, low and close in one mark. Body is the move, wick is the range.',
    tags: ['candlestick', 'ohlc', 'finance', 'stock', 'trading'],
    spec: {
      count: 60,
      seed: 4,
      start: 148,
      volatility: 4,
      upColor: C.teal,
      downColor: C.coral,
      opts: { floor: 120, ceiling: 200, barGap: 2, wickWidth: 1, prefix: '$' },
    },
    controls: [
      { group: 'Data',  type: 'slider', key: 'count', label: 'Sessions', min: 15, max: 160, step: 5 },
      { group: 'Data',  type: 'slider', key: 'seed', label: 'Sample seed', min: 1, max: 60, step: 1 },
      { group: 'Data',  type: 'slider', key: 'start', label: 'Opening price', min: 50, max: 300, step: 5 },
      { group: 'Data',  type: 'slider', key: 'volatility', label: 'Volatility', min: 0.5, max: 12, step: 0.5, format: (v) => v.toFixed(1) },
      { group: 'Style', type: 'colors', key: 'candle', label: 'Up / down', names: () => ['Rising', 'Falling'] },
      { group: 'Style', type: 'slider', key: 'opts.barGap', label: 'Candle gap', min: 0, max: 8, step: 1, format: (v) => v + 'px' },
    ],
    onInit(spec) { spec.candle = [spec.upColor, spec.downColor]; },
    onChange(spec) { [spec.upColor, spec.downColor] = spec.candle; },
    canvas: {
      height: 340,
      helpers: [makeRng],
      draw(ctx, spec, W, H) {
        const o = spec.opts;
        const rnd = makeRng(spec.seed * 7919);

        // Deterministic random walk — the same seed always draws this chart.
        let price = spec.start;
        const candles = [];
        for (let i = 0; i < spec.count; i++) {
          const open = price;
          price = Math.max(o.floor, Math.min(o.ceiling, price + (rnd() - 0.48) * spec.volatility));
          const close = price;
          candles.push({
            o: +open.toFixed(2),
            c: +close.toFixed(2),
            h: +(Math.max(open, close) + rnd() * spec.volatility * 0.5).toFixed(2),
            l: +(Math.min(open, close) - rnd() * spec.volatility * 0.5).toFixed(2),
          });
        }

        const vals = candles.flatMap((c) => [c.h, c.l]);
        const minV = Math.min(...vals) - 2;
        const maxV = Math.max(...vals) + 2;
        const pad = { t: 16, r: 16, b: 30, l: 56 };
        const cw = W - pad.l - pad.r;
        const ch = H - pad.t - pad.b;
        const toY = (v) => pad.t + ch - ((v - minV) / (maxV - minV || 1)) * ch;
        const slot = cw / Math.max(1, candles.length);
        const barW = Math.max(1.5, slot - o.barGap);

        ctx.font = '10px "DM Sans", system-ui, sans-serif';
        const step = Math.max(1, Math.round((maxV - minV) / 6));
        for (let v = Math.ceil(minV / step) * step; v <= maxV; v += step) {
          const y = toY(v);
          ctx.strokeStyle = 'rgba(128,128,128,.11)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pad.l, y);
          ctx.lineTo(W - pad.r, y);
          ctx.stroke();
          ctx.fillStyle = 'rgba(128,128,128,.75)';
          ctx.textAlign = 'right';
          ctx.fillText(o.prefix + Math.round(v), pad.l - 6, y + 4);
        }

        candles.forEach((c, i) => {
          const x = pad.l + i * slot + slot / 2;
          const up = c.c >= c.o;
          const colour = up ? spec.upColor : spec.downColor;

          ctx.strokeStyle = colour;
          ctx.lineWidth = o.wickWidth;
          ctx.beginPath();
          ctx.moveTo(x, toY(c.h));
          ctx.lineTo(x, toY(c.l));
          ctx.stroke();

          const top = toY(Math.max(c.o, c.c));
          const bottom = toY(Math.min(c.o, c.c));
          ctx.fillStyle = colour + 'cc';
          ctx.fillRect(x - barW / 2, top, barW, Math.max(1, bottom - top));
        });
      },
    },
    legend: (spec) => [
      { label: 'Rising',  color: spec.upColor, toggleable: false },
      { label: 'Falling', color: spec.downColor, toggleable: false },
    ],
  },

  {
    id: 'parallel-coords',
    title: 'Parallel Coordinates',
    category: 'Comparison',
    blurb: 'One line per item crossing several axes. Crossings mean trade-offs.',
    tags: ['parallel coordinates', 'multivariate', 'd3', 'dimensions', 'trade off'],
    spec: {
      dims: ['Price', 'Rating', 'Reviews', 'Margin%', 'Returns%'],
      count: 40,
      seed: 6,
      groups: [
        { label: 'Premium', color: C.purple },
        { label: 'Mid',     color: C.teal   },
        { label: 'Value',   color: C.coral  },
      ],
      opts: { strokeWidth: 1.2, alpha: 0.45, showAxisLabels: true },
    },
    controls: [
      { group: 'Data',  type: 'slider', key: 'count', label: 'Item count', min: 10, max: 200, step: 5 },
      { group: 'Data',  type: 'slider', key: 'seed',  label: 'Sample seed', min: 1, max: 60, step: 1 },
      { group: 'Data',  type: 'series', key: 'groups', data: false, max: 5, min: 1 },
      { group: 'Style', type: 'slider', key: 'opts.strokeWidth', label: 'Line width', min: 0.5, max: 4, step: 0.1, format: (v) => v.toFixed(1) + 'px' },
      { group: 'Style', type: 'slider', key: 'opts.alpha', label: 'Line opacity', min: 0.1, max: 1, step: 0.05, format: (v) => Math.round(v * 100) + '%' },
      { group: 'Style', type: 'toggle', key: 'opts.showAxisLabels', label: 'Show axis titles' },
    ],
    d3: {
      height: 380,
      helpers: [makeRng],
      mount(host, spec, W, H) {
        const o = spec.opts;
        const pad = { t: 42, r: 34, b: 22, l: 34 };
        const rnd = makeRng(spec.seed * 2654435761);
        const groupCount = Math.max(1, spec.groups.length);

        const rows = Array.from({ length: spec.count }, (_, i) => {
          const g = i % groupCount;
          const band = groupCount - g;
          return {
            group: g,
            Price: Math.round(15 + rnd() * 60 * band),
            Rating: +(2.5 + rnd() * 2.4).toFixed(1),
            Reviews: Math.round(10 + rnd() * 490),
            'Margin%': Math.round(15 + rnd() * 50),
            'Returns%': Math.round(2 + rnd() * 18),
          };
        });

        const svg = d3.select(host).append('svg').attr('width', W).attr('height', H);
        const x = d3.scalePoint().domain(spec.dims).range([pad.l, W - pad.r]);
        const y = {};
        spec.dims.forEach((dim) => {
          y[dim] = d3.scaleLinear()
            .domain(d3.extent(rows, (r) => r[dim]))
            .nice()
            .range([H - pad.b, pad.t]);
        });

        const line = d3.line();
        svg.append('g').selectAll('path').data(rows).join('path')
          .attr('d', (r) => line(spec.dims.map((dim) => [x(dim), y[dim](r[dim])])))
          .attr('fill', 'none')
          .attr('stroke', (r) => spec.groups[r.group % groupCount].color)
          .attr('stroke-width', o.strokeWidth)
          .attr('stroke-opacity', o.alpha);

        spec.dims.forEach((dim) => {
          const g = svg.append('g').attr('transform', `translate(${x(dim)},0)`);
          g.call(d3.axisLeft(y[dim]).ticks(5).tickSize(3))
            .call((sel) => sel.select('.domain').attr('stroke', 'rgba(128,128,128,.35)'))
            .call((sel) => sel.selectAll('text')
              .attr('font-size', 10)
              .attr('font-family', '"DM Sans", system-ui, sans-serif')
              .attr('fill', 'currentColor'))
            .call((sel) => sel.selectAll('.tick line').attr('stroke', 'rgba(128,128,128,.35)'));

          if (o.showAxisLabels) {
            g.append('text')
              .attr('y', pad.t - 16)
              .attr('text-anchor', 'middle')
              .attr('font-size', 11)
              .attr('font-weight', 500)
              .attr('font-family', '"DM Sans", system-ui, sans-serif')
              .attr('fill', 'currentColor')
              .text(dim);
          }
        });
      },
    },
    legend: (spec) => spec.groups.map((g) => ({ label: g.label, color: g.color, toggleable: false })),
  },

  {
    id: 'bump-chart',
    title: 'Bump Chart',
    category: 'Comparison',
    blurb: 'Rank over time on a reversed axis, so first place sits on top and crossings are overtakes.',
    tags: ['bump', 'ranking', 'position', 'over time', 'leaderboard'],
    spec: {
      labels: [...MONTHS6],
      series: [
        { label: 'Linen Blazer',  color: C.purple, data: [1, 1, 2, 2, 1, 1] },
        { label: 'Silk Midi',     color: C.teal,   data: [2, 3, 1, 1, 2, 2] },
        { label: 'Wool Coat',     color: C.coral,  data: [3, 2, 3, 4, 3, 3] },
        { label: 'Canvas Tote',   color: C.blue,   data: [4, 4, 4, 3, 5, 4] },
        { label: 'Cashmere Knit', color: C.amber,  data: [5, 5, 5, 5, 4, 5] },
        { label: 'Leather Belt',  color: C.gray,   data: [6, 6, 6, 6, 6, 6] },
      ],
      opts: { tension: 0.4, pointRadius: 7, lineWidth: 2.5 },
    },
    controls: [
      { group: 'Data',  type: 'labels', key: 'labels', label: 'Period labels' },
      { group: 'Data',  type: 'series', key: 'series', data: true, max: 8 },
      { group: 'Style', type: 'slider', key: 'opts.tension', label: 'Curve tension', min: 0, max: 1, step: 0.05, format: (v) => v.toFixed(2) },
      { group: 'Style', type: 'slider', key: 'opts.pointRadius', label: 'Point size', min: 3, max: 14, step: 1, format: (v) => v + 'px' },
      { group: 'Style', type: 'slider', key: 'opts.lineWidth', label: 'Line width', min: 1, max: 6, step: 0.5, format: (v) => v + 'px' },
    ],
    chartjs: {
      build(spec) {
        const places = spec.series.length;
        return {
          type: 'line',
          data: {
            labels: spec.labels,
            datasets: spec.series.map((s) => ({
              label: s.label,
              data: s.data,
              borderColor: s.color,
              backgroundColor: 'transparent',
              tension: spec.opts.tension,
              pointRadius: spec.opts.pointRadius,
              pointHoverRadius: spec.opts.pointRadius + 2,
              pointBackgroundColor: s.color,
              pointBorderColor: s.color,
              borderWidth: spec.opts.lineWidth,
              fill: false,
            })),
          },
          options: baseOpts({
            scales: {
              x: xAxis(),
              y: yAxis({
                // Reversed so rank 1 sits at the top of the frame.
                reverse: true,
                min: 0.5,
                max: places + 0.5,
                ticks: { ...TICK, stepSize: 1, callback: srcFn(`(v) => (Number.isInteger(v) ? '#' + v : '')`) },
              }),
            },
          }),
        };
      },
    },
    legend: (spec) => seriesLegend(spec, true),
  },

  {
    id: 'mixed-bar-line',
    title: 'Bar + Line',
    category: 'Comparison',
    blurb: 'A magnitude on the left axis and a rate on the right. Two units, one frame.',
    tags: ['mixed', 'combo', 'dual axis', 'bar line', 'growth'],
    spec: {
      labels: [...QUARTERS],
      bars: { label: 'Revenue', color: C.purple, data: [520, 680, 740, 910] },
      line: { label: 'Growth',  color: C.coral,  data: [null, 31, 9, 23] },
      opts: { radius: 5, thickness: 0.6, outline: true, tension: 0.3, pointRadius: 6, lineWidth: 2.5, leftPrefix: '$', leftSuffix: 'K', rightSuffix: '%' },
    },
    controls: [
      { group: 'Data',  type: 'labels', key: 'labels',     label: 'Category labels' },
      { group: 'Data',  type: 'values', key: 'bars.data',  label: 'Bar values' },
      { group: 'Data',  type: 'values', key: 'line.data',  label: 'Line values' },
      { group: 'Style', type: 'text',   key: 'bars.label', label: 'Bar series name' },
      { group: 'Style', type: 'text',   key: 'line.label', label: 'Line series name' },
      { group: 'Style', type: 'colors', key: 'mixed', label: 'Colours', names: (s) => [s.bars.label, s.line.label] },
      { group: 'Style', type: 'toggle', key: 'opts.outline', label: 'Outlined bars' },
      { group: 'Axis',  type: 'text',   key: 'opts.leftPrefix',  label: 'Left axis prefix' },
      { group: 'Axis',  type: 'text',   key: 'opts.leftSuffix',  label: 'Left axis suffix' },
      { group: 'Axis',  type: 'text',   key: 'opts.rightSuffix', label: 'Right axis suffix' },
    ],
    onInit(spec) { spec.mixed = [spec.bars.color, spec.line.color]; },
    onChange(spec) { [spec.bars.color, spec.line.color] = spec.mixed; },
    chartjs: {
      build: (spec) => ({
        type: 'bar',
        data: {
          labels: spec.labels,
          datasets: [
            {
              type: 'bar',
              label: spec.bars.label,
              data: spec.bars.data,
              backgroundColor: spec.opts.outline ? withAlpha(spec.bars.color, 0.2) : spec.bars.color,
              borderColor: spec.bars.color,
              borderWidth: spec.opts.outline ? 1.5 : 0,
              borderRadius: spec.opts.radius,
              borderSkipped: false,
              categoryPercentage: spec.opts.thickness,
              yAxisID: 'y',
            },
            {
              type: 'line',
              label: spec.line.label,
              data: spec.line.data,
              borderColor: spec.line.color,
              backgroundColor: 'transparent',
              tension: spec.opts.tension,
              pointRadius: spec.opts.pointRadius,
              pointBackgroundColor: spec.line.color,
              borderWidth: spec.opts.lineWidth,
              yAxisID: 'y2',
            },
          ],
        },
        options: baseOpts({
          scales: {
            x: xAxis(),
            y: yAxis({ ticks: { ...TICK, callback: tickFormat({ prefix: spec.opts.leftPrefix, suffix: spec.opts.leftSuffix }) } }),
            y2: {
              position: 'right',
              ticks: { ...TICK, callback: tickFormat({ suffix: spec.opts.rightSuffix }) },
              grid: { display: false },
              border: { display: false },
            },
          },
        }),
      }),
    },
    legend: (spec) => [
      { label: spec.bars.label, color: spec.bars.color, datasetIndex: 0 },
      { label: spec.line.label, color: spec.line.color, line: true, datasetIndex: 1 },
    ],
  },

  {
    id: 'mixed-stacked-line',
    title: 'Stacked Bar + Total Line',
    category: 'Comparison',
    blurb: 'Composition in the stack, total on the line — the figure the stack makes hard to read.',
    tags: ['mixed', 'combo', 'stacked', 'total', 'overlay'],
    spec: {
      labels: [...QUARTERS],
      series: [
        { label: 'Online',    color: C.purple, data: [0.52, 0.68, 0.74, 0.91] },
        { label: 'In-store',  color: C.teal,   data: [0.31, 0.38, 0.42, 0.51] },
        { label: 'Wholesale', color: C.coral,  data: [0.18, 0.22, 0.24, 0.29] },
      ],
      totalLabel: 'Total',
      totalColor: C.pink,
      opts: { outline: true, radius: 4, thickness: 0.62, tension: 0.3, pointRadius: 6, lineWidth: 2.5, prefix: '$', suffix: 'M', decimals: 2 },
    },
    controls: [
      { group: 'Data',  type: 'labels', key: 'labels', label: 'Category labels' },
      { group: 'Data',  type: 'series', key: 'series', data: true, max: 6 },
      { group: 'Total', type: 'text',   key: 'totalLabel', label: 'Total series name' },
      { group: 'Total', type: 'colors', key: 'totalColorList', label: 'Total colour' },
      { group: 'Style', type: 'toggle', key: 'opts.outline', label: 'Outlined bars' },
      { group: 'Style', type: 'slider', key: 'opts.radius', label: 'Corner radius', min: 0, max: 10, step: 1, format: (v) => v + 'px' },
      { group: 'Axis',  type: 'text',   key: 'opts.prefix', label: 'Value prefix' },
      { group: 'Axis',  type: 'text',   key: 'opts.suffix', label: 'Value suffix' },
    ],
    onInit(spec) { spec.totalColorList = [spec.totalColor]; },
    onChange(spec) { spec.totalColor = spec.totalColorList[0]; },
    chartjs: {
      build(spec) {
        const totals = spec.labels.map((_, i) =>
          +spec.series.reduce((sum, s) => sum + (s.data[i] || 0), 0).toFixed(spec.opts.decimals));
        return {
          type: 'bar',
          data: {
            labels: spec.labels,
            datasets: [
              ...spec.series.map((s) => ({
                type: 'bar',
                label: s.label,
                data: s.data,
                backgroundColor: spec.opts.outline ? withAlpha(s.color, 0.2) : s.color,
                borderColor: s.color,
                borderWidth: spec.opts.outline ? 1 : 0,
                borderRadius: spec.opts.radius,
                borderSkipped: false,
                categoryPercentage: spec.opts.thickness,
                stack: 'total',
              })),
              {
                type: 'line',
                label: spec.totalLabel,
                data: totals,
                borderColor: spec.totalColor,
                backgroundColor: 'transparent',
                tension: spec.opts.tension,
                pointRadius: spec.opts.pointRadius,
                pointBackgroundColor: spec.totalColor,
                borderWidth: spec.opts.lineWidth,
              },
            ],
          },
          options: baseOpts({
            scales: {
              x: xAxis({ stacked: true }),
              y: yAxis({ stacked: true, ticks: { ...TICK, callback: tickFormat({ prefix: spec.opts.prefix, suffix: spec.opts.suffix, decimals: spec.opts.decimals }) } }),
            },
          }),
        };
      },
    },
    legend: (spec) => [
      ...spec.series.map((s, i) => ({ label: s.label, color: s.color, datasetIndex: i })),
      { label: spec.totalLabel, color: spec.totalColor, line: true, datasetIndex: spec.series.length },
    ],
  },
];
