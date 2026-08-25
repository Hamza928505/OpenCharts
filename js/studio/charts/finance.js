/**
 * Finance charts: OHLC, Kagi, Point & Figure, Renko.
 *
 * The last three are *price-driven* rather than time-driven — a new mark only
 * appears when price moves far enough, so the horizontal axis is not time at
 * all. That is the whole point of them, and it is why they each need their own
 * construction rather than a variant of the candlestick.
 */

import { C } from '../palette.js';

function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A deterministic price walk shared by all four charts.
 *
 * The small pull back toward `start` matters: a pure random walk drifts to a
 * boundary and sits there, which starves the reversal-driven charts (Point &
 * Figure, Kagi, Renko) of the direction changes they exist to show. Mean
 * reversion keeps it oscillating, which is both more realistic and the only
 * way those three produce a meaningful picture from default settings.
 */
function priceWalk(seed, count, start, volatility, floor, ceiling) {
  const rnd = makeRng(seed * 7919);
  const out = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const open = price;
    const drift = (start - price) * 0.03;
    price = Math.max(floor, Math.min(ceiling, price + (rnd() - 0.5) * volatility + drift));
    const close = price;
    out.push({
      o: +open.toFixed(2),
      c: +close.toFixed(2),
      h: +(Math.max(open, close) + rnd() * volatility * 0.5).toFixed(2),
      l: +(Math.min(open, close) - rnd() * volatility * 0.5).toFixed(2),
    });
  }
  return out;
}

const priceControls = [
  { group: 'Data', type: 'slider', key: 'count',      label: 'Sessions',      min: 20, max: 240, step: 10 },
  { group: 'Data', type: 'slider', key: 'seed',       label: 'Sample seed',   min: 1, max: 60, step: 1 },
  { group: 'Data', type: 'slider', key: 'start',      label: 'Opening price', min: 40, max: 300, step: 5 },
  { group: 'Data', type: 'slider', key: 'volatility', label: 'Volatility',    min: 0.5, max: 14, step: 0.5, format: (v) => v.toFixed(1) },
];

