import * as U from './utils.js';

const axes=['Quality','Speed','Value','Support','UX','Reliability'];
const data =[82,74,68,90,78,85];

new Chart('chart',{
  type:'radar',
  data:{
    labels:axes,
    datasets:[{
      label:'Score', data,
      borderColor:U.C.purple,
      backgroundColor:U.C.purpleA,
      pointBackgroundColor:U.C.purple,
      borderWidth:2, pointRadius:5, pointHoverRadius:7,
    }]
  },
  options: U.baseOpts({
    scales:{ r:{ min:0, max:100, ticks:{ stepSize:20, font:{ size:10 } }, pointLabels:{ font:{ size:12 } }, grid:{ color:'rgba(128,128,128,.15)' } } }
  })
});