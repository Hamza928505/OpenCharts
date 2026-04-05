import * as U from './utils.js';

const labels = U.MO3;
const sets=[
  {label:'Organic', data:[4200,4800,4500,5200,5600,6100], color:U.C.purple, alpha:'rgba(127,119,221,.55)'},
  {label:'Paid',    data:[2100,2400,2200,2600,2900,3300], color:U.C.teal,   alpha:'rgba(29,158,117,.55)'},
  {label:'Social',  data:[1200,1400,1300,1600,1700,1900], color:U.C.coral,  alpha:'rgba(216,90,48,.55)'},
  {label:'Email',   data:[800,900,850,1000,1100,1200],    color:U.C.blue,   alpha:'rgba(55,138,221,.55)'},
];

const chart = new Chart('chart',{
  type:'line',
  data:{
    labels,
    datasets:sets.map(s=>({
      label:s.label, data:s.data,
      borderColor:s.color, backgroundColor:s.alpha,
      fill:true, tension:0.35, pointRadius:3,
      pointBackgroundColor:s.color, borderWidth:1.5,
    }))
  },
  options: U.baseOpts({
    scales:{
      x: U.xAxis(),
      y: U.yAxis({ stacked:true, ticks:{ ...U.TICK, callback:v=>v.toLocaleString() } }),
    }
  })
});
U.buildLegend(chart,'legend');