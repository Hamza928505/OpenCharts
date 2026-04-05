import * as U from './utils.js';

const canvas=document.getElementById('chart');
const W=canvas.offsetWidth,H=360;
canvas.width=W*devicePixelRatio;canvas.height=H*devicePixelRatio;
canvas.style.width=W+'px';canvas.style.height=H+'px';
const ctx=canvas.getContext('2d');
ctx.scale(devicePixelRatio,devicePixelRatio);

const data=[
  {label:'Onboarding',val:82,color:U.C.purple},
  {label:'Support',val:74,color:U.C.teal},
  {label:'Sales',val:68,color:U.C.blue},
  {label:'Billing',val:55,color:U.C.coral},
  {label:'Delivery',val:79,color:U.C.teal},
  {label:'Returns',val:48,color:U.C.amber},
  {label:'Product',val:88,color:U.C.purple},
  {label:'Website',val:71,color:U.C.blue},
];

const pad={t:20,r:20,b:32,l:110};
const cw=W-pad.l-pad.r, ch=H-pad.t-pad.b;
const rowH=ch/data.length;
const toX=v=>pad.l+(v/100)*cw;

// grid
for(let v=0;v<=100;v+=20){
  const x=toX(v);
  ctx.strokeStyle='rgba(128,128,128,.12)';
  ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();
  ctx.fillStyle='rgba(128,128,128,.6)';
  ctx.font='10px DM Sans,sans-serif';
  ctx.textAlign='center';
  ctx.fillText(v,x,H-pad.b+14);
}

data.forEach((d,i)=>{
  const y=pad.t+rowH*(i+0.5);
  const x=toX(d.val);
  // stem
  ctx.strokeStyle=d.color+'88';
  ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(x,y);ctx.stroke();
  // dot
  ctx.beginPath();
  ctx.arc(x,y,7,0,Math.PI*2);
  ctx.fillStyle=d.color;
  ctx.fill();
  // label
  ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('color')||'#111';
  ctx.font='12px DM Sans,sans-serif';
  ctx.textAlign='right';
  ctx.fillText(d.label,pad.l-10,y+4);
  // value
  ctx.fillStyle=d.color;
  ctx.textAlign='left';
  ctx.font='500 11px DM Sans,sans-serif';
  ctx.fillText(d.val,x+12,y+4);
});
