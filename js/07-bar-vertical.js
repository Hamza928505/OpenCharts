import * as U from './utils.js';

const chart = new Chart('chart',{
  type:'bar',
  data:{
    labels:U.QTR,
    datasets:[
      { label:'2024', data:[520,680,740,910], backgroundColor:U.C.purple, borderRadius:4, borderSkipped:false },
      { label:'2023', data:[440,575,625,770], backgroundColor:U.C.purpleA, borderRadius:4, borderSkipped:false, borderColor:U.C.purple, borderWidth:1 },
    ]
  },
  options: U.baseOpts({
    scales:{
      x: U.xAxis(),
      y: U.yAxis({ ticks:{ ...U.TICK, callback:v=>'$'+v+'K' } }),
    }
  })
});
U.buildLegend(chart,'legend');