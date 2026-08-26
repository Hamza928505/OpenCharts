/**
 * dataio.js — parse pasted tabular text into the shapes chart specs use.
 *
 * The premise of OpenCharts is "bring your data, take the code", so every
 * chart needs a way in. Rather than 60-odd bespoke editors, charts declare a
 * `data` descriptor naming the shape they want, and this module turns whatever
 * the user pasted into that shape.
 *
 * Delimiters are sniffed rather than configured: people paste from Excel (tabs),
 * from a CSV file (commas), or type by hand (spaces). Asking them which is a
 * question they should never have to answer.
 */

/** Split a line respecting double-quoted fields. */
function splitLine(line, delim) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Guess the delimiter from the first few lines: whichever candidate appears
 * the most consistently per line wins.
 */
function sniffDelimiter(lines) {
  const candidates = ['\t', ',', ';', '|'];
  let best = null;
  let bestScore = 0;
  for (const d of candidates) {
    const counts = lines.slice(0, 8).map((l) => splitLine(l, d).length);
    if (!counts.length) continue;
    const first = counts[0];
    if (first < 2) continue;
    const consistent = counts.every((c) => c === first);
    const score = (consistent ? 100 : 0) + first;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  // Fall back to whitespace for hand-typed input.
  return best || /\s{2,}|\s/.test(lines[0] || '') ? (best || /\s+/) : ',';
}

/** True when every non-empty cell parses as a number. */
const allNumeric = (cells) =>
  cells.length > 0 && cells.every((c) => c === '' || Number.isFinite(Number(c)));

const num = (v, fallback = 0) => {
  if (v == null || v === '') return fallback;
  // Tolerate 1,234.5 / 1 234,5 / $1,234 / 42% — people paste formatted numbers.
  const cleaned = String(v).replace(/[^0-9eE+\-.,]/g, '');
  const dot = cleaned.lastIndexOf('.');
  const comma = cleaned.lastIndexOf(',');
  let normalised = cleaned;
  if (comma > dot) normalised = cleaned.replace(/\./g, '').replace(',', '.');
  else normalised = cleaned.replace(/,/g, '');
  const n = Number(normalised);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Parse pasted text into { headers, rows }.
 *
 * A header row is detected rather than assumed: if the first row is
 * non-numeric where later rows are numeric, it is treated as headers.
 *
 * @returns {{ headers: string[], rows: string[][], hadHeader: boolean }}
 */
export function parseTable(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length);

  if (!lines.length) return { headers: [], rows: [], hadHeader: false };

  const delim = sniffDelimiter(lines);
  const grid = lines.map((l) => (delim instanceof RegExp ? l.split(delim) : splitLine(l, delim)))
    .map((cells) => cells.map((c) => c.trim()));

  const width = Math.max(...grid.map((r) => r.length));
  grid.forEach((r) => { while (r.length < width) r.push(''); });

  // Header detection: first row's trailing cells are text while the second
  // row's are numbers.
  let hadHeader = false;
  if (grid.length > 1) {
    const firstTail = grid[0].slice(1);
    const secondTail = grid[1].slice(1);
    if (firstTail.length && !allNumeric(firstTail) && allNumeric(secondTail)) hadHeader = true;
  }

  const headers = hadHeader
    ? grid[0].map((h, i) => h || `Column ${i + 1}`)
    : grid[0].map((_, i) => (i === 0 ? 'Label' : `Series ${i}`));

  return { headers, rows: hadHeader ? grid.slice(1) : grid, hadHeader };
}

/** Render a { headers, rows } table back to CSV, for the editor's initial value. */
export function toCSV(headers, rows) {
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const out = [];
  if (headers && headers.length) out.push(headers.map(esc).join(','));
  rows.forEach((r) => out.push(r.map(esc).join(',')));
  return out.join('\n');
}

/* ── Shape adapters ──────────────────────────────────────────────────────────
 * Each takes the parsed table and returns a patch to merge into the spec.
 * They are deliberately forgiving: a user who pastes the wrong shape should
 * get a sensible chart, not an exception.
 * ───────────────────────────────────────────────────────────────────────── */

const PALETTE_FALLBACK = [
  '#6C63D8', '#16916A', '#CE5229', '#2F76C9',
  '#A5720F', '#C13F69', '#5A6270', '#7A9A2E',
];
const colourAt = (i, existing) => (existing && existing[i] && existing[i].color)
  || PALETTE_FALLBACK[i % PALETTE_FALLBACK.length];

export const SHAPES = {
  /**
   * label + one column per series → { labels, series:[{label,color,data}] }
   * The most common shape by far.
   */
  labelSeries(table, spec, opts = {}) {
    const { headers, rows } = table;
    if (!rows.length) return null;
    const labels = rows.map((r) => r[0] || '');
    const seriesCount = Math.max(1, Math.min(headers.length - 1, opts.maxSeries || 8));
    const prev = spec[opts.key || 'series'] || [];
    const series = [];
    for (let c = 1; c <= seriesCount; c++) {
      series.push({
        label: headers[c] || `Series ${c}`,
        color: colourAt(c - 1, prev),
        data: rows.map((r) => num(r[c])),
      });
    }
    return { [opts.labelsKey || 'labels']: labels, [opts.key || 'series']: series };
  },

  /**
   * The transpose of labelSeries: each *row* is a series, each further column
   * a point along it.
   *
   * Sparklines, horizon bands and Likert scales are all naturally written this
   * way — one line per metric — and forcing people to transpose their
   * spreadsheet first would be a poor trade.
   */
  rowSeries(table, spec, opts = {}) {
    const { headers, rows } = table;
    if (!rows.length) return null;
    const key = opts.key || 'series';
    const prev = spec[key] || [];
    const series = rows.map((r, i) => {
      const existing = prev.find((p) => p.label === r[0]) || prev[i] || {};
      return {
        ...existing,
        label: r[0] || `Series ${i + 1}`,
        color: colourAt(i, prev),
        data: r.slice(1).map((c) => num(c)),
      };
    });
    const patch = { [key]: series };
    // Column headers become the shared category labels.
    if (opts.labelsKey !== false) patch[opts.labelsKey || 'labels'] = headers.slice(1);
    return patch;
  },

  /** label + single value column → { labels, values } */
  labelValue(table, spec, opts = {}) {
    const { rows } = table;
    if (!rows.length) return null;
    return {
      [opts.labelsKey || 'labels']: rows.map((r) => r[0] || ''),
      [opts.valuesKey || 'values']: rows.map((r) => num(r[1])),
    };
  },

  /** label + value → an array of {label, value, color} items. */
  items(table, spec, opts = {}) {
    const { rows } = table;
    if (!rows.length) return null;
    const key = opts.key || 'items';
    const prev = spec[key] || [];
    const extra = opts.fields || [];
    return {
      [key]: rows.map((r, i) => {
        const item = {
          label: r[0] || `Item ${i + 1}`,
          color: colourAt(i, prev),
        };
        // First numeric column is the primary value; any declared extra
        // fields consume the columns after it.
        item[opts.valueField || 'value'] = num(r[1]);
        extra.forEach((f, k) => { item[f] = num(r[2 + k]); });
        return item;
      }),
    };
  },

  /** label + two numeric columns → paired rows (dumbbell, span, spine, slope). */
  pairs(table, spec, opts = {}) {
    const { headers, rows } = table;
    if (!rows.length) return null;
    const key = opts.key || 'rows';
    const prev = spec[key] || [];
    const [a, b] = opts.fields || ['start', 'end'];
    const patch = {
      [key]: rows.map((r, i) => ({
        label: r[0] || `Row ${i + 1}`,
        [a]: num(r[1]),
        [b]: num(r[2]),
        color: colourAt(i, prev),
      })),
    };
    if (opts.headerLabels) {
      const [ha, hb] = opts.headerLabels;
      if (headers[1]) patch[ha] = headers[1];
      if (headers[2]) patch[hb] = headers[2];
    }
    return patch;
  },

  /** A flat numeric list → raw observations for the distribution charts. */
  observations(table, spec, opts = {}) {
    const { headers, rows } = table;
    if (!rows.length) return null;
    // Two layouts are both common: one column per group (wide), or a
    // group/value pair per row (long). Detect which.
    const wide = rows.every((r) => allNumeric(r.filter((c) => c !== '')));
    const key = opts.key || 'groups';
    const prev = spec[key] || [];

    if (wide) {
      const cols = Math.max(...rows.map((r) => r.length));
      const groups = [];
      for (let c = 0; c < cols; c++) {
        const values = rows.map((r) => r[c]).filter((v) => v !== '' && v != null).map((v) => num(v));
        if (!values.length) continue;
        groups.push({
          label: (table.hadHeader && headers[c]) || `Group ${c + 1}`,
          color: colourAt(groups.length, prev),
          values,
        });
      }
      return groups.length ? { [key]: groups, dataMode: 'observations' } : null;
    }

    // Long form: first column names the group, second holds the value.
    const byGroup = new Map();
    rows.forEach((r) => {
      const g = r[0] || 'Group 1';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(num(r[1]));
    });
    const groups = [...byGroup.entries()].map(([label, values], i) => ({
      label, values, color: colourAt(i, prev),
    }));
    return groups.length ? { [key]: groups, dataMode: 'observations' } : null;
  },

  /** from,to,value → flow links (sankey, flow map, parallel sets). */
  links(table, spec, opts = {}) {
    const { rows } = table;
    if (!rows.length) return null;
    const key = opts.key || 'flows';
    const links = rows
      .filter((r) => r[0] && r[1])
      .map((r) => ({
        [opts.fromField || 'from']: r[0],
        [opts.toField || 'to']: r[1],
        [opts.valueField || 'flow']: num(r[2], 1),
      }));
    if (!links.length) return null;

    const patch = { [key]: links };
    // Refresh the node list so colours and legends follow the new links.
    if (opts.nodesKey) {
      const seen = [];
      links.forEach((l) => {
        [l[opts.fromField || 'from'], l[opts.toField || 'to']].forEach((n) => {
          if (!seen.includes(n)) seen.push(n);
        });
      });
      patch[opts.nodesKey] = seen;
      patch[opts.colorsKey || 'colors'] = seen.map((_, i) => PALETTE_FALLBACK[i % PALETTE_FALLBACK.length]);
    }
    return patch;
  },

  /** source,target → graph edges, deriving the node list from the edges. */
  edges(table, spec, opts = {}) {
    const { rows } = table;
    if (!rows.length) return null;
    const links = rows.filter((r) => r[0] && r[1]).map((r) => ({ source: r[0], target: r[1] }));
    if (!links.length) return null;

    const seen = [];
    links.forEach((l) => {
      [l.source, l.target].forEach((n) => { if (!seen.includes(n)) seen.push(n); });
    });
    // Preserve any group assignment the user already had for a known node.
    const prev = new Map((spec.nodes || []).map((n) => [n.id, n.group]));
    return {
      links,
      nodes: seen.map((id) => ({ id, group: prev.get(id) ?? 0 })),
    };
  },

  /**
   * Indented text, or `parent > child > leaf,value` paths, → a nested tree.
   * Both are far friendlier than asking anyone to type JSON.
   */
  tree(table, spec, opts = {}) {
    const { rows } = table;
    if (!rows.length) return null;
    const root = { name: opts.rootName || 'All', children: [] };

    rows.forEach((r) => {
      const first = String(r[0] || '');
      // A path in one cell, or one level per column.
      const path = first.includes('>')
        ? first.split('>').map((s) => s.trim()).filter(Boolean)
        : r.slice(0, -1).map((s) => String(s).trim()).filter(Boolean);
      const value = num(r[r.length - 1], 0);
      if (!path.length) return;

      let node = root;
      path.forEach((name, depth) => {
        node.children = node.children || [];
        let next = node.children.find((c) => c.name === name);
        if (!next) { next = { name }; node.children.push(next); }
        node = next;
        if (depth === path.length - 1) node.value = value;
      });
    });

    if (!root.children.length) return null;
    const patch = { [opts.key || 'tree']: root };
    if (opts.groupsKey) {
      patch[opts.groupsKey] = root.children.map((c) => c.name);
      patch[opts.colorsKey || 'colors'] = root.children.map((_, i) => PALETTE_FALLBACK[i % PALETTE_FALLBACK.length]);
    }
    return patch;
  },

  /**
   * group,x,y → grouped point clouds.
   *
   * Charts store the points under different field names (`points` for the
   * scatter families, `data` for the engine's), so the descriptor says which.
   */
  xyGroups(table, spec, opts = {}) {
    const { rows } = table;
    if (!rows.length) return null;
    const key = opts.key || 'groups';
    const prev = spec[key] || [];

    // Two numeric columns and no group name is still valid — one group.
    const grouped = new Map();
    rows.forEach((r) => {
      const named = r.length >= 3 && !Number.isFinite(Number(r[0]));
      const g = named ? (r[0] || 'Group 1') : 'Group 1';
      const x = num(named ? r[1] : r[0]);
      const y = num(named ? r[2] : r[1]);
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g).push({ x, y });
    });
    if (!grouped.size) return null;

    const field = opts.pointField || 'points';
    const groups = [...grouped.entries()].map(([label, pts], i) => {
      const existing = prev.find((p) => p.label === label) || prev[i] || {};
      const base = { ...existing, label, color: colourAt(i, prev) };
      // The engine scatter takes [x, y] pairs rather than objects.
      base[field] = opts.asPairs ? pts.map((p) => [p.x, p.y]) : pts;
      return base;
    });
    return { [key]: groups };
  },

  /** name,lon,lat,value → geographic points. */
  places(table, spec, opts = {}) {
    const { rows } = table;
    if (!rows.length) return null;
    const places = rows
      .filter((r) => r[0])
      .map((r) => ({
        name: r[0],
        lon: num(r[1]),
        lat: num(r[2]),
        value: num(r[3], 1),
      }))
      .filter((p) => Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
    return places.length ? { [opts.key || 'places']: places } : null;
  },

  /** country,value → a lookup the maps colour by. */
  regions(table, spec, opts = {}) {
    const { rows } = table;
    if (!rows.length) return null;
    const values = {};
    rows.forEach((r) => { if (r[0]) values[String(r[0]).trim()] = num(r[1]); });
    return Object.keys(values).length
      ? { [opts.key || 'regionValues']: values, dataMode: 'regions' }
      : null;
  },

  /** date/open/high/low/close → OHLC bars for the finance charts. */
  ohlc(table, spec, opts = {}) {
    const { rows } = table;
    if (!rows.length) return null;
    const bars = rows.map((r) => {
      // Accept either date,o,h,l,c or just o,h,l,c.
      const off = Number.isFinite(Number(r[0])) && r.length < 5 ? 0 : 1;
      const o = num(r[off]);
      const h = num(r[off + 1], o);
      const l = num(r[off + 2], o);
      const c = num(r[off + 3], o);
      return { o, h: Math.max(o, h, c), l: Math.min(o, l, c), c };
    }).filter((b) => Number.isFinite(b.o) && b.o !== 0);
    return bars.length ? { bars, dataMode: 'bars' } : null;
  },

  /** row,column,value → a matrix of cells. */
  matrix(table, spec, opts = {}) {
    const { headers, rows } = table;
    if (!rows.length) return null;
    // Wide form: first column is the row label, headers are column labels.
    const rowLabels = rows.map((r) => r[0] || '');
    const colLabels = headers.slice(1);
    const cells = [];
    rows.forEach((r, y) => {
      for (let x = 1; x < r.length; x++) {
        if (r[x] === '') continue;
        cells.push({ x: x - 1, y, v: num(r[x]) });
      }
    });
    return cells.length
      ? { [opts.rowsKey || 'rows']: rowLabels, [opts.colsKey || 'cols']: colLabels, cells, dataMode: 'cells' }
      : null;
  },
};

/**
 * Apply a chart's declared data descriptor to pasted text.
 *
 * @param {object} def   chart definition (reads def.data)
 * @param {object} spec  live spec, mutated in place
 * @param {string} text  what the user pasted
 * @returns {{ ok: boolean, message: string }}
 */
export function applyData(def, spec, text) {
  const desc = def.data;
  if (!desc) return { ok: false, message: 'This chart has no data editor.' };

  const table = parseTable(text);
  if (!table.rows.length) return { ok: false, message: 'Nothing to read — paste some rows first.' };

  const shape = SHAPES[desc.shape];
  if (!shape) return { ok: false, message: `Unknown data shape "${desc.shape}".` };

  let patch;
  try {
    patch = shape(table, spec, desc);
  } catch (err) {
    return { ok: false, message: 'Could not read that: ' + err.message };
  }
  if (!patch) {
    return { ok: false, message: desc.hint || 'That does not look like the expected columns.' };
  }

  Object.assign(spec, patch);
  if (typeof def.onData === 'function') def.onData(spec, table);

  const n = table.rows.length;
  return { ok: true, message: `Loaded ${n} row${n === 1 ? '' : 's'}.` };
}

export { num };