export const financeCharts = [
  {
    id: 'ohlc',
    title: 'OHLC Bar',
    category: 'Finance',
    blurb: 'The candlestick’s older sibling: a vertical range with ticks left for open and right for close.',
    tags: ['ohlc', 'bar chart', 'finance', 'stock', 'trading', 'price'],
    spec: {
      count: 60, seed: 4, start: 148, volatility: 4,
      upColor: C.teal, downColor: C.coral,
      opts: { floor: 110, ceiling: 210, tickLength: 5, lineWidth: 1.6, prefix: '$' },
    },
    controls: [
      ...priceControls,
      { group: 'Style', type: 'colors', key: 'ohlcColors', label: 'Up / down', names: () => ['Rising', 'Falling'] },
      { group: 'Style', type: 'slider', key: 'opts.tickLength', label: 'Tick length', min: 2, max: 14, step: 1, format: (v) => v + 'px' },
      { group: 'Style', type: 'slider', key: 'opts.lineWidth', label: 'Line width', min: 1, max: 5, step: 0.5, format: (v) => v + 'px' },
    ],
    onInit(spec) { spec.ohlcColors = [spec.upColor, spec.downColor]; },
    onChange(spec) { [spec.upColor, spec.downColor] = spec.ohlcColors; },
    canvas: {
      height: 360,
      helpers: [makeRng, priceWalk],
      draw(ctx, spec, W, H) {
        const o = spec.opts;
        const bars = priceWalk(spec.seed, spec.count, spec.start, spec.volatility, o.floor, o.ceiling);
        const vals = bars.flatMap((b) => [b.h, b.l]);
        const minV = Math.min(...vals) - 2;
        const maxV = Math.max(...vals) + 2;
        const pad = { t: 16, r: 16, b: 30, l: 56 };
        const cw = W - pad.l - pad.r;
        const ch = H - pad.t - pad.b;
        const toY = (v) => pad.t + ch - ((v - minV) / (maxV - minV || 1)) * ch;
        const slot = cw / Math.max(1, bars.length);

        ctx.font = '10px "DM Sans", system-ui, sans-serif';
        const stepV = Math.max(1, Math.round((maxV - minV) / 6));
        for (let v = Math.ceil(minV / stepV) * stepV; v <= maxV; v += stepV) {
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

        bars.forEach((b, i) => {
          const x = pad.l + i * slot + slot / 2;
          ctx.strokeStyle = b.c >= b.o ? spec.upColor : spec.downColor;
          ctx.lineWidth = o.lineWidth;

          ctx.beginPath();
          ctx.moveTo(x, toY(b.h));
          ctx.lineTo(x, toY(b.l));
          ctx.stroke();

          // Open ticks left, close ticks right — the OHLC convention.
          ctx.beginPath();
          ctx.moveTo(x - o.tickLength, toY(b.o));
          ctx.lineTo(x, toY(b.o));
          ctx.moveTo(x, toY(b.c));
          ctx.lineTo(x + o.tickLength, toY(b.c));
          ctx.stroke();
        });
      },
    },
    legend: (spec) => [
      { label: 'Rising', color: spec.upColor, toggleable: false },
      { label: 'Falling', color: spec.downColor, toggleable: false },
    ],
  },

  {
    id: 'renko',
    title: 'Renko',
    category: 'Finance',
    blurb: 'A brick is laid only when price moves a fixed amount. Time disappears; noise goes with it.',
    tags: ['renko', 'bricks', 'finance', 'price action', 'noise filter', 'trend'],
    spec: {
      count: 220, seed: 6, start: 148, volatility: 6,
      upColor: C.teal, downColor: C.coral,
      opts: { floor: 90, ceiling: 230, brickSize: 3, gap: 1, prefix: '$' },
    },
    controls: [
      ...priceControls,
      { group: 'Bricks', type: 'slider', key: 'opts.brickSize', label: 'Brick size', min: 1, max: 20, step: 0.5, format: (v) => v.toFixed(1) },
      { group: 'Bricks', type: 'slider', key: 'opts.gap', label: 'Brick gap', min: 0, max: 6, step: 1, format: (v) => v + 'px' },
      { group: 'Style',  type: 'colors', key: 'renkoColors', label: 'Up / down', names: () => ['Up brick', 'Down brick'] },
    ],
    onInit(spec) { spec.renkoColors = [spec.upColor, spec.downColor]; },
    onChange(spec) { [spec.upColor, spec.downColor] = spec.renkoColors; },
    canvas: {
      height: 360,
      helpers: [makeRng, priceWalk],
      draw(ctx, spec, W, H) {
        const o = spec.opts;
        const size = o.brickSize;
        const walk = priceWalk(spec.seed, spec.count, spec.start, spec.volatility, o.floor, o.ceiling);

        // Lay a brick each time price closes a full brick beyond the last one.
        const bricks = [];
        let base = Math.round(walk[0].c / size) * size;
        walk.forEach((bar) => {
          while (bar.c >= base + size) { base += size; bricks.push({ low: base - size, up: true }); }
          while (bar.c <= base - size) { base -= size; bricks.push({ low: base, up: false }); }
        });
        if (!bricks.length) return;

        const lows = bricks.map((b) => b.low);
        const minV = Math.min(...lows) - size;
        const maxV = Math.max(...lows) + size * 2;
        const pad = { t: 16, r: 16, b: 24, l: 56 };
        const cw = W - pad.l - pad.r;
        const ch = H - pad.t - pad.b;
        const toY = (v) => pad.t + ch - ((v - minV) / (maxV - minV || 1)) * ch;
        const colW = cw / bricks.length;

        ctx.font = '10px "DM Sans", system-ui, sans-serif';
        const stepV = Math.max(size, Math.round((maxV - minV) / 6 / size) * size);
        for (let v = Math.ceil(minV / stepV) * stepV; v <= maxV; v += stepV) {
          const y = toY(v);
          ctx.strokeStyle = 'rgba(128,128,128,.1)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pad.l, y);
          ctx.lineTo(W - pad.r, y);
          ctx.stroke();
          ctx.fillStyle = 'rgba(128,128,128,.75)';
          ctx.textAlign = 'right';
          ctx.fillText(o.prefix + Math.round(v), pad.l - 6, y + 4);
        }

        bricks.forEach((b, i) => {
          const x = pad.l + i * colW;
          const yTop = toY(b.low + size);
          const h = Math.max(1, toY(b.low) - yTop);
          ctx.fillStyle = (b.up ? spec.upColor : spec.downColor) + 'dd';
          ctx.fillRect(x + o.gap / 2, yTop + o.gap / 2, Math.max(1, colW - o.gap), Math.max(1, h - o.gap));
        });
      },
    },
    legend: (spec) => [
      { label: 'Up brick', color: spec.upColor, toggleable: false },
      { label: 'Down brick', color: spec.downColor, toggleable: false },
    ],
  },

  {
    id: 'point-figure',
    title: 'Point & Figure',
    category: 'Finance',
    blurb: 'Columns of X and O. A new column starts only when price reverses by a set number of boxes.',
    tags: ['point and figure', 'pnf', 'x o', 'reversal', 'finance', 'price action'],
    spec: {
      count: 300, seed: 9, start: 148, volatility: 7,
      upColor: C.teal, downColor: C.coral,
      opts: { floor: 90, ceiling: 230, boxSize: 2, reversal: 3, markSize: 0.72, lineWidth: 1.8, prefix: '$' },
    },
    controls: [
      ...priceControls,
      { group: 'Boxes', type: 'slider', key: 'opts.boxSize',  label: 'Box size', min: 1, max: 12, step: 0.5, format: (v) => v.toFixed(1) },
      { group: 'Boxes', type: 'slider', key: 'opts.reversal', label: 'Reversal boxes', min: 1, max: 6, step: 1 },
      { group: 'Style', type: 'colors', key: 'pnfColors', label: 'X / O', names: () => ['X (rising)', 'O (falling)'] },
      { group: 'Style', type: 'slider', key: 'opts.markSize', label: 'Mark size', min: 0.4, max: 1, step: 0.04, format: (v) => Math.round(v * 100) + '%' },
    ],
    onInit(spec) { spec.pnfColors = [spec.upColor, spec.downColor]; },
    onChange(spec) { [spec.upColor, spec.downColor] = spec.pnfColors; },
    canvas: {
      height: 380,
      helpers: [makeRng, priceWalk],
      draw(ctx, spec, W, H) {
        const o = spec.opts;
        const box = o.boxSize;
        const walk = priceWalk(spec.seed, spec.count, spec.start, spec.volatility, o.floor, o.ceiling);

        // Build columns: extend the current one, or reverse into a new one.
        const columns = [];
        let dir = 1;
        let top = Math.round(walk[0].c / box) * box;
        let bottom = top;
        let current = { up: true, from: top, to: top };

        walk.forEach((bar) => {
          const p = bar.c;
          if (dir === 1) {
            if (p >= current.to + box) {
              current.to = Math.floor(p / box) * box;
            } else if (p <= current.to - box * o.reversal) {
              columns.push(current);
              dir = -1;
              current = { up: false, from: current.to - box, to: Math.ceil(p / box) * box };
            }
          } else {
            if (p <= current.to - box) {
              current.to = Math.ceil(p / box) * box;
            } else if (p >= current.to + box * o.reversal) {
              columns.push(current);
              dir = 1;
              current = { up: true, from: current.to + box, to: Math.floor(p / box) * box };
            }
          }
        });
        columns.push(current);
        if (!columns.length) return;

        const all = columns.flatMap((c) => [c.from, c.to]);
        const minV = Math.min(...all) - box;
        const maxV = Math.max(...all) + box;
        const pad = { t: 14, r: 16, b: 20, l: 56 };
        const cw = W - pad.l - pad.r;
        const ch = H - pad.t - pad.b;
        const rows = Math.max(1, Math.round((maxV - minV) / box));
        const cellH = ch / rows;
        const cellW = cw / columns.length;
        const toY = (v) => pad.t + ch - ((v - minV) / box) * cellH;

        ctx.font = '10px "DM Sans", system-ui, sans-serif';
        const labelEvery = Math.max(1, Math.round(rows / 8));
        for (let r = 0; r <= rows; r += labelEvery) {
          const v = minV + r * box;
          const y = toY(v);
          ctx.strokeStyle = 'rgba(128,128,128,.09)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pad.l, y);
          ctx.lineTo(W - pad.r, y);
          ctx.stroke();
          ctx.fillStyle = 'rgba(128,128,128,.75)';
          ctx.textAlign = 'right';
          ctx.fillText(o.prefix + Math.round(v), pad.l - 6, y + 4);
        }

        const m = Math.min(cellW, cellH) * o.markSize;
        columns.forEach((col, ci) => {
          const cx = pad.l + ci * cellW + cellW / 2;
          const lo = Math.min(col.from, col.to);
          const hi = Math.max(col.from, col.to);
          ctx.strokeStyle = col.up ? spec.upColor : spec.downColor;
          ctx.lineWidth = o.lineWidth;

          for (let v = lo; v <= hi; v += box) {
            const cy = toY(v) - cellH / 2;
            if (col.up) {
              ctx.beginPath();
              ctx.moveTo(cx - m / 2, cy - m / 2);
              ctx.lineTo(cx + m / 2, cy + m / 2);
              ctx.moveTo(cx + m / 2, cy - m / 2);
              ctx.lineTo(cx - m / 2, cy + m / 2);
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.arc(cx, cy, m / 2, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        });
      },
    },
    legend: (spec) => [
      { label: 'X — rising', color: spec.upColor, toggleable: false },
      { label: 'O — falling', color: spec.downColor, toggleable: false },
    ],
  },

  {
    id: 'kagi',
    title: 'Kagi',
    category: 'Finance',
    blurb: 'A line that thickens on a break to a new high and thins on a break to a new low. Direction, not duration.',
    tags: ['kagi', 'finance', 'reversal', 'yin yang', 'price action', 'trend'],
    spec: {
      count: 260, seed: 11, start: 148, volatility: 6,
      upColor: C.teal, downColor: C.coral,
      opts: { floor: 90, ceiling: 230, reversal: 5, thickWidth: 3.6, thinWidth: 1.4, prefix: '$' },
    },
    controls: [
      ...priceControls,
      { group: 'Lines', type: 'slider', key: 'opts.reversal', label: 'Reversal amount', min: 1, max: 20, step: 0.5, format: (v) => v.toFixed(1) },
      { group: 'Style', type: 'colors', key: 'kagiColors', label: 'Yang / yin', names: () => ['Thick (yang)', 'Thin (yin)'] },
      { group: 'Style', type: 'slider', key: 'opts.thickWidth', label: 'Thick width', min: 2, max: 8, step: 0.2, format: (v) => v.toFixed(1) + 'px' },
      { group: 'Style', type: 'slider', key: 'opts.thinWidth', label: 'Thin width', min: 0.5, max: 4, step: 0.2, format: (v) => v.toFixed(1) + 'px' },
    ],
    onInit(spec) { spec.kagiColors = [spec.upColor, spec.downColor]; },
    onChange(spec) { [spec.upColor, spec.downColor] = spec.kagiColors; },
    canvas: {
      height: 360,
      helpers: [makeRng, priceWalk],
      draw(ctx, spec, W, H) {
        const o = spec.opts;
        const walk = priceWalk(spec.seed, spec.count, spec.start, spec.volatility, o.floor, o.ceiling);

        // Turning points: extend while moving with the trend, pivot on a
        // reversal larger than the threshold.
        const pivots = [walk[0].c];
        let dir = 0;
        walk.forEach((bar) => {
          const p = bar.c;
          const last = pivots[pivots.length - 1];
          if (dir === 0) {
            if (Math.abs(p - last) >= o.reversal) { dir = p > last ? 1 : -1; pivots.push(p); }
          } else if (dir === 1) {
            if (p > last) pivots[pivots.length - 1] = p;
            else if (last - p >= o.reversal) { dir = -1; pivots.push(p); }
          } else {
            if (p < last) pivots[pivots.length - 1] = p;
            else if (p - last >= o.reversal) { dir = 1; pivots.push(p); }
          }
        });
        if (pivots.length < 2) return;

        const minV = Math.min(...pivots) - 3;
        const maxV = Math.max(...pivots) + 3;
        const pad = { t: 16, r: 16, b: 22, l: 56 };
        const cw = W - pad.l - pad.r;
        const ch = H - pad.t - pad.b;
        const toY = (v) => pad.t + ch - ((v - minV) / (maxV - minV || 1)) * ch;
        const stepX = cw / Math.max(1, pivots.length - 1);

        ctx.font = '10px "DM Sans", system-ui, sans-serif';
        const stepV = Math.max(1, Math.round((maxV - minV) / 6));
        for (let v = Math.ceil(minV / stepV) * stepV; v <= maxV; v += stepV) {
          const y = toY(v);
          ctx.strokeStyle = 'rgba(128,128,128,.1)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pad.l, y);
          ctx.lineTo(W - pad.r, y);
          ctx.stroke();
          ctx.fillStyle = 'rgba(128,128,128,.75)';
          ctx.textAlign = 'right';
          ctx.fillText(o.prefix + Math.round(v), pad.l - 6, y + 4);
        }

        // The line is thick while above the prior shoulder, thin below it.
        let thick = pivots[1] > pivots[0];
        let shoulder = pivots[0];
        ctx.lineCap = 'butt';

        for (let i = 1; i < pivots.length; i++) {
          const x0 = pad.l + (i - 1) * stepX;
          const x1 = pad.l + i * stepX;
          const y0 = toY(pivots[i - 1]);
          const y1 = toY(pivots[i]);
          const rising = pivots[i] > pivots[i - 1];

          if (rising && pivots[i] > shoulder) thick = true;
          if (!rising && pivots[i] < shoulder) thick = false;
          shoulder = pivots[i - 1];

          ctx.strokeStyle = thick ? spec.upColor : spec.downColor;
          ctx.lineWidth = thick ? o.thickWidth : o.thinWidth;

          // Vertical move, then the horizontal shoulder into the next column.
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x0, y1);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x0, y1);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      },
    },
    legend: (spec) => [
      { label: 'Yang (thick)', color: spec.upColor, toggleable: false },
      { label: 'Yin (thin)', color: spec.downColor, toggleable: false },
    ],
  },
];
