import * as U from './utils.js';

const names=['Women','Men','Living','Accessories','Footwear'];
const colors=[U.C.purple,U.C.teal,U.C.coral,U.C.blue,U.C.amber];
const matrix=[
  [0,   1200, 800, 1500, 600],
  [1200, 0,   500,  900, 1100],
  [800,  500,  0,   400,  200],
  [1500, 900, 400,   0,   700],
  [600, 1100, 200,  700,   0],
];

const el=document.getElementById('chart');
const S=Math.min(el.offsetWidth,420),R=S/2-50;
const svg=d3.select('#chart').append('svg').attr('width',S).attr('height',S);
const g=svg.append('g').attr('transform',`translate(${S/2},${S/2})`);

const chord=d3.chord().padAngle(0.04).sortSubgroups(d3.descending);
const chords=chord(matrix);

const arc=d3.arc().innerRadius(R).outerRadius(R+18);
const ribbon=d3.ribbon().radius(R);

g.append('g').selectAll('path').data(chords.groups).join('path')
  .attr('d',arc).attr('fill',d=>colors[d.index]).attr('stroke','rgba(255,255,255,.4)').attr('stroke-width',1);

g.append('g').selectAll('path').data(chords).join('path')
  .attr('d',ribbon).attr('fill',d=>colors[d.source.index]).attr('fill-opacity',0.45)
  .attr('stroke',d=>colors[d.source.index]).attr('stroke-width',0.5)
  .append('title').text(d=>`${names[d.source.index]} ↔ ${names[d.target.index]}: ${(d.source.value).toLocaleString()} customers`);

g.append('g').selectAll('text').data(chords.groups).join('text')
  .attr('transform',d=>{const a=(d.startAngle+d.endAngle)/2-Math.PI/2;return `rotate(${a*180/Math.PI}) translate(${R+24},0) rotate(${a>0?90:-90})`;})
  .attr('text-anchor','middle').attr('font-size',11).attr('font-family','DM Sans,sans-serif')
  .attr('fill','var(--text,#111)').text(d=>names[d.index]);
