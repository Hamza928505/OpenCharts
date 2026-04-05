/* chart-utils.js — shared Chart.js helpers */

// Palette
export const C = {
  purple:'#7F77DD', teal:'#1D9E75', coral:'#D85A30',
  blue:'#378ADD',   amber:'#BA7517', pink:'#D4537E',
  gray:'#888780',   red:'#E24B4A',   green:'#639922',
  purpleA:'rgba(127,119,221,.15)', tealA:'rgba(29,158,117,.15)',
  coralA:'rgba(216,90,48,.15)',    blueA:'rgba(55,138,221,.15)',
  pinkA:'rgba(212,83,126,.15)',
};

// Default grid colors for axes
export const GRID = { color:'rgba(128,128,128,.1)' };
export const TICK = { font:{ size:11 } };

// Axis shorthands
export const xAxis = (opts={}) => ({ ticks:TICK, grid:{ display:false }, ...opts });
export const yAxis = (opts={}) => ({ ticks:TICK, grid:GRID, ...opts });

// Base chart options
export const baseOpts = (extra={}) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration:600, easing:'easeOutQuart' },
  plugins: {
    legend: { display:false },
    tooltip: {
      backgroundColor: 'rgba(17,17,16,.85)',
      titleColor:'#f0efe9', bodyColor:'#c8c7c0',
      padding:10, cornerRadius:6, boxPadding:4,
    },
    ...((extra.plugins)||{}),
  },
  scales: extra.scales || {},
  ...Object.fromEntries(Object.entries(extra).filter(([k])=>!['plugins','scales'].includes(k))),
});

// Random helpers
export const rand = (min,max) => Math.round(min + Math.random()*(max-min));
export const randArr = (n,min,max) => Array.from({length:n},()=>rand(min,max));
export const randPts = (n,cx,cy,spread) =>
  Array.from({length:n},()=>({
    x:+((cx+(Math.random()-.5)*spread*2).toFixed(1)),
    y:+((cy+(Math.random()-.5)*spread*2).toFixed(1)),
  }));

// Build interactive legend
export function buildLegend(chart, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  chart.data.datasets.forEach((ds, i) => {
    const item = document.createElement('span');
    item.className = 'legend-item';
    const sw = document.createElement('span');
    sw.className = 'legend-swatch';
    sw.style.background = Array.isArray(ds.backgroundColor)
      ? ds.backgroundColor[0] : (ds.backgroundColor || ds.borderColor);
    const label = document.createElement('span');
    label.textContent = ds.label || `Series ${i+1}`;
    item.append(sw, label);
    item.addEventListener('click', () => {
      const meta = chart.getDatasetMeta(i);
      meta.hidden = !meta.hidden;
      item.classList.toggle('hidden');
      chart.update();
    });
    el.appendChild(item);
  });
}

// Months labels
export const MO3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const MO6 = MO3.slice(0,6);
export const QTR = ['Q1','Q2','Q3','Q4'];
