import * as U from './utils.js';

const raw=[
  {name:'Email Q4',channel:'Email',v:420},{name:'Email Q3',channel:'Email',v:310},{name:'Email Q2',channel:'Email',v:280},
  {name:'Instagram',channel:'Social',v:380},{name:'Facebook',channel:'Social',v:290},{name:'TikTok',channel:'Social',v:220},{name:'Twitter',channel:'Social',v:110},
  {name:'Google Ads',channel:'Paid',v:540},{name:'Display',channel:'Paid',v:195},{name:'YouTube',channel:'Paid',v:260},
  {name:'SEO Blog',channel:'Organic',v:310},{name:'SEO Brand',channel:'Organic',v:180},{name:'Direct',channel:'Organic',v:240},
];
const chColors={Email:U.C.purple,Social:U.C.teal,Paid:U.C.coral,Organic:U.C.blue};
const el=document.getElementById('chart');
const W=el.offsetWidth,H=400;

const svg=d3.select('#chart').append('svg').attr('width',W).attr('height',H);
const pack=d3.pack().size([W,H]).padding(6);
const root=d3.hierarchy({children:raw}).sum(d=>d.v||0);
pack(root);

const nodes=svg.selectAll('g').data(root.leaves()).join('g')
  .attr('transform',d=>`translate(${d.x},${d.y})`).style('cursor','default');

nodes.append('circle')
  .attr('r',d=>d.r)
  .attr('fill',d=>chColors[d.data.channel]+'99')
  .attr('stroke',d=>chColors[d.data.channel])
  .attr('stroke-width',1);

nodes.append('text')
  .attr('text-anchor','middle').attr('dy','0.35em')
  .attr('font-size',d=>Math.min(d.r*0.38,12))
  .attr('font-family','DM Sans,sans-serif')
  .attr('fill','var(--text,#111)').attr('pointer-events','none')
  .text(d=>d.r>20?d.data.name:'');

nodes.append('title').text(d=>`${d.data.name}\n${d.data.channel}\n${d.data.v} conversions`);

// Legend
const channels=[...new Set(raw.map(d=>d.channel))];
const lg=svg.append('g').attr('transform',`translate(12,${H-22})`);
channels.forEach((ch,i)=>{
  const g=lg.append('g').attr('transform',`translate(${i*100},0)`);
  g.append('circle').attr('r',5).attr('fill',chColors[ch]).attr('cx',0).attr('cy',0);
  g.append('text').attr('x',10).attr('y',4).attr('font-size',11).attr('font-family','DM Sans,sans-serif').attr('fill','var(--muted,#888)').text(ch);
});