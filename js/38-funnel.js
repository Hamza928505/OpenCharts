import * as U from './utils.js';

const canvas=document.getElementById('chart');
const W=canvas.offsetWidth,H=380;
canvas.width=W*devicePixelRatio;canvas.height=H*devicePixelRatio;
canvas.style.width=W+'px';canvas.style.height=H+'px';
const ctx=canvas.getContext('2d');
ctx.scale(devicePixelRatio,devicePixelRatio);

const stages=[
  {label:'Visited site',     n:24800,color:U.C.purple},
  {label:'Viewed product',   n:14200,color:U.C.blue},
  {label:'Added to cart',    n:5800, color:U.C.teal},
  {label:'Started checkout', n:3200, color:U.C.amber},
  {label:'Purchased',        n:1950, color:U.C.coral},
];
const maxN=stages[0].n;
const pad={t:20,r:180,b:20,l:20};
const cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
const rowH=ch/stages.length;

stages.forEach((s,i)=>{
  const w=(s.n/maxN)*cw;
  const x=pad.l+(cw-w)/2;
  const y=pad.t+i*rowH+3;
  const h=rowH-6;

  ctx.fillStyle=s.color+'cc';
  ctx.beginPath();
  if(i<stages.length-1){
    const nextW=(stages[i+1].n/maxN)*cw;
    const nx=pad.l+(cw-nextW)/2;
    ctx.moveTo(x,y);ctx.lineTo(x+w,y);
    ctx.lineTo(pad.l+(cw-nextW)/2+nextW,y+h);
    ctx.lineTo(pad.l+(cw-nextW)/2,y+h);
  } else {
    ctx.roundRect(x,y,w,h,3);
  }
  ctx.closePath();ctx.fill();

  // label
  ctx.fillStyle='rgba(255,255,255,.95)';
  ctx.font='500 12px DM Sans,sans-serif';
  ctx.textAlign='center';
  ctx.fillText(s.label,pad.l+cw/2,y+h/2-4);
  ctx.font='11px DM Sans,sans-serif';
  ctx.fillText(s.n.toLocaleString(),pad.l+cw/2,y+h/2+10);

  // side stats
  const pct=i===0?100:(s.n/stages[0].n*100).toFixed(1);
  const drop=i===0?'':`−${((stages[i-1].n-s.n)/stages[i-1].n*100).toFixed(0)}%`;
  ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('color')||'#111';
  ctx.textAlign='left';
  ctx.font='500 13px DM Sans,sans-serif';
  ctx.fillText(pct+'%',W-pad.r+20,y+h/2-4);
  ctx.fillStyle=U.C.coral;
  ctx.font='11px DM Sans,sans-serif';
  ctx.fillText(drop,W-pad.r+20,y+h/2+10);
});