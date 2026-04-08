import * as U from './utils.js';

// --- Designer State ---
let lineColor = '#7F77DD';
let dotColor = '#7F77DD';
let tension = 0.4;
let pointRadius = 5;
let activeTab = 'html';

const dataValues = [185, 210, 198, 240, 275, 310, 295, 330, 285, 320, 355, 410];
const labels = U.MO3;

// --- Initialize Chart ---
const chart = new Chart('chart', {
  type: 'line',
  data: {
    labels: labels,
    datasets: [{
      label: 'Revenue',
      data: dataValues,
      borderColor: lineColor,
      backgroundColor: lineColor + '26',
      pointBackgroundColor: dotColor,
      pointBorderColor: dotColor,
      fill: true,
      tension: tension,
      pointRadius: pointRadius,
      borderWidth: 2
    }]
  },
  options: U.baseOpts({
    scales: {
      x: U.xAxis(),
      y: U.yAxis({ ticks: { ...U.TICK, callback: v => '$' + v + 'K' } })
    }
  })
});

// --- Code Generator ---
const updateCodeOutput = () => {
  const codes = {
    html: `\n<canvas id="lineChart"></canvas>\n\n\n<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>`,
    js: `const ctx = document.getElementById('lineChart');\n\nnew Chart(ctx, {\n  type: 'line',\n  data: {\n    labels: ${JSON.stringify(labels)},\n    datasets: [{\n      label: 'Data',\n      data: ${JSON.stringify(dataValues)},\n      borderColor: '${lineColor}',\n      backgroundColor: '${lineColor}26',\n      pointBackgroundColor: '${dotColor}',\n      tension: ${tension},\n      pointRadius: ${pointRadius},\n      fill: true\n    }]\n  }\n});`,
    css: `#lineChart {\n  width: 100%;\n  height: 400px;\n  background: #ffffff;\n}`
  };
  document.getElementById('code-display').value = codes[activeTab];
};

// --- Listeners ---
document.getElementById('cfg-line-color').addEventListener('input', (e) => {
  lineColor = e.target.value;
  chart.data.datasets[0].borderColor = lineColor;
  chart.data.datasets[0].backgroundColor = lineColor + '26';
  chart.update();
  updateCodeOutput();
});

document.getElementById('cfg-dot-color').addEventListener('input', (e) => {
  dotColor = e.target.value;
  chart.data.datasets[0].pointBackgroundColor = dotColor;
  chart.data.datasets[0].pointBorderColor = dotColor;
  chart.update();
  updateCodeOutput();
});

document.getElementById('btn-smooth').addEventListener('click', (e) => {
  tension = 0.4;
  chart.data.datasets[0].tension = 0.4;
  chart.update();
  document.querySelectorAll('#btn-smooth, #btn-linear').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  updateCodeOutput();
});

document.getElementById('btn-linear').addEventListener('click', (e) => {
  tension = 0;
  chart.data.datasets[0].tension = 0;
  chart.update();
  document.querySelectorAll('#btn-smooth, #btn-linear').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  updateCodeOutput();
});

document.getElementById('btn-pts').addEventListener('click', (e) => {
  pointRadius = pointRadius === 5 ? 0 : 5;
  chart.data.datasets[0].pointRadius = pointRadius;
  chart.update();
  e.target.textContent = pointRadius === 5 ? 'Hide Points' : 'Show Points';
  updateCodeOutput();
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeTab = e.target.getAttribute('data-tab');
    updateCodeOutput();
  });
});

window.copyActiveCode = () => {
  const area = document.getElementById('code-display');
  area.select();
  document.execCommand('copy');
};

// Init Output
updateCodeOutput();