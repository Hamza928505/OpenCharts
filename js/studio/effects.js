/** One visual treatment for every renderer. Values live in the chart spec. */
export const DEFAULT_EFFECTS = Object.freeze({ enabled: true, glow: 0.5, gradient: 0.6, shadow: 0.4 });

export function effectsOf(spec) {
  const value = { ...DEFAULT_EFFECTS, ...(spec?.effects || {}) };
  for (const key of ['glow', 'gradient', 'shadow']) {
    value[key] = Math.min(1, Math.max(0, Number(value[key]) || 0));
  }
  value.enabled = value.enabled !== false;
  return value;
}

/** The exported callbacks use these same plain functions, inlined by engines.js. */
export function effectRgb(color) {
  if (typeof color !== 'string') return null;
  const raw = color.trim().toLowerCase();
  if (raw[0] === '#') {
    const hex = raw.slice(1);
    if (![3, 4, 6, 8].includes(hex.length) || !/^[0-9a-f]+$/.test(hex)) return null;
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
      .concat(full.length === 8 ? +(parseInt(full.slice(6), 16) / 255).toFixed(4) : 1);
  }
  const match = raw.match(/^(rgba?|hsla?)\((.*)\)$/);
  if (!match) return null;
  const parts = match[2].replace(/,/g, ' ').replace(/\s*\/\s*/g, ' ').trim().split(/\s+/);
  if (parts.length < 3) return null;
  const alpha = parts[3] == null ? 1 : (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : Number(parts[3]));
  if (!Number.isFinite(alpha)) return null;
  if (match[1].startsWith('rgb')) {
    const rgb = parts.slice(0, 3).map((v) => v.endsWith('%') ? parseFloat(v) * 2.55 : Number(v));
    return rgb.every(Number.isFinite) ? [...rgb, Math.min(1, Math.max(0, alpha))] : null;
  }
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  if (![h, s, l].every(Number.isFinite)) return null;
  const a = s * Math.min(l, 1 - l);
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [channel(0), channel(8), channel(4), Math.min(1, Math.max(0, alpha))];
}

export function lighten(color, amount) {
  const rgb = effectRgb(color);
  if (!rgb) return color;
  const t = Math.min(1, Math.max(0, amount));
  return `rgba(${rgb.slice(0, 3).map((v) => Math.round(v + (255 - v) * t)).join(',')},${rgb[3]})`;
}

export function darken(color, amount) {
  const rgb = effectRgb(color);
  if (!rgb) return color;
  const t = Math.min(1, Math.max(0, amount));
  return `rgba(${rgb.slice(0, 3).map((v) => Math.round(v * (1 - t))).join(',')},${rgb[3]})`;
}

