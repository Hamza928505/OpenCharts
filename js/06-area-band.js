import * as U from './utils.js';

const labels = Array.from({length:14},(_,i)=>'Day '+(i+1));
const mean=[18,19,21,22,20,19,23,25,24,22,21,23,26,25];
const hi  = mean.map(v=>v+U.rand(2,5));
const lo  = mean.map(v=>v-U.rand(2,5));

const chart = new Chart('chart',{
  type:'line',
  data:{
    labels,
    datasets:[
      { label:'Upper bound', data:hi,  borderColor:'transparent', backgroundColor:'rgba(127,119,221,.18)', fill:'+1', pointRadius:0, tension:0.4, borderWidth:0 },
      { label:'Lower bound', data:lo,  borderColor:'transparent', backgroundColor:'rgba(127,119,221,.18)', fill:false, pointRadius:0, tension:0.4, borderWidth:0 },
      { label:'Mean',        data:mean, borderColor:U.C.purple,   backgroundColor:'transparent', fill:false, tension:0.4, pointRadius:4, pointBackgroundColor:U.C.purple, borderWidth:2.5 },
    ]
  },
  options: U.baseOpts({
    scales:{
      x: U.xAxis(),
      y: U.yAxis({ ticks:{ ...U.TICK, callback:v=>v+'°C' } }),
    }
  })
});
U.buildLegend(chart,'legend');