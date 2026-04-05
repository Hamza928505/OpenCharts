import * as U from './utils.js';

const chart = new Chart('chart',{
  type:'bar',
  data:{
    labels:U.QTR,
    datasets:[
      { type:'bar',  label:'Revenue ($K)', data:[520,680,740,910], backgroundColor:U.C.purpleA, borderColor:U.C.purple, borderWidth:1.5, borderRadius:4, borderSkipped:false, yAxisID:'y' },
      { type:'line', label:'Growth (%)',   data:[null,31,9,23],    borderColor:U.C.coral, backgroundColor:'transparent', tension:0.3, pointRadius:6, pointBackgroundColor:U.C.coral, borderWidth:2.5, yAxisID:'y2' },
    ]
  },
  options: U.baseOpts({
    scales:{
      x: U.xAxis(),
      y:  U.yAxis({ ticks:{ ...U.TICK, callback:v=>'$'+v+'K' } }),
      y2: { position:'right', ticks:{ font:{ size:11 }, callback:v=>v+'%' }, grid:{ display:false } },
    }
  })
});
U.buildLegend(chart,'legend');