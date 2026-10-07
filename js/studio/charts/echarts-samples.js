export const echartsSamples = [
  {
    id: 'echarts-heatmap',
    title: 'ECharts Heatmap',
    category: 'Distribution',
    blurb: 'A row-by-column grid with colour for the value, rendered by Apache ECharts.',
    tags: ['echarts', 'heatmap', 'matrix', 'grid'],
    spec: {
      rows: ['Saturday', 'Friday', 'Thursday'],
      cols: ['12a', '1a', '2a', '3a', '4a', '5a'],
      cells: [
        { x: 0, y: 0, v: 5 }, { x: 1, y: 0, v: 1 }, { x: 2, y: 0, v: 0 },
        { x: 3, y: 0, v: 0 }, { x: 4, y: 0, v: 0 }, { x: 5, y: 0, v: 0 },
        { x: 0, y: 1, v: 3 }, { x: 1, y: 1, v: 2 }, { x: 2, y: 1, v: 0 },
        { x: 3, y: 1, v: 0 }, { x: 4, y: 1, v: 0 }, { x: 5, y: 1, v: 0 },
        { x: 0, y: 2, v: 1 }, { x: 1, y: 2, v: 0 }, { x: 2, y: 2, v: 0 },
        { x: 3, y: 2, v: 0 }, { x: 4, y: 2, v: 0 }, { x: 5, y: 2, v: 0 },
      ],
      dataMode: 'cells',
    },
    controls: [],
    echarts: {
      height: 400,
      build(spec, env) {
        const compact = !!env?.compact;
        const cells = (spec.cells || []).map((c) => [c.x, c.y, c.v]);
        const max = cells.reduce((m, c) => Math.max(m, Number(c[2]) || 0), 0) || 1;
        return {
          tooltip: { show: !compact, position: 'top' },
          grid: compact
            ? { top: 4, right: 4, bottom: 4, left: 4 }
            : { top: 16, right: 16, bottom: 88, left: 12, containLabel: true },
          xAxis: { type: 'category', data: spec.cols || [], show: !compact },
          yAxis: { type: 'category', data: spec.rows || [], inverse: true, show: !compact },
          visualMap: {
            min: 0,
            max,
            show: !compact,
            calculable: !compact,
            inRange: { color: ['#eef7f0', '#a6ddb4', '#4aa76d'] },
            orient: 'horizontal',
            left: 'center',
            bottom: 8,
          },
          series: [
            {
              name: 'Value',
              type: 'heatmap',
              data: cells,
              label: { show: !compact },
              emphasis: {
                itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' },
              },
            },
          ],
        };
      },
    },
  },
];
