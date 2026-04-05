import * as U from './utils.js';

const labels = Array.from({length:30},(_,i)=>'D'+(i+1));
const data   = [820,860,910,890,950,1020,1080,1060,1120,1090,1150,1200,1180,1240,1300,
                1280,1350,1410,1390,1460,1520,1500,1560,1620,1600,1670,1730,1710,1780,1840];

new Chart('chart',{
  type:'line',
  data:{
    labels,
    datasets:[{
      label:'DAU', data,
      borderColor:U.C.teal,
      backgroundColor:'rgba(29,158,117,.12)',
      fill:true, tension:0.4,
      pointRadius:0, pointHoverRadius:5,
      pointBackgroundColor:U.C.teal,
      borderWidth:2,
    }]
  },
  options: U.baseOpts({
    scales:{
      x: U.xAxis({ ticks:{ ...U.TICK, maxTicksLimit:8 } }),
      y: U.yAxis({ ticks:{ ...U.TICK, callback:v=>v.toLocaleString() } }),
    }
  })
});