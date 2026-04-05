import * as U from './utils.js';

const items=[
  {g:'Women',label:'Dresses',value:420},{g:'Women',label:'Tops',value:285},{g:'Women',label:'Outerwear',value:310},
  {g:'Women',label:'Accessories',value:175},{g:'Men',label:'Shirts',value:240},{g:'Men',label:'Trousers',value:195},
  {g:'Men',label:'Outerwear',value:260},{g:'Men',label:'Footwear',value:180},{g:'Living',label:'Textiles',value:140},
  {g:'Living',label:'Ceramics',value:95},{g:'Living',label:'Lighting',value:115},
];
const groupColors={'Women':U.C.purple,'Men':U.C.teal,'Living':U.C.coral};

new Chart('chart',{
  type:'treemap',
  data:{datasets:[{
    label:'Revenue',
    tree:items,
    key:'value',
    groups:['g','label'],
    backgroundColor:ctx=>{
      if(!ctx.raw?.g) return 'transparent';
      return (groupColors[ctx.raw.g]||U.C.gray)+(ctx.type==='data'?'bb':'44');
    },
    borderColor:ctx=>ctx.type==='data'?'rgba(255,255,255,.4)':'rgba(255,255,255,.8)',
    borderWidth:1,
    labels:{display:true,color:'#fff',font:{size:11,weight:'500'},formatter:ctx=>ctx.raw._data?.label||ctx.raw.g||''},
  }]},
  options:U.baseOpts({plugins:{legend:{display:false},tooltip:{callbacks:{title:ctx=>ctx[0].raw._data?.label||ctx[0].raw.g,label:ctx=>`Revenue: $${ctx.raw.v}K`}}}}),
});