import * as U from './utils.js';

const axes=['Quality','Speed','Price','Support','UX','Reliability'];
const chart = new Chart('chart',{
  type:'radar',
  data:{
    labels:axes,
    datasets:[
      { label:'Our product', data:[82,74,68,90,78,85], borderColor:U.C.purple, backgroundColor:U.C.purpleA, pointBackgroundColor:U.C.purple, borderWidth:2, pointRadius:4 },
      { label:'Competitor A', data:[70,80,75,65,82,72], borderColor:U.C.coral, backgroundColor:U.C.coralA, pointBackgroundColor:U.C.coral, borderWidth:2, pointRadius:4 },
      { label:'Competitor B', data:[65,70,85,70,68,78], borderColor:U.C.teal,  backgroundColor:U.C.tealA,  pointBackgroundColor:U.C.teal,  borderWidth:2, pointRadius:4 },
    ]
  },
  options: U.baseOpts({
    scales:{ r:{ min:0, max:100, ticks:{ stepSize:20, font:{ size:10 } }, pointLabels:{ font:{ size:12 } }, grid:{ color:'rgba(128,128,128,.15)' } } }
  })
});
U.buildLegend(chart,'legend');