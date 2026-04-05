import * as U from './utils.js';

let score = 72;
const chart = new Chart('chart',{
  type:'doughnut',
  data:{
    datasets:[{
      data:[score, 100-score],
      backgroundColor:[U.C.purple,'rgba(127,119,221,.1)'],
      borderWidth:0, circumference:180, rotation:270,
    }]
  },
  options: U.baseOpts({ cutout:'75%', layout:{ padding:20 } })
});

document.getElementById('slider').addEventListener('input',function(){
  score = +this.value;
  chart.data.datasets[0].data = [score, 100-score];
  chart.update();
  document.getElementById('slider-val').textContent = score+'%';
  document.getElementById('m-val').textContent = score+'%';
});
