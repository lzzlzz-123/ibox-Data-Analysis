<template>
  <div class="collection-detail" v-if="!detailState.loading || detailData">
    <section class="panel detail-header">
      <div class="summary">
        <img v-if="collection?.imageUrl" :src="collection.imageUrl" alt="" />
        <div>
          <h1>{{ collection?.name ?? 'Unknown Collection' }}</h1>
          <p v-if="collection?.symbol">{{ collection.symbol }}</p>
          <p class="description" v-if="detailData?.collection.description">
            {{ detailData.collection.description }}
          </p>
          <div class="tags" v-if="detailData?.collection.tags?.length">
            <span v-for="tag in detailData.collection.tags" :key="tag">#{{ tag }}</span>
          </div>
        </div>
      </div>
      <div class="metrics">
        <StatCard
          title="Floor Price"
          :value="collection?.floorPrice ?? null"
          :precision="3"
          unit=""
        />
        <StatCard
          title="24h Volume"
          :value="collection?.volume24h ?? null"
          unit=""
        />
        <StatCard
          title="24h Change"
          :value="collection?.change24h ?? null"
          unit="%"
          :precision="2"
        />
      </div>
    </section>

    <section class="panel chart-panel">
      <header class="panel-header">
        <h2>{{ collection?.name ?? 'Collection' }} Performance</h2>
        <TimeRangeToggle
          v-model="currentRange"
          :options="timeRangeOptions"
          :name="`collection-range-${collectionId}`"
        />
      </header>
      <TrendChart
        title="Price & Volume"
        :series="seriesData"
        :loading="detailState.loading"
        height="360px"
      />
    </section>

    <section class="detail-grid">
      <EventFeed
        title="Current Listings"
        :events="listings"
        :loading="detailState.loading"
      />
      <EventFeed
        title="Recent Purchases"
        :events="purchases"
        :loading="detailState.loading"
      />
      <AlertsPanel
        title="Alert History"
        :alerts="detailAlerts"
        :loading="detailState.loading"
      />
    </section>
  </div>
  <section v-else class="panel placeholder">
    <p v-if="detailState.loading">Loading collection data…</p>
    <p v-else-if="detailState.error">{{ detailState.error }}</p>
    <p v-else>No collection data available.</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import StatCard from '@/components/StatCard.vue';
import TrendChart from '@/components/TrendChart.vue';
import TimeRangeToggle from '@/components/TimeRangeToggle.vue';
import EventFeed from '@/components/EventFeed.vue';
import AlertsPanel from '@/components/AlertsPanel.vue';
import { useCollectionsStore } from '@/stores/collections';
import type { TimeRange } from '@/stores/collections';
import { useAutoRefresh } from '@/composables/useAutoRefresh';

const props = defineProps<{ collectionId: string }>();
const collectionId = computed(() => props.collectionId);

const collectionsStore = useCollectionsStore();
const { details, filters } = storeToRefs(collectionsStore);

const detailState = computed(() => details.value[collectionId.value] ?? {
  data: null,
  loading: false,
  error: null,
});

const detailData = computed(() => detailState.value.data);

const collection = computed(() => {
  if (detailData.value?.collection) {
    return detailData.value.collection;
  }
  return collectionsStore.byId(collectionId.value);
});

const seriesData = computed(() => {
  const priceSeries = detailData.value?.chart.price ?? [];
  const volumeSeries = detailData.value?.chart.volume ?? [];
  return [
    {
      name: 'Floor Price',
      data: priceSeries.map((point) => ({
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
      data: volumeSeries.map((point) => ({
        timestamp: point.timestamp,
        price: null,
        volume: point.volume,
      })),
      color: '#f97316',
      type: 'bar' as const,
      yAxisIndex: 1,
    },
  ];
});

const listings = computed(() => detailData.value?.listings ?? []);
const purchases = computed(() => detailData.value?.purchases ?? []);
const detailAlerts = computed(() => detailData.value?.alerts ?? []);

const currentRange = computed({
  get: () => filters.value.timeRange,
  set: (range: TimeRange) => collectionsStore.setTimeRange(range),
});

const timeRangeOptions = [
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
];

async function loadDetail() {
  if (!collectionId.value) {
    return;
  }
  await collectionsStore.loadCollectionDetail(collectionId.value);
}

useAutoRefresh(loadDetail, {
  interval: collectionsStore.autoRefreshInterval,
  immediate: true,
});

watch(
  collectionId,
  () => {
    void loadDetail();
  }
);

watch(
  () => filters.value.timeRange,
  () => {
    void loadDetail();
  }
);

onMounted(async () => {
  if (!detailState.value.data) {
    await loadDetail();
  }
});
</script>

<style scoped>
.collection-detail {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.detail-header {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.summary {
  display: flex;
  gap: 1.5rem;
}

.summary img {
  width: 120px;
  height: 120px;
  border-radius: 18px;
  object-fit: cover;
}

.summary h1 {
  margin: 0;
}

.summary p {
  margin: 0.25rem 0;
  color: #94a3b8;
}

.summary .description {
  margin-top: 0.75rem;
  line-height: 1.5;
  color: #cbd5f5;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.tags span {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.85rem;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.placeholder {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
}

@media (max-width: 768px) {
  .summary {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .summary img {
    width: 100px;
    height: 100px;
  }
}
</style>
