import * as U from './utils.js';

const online  = [0.52,0.68,0.74,0.91];
const instore = [0.31,0.38,0.42,0.51];
const whole   = [0.18,0.22,0.24,0.29];
const totals  = online.map((_,i)=>+(online[i]+instore[i]+whole[i]).toFixed(2));

const chart = new Chart('chart',{
  type:'bar',
  data:{
    labels:U.QTR,
    datasets:[
      { type:'bar',  label:'Online',    data:online,  backgroundColor:U.C.purpleA, borderColor:U.C.purple, borderWidth:1, stack:'s' },
      { type:'bar',  label:'In-store',  data:instore, backgroundColor:U.C.tealA,   borderColor:U.C.teal,   borderWidth:1, stack:'s' },
      { type:'bar',  label:'Wholesale', data:whole,   backgroundColor:U.C.coralA,  borderColor:U.C.coral,  borderWidth:1, stack:'s' },
      { type:'line', label:'Total',     data:totals,  borderColor:U.C.pink, backgroundColor:'transparent', tension:0.3, pointRadius:6, pointBackgroundColor:U.C.pink, borderWidth:2.5 },
    ]
  },
  options: U.baseOpts({
    scales:{
      x: U.xAxis({ stacked:true }),
      y: U.yAxis({ stacked:true, ticks:{ ...U.TICK, callback:v=>'$'+v.toFixed(2)+'M' } }),
    }
  })
});
U.buildLegend(chart,'legend');