export function withAlpha(color, alpha) {
  const rgb = effectRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.slice(0, 3).map(Math.round).join(',')},${+(rgb[3] * Math.min(1, Math.max(0, alpha))).toFixed(4)})`;
}

export function effectTheme() {
  if (window.matchMedia && window.matchMedia('print').matches) return 0.12;
  const theme = document.documentElement.dataset.theme;
  const dark = theme === 'dark' || (theme !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return dark ? 1 : 0.32;
}

/** Scriptable Chart.js fill. Color stays tied to the edited dataset or slice. */
export function chartFill(context) {
  const ds = context.dataset;
  const raw = ds._ocFill;
  const color = typeof raw === 'function' ? raw(context)
    : Array.isArray(raw) ? raw[(context.dataIndex || 0) % raw.length] : raw;
  const fx = ds._ocEffects;
  if (!fx?.enabled || !fx.gradient || !effectRgb(color)) return color;
  const { chart, element } = context;
  const area = chart.chartArea;
  if (!area) return color;
  const strength = fx.gradient * (0.5 + effectTheme() * 0.5);
  const type = ds.type || chart.config.type;
  let gradient;
  if (['pie', 'doughnut', 'polarArea', 'radar', 'bubble', 'scatter'].includes(type) && element?.x != null) {
    const radius = Math.max(1, element.outerRadius || element.radius || element.options?.radius || 12);
    gradient = chart.ctx.createRadialGradient(element.x - radius * 0.2, element.y - radius * 0.2, 0, element.x, element.y, radius);
  } else if (chart.options.indexAxis === 'y' && element?.base != null) {
    gradient = chart.ctx.createLinearGradient(Math.min(element.x, element.base), 0, Math.max(element.x, element.base), 0);
  } else {
    const top = element?.base != null && element?.y != null ? Math.min(element.y, element.base)
      : element?.height ? element.y - element.height / 2 : area.top;
    const bottom = element?.base != null && element?.y != null ? Math.max(element.y, element.base)
      : element?.height ? element.y + element.height / 2 : area.bottom;
    if (bottom - top < 1) return color;
    gradient = chart.ctx.createLinearGradient(0, top, 0, bottom);
  }
  gradient.addColorStop(0, lighten(color, 0.36 * strength));
  gradient.addColorStop(1, type === 'line'
    ? withAlpha(darken(color, 0.22 * strength), 0.35)
    : darken(color, 0.22 * strength));
  return gradient;
}

/** Line strokes use the edited series color across the plotted extent. */
export function chartStroke(context) {
  const ds = context.dataset;
  const color = ds._ocStroke;
  const fx = ds._ocEffects;
  const area = context.chart.chartArea;
  if (!fx?.enabled || !fx.gradient || !area || !effectRgb(color)) return color;
  const strength = fx.gradient * (0.5 + effectTheme() * 0.5);
  const gradient = context.chart.ctx.createLinearGradient(area.left, area.top, area.right, area.bottom);
  gradient.addColorStop(0, lighten(color, 0.36 * strength));
  gradient.addColorStop(1, darken(color, 0.22 * strength));
  return gradient;
}

/** Only the dataset paint gets a shadow. Axes, grid, and labels stay crisp. */
export const chartGlowPlugin = {
  id: 'ocNeon',
  beforeDatasetDraw(chart, args) {
    const ds = chart.data.datasets[args.index];
    const fx = ds._ocEffects;
    const count = chart.data.datasets.reduce((n, d) => n + (d.data?.length || 0), 0);
    chart.ctx.save();
    if (!fx?.enabled) return;
    // Chart.js resolves scriptable colors before its first chartArea exists.
    // Refresh the paint after layout, using each mark's actual bounds.
    const meta = chart.getDatasetMeta(args.index);
    for (let i = 0; i < meta.data.length; i++) {
      const element = meta.data[i];
      if (ds._ocFill && chart.config.type !== 'matrix' && element.options) {
        const context = meta.controller.getContext(i);
        element.options.backgroundColor = chartFill({ ...context, chart, dataset: ds, element, dataIndex: i });
      }
    }
    if (ds._ocFill && chart.config.type !== 'matrix' && meta.dataset?.options) {
      meta.dataset.options.backgroundColor = chartFill({ chart, dataset: ds, element: meta.dataset });
    }
    if (ds._ocStroke && meta.dataset?.options) {
      meta.dataset.options.borderColor = chartStroke({ chart, dataset: ds });
    }
    if (count > 2000) return;
    const raw = ds._ocStroke || ds._ocGlowColor || ds._ocFill;
    const color = Array.isArray(raw) ? raw[0] : raw;
    if (!effectRgb(color)) return;
    const theme = effectTheme();
    const weight = chart.config.type === 'matrix' ? 0.12
      : ['sankey', 'treemap', 'boxplot'].includes(chart.config.type) ? 0.35 : 1;
    chart.ctx.shadowColor = withAlpha(color, Math.min(0.6, fx.glow * 1.1 * theme * weight));
    chart.ctx.shadowBlur = Math.min(16, fx.glow * 24 * theme * weight);
    chart.ctx.shadowOffsetY = Math.min(4, fx.shadow * 5 * theme);
  },
  afterDatasetDraw(chart) { chart.ctx.restore(); },
};

/** Built configs are the common point for all 39 Chart.js definitions. */
export function chartJsEffects(config, spec) {
  const fx = effectsOf(spec);
  if (!fx.enabled) return config;
  for (const ds of config.data.datasets || []) {
    ds._ocEffects = fx;
    ds._ocGlowColor = spec.colors?.[0] || spec.color || spec.series?.[0]?.color || spec.upColor;
    if (ds.backgroundColor != null) {
      ds._ocFill = ds.backgroundColor;
      // Matrix/heatmap color is the value encoding, so leave its ramp intact.
      if (config.type !== 'matrix' && config.type !== 'heatmap') ds.backgroundColor = chartFill;
    }
    if (typeof ds.borderColor === 'string' && (ds.type || config.type) === 'line') {
      if (ds.fill === false && !ds.borderDash?.length) {
        ds.fill = true;
        ds._ocFill = withAlpha(ds.borderColor, 0.12);
        ds.backgroundColor = chartFill;
      }
      ds._ocStroke = ds.borderColor;
      ds._ocEffects = fx;
      ds.borderColor = chartStroke;
    }
  }
  config.plugins = [...(config.plugins || []), chartGlowPlugin];
  return config;
}

/** Paint-time Canvas wrapper: paths and hit boxes remain exactly as authored. */
export function canvasEffects(ctx, spec, chartId) {
  const fx = effectsOf(spec);
  if (!fx.enabled) return ctx;
  const palette = new Set();
  let maxMarks = 0;
  const collect = (value, key = '') => {
    if (Array.isArray(value)) {
      maxMarks = Math.max(maxMarks, value.length);
      value.forEach((item) => collect(item, key));
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([name, item]) => collect(item, name));
    } else if (typeof value === 'string' && !/text|grid|axis|background/i.test(key)) {
      const rgb = effectRgb(value);
      if (rgb) palette.add(rgb.slice(0, 3).map(Math.round).join(','));
    }
  };
  collect(spec);
  const dense = maxMarks > 2000;
  const heat = /heatmap|matrix|hexbin|calendar/i.test(chartId);
  const candle = /candlestick|ohlc|renko|kagi|point-figure/i.test(chartId);
  let box = null;
  const include = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!box) box = [x, y, x, y];
    else { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); }
  };
  const paint = (method, args, bounds) => {
    const color = ctx[method.startsWith('stroke') ? 'strokeStyle' : 'fillStyle'];
    const rgb = effectRgb(color);
    const key = rgb?.slice(0, 3).map(Math.round).join(',');
    if (!key || !palette.has(key) || !bounds) return ctx[method](...args);
    const [x0, y0, x1, y1] = bounds;
    const wide = x1 - x0;
    const tall = y1 - y0;
    if (wide < 1.5 && tall < 1.5) return ctx[method](...args);
    const theme = effectTheme();
    ctx.save();
    if (!heat && fx.gradient && wide > 2 && tall > 2) {
      const gradient = ctx.createLinearGradient(x0, y0, x0, y1);
      const strength = fx.gradient * (0.5 + theme * 0.5);
      gradient.addColorStop(0, lighten(color, 0.36 * strength));
      gradient.addColorStop(1, darken(color, 0.22 * strength));
      ctx[method.startsWith('stroke') ? 'strokeStyle' : 'fillStyle'] = gradient;
    }
    if (!dense && wide > 2 && tall > 2) {
      const weight = heat ? 0.12 : candle ? 0.35 : 1;
      ctx.shadowColor = withAlpha(color, Math.min(0.6, fx.glow * 1.1 * theme * weight));
      ctx.shadowBlur = Math.min(16, fx.glow * 24 * theme * weight);
      ctx.shadowOffsetY = Math.min(4, fx.shadow * 5 * theme * weight);
    }
    const result = ctx[method](...args);
    ctx.restore();
    return result;
  };
  return new Proxy(ctx, {
    get(target, name) {
      if (name === 'beginPath') return (...args) => { box = null; return target.beginPath(...args); };
      if (name === 'moveTo' || name === 'lineTo') return (x, y) => { include(x, y); return target[name](x, y); };
      if (name === 'rect' || name === 'roundRect') return (x, y, w, h, ...rest) => { include(x, y); include(x + w, y + h); return target[name](x, y, w, h, ...rest); };
      if (name === 'arc') return (x, y, r, ...rest) => { include(x - r, y - r); include(x + r, y + r); return target.arc(x, y, r, ...rest); };
      if (name === 'ellipse') return (x, y, rx, ry, ...rest) => { include(x - rx, y - ry); include(x + rx, y + ry); return target.ellipse(x, y, rx, ry, ...rest); };
      if (name === 'quadraticCurveTo') return (cx, cy, x, y) => { include(cx, cy); include(x, y); return target.quadraticCurveTo(cx, cy, x, y); };
      if (name === 'bezierCurveTo') return (x1, y1, x2, y2, x, y) => { include(x1, y1); include(x2, y2); include(x, y); return target.bezierCurveTo(x1, y1, x2, y2, x, y); };
      if (name === 'fill' || name === 'stroke') return (...args) => paint(name, args, box);
      if (name === 'fillRect' || name === 'strokeRect') return (x, y, w, h) => paint(name, [x, y, w, h], [x, y, x + w, y + h]);
      const value = target[name];
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, name, value) { target[name] = value; return true; },
  });
}
