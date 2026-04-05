import * as U from './utils.js';

const chart = new Chart('chart',{
  type:'bubble',
  data:{
    datasets:[
      { label:'Women', data:[{x:68,y:42,r:22},{x:45,y:55,r:14},{x:80,y:35,r:10}], backgroundColor:'rgba(127,119,221,.65)', borderColor:U.C.purple, borderWidth:1 },
      { label:'Men',   data:[{x:52,y:38,r:18},{x:30,y:60,r:12},{x:70,y:48,r:8}],  backgroundColor:'rgba(29,158,117,.65)',  borderColor:U.C.teal,   borderWidth:1 },
      { label:'Living',data:[{x:38,y:65,r:9}, {x:60,y:30,r:15},{x:20,y:50,r:7}],  backgroundColor:'rgba(216,90,48,.65)',   borderColor:U.C.coral,  borderWidth:1 },
    ]
  },
  options: U.baseOpts({
    layout:{ padding:20 },
    scales:{
      x: U.yAxis({ min:0, max:100, title:{ display:true, text:'Revenue contribution (%)', font:{ size:11 } } }),
      y: U.yAxis({ min:0, max:100, title:{ display:true, text:'Gross margin (%)', font:{ size:11 } } }),
    }
  })
});
U.buildLegend(chart,'legend');