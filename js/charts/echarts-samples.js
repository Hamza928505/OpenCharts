export const echartsSamples = [
  {
    id: 'echarts-heatmap',
    title: 'ECharts Heatmap',
    category: 'Distribution',
    blurb: 'A heatmap created using Apache ECharts renderer.',
    tags: ['echarts', 'heatmap', 'matrix'],
    spec: {
      data: [
        [0, 0, 5], [0, 1, 1], [0, 2, 0], [0, 3, 0], [0, 4, 0], [0, 5, 0],
        [1, 0, 3], [1, 1, 2], [1, 2, 0], [1, 3, 0], [1, 4, 0], [1, 5, 0],
        [2, 0, 1], [2, 1, 0], [2, 2, 0], [2, 3, 0], [2, 4, 0], [2, 5, 0]
      ],
      xAxisData: ['12a', '1a', '2a', '3a', '4a', '5a'],
      yAxisData: ['Saturday', 'Friday', 'Thursday'],
    },
    controls: [],
    echarts: {
      height: 400,
      build(spec, env) {
        return {
          tooltip: { position: 'top' },
          grid: { height: '80%', top: '10%' },
          xAxis: {
            type: 'category',
            data: spec.xAxisData,
            splitArea: { show: true }
          },
          yAxis: {
            type: 'category',
            data: spec.yAxisData,
            splitArea: { show: true }
          },
          visualMap: {
            min: 0,
            max: 10,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '0%'
          },
          series: [
            {
              name: 'Punch Card',
              type: 'heatmap',
              data: spec.data,
              label: { show: true },
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
              }
            }
          ]
        };
      }
    }
  }
];
