import * as U from './utils.js';

const years=[2020,2021,2022,2023,2024];
const cats=[
  {name:'Women', color:U.C.purple, vals:[420,480,520,580,640]},
  {name:'Men',   color:U.C.teal,   vals:[310,340,380,410,450]},
  {name:'Living',color:U.C.coral,  vals:[180,220,260,290,320]},
  {name:'Sale',  color:U.C.blue,   vals:[120,145,130,160,175]},
];

const el=document.getElementById('chart');
const W=el.offsetWidth,H=380,pad={t:20,r:20,b:30,l:50};

const rows=years.map((_,yi)=>{
  const row={year:years[yi]};
  cats.forEach(c=>row[c.name]=c.vals[yi]);
  return row;
});

const stack=d3.stack().keys(cats.map(c=>c.name)).offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut);
const series=stack(rows);

const xScale=d3.scaleLinear().domain([0,years.length-1]).range([pad.l,W-pad.r]);
const yExtent=d3.extent(series.flatMap(s=>s.flatMap(d=>d)));
const yScale=d3.scaleLinear().domain(yExtent).range([H-pad.b,pad.t]);

const svg=d3.select('#chart').append('svg').attr('width',W).attr('height',H);

const area=d3.area().x((_,i)=>xScale(i)).y0(d=>yScale(d[0])).y1(d=>yScale(d[1])).curve(d3.curveCatmullRom);

svg.selectAll('path').data(series).join('path')
  .attr('d',area)
  .attr('fill',(d,i)=>cats[i].color+'cc')
  .attr('stroke',(d,i)=>cats[i].color)
  .attr('stroke-width',0.5);

// x axis
svg.append('g').attr('transform',`translate(0,${H-pad.b})`).call(d3.axisBottom(xScale).ticks(5).tickFormat((_,i)=>years[i]||'').tickSize(3))
  .call(g=>g.select('.domain').remove())
  .call(g=>g.selectAll('text').attr('font-size',11).attr('font-family','DM Sans,sans-serif').attr('fill','var(--muted,#888)'));

// Legend
const lg=svg.append('g').attr('transform',`translate(${pad.l},14)`);
cats.forEach((c,i)=>{
  const g=lg.append('g').attr('transform',`translate(${i*90},0)`);
  g.append('rect').attr('width',10).attr('height',10).attr('fill',c.color).attr('rx',2).attr('y',-9);
  g.append('text').attr('x',14).attr('font-size',11).attr('font-family','DM Sans,sans-serif').attr('fill','var(--muted,#888)').text(c.name);
});