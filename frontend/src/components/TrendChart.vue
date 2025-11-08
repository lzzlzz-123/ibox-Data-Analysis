<template>
  <section class="trend-chart panel" role="group" :aria-busy="loading">
    <header>
      <h2>{{ title }}</h2>
      <slot name="controls"></slot>
    </header>
    <div v-if="!hasData && !loading" class="empty-state">{{ emptyMessage }}</div>
    <div v-else ref="chartRef" class="chart" :style="{ height }"></div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { TimeSeriesPoint } from '@/services/api';

const props = withDefaults(
  defineProps<{
    title: string;
    series: Array<{
      name: string;
      data: TimeSeriesPoint[];
      type?: 'line' | 'bar';
      area?: boolean;
      yAxisIndex?: number;
      color?: string;
    }>;
    loading?: boolean;
    height?: string;
    emptyMessage?: string;
  }>(),
  {
    loading: false,
    height: '320px',
    emptyMessage: 'No data available for the selected range.',
  }
);

const chartRef = ref<HTMLDivElement | null>(null);
let chartInstance: import('echarts').ECharts | null = null;

const hasData = computed(() => props.series.some((serie) => serie.data.length > 0));

async function initChart() {
  if (!chartRef.value) {
    return;
  }
  const echarts = await import('echarts');
  if (chartInstance) {
    chartInstance.dispose();
  }
  chartInstance = echarts.init(chartRef.value);
  updateChart();
}

function getOption(): import('echarts').EChartsOption {
  const timestamps = Array.from(
    new Set(
      props.series.flatMap((serie) =>
        serie.data.map((point) => point.timestamp)
      )
    )
  ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const series = props.series.map((serie) => ({
    type: serie.type ?? 'line',
    name: serie.name,
    smooth: true,
    showSymbol: false,
    areaStyle: serie.area ? {} : undefined,
    yAxisIndex: serie.yAxisIndex ?? 0,
    itemStyle: serie.color
      ? {
          color: serie.color,
        }
      : undefined,
    data: timestamps.map((timestamp) => {
      const match = serie.data.find((point) => point.timestamp === timestamp);
      return match ? [timestamp, match.price ?? match.volume ?? 0] : [timestamp, 0];
    }),
  }));

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      textStyle: {
        color: '#e2e8f0',
      },
    },
    grid: {
      left: 24,
      right: 16,
      top: 32,
      bottom: 24,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: timestamps,
      axisLine: {
        lineStyle: {
          color: 'rgba(148, 163, 184, 0.4)',
        },
      },
      axisLabel: {
        color: '#cbd5f5',
      },
    },
    yAxis: [
      {
        type: 'value',
        axisLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.4)',
          },
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.2)',
          },
        },
        axisLabel: {
          color: '#cbd5f5',
        },
      },
      {
        type: 'value',
        axisLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.4)',
          },
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.2)',
          },
        },
        axisLabel: {
          color: '#cbd5f5',
        },
      },
    ],
    series,
  };
}

function updateChart() {
  if (!chartInstance) {
    return;
  }
  chartInstance.setOption(getOption());
}

onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance?.dispose();
  chartInstance = null;
});

function handleResize() {
  chartInstance?.resize();
}

watch(
  () => props.series,
  () => {
    if (chartInstance) {
      updateChart();
    } else {
      initChart();
    }
  },
  { deep: true }
);
</script>

<style scoped>
.trend-chart header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.trend-chart h2 {
  margin: 0;
}

.chart {
  width: 100%;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
}
</style>
