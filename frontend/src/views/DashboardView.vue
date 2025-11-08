<template>
  <div class="dashboard-view">
    <section class="card-grid">
      <StatCard
        v-for="card in kpiCards"
        :key="card.title"
        :title="card.title"
        :value="card.value"
        :delta="card.delta"
        :unit="card.unit"
        :precision="card.precision"
      />
    </section>

    <section class="panel chart-panel">
      <header class="panel-header">
        <h2>Market Overview</h2>
        <TimeRangeToggle
          v-model="currentRange"
          :options="timeRangeOptions"
        />
      </header>
      <TrendChart
        title="Global Floor Price & Volume"
        :series="trendSeries"
        :loading="collectionsLoading"
        height="360px"
      />
    </section>

    <section class="layout-grid">
      <CollectionTable
        title="Top Movers"
        :collections="topMovers"
        :loading="collectionsLoading"
      />
      <AlertsPanel
        :alerts="recentAlerts"
        :loading="alertsLoading"
      >
        <template #actions>
          <select v-model="alertFilter" class="alert-filter">
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </template>
      </AlertsPanel>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import StatCard from '@/components/StatCard.vue';
import TrendChart from '@/components/TrendChart.vue';
import CollectionTable from '@/components/CollectionTable.vue';
import AlertsPanel from '@/components/AlertsPanel.vue';
import TimeRangeToggle from '@/components/TimeRangeToggle.vue';
import { useCollectionsStore } from '@/stores/collections';
import { useAlertsStore } from '@/stores/alerts';
import { useAutoRefresh } from '@/composables/useAutoRefresh';

const collectionsStore = useCollectionsStore();
const alertsStore = useAlertsStore();

const { summaries, topMovers, globalSeries, loading: collectionsLoading, filters } = storeToRefs(collectionsStore);
const { filteredAlerts, loading: alertsLoading, filter } = storeToRefs(alertsStore);

const totalVolume = computed(() =>
  summaries.value.reduce((total, collection) => total + (collection.volume24h ?? 0), 0)
);

const averageFloor = computed(() => {
  if (!summaries.value.length) {
    return 0;
  }
  const total = summaries.value.reduce((sum, collection) => sum + (collection.floorPrice ?? 0), 0);
  return total / summaries.value.length;
});

const bestPerformer = computed(() => {
  if (!summaries.value.length) {
    return null;
  }
  return summaries.value.reduce((best, current) => {
    if (!best) return current;
    if ((current.change24h ?? 0) > (best.change24h ?? 0)) {
      return current;
    }
    return best;
  }, summaries.value[0]);
});

const worstPerformer = computed(() => {
  if (!summaries.value.length) {
    return null;
  }
  return summaries.value.reduce((worst, current) => {
    if (!worst) return current;
    if ((current.change24h ?? 0) < (worst.change24h ?? 0)) {
      return current;
    }
    return worst;
  }, summaries.value[0]);
});

const kpiCards = computed(() => [
  {
    title: 'Total Volume (24h)',
    value: Number.isFinite(totalVolume.value) ? totalVolume.value : null,
    delta: null,
    unit: '',
    precision: 0,
  },
  {
    title: 'Average Floor Price',
    value: Number.isFinite(averageFloor.value) ? averageFloor.value : null,
    delta: null,
    unit: '',
    precision: 3,
  },
  {
    title: 'Best Performer',
    value: bestPerformer.value?.change24h ?? null,
    delta: null,
    unit: '%',
    precision: 2,
  },
  {
    title: 'Worst Performer',
    value: worstPerformer.value?.change24h ?? null,
    delta: null,
    unit: '%',
    precision: 2,
  },
]);

const trendSeries = computed(() => [
  {
    name: 'Floor Price',
    data: globalSeries.value.map((point) => ({
      timestamp: point.timestamp,
      price: point.price,
      volume: null,
    })),
    color: '#38bdf8',
    type: 'line' as const,
    area: true,
  },
  {
    name: 'Volume',
    data: globalSeries.value.map((point) => ({
      timestamp: point.timestamp,
      price: null,
      volume: point.volume,
    })),
    color: '#f97316',
    type: 'bar' as const,
    yAxisIndex: 1,
  },
]);

const recentAlerts = computed(() => filteredAlerts.value.slice(0, 6));

const currentRange = computed({
  get: () => filters.value.timeRange,
  set: (range) => collectionsStore.setTimeRange(range),
});

const alertFilter = computed({
  get: () => filter.value,
  set: (value) => alertsStore.setFilter(value),
});

const timeRangeOptions = [
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
];

async function loadData() {
  await Promise.all([
    collectionsStore.loadCollections(),
    alertsStore.loadAlerts(),
  ]);
}

useAutoRefresh(loadData, { interval: collectionsStore.autoRefreshInterval, immediate: true });

watch(
  () => filters.value.timeRange,
  () => {
    void collectionsStore.loadCollections();
  }
);

onMounted(async () => {
  if (!summaries.value.length) {
    await loadData();
  }
});
</script>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.chart-panel {
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.layout-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1.2fr);
  gap: 1.5rem;
}

.alert-filter {
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.25);
  color: #e2e8f0;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
}

@media (max-width: 1024px) {
  .layout-grid {
    grid-template-columns: 1fr;
  }
}
</style>
