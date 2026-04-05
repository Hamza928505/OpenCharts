import * as U from './utils.js';

const data = [185,210,198,240,275,310,295,330,285,320,355,410];
const labels = U.MO3;

document.getElementById('m-peak').textContent  = '$' + Math.max(...data) + 'K';
document.getElementById('m-avg').textContent   = '$' + Math.round(data.reduce((a,b)=>a+b)/data.length) + 'K';
document.getElementById('m-total').textContent = '$' + (data.reduce((a,b)=>a+b)/1000).toFixed(2) + 'M';

const dataset = {
  label:'Revenue', data,
  borderColor: U.C.purple,
  backgroundColor: U.C.purpleA,
  fill: true, tension: 0.4,
  pointRadius: 5, pointHoverRadius: 7,
  pointBackgroundColor: U.C.purple,
  borderWidth: 2,
};

const chart = new Chart('chart', {
  type:'line',
  data:{ labels, datasets:[dataset] },
  options: U.baseOpts({
    scales:{
      x: U.xAxis(),
      y: U.yAxis({ ticks:{ ...U.TICK, callback:v=>'$'+v+'K' } }),
    }
  })
});

// Controls
let showPts = true;
document.getElementById('btn-smooth').addEventListener('click', () => {
  chart.data.datasets[0].tension = 0.4; chart.update();
  document.getElementById('btn-smooth').classList.add('active');
  document.getElementById('btn-linear').classList.remove('active');
});
document.getElementById('btn-linear').addEventListener('click', () => {
  chart.data.datasets[0].tension = 0; chart.update();
  document.getElementById('btn-linear').classList.add('active');
  document.getElementById('btn-smooth').classList.remove('active');
});
document.getElementById('btn-pts').addEventListener('click', function() {
  showPts = !showPts;
  chart.data.datasets[0].pointRadius = showPts ? 5 : 0;
  chart.update();
  this.textContent = showPts ? 'Hide points' : 'Show points';
});