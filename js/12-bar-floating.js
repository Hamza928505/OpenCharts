import * as U from './utils.js';

const tasks = ['Discovery','Design','Development','QA Testing','Launch Prep','Go-Live'];
const ranges= [[1,3],[2,5],[4,10],[8,12],[11,13],[13,14]];
const colors= [U.C.blue,U.C.purple,U.C.teal,U.C.amber,U.C.coral,U.C.pink];

new Chart('chart',{
  type:'bar',
  data:{
    labels:tasks,
    datasets:[{
      label:'Duration',
      data:ranges,
      backgroundColor:colors.map(c=>c+'cc'),
      borderColor:colors,
      borderWidth:1,
      borderRadius:4,
      borderSkipped:false,
    }]
  },
  options: U.baseOpts({
    indexAxis:'y',
    scales:{
      x: U.yAxis({ min:0, max:15, ticks:{ ...U.TICK, callback:v=>'Wk '+v } }),
      y: U.xAxis({ ticks:{ font:{ size:12 } } }),
    }
  })
});