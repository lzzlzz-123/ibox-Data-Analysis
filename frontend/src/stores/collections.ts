import { defineStore } from 'pinia';
import type {
  CollectionDetailResponse,
  CollectionSummary,
  TimeSeriesPoint,
} from '@/services/api';
import { fetchCollectionDetail, fetchCollections } from '@/services/api';

export type TimeRange = '24h' | '7d' | '30d' | '90d';

interface CollectionDetailState {
  data: CollectionDetailResponse | null;
  loading: boolean;
  error: string | null;
}

interface CollectionsState {
  summaries: CollectionSummary[];
  topMovers: CollectionSummary[];
  globalSeries: TimeSeriesPoint[];
  details: Record<string, CollectionDetailState>;
  filters: {
    search: string;
    timeRange: TimeRange;
  };
  autoRefreshInterval: number;
  lastUpdated: number | null;
  loading: boolean;
  error: string | null;
}

function dedupeBy<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  items.forEach((item) => {
    if (!item?.id) {
      return;
    }
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

export const useCollectionsStore = defineStore('collections', {
  state: (): CollectionsState => ({
    summaries: [],
    topMovers: [],
    globalSeries: [],
    details: {},
    filters: {
      search: '',
      timeRange: '24h',
    },
    autoRefreshInterval: 60_000,
    lastUpdated: null,
    loading: false,
    error: null,
  }),
  getters: {
    filteredSummaries(state): CollectionSummary[] {
      const search = state.filters.search.trim().toLowerCase();
      if (!search) {
        return state.summaries;
      }
      return state.summaries.filter((summary) =>
        [summary.name, summary.symbol]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(search))
      );
    },
    byId(state) {
      return (collectionId: string) =>
        state.summaries.find((summary) => summary.id === collectionId) || null;
    },
  },
  actions: {
    setTimeRange(range: TimeRange) {
      this.filters.timeRange = range;
    },
    setSearch(search: string) {
      this.filters.search = search;
    },
    setAutoRefreshInterval(interval: number) {
      if (Number.isFinite(interval) && interval >= 10_000) {
        this.autoRefreshInterval = interval;
      }
    },
    async loadCollections() {
      this.loading = true;
      this.error = null;
      try {
        const payload = await fetchCollections();
        this.summaries = dedupeBy(payload.summaries);
        this.topMovers = dedupeBy(payload.topMovers).slice(0, 10);
        this.globalSeries = payload.globalSeries;
        this.lastUpdated = Date.now();
      } catch (error) {
        this.error = (error as Error).message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async loadCollectionDetail(collectionId: string, params?: Record<string, unknown>) {
      if (!collectionId) {
        return;
      }
      if (!this.details[collectionId]) {
        this.details[collectionId] = {
          data: null,
          loading: false,
          error: null,
        };
      }
      const entry = this.details[collectionId];
      entry.loading = true;
      entry.error = null;
      try {
        const payload = await fetchCollectionDetail(collectionId, {
          range: this.filters.timeRange,
          ...params,
        });
        entry.data = {
          ...payload,
          listings: dedupeBy(payload.listings),
          purchases: dedupeBy(payload.purchases),
        };
        this.lastUpdated = Date.now();
      } catch (error) {
        entry.error = (error as Error).message;
        throw error;
      } finally {
        entry.loading = false;
      }
    },
  },
});
