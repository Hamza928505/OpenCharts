import * as U from './utils.js';

const ages=['18–24','25–34','35–44','45–54','55–64','65+'];
const male  =[ 8.2, 14.5, 13.8, 11.2, 8.4, 5.1];
const female=[ 9.1, 15.8, 14.2, 12.0, 9.3, 6.4];

const chart=new Chart('chart',{
  type:'bar',
  data:{
    labels:ages,
    datasets:[
      {label:'Male',  data:male.map(v=>-v), backgroundColor:U.C.blue+'cc', borderRadius:3, borderSkipped:false},
      {label:'Female',data:female,           backgroundColor:U.C.pink+'cc', borderRadius:3, borderSkipped:false},
    ]
  },
  options:U.baseOpts({
    indexAxis:'y',
    scales:{
      x:{...U.yAxis(),ticks:{...U.TICK,callback:v=>Math.abs(v).toFixed(1)+'%'}},
      y:U.xAxis(),
    },
    plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${Math.abs(ctx.parsed.x).toFixed(1)}%`}}}
  })
});
U.buildLegend(chart,'legend');