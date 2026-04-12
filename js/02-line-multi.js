import * as U from './utils.js';

// ── Palette for auto-assigning new series colors ──
const PALETTE = [
  '#7F77DD', // purple  (default first)
  '#38D9A9', // teal
  '#FF6B6B', // coral
  '#4DABF7', // blue
  '#FFB347', // amber
  '#A9E34B', // lime
  '#DA77F2', // violet
  '#FF8CC8', // pink
];

// ── Global settings ───────────────────────────────
let tension     = 0.4;
let pointRadius = 5;
let activeTab   = 'html';
let nextId      = 0; // unique id per series

// ── Dataset registry ──────────────────────────────
// Each entry: { id, label, lineColor, dotColor, data }
const datasets = [];

// ── Labels ────────────────────────────────────────
const labels = U.MO3;

// ── Default data + randomizer ─────────────────────
const DEFAULT_DATA = [185, 210, 198, 240, 275, 310, 295, 330, 285, 320, 355, 410];

function randomData() {
  const base = 100 + Math.random() * 200;
  const trend = 50 + Math.random() * 150;
  return Array.from({ length: 12 }, (_, i) =>
    Math.round(base + (trend * i / 11) + (Math.random() - 0.4) * 60)
  );
}

// ── Chart ─────────────────────────────────────────
const chart = new Chart('chart', {
  type: 'line',
  data: { labels, datasets: [] },
  options: U.baseOpts({
    scales: {
      x: U.xAxis(),
      y: U.yAxis({ ticks: { ...U.TICK, callback: v => '$' + v + 'K' } })
    }
  })
});

// ── Add a series (to state + chart + DOM) ─────────
function addSeries({ label, lineColor, dotColor, data } = {}) {
  const id        = nextId++;
  const palColor  = PALETTE[datasets.length % PALETTE.length];
  const lColor    = lineColor || palColor;
  const dColor    = dotColor  || lColor;
  const seriesData = data || (datasets.length === 0 ? DEFAULT_DATA : randomData());
  const seriesLabel = label || (datasets.length === 0 ? 'Revenue' : `Series ${datasets.length + 1}`);

  datasets.push({ id, label: seriesLabel, lineColor: lColor, dotColor: dColor, data: seriesData });

  // Push into chart
  chart.data.datasets.push({
    label: seriesLabel,
    data: seriesData,
    borderColor: lColor,
    backgroundColor: 'transparent',
    pointBackgroundColor: dColor,
    pointBorderColor: dColor,
    fill: false,
    tension,
    pointRadius,
    borderWidth: 2.5,
  });
  chart.update();

  // Render card for this series
  renderSeriesCard(datasets[datasets.length - 1]);
  syncMeta();
  updateCodeOutput();
}

// ── Remove a series ───────────────────────────────
function removeSeries(id) {
  if (datasets.length <= 1) return; // always keep at least one

  const idx = datasets.findIndex(d => d.id === id);
  if (idx === -1) return;

  datasets.splice(idx, 1);
  chart.data.datasets.splice(idx, 1);
  chart.update();

  // Remove DOM card
  const card = document.querySelector(`.lc-sc[data-id="${id}"]`);
  if (card) {
    card.style.animation = 'sc-out .18s ease forwards';
    setTimeout(() => card.remove(), 180);
  }

  syncMeta();
  updateCodeOutput();
  // re-enable/disable all remove buttons
  setTimeout(syncRemoveButtons, 200);
}

// ── Render one series card into the DOM ───────────
function renderSeriesCard({ id, label, lineColor, dotColor }) {
  const list = document.getElementById('series-list');
  if (!list) return;

  const card = document.createElement('div');
  card.className = 'lc-sc';
  card.dataset.id = id;
  card.innerHTML = `
    <div class="lc-sc-top">
      <span class="lc-sc-bar" style="background:${lineColor};"></span>
      <input class="lc-sc-label" type="text" value="${label}" placeholder="Series name" spellcheck="false" />
      <button class="lc-sc-remove" title="Remove series" ${datasets.length <= 1 ? 'disabled' : ''}>
        <i class="bi bi-trash3"></i>
      </button>
    </div>
    <div class="lc-sc-colors">
      <!-- Line color -->
      <label class="lc-sc-color-field" title="Line Color">
        <span class="lc-sc-swatch lc-sc-line-sw" style="background:${lineColor};"></span>
        <span class="lc-sc-color-info">
          <span class="lc-sc-cname">Line</span>
          <span class="lc-sc-chex">${lineColor.toUpperCase()}</span>
        </span>
        <input type="color" class="lc-sc-color-input lc-sc-line-input" value="${lineColor}">
      </label>
      <!-- Dot color -->
      <label class="lc-sc-color-field" title="Dot Color">
        <span class="lc-sc-swatch lc-sc-dot-sw" style="background:${dotColor};"></span>
        <span class="lc-sc-color-info">
          <span class="lc-sc-cname">Dot</span>
          <span class="lc-sc-chex">${dotColor.toUpperCase()}</span>
        </span>
        <input type="color" class="lc-sc-color-input lc-sc-dot-input" value="${dotColor}">
      </label>
    </div>
  `;

  // ── Label input ──
  const labelInput = card.querySelector('.lc-sc-label');
  labelInput.addEventListener('input', () => {
    const ds = datasets.find(d => d.id === id);
    if (!ds) return;
    ds.label = labelInput.value;
    const idx = datasets.indexOf(ds);
    chart.data.datasets[idx].label = labelInput.value;
    chart.update();
    syncChartBarLabel();
    updateCodeOutput();
  });

  // ── Line color ──
  const lineInput = card.querySelector('.lc-sc-line-input');
  lineInput.addEventListener('input', () => {
    const color = lineInput.value;
    const ds = datasets.find(d => d.id === id);
    if (!ds) return;
    ds.lineColor = color;
    const idx = datasets.indexOf(ds);
    chart.data.datasets[idx].borderColor = color;
    if (idx === 0) chart.data.datasets[idx].backgroundColor = color + '26';
    card.querySelector('.lc-sc-line-sw').style.background = color;
    card.querySelector('.lc-sc-bar').style.background = color;
    card.querySelector('.lc-sc-line-input').closest('.lc-sc-color-field')
        .querySelector('.lc-sc-chex').textContent = color.toUpperCase();
    chart.update();
    updateCodeOutput();
  });

  // ── Dot color ──
  const dotInput = card.querySelector('.lc-sc-dot-input');
  dotInput.addEventListener('input', () => {
    const color = dotInput.value;
    const ds = datasets.find(d => d.id === id);
    if (!ds) return;
    ds.dotColor = color;
    const idx = datasets.indexOf(ds);
    chart.data.datasets[idx].pointBackgroundColor = color;
    chart.data.datasets[idx].pointBorderColor     = color;
    card.querySelector('.lc-sc-dot-sw').style.background = color;
    card.querySelector('.lc-sc-dot-input').closest('.lc-sc-color-field')
        .querySelector('.lc-sc-chex').textContent = color.toUpperCase();
    chart.update();
    updateCodeOutput();
  });

  // ── Remove button ──
  card.querySelector('.lc-sc-remove').addEventListener('click', () => removeSeries(id));

  list.appendChild(card);
}

