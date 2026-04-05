import * as U from './utils.js';

const labels=U.MO3;
const data  =[850,920,880,1050,1140,1260,1310,1280,1120,1090,1190,1420];
const colors=['#7F77DD','#7F77DD','#1D9E75','#1D9E75','#1D9E75','#D85A30','#D85A30','#D85A30','#378ADD','#378ADD','#BA7517','#BA7517'];

const chart = new Chart('chart',{
  type:'polarArea',
  data:{
    labels,
    datasets:[{
      data,
      backgroundColor:colors.map(c=>c+'bb'),
      borderColor:colors,
      borderWidth:1,
    }]
  },
  options: U.baseOpts({
    scales:{ r:{ ticks:{ font:{ size:9 }, display:false }, grid:{ color:'rgba(128,128,128,.12)' } } },
    layout:{ padding:12 },
  })
});
U.buildLegend(chart,'legend');