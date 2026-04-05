import * as U from './utils.js';

const raw = {
  'North': [40,25,20,15],
  'South': [35,30,20,15],
  'East':  [45,22,18,15],
  'West':  [38,28,22,12],
};
const brands=['Brand A','Brand B','Brand C','Brand D'];
const colors=[U.C.purple,U.C.teal,U.C.coral,U.C.blue];

const regions = Object.keys(raw);
const totals  = regions.map(r=>raw[r].reduce((a,b)=>a+b,0));

const chart = new Chart('chart',{
  type:'bar',
  data:{
    labels:regions,
    datasets:brands.map((b,i)=>({
      label:b,
      data:regions.map((r,ri)=>+(raw[r][i]/totals[ri]*100).toFixed(1)),
      backgroundColor:colors[i],
      borderRadius: i===brands.length-1 ? 4 : 0,
      stack:'s',
    }))
  },
  options: U.baseOpts({
    scales:{
      x: U.xAxis({ stacked:true }),
      y: U.yAxis({ stacked:true, max:100, ticks:{ ...U.TICK, callback:v=>v+'%' } }),
    }
  })
});
U.buildLegend(chart,'legend');