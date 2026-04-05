import * as U from './utils.js';

const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const hours=Array.from({length:24},(_,i)=>i);
const data=[];
days.forEach((d,di)=>{
  hours.forEach(h=>{
    const isWeekend=di>=5;
    const base=isWeekend?2:8;
    const peak=(h>=9&&h<=11)||(h>=14&&h<=16)?15:0;
    const v=Math.max(0,Math.round(base+peak+U.rand(-3,3)));
    data.push({x:h,y:di,v});
  });
});
const maxV=Math.max(...data.map(d=>d.v));

new Chart('chart',{
  type:'matrix',
  data:{datasets:[{
    label:'Tickets',data,
    backgroundColor:ctx=>{
      const v=ctx.dataset.data[ctx.dataIndex].v;
      const t=v/maxV;
      const r=Math.round(127+t*(127-127)),g=Math.round(119+t*(119-30)),b=Math.round(221+t*(221-48));
      return `rgba(${Math.round(127*t+127*(1-t)*0.3)},${Math.round(119*t)},${Math.round(221*(1-t))},${0.15+t*0.85})`;
    },
    borderColor:'transparent',
    borderWidth:2,
    width:ctx=>(ctx.chart.chartArea?.width||400)/24-2,
    height:ctx=>(ctx.chart.chartArea?.height||200)/7-2,
  }]},
  options:{...U.baseOpts({
    scales:{
      x:{type:'linear',min:-0.5,max:23.5,offset:false,ticks:{...U.TICK,stepSize:3,callback:v=>v===0?'12a':v<12?v+'a':v===12?'12p':(v-12)+'p'},grid:{display:false}},
      y:{type:'linear',min:-0.5,max:6.5,offset:false,ticks:{...U.TICK,callback:v=>days[v]||'',stepSize:1},grid:{display:false}},
    },
    plugins:{legend:{display:false},tooltip:{callbacks:{title:ctx=>`${days[ctx[0].raw.y]} ${ctx[0].raw.x}:00`,label:ctx=>`${ctx.raw.v} tickets`}}}
  })},
});
