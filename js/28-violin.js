import * as U from './utils.js';

const canvas=document.getElementById('chart');
const W=canvas.offsetWidth; const H=360;
canvas.width=W*devicePixelRatio; canvas.height=H*devicePixelRatio;
canvas.style.width=W+'px'; canvas.style.height=H+'px';
const ctx=canvas.getContext('2d');
ctx.scale(devicePixelRatio,devicePixelRatio);

const gauss=(mu,s)=>{const u=Math.random(),v=Math.random();return mu+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const groups=[
  {label:'Desktop', color:U.C.purple, data:Array.from({length:300},()=>Math.max(0.5,gauss(8,3)))},
  {label:'Mobile',  color:U.C.teal,   data:Array.from({length:300},()=>Math.max(0.5,gauss(4.5,2)))},
  {label:'Tablet',  color:U.C.coral,  data:Array.from({length:300},()=>Math.max(0.5,gauss(6.5,2.5)))},
];

const minV=0, maxV=18, pad=40;
const colW=(W-pad*2)/groups.length;
const toY=v=>H-pad-(v-minV)/(maxV-minV)*(H-pad*2);

function kde(data, bw=0.8) {
  const pts=[];
  for(let v=minV;v<=maxV;v+=0.3){
    const d=data.reduce((s,x)=>s+Math.exp(-0.5*((v-x)/bw)**2)/(bw*Math.sqrt(2*Math.PI)),0)/data.length;
    pts.push({v,d});
  }
  return pts;
}

groups.forEach((g,i)=>{
  const cx=pad+colW*i+colW/2;
  const pts=kde(g.data);
  const maxD=Math.max(...pts.map(p=>p.d));
  const scale=(colW*0.42)/maxD;

  ctx.beginPath();
  pts.forEach((p,j)=>{const x=cx+p.d*scale,y=toY(p.v);j===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  pts.slice().reverse().forEach(p=>ctx.lineTo(cx-p.d*scale,toY(p.v)));
  ctx.closePath();
  ctx.fillStyle=g.color+'33';
  ctx.fill();
  ctx.strokeStyle=g.color;
  ctx.lineWidth=1.5;
  ctx.stroke();

  // median line
  const sorted=[...g.data].sort((a,b)=>a-b);
  const med=sorted[Math.floor(sorted.length/2)];
  const q1=sorted[Math.floor(sorted.length/4)];
  const q3=sorted[Math.floor(sorted.length*3/4)];
  ctx.strokeStyle=g.color;
  ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cx-8,toY(med));ctx.lineTo(cx+8,toY(med));ctx.stroke();
  ctx.fillStyle=g.color;
  ctx.fillRect(cx-3,toY(q3),6,toY(q1)-toY(q3));

  // label
  ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--text')||'#111';
  ctx.font='12px DM Sans,sans-serif';
  ctx.textAlign='center';
  ctx.fillText(g.label,cx,H-8);
});

// axes
ctx.strokeStyle='rgba(128,128,128,.2)';
ctx.lineWidth=1;
for(let v=0;v<=18;v+=3){
  const y=toY(v);
  ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();
  ctx.fillStyle='rgba(128,128,128,.7)';
  ctx.font='10px DM Sans,sans-serif';
  ctx.textAlign='right';
  ctx.fillText(v+'m',pad-4,y+4);
}