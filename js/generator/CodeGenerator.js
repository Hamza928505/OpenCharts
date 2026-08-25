/**
 * CodeGenerator.js
 * Serialises a chart configuration into embeddable, production-ready code.
 *
 * Output formats:
 *   - 'html'     Full standalone HTML file (open in browser with no dependencies)
 *   - 'snippet'  Minimal embed: <canvas> + <script> tags only
 *   - 'js'       JavaScript only (assumes canvas already exists)
 *   - 'json'     Pure data/config blob for save/load
 *
 * Usage:
 *   const gen = new CodeGenerator({ chartType: 'line', data, config });
 *   const html = gen.generate('html');
 *   const js   = gen.generate('js');
 */

export class CodeGenerator {

  /**
   * @param {Object} opts
   * @param {string}  opts.chartType   'line' | 'bar' | 'pie' | 'scatter'
   * @param {Object}  opts.data        Chart data { labels, datasets }
   * @param {Object}  opts.config      Chart config (merged with defaults)
   * @param {string}  [opts.canvasId]  Id for the <canvas> element (default 'myChart')
   * @param {string}  [opts.title]     Page title for standalone HTML output
   */
  constructor({ chartType, data, config = {}, canvasId = 'myChart', title = 'Chart' }) {
    this._type     = chartType;
    this._data     = data;
    this._config   = config;
    this._id       = sanitiseId(canvasId);
    this._title    = title;
  }

  /* ─────────────────────────────────────────────
   * Public API
   * ───────────────────────────────────────────── */

  /**
   * Generate code in the requested format.
   *
   * @param {'html'|'snippet'|'js'|'json'} format
   * @returns {string}
   */
  generate(format = 'snippet') {
    switch (format) {
      case 'html':    return this._generateHTML();
      case 'snippet': return this._generateSnippet();
      case 'js':      return this._generateJS();
      case 'json':    return this._generateJSON();
      default:
        throw new Error(`[CodeGenerator] Unknown format: "${format}"`);
    }
  }

  /**
   * Serialise the current chart state to a JSON string
   * that can be restored later via CodeGenerator.fromJSON().
   */
  toSaveState() {
    return JSON.stringify({
      _v:       1,           // schema version
      chartType: this._type,
      data:     this._data,
      config:   this._config,
      canvasId: this._id,
      title:    this._title,
    }, null, 2);
  }

  /**
   * Restore a CodeGenerator from a previously saved state string.
   * @param {string|Object} saved
   * @returns {CodeGenerator}
   */
  static fromJSON(saved) {
    const obj = typeof saved === 'string' ? JSON.parse(saved) : saved;
    return new CodeGenerator({
      chartType: obj.chartType,
      data:      obj.data,
      config:    obj.config,
      canvasId:  obj.canvasId,
      title:     obj.title,
    });
  }

  /* ─────────────────────────────────────────────
   * Format generators
   * ───────────────────────────────────────────── */

  _generateHTML() {
    const js = this._generateJS();
    return [
      `<!DOCTYPE html>`,
      `<html lang="en">`,
      `<head>`,
      `  <meta charset="UTF-8"/>`,
      `  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>`,
      `  <title>${escHtml(this._title)}</title>`,
      `  <style>`,
      `    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`,
      `    body { font-family: 'DM Sans', system-ui, sans-serif; background: #0f0f17; color: #e8e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }`,
      `    .chart-wrap { width: 100%; max-width: 900px; background: #1a1a28; border-radius: 16px; padding: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }`,
      `    canvas { width: 100%; height: 360px; display: block; }`,
      `  </style>`,
      `</head>`,
      `<body>`,
      `  <div class="chart-wrap">`,
      `    <canvas id="${this._id}"></canvas>`,
      `  </div>`,
      ``,
      `  <!-- OpenCharts engine (replace with your hosted path) -->`,
      `  <script type="module">`,
      `    ${indent(js, 4)}`,
      `  </script>`,
      `</body>`,
      `</html>`,
    ].join('\n');
  }

  _generateSnippet() {
    const js = this._generateJS();
    return [
      `<canvas id="${this._id}" style="width:100%;height:360px"></canvas>`,
      ``,
      `<script type="module">`,
      indent(js, 2),
      `</script>`,
    ].join('\n');
  }

  _generateJS() {
    const classMap = {
      line:    'LineChart',
      bar:     'BarChart',
      pie:     'PieChart',
      scatter: 'ScatterChart',
    };
    const className = classMap[this._type] ?? 'LineChart';
    const importPath = `./js/charts/${className}.js`;

    const dataStr   = JSON.stringify(this._cleanData(),   null, 4);
    const configStr = JSON.stringify(this._cleanConfig(), null, 4);

    return [
      `import { ${className} } from '${importPath}';`,
      ``,
      `const data = ${dataStr};`,
      ``,
      `const config = ${configStr};`,
      ``,
      `const chart = new ${className}('${this._id}', { data, ...config });`,
      ``,
      `// Optional: enable interactive features`,
      `chart.enableTooltip();`,
    ].join('\n');
  }

  _generateJSON() {
    return JSON.stringify({
      chartType: this._type,
      data:      this._cleanData(),
      config:    this._cleanConfig(),
    }, null, 2);
  }

  /* ─────────────────────────────────────────────
   * Config / data cleaning
   * Strip internal engine properties before export
   * ───────────────────────────────────────────── */

  _cleanData() {
    return {
      labels:   this._data.labels ?? [],
      datasets: (this._data.datasets ?? []).map((ds) => ({
        label: ds.label,
        data:  ds.data,
        color: ds.color ?? ds.borderColor,
        ...(ds.showArea != null ? { showArea: ds.showArea } : {}),
      })),
    };
  }

  _cleanConfig() {
    // Strip engine internals, keep user-facing config only
    const { data: _data, ...rest } = this._config;  // eslint-disable-line no-unused-vars
    const clean = {};
    const keep = [
      'smooth', 'tension', 'stepped', 'showArea', 'areaAlpha',
      'pointRadius', 'lineWidth', 'yAxis', 'xAxis',
      'animation', 'padding', 'grid', 'tooltip', 'legend',
    ];
    for (const key of keep) {
      if (rest[key] !== undefined) clean[key] = rest[key];
    }
    return clean;
  }
}

/* ─────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────── */

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function sanitiseId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_') || 'myChart';
}

function indent(str, spaces) {
  const pad = ' '.repeat(spaces);
  return str.split('\n').map((l) => (l.trim() ? pad + l : l)).join('\n');
}