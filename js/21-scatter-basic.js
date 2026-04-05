import * as U from './utils.js';

const points = Array.from({length:120},()=>({
  x: +(20+Math.random()*230).toFixed(0),
  y: +(2.5+Math.random()*2.4).toFixed(1),
}));

new Chart('chart',{
  type:'scatter',
  data:{ datasets:[{ label:'Product', data:points, backgroundColor:'rgba(127,119,221,.55)', pointRadius:5, pointHoverRadius:7 }] },
  options: U.baseOpts({
    scales:{
      x: U.yAxis({ min:0, max:260, ticks:{ ...U.TICK, callback:v=>'$'+v } }),
      y: U.yAxis({ min:2, max:5.2, ticks:{ ...U.TICK, stepSize:0.5 } }),
    }
  })
});