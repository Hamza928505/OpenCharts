import * as U from './utils.js';

const labels = U.MO3;
const sets = [
  { label:'North', data:[420,510,480,560,620,700,680,740,660,720,790,880], color:U.C.purple },
  { label:'South', data:[310,380,355,420,455,510,490,540,500,550,590,640], color:U.C.teal },
  { label:'East',  data:[260,295,275,330,360,410,395,430,415,455,480,520], color:U.C.coral },
  { label:'West',  data:[190,220,210,250,275,310,300,335,315,350,375,410], color:U.C.blue },
];

const chart = new Chart('chart', {
  type:'line',
  data:{
    labels,
    datasets: sets.map(s=>({
      label:s.label, data:s.data,
      borderColor:s.color, backgroundColor:'transparent',
      tension:0.35, pointRadius:3, pointHoverRadius:6,
      pointBackgroundColor:s.color, borderWidth:2,
    }))
  },
  options: U.baseOpts({ scales:{ x:U.xAxis(), y:U.yAxis() } })
});
U.buildLegend(chart,'legend');