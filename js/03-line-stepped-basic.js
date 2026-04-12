import * as U from './utils.js';

// ── State ─────────────────────────────────────────
let lineColor   = '#4DABF7';
let dotColor    = '#4DABF7';
let stepped     = 'before';
let pointRadius = 5;
let activeTab   = 'html';

const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const data   = [29,29,29,39,39,39,49,49,59,59,69,79];

// ── Chart ─────────────────────────────────────────
const chart = new Chart('chart', {
  type: 'line',
  data: {
    labels,
    datasets: [{
      label: 'Price ($)',
      data,
      borderColor: lineColor,
      backgroundColor: lineColor + '26',
      pointBackgroundColor: dotColor,
      pointBorderColor: dotColor,
      stepped,
      fill: false,
      pointRadius,
      borderWidth: 2.5,
    }]
  },
  options: U.baseOpts({
    scales: {
      x: U.xAxis(),
      y: U.yAxis({ ticks: { ...U.TICK, callback: v => '$' + v }, min: 0, max: 100 }),
    }
  })
});

// ── Code generator ────────────────────────────────
function getCode() {
  return {
    html: `<canvas id="lineChart"></canvas>\n\n<!-- Include Chart.js -->\n<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>`,
    js: [
      `const ctx = document.getElementById('lineChart');`,
      ``,
      `new Chart(ctx, {`,
      `  type: 'line',`,
      `  data: {`,
      `    labels: ${JSON.stringify(labels)},`,
      `    datasets: [{`,
      `      label: 'Price ($)',`,
      `      data: ${JSON.stringify(data)},`,
      `      borderColor: '${lineColor}',`,
      `      backgroundColor: '${lineColor}26',`,
      `      pointBackgroundColor: '${dotColor}',`,
      `      pointBorderColor: '${dotColor}',`,
      `      stepped: '${stepped}',`,
      `      fill: false,`,
      `      pointRadius: ${pointRadius},`,
      `      borderWidth: 2.5`,
      `    }]`,
      `  },`,
      `  options: {`,
      `    scales: {`,
      `      y: { min: 0, max: 100, ticks: { callback: v => '$' + v } }`,
      `    }`,
      `  }`,
      `});`,
    ].join('\n'),
    css: `#lineChart {\n  width: 100%;\n  height: 400px;\n  background: transparent;\n}`,
  };
}

// ── Gutter (line numbers) ─────────────────────────
function updateGutter(text) {
  const gutter = document.getElementById('lc-gutter');
  if (!gutter) return;
  const count = text.split('\n').length;
  gutter.innerHTML = Array.from({ length: count }, (_, i) => i + 1).join('<br>');
}

// ── Code output ───────────────────────────────────
function updateCodeOutput() {
  const text = getCode()[activeTab];
  const area = document.getElementById('code-display');
  if (area) area.value = text;
  updateGutter(text);
}

// ── Color helper ──────────────────────────────────
function syncColorUI(swatchId, hexId, color) {
  const swatch = document.getElementById(swatchId);
  const hex    = document.getElementById(hexId);
  if (swatch) swatch.style.background = color;
  if (hex)    hex.textContent = color.toUpperCase();
}

// Init color UI
syncColorUI('line-swatch', 'line-hex', lineColor);
syncColorUI('dot-swatch',  'dot-hex',  dotColor);

// ── Sync step-related UI ──────────────────────────
function syncStepUI() {
  const chipStep = document.getElementById('chip-step');
  const metaStep = document.getElementById('meta-step');
  if (chipStep) chipStep.textContent = stepped;
  if (metaStep) metaStep.textContent = stepped;
}

// ── Listeners ─────────────────────────────────────

// Line color
document.getElementById('cfg-line-color').addEventListener('input', e => {
  lineColor = e.target.value;
  syncColorUI('line-swatch', 'line-hex', lineColor);
  chart.data.datasets[0].borderColor     = lineColor;
  chart.data.datasets[0].backgroundColor = lineColor + '26';
  chart.update();
  updateCodeOutput();
});

// Dot color
document.getElementById('cfg-dot-color').addEventListener('input', e => {
  dotColor = e.target.value;
  syncColorUI('dot-swatch', 'dot-hex', dotColor);
  chart.data.datasets[0].pointBackgroundColor = dotColor;
  chart.data.datasets[0].pointBorderColor     = dotColor;
  chart.update();
  updateCodeOutput();
});

// Step mode buttons
document.querySelectorAll('.lc-seg[data-step]').forEach(btn => {
  btn.addEventListener('click', e => {
    stepped = e.currentTarget.dataset.step;
    chart.data.datasets[0].stepped = stepped;
    chart.update();
    document.querySelectorAll('.lc-seg[data-step]').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    syncStepUI();
    updateCodeOutput();
  });
});

// Points toggle
document.getElementById('btn-pts').addEventListener('click', e => {
  const btn    = e.currentTarget;
  const active = btn.classList.toggle('active');
  pointRadius  = active ? 5 : 0;
  chart.data.datasets[0].pointRadius = pointRadius;
  chart.update();
  const lbl = btn.querySelector('.lc-toggle-text');
  if (lbl) lbl.textContent = active ? 'Hide Points' : 'Show Points';
  updateCodeOutput();
});

// Code tabs
document.querySelectorAll('.lc-tab').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.lc-tab').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    activeTab = e.currentTarget.getAttribute('data-tab');
    updateCodeOutput();
  });
});

// ── Copy with feedback ────────────────────────────
window.copyActiveCode = () => {
  const area  = document.getElementById('code-display');
  const btn   = document.querySelector('.lc-copy-btn');
  const icon  = document.getElementById('copy-icon');
  const label = document.getElementById('copy-label');
  if (!area) return;

  area.select();
  document.execCommand('copy');

  if (btn)   btn.classList.add('copied');
  if (icon)  icon.className   = 'bi bi-check2';
  if (label) label.textContent = 'Copied!';

  setTimeout(() => {
    if (btn)   btn.classList.remove('copied');
    if (icon)  icon.className   = 'bi bi-clipboard';
    if (label) label.textContent = 'Copy';
  }, 2000);
};

// ── Init ──────────────────────────────────────────
syncStepUI();
updateCodeOutput();