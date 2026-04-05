import * as U from './utils.js';

const regions=['North','South','East','West','Central'];
const colors=[U.C.purple,U.C.teal,U.C.coral,U.C.blue,U.C.amber];
const gauss=(mu,sig)=>{const u=Math.random(),v=Math.random();return mu+sig*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const datasets=regions.map((r,i)=>({
  label:r,
  data:[Array.from({length:80},()=>Math.max(10,Math.round(gauss([68,55,75,62,70][i],[18,14,22,16,20][i]))))],
  backgroundColor:colors[i]+'44',borderColor:colors[i],borderWidth:1.5,
  outlierBackgroundColor:colors[i],outlierBorderColor:colors[i],outlierRadius:3,
  medianColor:colors[i],
}));
new Chart('chart',{
  type:'boxplot',
  data:{labels:regions,datasets:datasets},
  options:U.baseOpts({scales:{x:U.xAxis(),y:{...U.yAxis(),ticks:{...U.TICK,callback:v=>'$'+v}}}}),
});