import * as U from './utils.js';

// ── Data ──────────────────────────────────────────
// Pricing tiers that change at discrete points — ideal for stepped lines
const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const sets = [
  {
    label: 'Basic',
    color: U.C.blue,
    data:  [9,9,9,9,9,12,12,12,12,15,15,15],
  },
  {
    label: 'Pro',
    color: U.C.purple,
    data:  [29,29,29,39,39,39,39,49,49,49,59,59],
  },
  {
    label: 'Business',
    color: U.C.teal,
    data:  [79,79,99,99,99,119,119,119,149,149,149,179],
  },
  {
    label: 'Enterprise',
    color: U.C.coral,
    data:  [199,199,199,249,249,299,299,299,349,349,399,399],
  },
];

// ── State ─────────────────────────────────────────
let stepped     = 'before';
let pointRadius = 3;

// ── Chart ─────────────────────────────────────────
const chart = new Chart('chart', {
  type: 'line',
  data: {
    labels,
    datasets: sets.map(s => ({
      label: s.label,
      data: s.data,
      borderColor: s.color,
      backgroundColor: 'transparent',
      pointBackgroundColor: s.color,
      pointBorderColor: s.color,
      stepped,
      fill: false,
      pointRadius,
      pointHoverRadius: 6,
      borderWidth: 2.5,
    }))
  },
  options: U.baseOpts({
    scales: {
      x: U.xAxis(),
      y: U.yAxis({ ticks: { ...U.TICK, callback: v => '$' + v }, min: 0 }),
    }
  })
});

// ── Helpers ───────────────────────────────────────
function pct(data) {
  const first = data[0], last = data[data.length - 1];
  const change = ((last - first) / first * 100).toFixed(1);
  return { val: change, up: Number(change) >= 0 };
}

function syncStepUI() {
  const chip = document.getElementById('chip-step');
  const meta = document.getElementById('meta-step');
  if (chip) chip.textContent = stepped;
  if (meta) meta.textContent = stepped;
}

// ── Custom legend ─────────────────────────────────
function buildLegend() {
  const container = document.getElementById('legend');
  if (!container) return;

  sets.forEach((s, i) => {
    const { val, up } = pct(s.data);
    const latest = '$' + s.data[s.data.length - 1];
    const peak   = '$' + Math.max(...s.data);

    const card = document.createElement('div');
    card.className = 'sm-series-card';
    card.dataset.index = i;
    card.innerHTML = `
      <div class="sm-series-top">
        <span class="sm-series-stair" style="--series-color:${s.color};"></span>
        <span class="sm-series-name">${s.label}</span>
        <i class="bi bi-eye sm-series-eye"></i>
      </div>
      <div class="sm-series-stats">
        <div class="sm-ss">
          <span class="sm-ss-label">Latest</span>
          <span class="sm-ss-value">${latest}</span>
        </div>
        <div class="sm-ss">
          <span class="sm-ss-label">Peak</span>
          <span class="sm-ss-value">${peak}</span>
        </div>
        <div class="sm-ss">
          <span class="sm-ss-label">Change</span>
          <span class="sm-ss-value ${up ? 'up' : 'down'}">${up ? '+' : ''}${val}%</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      const meta   = chart.getDatasetMeta(i);
      const hidden = !meta.hidden;
      meta.hidden  = hidden;
      chart.update();
      card.classList.toggle('hidden', hidden);
      const eye = card.querySelector('.sm-series-eye');
      if (eye) eye.className = `bi bi-${hidden ? 'eye-slash' : 'eye'} sm-series-eye`;
    });

    container.appendChild(card);
  });
}

// ── Stats bar ─────────────────────────────────────
function buildStatsBar() {
  const bar = document.getElementById('stats-bar');
  if (!bar) return;

  sets.forEach(s => {
    const { val, up } = pct(s.data);
    const latest = s.data[s.data.length - 1];

    const block = document.createElement('div');
    block.className = 'sm-stat-block';
    block.style.setProperty('--series-color', s.color);
    block.innerHTML = `
      <div class="sm-block-label">${s.label}</div>
      <div class="sm-block-value">$${latest}</div>
      <div class="sm-block-footer">
        <span class="sm-block-sub">Dec price</span>
        <span class="sm-block-trend ${up ? 'up' : 'down'}">
          <i class="bi bi-arrow-${up ? 'up' : 'down'}-short"></i>
          ${up ? '+' : ''}${val}%
        </span>
      </div>
    `;
    bar.appendChild(block);
  });
}

// ── Step mode buttons ─────────────────────────────
document.querySelectorAll('.sm-seg[data-step]').forEach(btn => {
  btn.addEventListener('click', e => {
    stepped = e.currentTarget.dataset.step;
    chart.data.datasets.forEach(ds => { ds.stepped = stepped; });
    chart.update();
    document.querySelectorAll('.sm-seg[data-step]').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    syncStepUI();
  });
});

// ── Points toggle ─────────────────────────────────
document.getElementById('btn-pts').addEventListener('click', e => {
  const btn    = e.currentTarget;
  const active = btn.classList.toggle('active');
  pointRadius  = active ? 3 : 0;
  chart.data.datasets.forEach(ds => { ds.pointRadius = pointRadius; });
  chart.update();
  const lbl = btn.querySelector('.sm-toggle-text');
  if (lbl) lbl.textContent = active ? 'Hide Points' : 'Show Points';
});

// ── Init ──────────────────────────────────────────
buildLegend();
buildStatsBar();
syncStepUI();