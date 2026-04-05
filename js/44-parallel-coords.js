import * as U from './utils.js';

const dims=['Price','Rating','Reviews','Margin%','Returns%'];
const products=Array.from({length:40},(_,i)=>{
  const cat=i%3;
  return {
    cat,
    Price: cat===0?U.rand(80,200):cat===1?U.rand(30,90):U.rand(15,60),
    Rating:+(2.5+Math.random()*2.4).toFixed(1),
    Reviews:U.rand(10,500),
    'Margin%':U.rand(15,65),
    'Returns%':U.rand(2,20),
  };
});
const colors=[U.C.purple,U.C.teal,U.C.coral];

const el=document.getElementById('chart');
const W=el.offsetWidth,H=380,pad={t:40,r:30,b:20,l:30};
const svg=d3.select('#chart').append('svg').attr('width',W).attr('height',H);

const x=d3.scalePoint().domain(dims).range([pad.l,W-pad.r]);
const y={};
dims.forEach(d=>{
  y[d]=d3.scaleLinear().domain(d3.extent(products,p=>p[d])).range([H-pad.b,pad.t]);
});

const line=d=>d3.line()(dims.map(dim=>[x(dim),y[dim](d[dim])]));

svg.append('g').selectAll('path').data(products).join('path')
  .attr('d',line).attr('fill','none')
  .attr('stroke',d=>colors[d.cat]).attr('stroke-width',1.2)
  .attr('stroke-opacity',0.45);

dims.forEach(dim=>{
  const g=svg.append('g').attr('transform',`translate(${x(dim)},0)`);
  g.call(d3.axisLeft(y[dim]).ticks(5).tickSize(3))
   .call(gr=>gr.select('.domain').attr('stroke','rgba(128,128,128,.3)'))
   .call(gr=>gr.selectAll('text').attr('font-size',10).attr('font-family','DM Sans,sans-serif').attr('fill','var(--muted,#888)'))
   .call(gr=>gr.selectAll('.tick line').attr('stroke','rgba(128,128,128,.3)'));
  g.append('text').attr('y',pad.t-14).attr('text-anchor','middle')
   .attr('font-size',11).attr('font-weight',500).attr('font-family','DM Sans,sans-serif')
   .attr('fill','var(--text,#111)').text(dim);
});

// Legend
const lg=svg.append('g').attr('transform',`translate(${W-180},${pad.t})`);
['Premium','Mid','Value'].forEach((l,i)=>{
  const g=lg.append('g').attr('transform',`translate(0,${i*18})`);
  g.append('line').attr('x2',16).attr('stroke',colors[i]).attr('stroke-width',2).attr('y1',-4).attr('y2',-4);
  g.append('text').attr('x',20).attr('font-size',11).attr('font-family','DM Sans,sans-serif').attr('fill','var(--muted,#888)').text(l);
});