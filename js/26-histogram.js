import * as U from './utils.js';

const raw = Array.from({length:2400}, () => {
  const u1=Math.random(), u2=Math.random();
  return Math.round(32 + 12 * Math.sqrt(-2*Math.log(u1)) * Math.cos(2*Math.PI*u2));
}).filter(v=>v>=18&&v<=75);

function makeBins(data, n) {
  const min=18, max=75, w=(max-min)/n;
  const bins=Array.from({length:n},(_,i)=>({label:`${Math.round(min+i*w)}–${Math.round(min+(i+1)*w)}`,count:0}));
  data.forEach(v=>{const i=Math.min(Math.floor((v-min)/w),n-1);bins[i].count++;});
  return bins;
}

let chart;
function draw(n){
  const bins=makeBins(raw,n);
  if(chart) chart.destroy();
  chart=new Chart('chart',{
    type:'bar',
    data:{labels:bins.map(b=>b.label),datasets:[{label:'Customers',data:bins.map(b=>b.count),backgroundColor:U.C.purple+'cc',borderColor:U.C.purple,borderWidth:1,borderRadius:2}]},
    options:{...U.baseOpts({scales:{x:{...U.xAxis(),ticks:{...U.TICK,maxRotation:45,autoSkip:false,maxTicksLimit:n<=10?10:15}},y:{...U.yAxis(),ticks:{...U.TICK}}},plugins:{legend:{display:false},tooltip:{callbacks:{title:ctx=>`Age ${ctx[0].label}`,label:ctx=>`${ctx.parsed.y} customers`}}}})},
  });
}
draw(10);
document.querySelectorAll('[data-bins]').forEach(btn=>{
  btn.addEventListener('click',function(){
    document.querySelectorAll('[data-bins]').forEach(b=>b.classList.remove('active'));
    this.classList.add('active');
    draw(+this.dataset.bins);
  });
});