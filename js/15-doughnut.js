import * as U from './utils.js';

const labels=['Organic','Paid','Social','Direct','Referral'];
const data  =[40,27,15,11,7];
const colors=[U.C.purple,U.C.teal,U.C.coral,U.C.blue,U.C.amber];

const chart = new Chart('chart',{
  type:'doughnut',
  data:{ labels, datasets:[{ data, backgroundColor:colors, borderWidth:0, hoverOffset:8 }] },
  options: U.baseOpts({
    cutout:'68%',
    layout:{ padding:16 },
    plugins:{
      tooltip:{ callbacks:{ label:ctx=>` ${ctx.label}: ${ctx.parsed}%` } }
    }
  })
});
U.buildLegend(chart,'legend');