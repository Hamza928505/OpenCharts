import * as U from './utils.js';

const chart = new Chart('chart',{
  type:'scatter',
  data:{
    datasets:[
      { label:'High-value',   data:U.randPts(30,75,80,12), backgroundColor:'rgba(127,119,221,.65)', pointRadius:6 },
      { label:'Regular',      data:U.randPts(40,45,45,15), backgroundColor:'rgba(29,158,117,.65)',  pointRadius:6 },
      { label:'Occasional',   data:U.randPts(35,20,25,12), backgroundColor:'rgba(216,90,48,.65)',   pointRadius:6 },
    ]
  },
  options: U.baseOpts({
    scales:{
      x: U.yAxis({ min:0, max:100, title:{ display:true, text:'Avg order value ($)', font:{ size:11 } } }),
      y: U.yAxis({ min:0, max:100, title:{ display:true, text:'Purchase frequency', font:{ size:11 } } }),
    }
  })
});
U.buildLegend(chart,'legend');