// ── Sync remove button disabled state ─────────────
function syncRemoveButtons() {
  document.querySelectorAll('.lc-sc-remove').forEach(btn => {
    btn.disabled = datasets.length <= 1;
  });
}

// ── Sync chart bar label + chip ───────────────────
function syncChartBarLabel() {
  const barLabel   = document.getElementById('chart-bar-label');
  const chipSeries = document.getElementById('chip-series');
  const countEl    = document.getElementById('series-count');

  const n = datasets.length;
  if (barLabel) {
    barLabel.innerHTML = n === 1
      ? `${datasets[0]?.label || 'Revenue'} &nbsp;·&nbsp; 12 Months`
      : `${n} Series &nbsp;·&nbsp; 12 Months`;
  }
  if (chipSeries) chipSeries.textContent = `${n} Series`;
  if (countEl)    countEl.textContent    = n;
}
function syncMeta() { syncChartBarLabel(); syncRemoveButtons(); }

// ── Code generator ────────────────────────────────
const LABELS_STR = JSON.stringify(labels);

function getCode() {
  const datasetsStr = datasets.map(ds => [
    `      {`,
    `        label: '${ds.label}',`,
    `        data: ${JSON.stringify(ds.data)},`,
    `        borderColor: '${ds.lineColor}',`,
    `        backgroundColor: '${ds.lineColor}26',`,
    `        pointBackgroundColor: '${ds.dotColor}',`,
    `        pointBorderColor: '${ds.dotColor}',`,
    `        tension: ${tension},`,
    `        pointRadius: ${pointRadius},`,
    `        fill: false,`,
    `        borderWidth: 2.5`,
    `      }`,
  ].join('\n')).join(',\n');

  return {
    html: `<canvas id="lineChart"></canvas>\n\n<!-- Include Chart.js -->\n<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>`,
    js: [
      `const ctx = document.getElementById('lineChart');`,
      ``,
      `new Chart(ctx, {`,
      `  type: 'line',`,
      `  data: {`,
      `    labels: ${LABELS_STR},`,
      `    datasets: [`,
      datasetsStr,
      `    ]`,
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

// ── Global: Smooth / Linear ───────────────────────
document.getElementById('btn-smooth').addEventListener('click', e => {
  tension = 0.4;
  chart.data.datasets.forEach(ds => { ds.tension = tension; });
  chart.update();
  document.querySelectorAll('.lc-seg').forEach(b => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  updateCodeOutput();
});

document.getElementById('btn-linear').addEventListener('click', e => {
  tension = 0;
  chart.data.datasets.forEach(ds => { ds.tension = tension; });
  chart.update();
  document.querySelectorAll('.lc-seg').forEach(b => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  updateCodeOutput();
});

// ── Global: Points toggle ─────────────────────────
document.getElementById('btn-pts').addEventListener('click', e => {
  const btn    = e.currentTarget;
  const active = btn.classList.toggle('active');
  pointRadius  = active ? 5 : 0;
  chart.data.datasets.forEach(ds => { ds.pointRadius = pointRadius; });
  chart.update();
  const lbl = btn.querySelector('.lc-toggle-text');
  if (lbl) lbl.textContent = active ? 'Hide Points' : 'Show Points';
  updateCodeOutput();
});

// ── Code tabs ─────────────────────────────────────
document.querySelectorAll('.lc-tab').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.lc-tab').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    activeTab = e.currentTarget.getAttribute('data-tab');
    updateCodeOutput();
  });
});

// ── Add series button ─────────────────────────────
document.getElementById('btn-add-series').addEventListener('click', () => {
  addSeries();
  syncRemoveButtons();
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

// ── CSS: sc-out keyframe (removal animation) ──────
const style = document.createElement('style');
style.textContent = `@keyframes sc-out{to{opacity:0;transform:translateY(-6px);max-height:0;margin:0;padding:0;}}`;
document.head.appendChild(style);

// ── Init ──────────────────────────────────────────
addSeries(); // seed with the default Revenue dataset