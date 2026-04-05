import * as U from './utils.js';

const data=[
  {label:'Outerwear', a:28, b:35, color:U.C.teal},
  {label:'Dresses',   a:22, b:18, color:U.C.coral},
  {label:'Footwear',  a:18, b:21, color:U.C.blue},
  {label:'Basics',    a:16, b:14, color:U.C.gray},
  {label:'Accessories',a:10,b:7,  color:U.C.amber},
  {label:'Living',    a:6,  b:5,  color:U.C.purple},
];
const canvas=document.getElementById('chart');
const W=canvas.offsetWidth,H=380;
canvas.width=W*devicePixelRatio;canvas.height=H*devicePixelRatio;
canvas.style.width=W+'px';canvas.style.height=H+'px';
const ctx=canvas.getContext('2d');
ctx.scale(devicePixelRatio,devicePixelRatio);

const allV=data.flatMap(d=>[d.a,d.b]);
const minV=Math.min(...allV)-4,maxV=Math.max(...allV)+4;
const pad={t:30,r:140,b:30,l:140};
const toY=v=>pad.t+(maxV-v)/(maxV-minV)*(H-pad.t-pad.b);
const xA=pad.l,xB=W-pad.r;

// axis labels
ctx.fillStyle='rgba(128,128,128,.8)';ctx.font='500 12px DM Sans,sans-serif';ctx.textAlign='center';
ctx.fillText('2022',xA,18);ctx.fillText('2024',xB,18);
ctx.strokeStyle='rgba(128,128,128,.2)';ctx.lineWidth=1;
ctx.beginPath();ctx.moveTo(xA,22);ctx.lineTo(xA,H-pad.b+10);ctx.stroke();
ctx.beginPath();ctx.moveTo(xB,22);ctx.lineTo(xB,H-pad.b+10);ctx.stroke();

data.forEach(d=>{
  const ya=toY(d.a),yb=toY(d.b);
  const up=d.b>d.a;
  ctx.strokeStyle=d.color+(up?'cc':'88');ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(xA,ya);ctx.lineTo(xB,yb);ctx.stroke();
  [xA,xB].forEach((x,i)=>{
    ctx.beginPath();ctx.arc(x,i===0?ya:yb,6,0,Math.PI*2);
    ctx.fillStyle=d.color;ctx.fill();
  });
  // labels
  ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('color')||'#111';
  ctx.font='12px DM Sans,sans-serif';ctx.textAlign='right';
  ctx.fillText(`${d.label} ${d.a}%`,xA-14,ya+4);
  ctx.textAlign='left';
  ctx.fillStyle=up?U.C.teal:U.C.coral;
  ctx.fillText(`${d.b}%  ${up?'▲':'▼'}${Math.abs(d.b-d.a)}pp`,xB+14,yb+4);
});