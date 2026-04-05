import * as U from './utils.js';

const labels = U.MO3;
const data   = [12,-8,20,-5,15,-12,18,25,-6,14,-9,30];
const colors = data.map(v=>v>=0 ? U.C.teal : U.C.coral);

new Chart('chart',{
  type:'bar',
  data:{
    labels,
    datasets:[{
      label:'Variance', data,
      backgroundColor:colors,
      borderRadius:3, borderSkipped:false,
    }]
  },
  options: U.baseOpts({
    scales:{
      x: U.xAxis(),
      y: U.yAxis({ ticks:{ ...U.TICK, callback:v=>(v>=0?'+':'')+v+'K' } }),
    }
  })
});