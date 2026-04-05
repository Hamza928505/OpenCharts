import * as U from './utils.js';

const axes=['Frontend','Backend','DevOps','Data','Security','Testing'];
const data =[85,78,62,70,55,80];

new Chart('chart',{
  type:'radar',
  data:{
    labels:axes,
    datasets:[{
      label:'Team avg', data,
      borderColor:U.C.teal,
      backgroundColor:'rgba(29,158,117,.35)',
      pointBackgroundColor:U.C.teal,
      borderWidth:2.5, pointRadius:5, fill:true,
    }]
  },
  options: U.baseOpts({
    scales:{ r:{ min:0, max:100, ticks:{ stepSize:20, font:{ size:10 } }, pointLabels:{ font:{ size:13 } }, grid:{ color:'rgba(128,128,128,.15)' } } }
  })
});