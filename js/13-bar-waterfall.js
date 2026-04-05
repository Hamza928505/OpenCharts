import * as U from './utils.js';

const steps = [
  { label:'FY2023',    delta:0,   abs:8.2,  type:'base' },
  { label:'New sales', delta:2.1, abs:null, type:'up'   },
  { label:'Upsells',   delta:0.8, abs:null, type:'up'   },
  { label:'Churn',     delta:-0.5,abs:null, type:'down' },
  { label:'FX impact', delta:-0.3,abs:null, type:'down' },
  { label:'Renewals',  delta:1.4, abs:null, type:'up'   },
  { label:'FY2024',    delta:0,   abs:null, type:'base' },
];
let cum = 8.2;
const floats = steps.map(s=>{
  if(s.type==='base'&&s.abs!=null){ return [0, s.abs]; }
  const start=cum; cum+=s.delta;
  if(s.type==='base') return [0,cum];
  return [Math.min(start,cum), Math.max(start,cum)];
});
const colors = steps.map(s=>s.type==='base'?U.C.gray:s.type==='up'?U.C.teal:U.C.coral);

new Chart('chart',{
  type:'bar',
  data:{
    labels:steps.map(s=>s.label),
    datasets:[{ label:'Value', data:floats, backgroundColor:colors, borderColor:colors, borderWidth:1, borderRadius:3, borderSkipped:false }]
  },
  options: U.baseOpts({
    scales:{
      x: U.xAxis({ ticks:{ font:{ size:11 } } }),
      y: U.yAxis({ ticks:{ ...U.TICK, callback:v=>'$'+v.toFixed(1)+'M' }, min:0 }),
    }
  })
});