import * as U from './utils.js';

const c=U.C;
new Chart('chart',{
  type:'sankey',
  data:{datasets:[{
    label:'Flow',
    colorFrom:ctx=>({Organic:c.teal,Paid:c.coral,Social:c.purple,Email:c.blue,Visit:c.amber,Checkout:c.amber,Purchase:c.teal,Bounce:c.gray}[ctx.dataset.data[ctx.dataIndex]?.from]||c.gray),
    colorTo:ctx=>({Visit:c.amber,Checkout:c.amber,Purchase:c.teal,Bounce:c.gray,Support:c.coral}[ctx.dataset.data[ctx.dataIndex]?.to]||c.gray),
    colorMode:'gradient',
    data:[
      {from:'Organic',to:'Visit',flow:4200},
      {from:'Paid',   to:'Visit',flow:2800},
      {from:'Social', to:'Visit',flow:1900},
      {from:'Email',  to:'Visit',flow:1400},
      {from:'Visit',  to:'Checkout',flow:3800},
      {from:'Visit',  to:'Bounce',  flow:6500},
      {from:'Checkout',to:'Purchase',flow:2900},
      {from:'Checkout',to:'Abandon', flow:900},
    ],
  }]},
  options:U.baseOpts({plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.raw.from} → ${ctx.raw.to}: ${ctx.raw.flow.toLocaleString()}`}}}})
});