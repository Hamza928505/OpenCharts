import * as U from './utils.js';

const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const data   = [29,29,29,39,39,39,49,49,59,59,69,79];

const chart = new Chart('chart', {
  type:'line',
  data:{
    labels,
    datasets:[{
      label:'Price ($)', data,
      borderColor:U.C.blue, backgroundColor:U.C.blueA,
      stepped:'before', fill:true,
      pointRadius:5, pointBackgroundColor:U.C.blue,
      borderWidth:2.5,
    }]
  },
  options: U.baseOpts({
    scales:{
      x: U.xAxis(),
      y: U.yAxis({ ticks:{ ...U.TICK, callback:v=>'$'+v }, min:0, max:100 }),
    }
  })
});

document.querySelectorAll('[data-step]').forEach(btn=>{
  btn.addEventListener('click',function(){
    document.querySelectorAll('[data-step]').forEach(b=>b.classList.remove('active'));
    this.classList.add('active');
    chart.data.datasets[0].stepped = this.dataset.step;
    chart.update();
  });
});