import * as U from './utils.js';

const segments=[
  {label:'Chrome',  pct:65, color:U.C.blue},
  {label:'Safari',  pct:19, color:U.C.teal},
  {label:'Firefox', pct:8,  color:U.C.coral},
  {label:'Edge',    pct:5,  color:U.C.purple},
  {label:'Other',   pct:3,  color:U.C.gray},
];
const cells=[];
segments.forEach(s=>{for(let i=0;i<s.pct;i++) cells.push(s.color);});

const grid=document.getElementById('waffle');
cells.forEach((color,i)=>{
  const d=document.createElement('div');
  d.style.cssText=`background:${color};border-radius:2px;aspect-ratio:1;transition:opacity .15s;`;
  d.title=`${segments.find(s=>s.color===color)?.label} — ${segments.find(s=>s.color===color)?.pct}%`;
  d.onmouseenter=()=>d.style.opacity='0.7';
  d.onmouseleave=()=>d.style.opacity='1';
  grid.appendChild(d);
});

const lg=document.getElementById('legend');
segments.forEach(s=>{
  const span=document.createElement('span');
  span.className='legend-item';
  span.innerHTML=`<span class="legend-swatch" style="background:${s.color}"></span>${s.label} ${s.pct}%`;
  lg.appendChild(span);
});
