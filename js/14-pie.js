import * as U from './utils.js';

const labels=['Women','Men','Living','Accessories'];
const data  =[48,31,13,8];
const colors=[U.C.purple,U.C.teal,U.C.coral,U.C.blue];

const chart = new Chart('chart',{
  type:'pie',
  data:{ labels, datasets:[{ data, backgroundColor:colors, borderWidth:0, hoverOffset:8 }] },
  options: U.baseOpts({
    layout:{ padding:16 },
    plugins:{ tooltip:{ callbacks:{ label:ctx=>` ${ctx.label}: ${ctx.parsed}%` } } }
  })
});
U.buildLegend(chart,'legend');