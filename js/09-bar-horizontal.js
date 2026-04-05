import * as U from './utils.js';

const products = ['Linen Blazer','Silk Midi Dress','Wool Overcoat','Canvas Tote','Cashmere Knit','Leather Belt','Wide-Leg Trousers','Cotton Shirt'];
const values   = [142,128,115,98,87,74,63,55];
const colors   = products.map((_,i)=>[U.C.purple,U.C.purple,U.C.purple,U.C.teal,U.C.teal,U.C.coral,U.C.coral,U.C.coral][i]);

new Chart('chart',{
  type:'bar',
  data:{
    labels:products,
    datasets:[{ label:'Revenue', data:values, backgroundColor:colors, borderRadius:4, borderSkipped:false }]
  },
  options: U.baseOpts({
    indexAxis:'y',
    scales:{
      x: U.yAxis({ ticks:{ ...U.TICK, callback:v=>'$'+v+'K' } }),
      y: U.xAxis({ ticks:{ font:{ size:12 } } }),
    }
  })
});