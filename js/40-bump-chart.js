import * as U from './utils.js';

const products=[
  {name:'Linen Blazer',  ranks:[1,1,2,2,1,1],color:U.C.purple},
  {name:'Silk Midi',     ranks:[2,3,1,1,2,2],color:U.C.teal},
  {name:'Wool Coat',     ranks:[3,2,3,4,3,3],color:U.C.coral},
  {name:'Canvas Tote',   ranks:[4,4,4,3,5,4],color:U.C.blue},
  {name:'Cashmere Knit', ranks:[5,5,5,5,4,5],color:U.C.amber},
  {name:'Leather Belt',  ranks:[6,6,6,6,6,6],color:U.C.gray},
];
const chart=new Chart('chart',{
  type:'line',
  data:{
    labels:U.MO6,
    datasets:products.map(p=>({
      label:p.name,data:p.ranks,
      borderColor:p.color,backgroundColor:'transparent',
      tension:0.4,pointRadius:7,pointHoverRadius:9,
      pointBackgroundColor:p.color,borderWidth:2.5,
    }))
  },
  options:U.baseOpts({
    scales:{
      x:U.xAxis(),
      y:{...U.yAxis(),reverse:true,min:0.5,max:6.5,ticks:{...U.TICK,stepSize:1,callback:v=>Number.isInteger(v)?'#'+v:''}},
    },
  })
});
U.buildLegend(chart,'legend');