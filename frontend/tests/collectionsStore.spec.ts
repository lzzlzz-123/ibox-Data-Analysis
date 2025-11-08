import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/services/api', () => ({
  fetchCollections: vi.fn(),
  fetchCollectionDetail: vi.fn(),
}));

import { fetchCollections, fetchCollectionDetail } from '@/services/api';
import type { CollectionDetailResponse, CollectionSummary } from '@/services/api';
import { useCollectionsStore } from '@/stores/collections';

const mockedFetchCollections = fetchCollections as unknown as vi.MockedFunction<typeof fetchCollections>;
const mockedFetchCollectionDetail = fetchCollectionDetail as unknown as vi.MockedFunction<typeof fetchCollectionDetail>;

function createCollection(id: string, overrides: Partial<CollectionSummary> = {}): CollectionSummary {
  return {
    ...stubCollection(id),
    ...overrides,
  };
}

function stubCollection(id: string): CollectionSummary {
  return {
    id,
    name: `Collection ${id}`,
    floorPrice: 1,
    volume24h: 10,
    change24h: 5,
    lastUpdated: new Date().toISOString(),
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  mockedFetchCollections.mockReset();
  mockedFetchCollectionDetail.mockReset();
});

describe('Collections Store', () => {
  it('deduplicates collection summaries when loading data', async () => {
    mockedFetchCollections.mockResolvedValue({
      summaries: [createCollection('1'), createCollection('1'), createCollection('2')],
      topMovers: [createCollection('1'), createCollection('2'), createCollection('2')],
      globalSeries: [
        { timestamp: '2023-01-01T00:00:00Z', price: 1, volume: 2 },
        { timestamp: '2023-01-02T00:00:00Z', price: 2, volume: 3 },
      ],
    });

    const store = useCollectionsStore();
    await store.loadCollections();

    expect(store.summaries).toHaveLength(2);
    expect(store.topMovers).toHaveLength(2);
  });

  it('stores detailed data with deduplicated listings and purchases', async () => {
    const detailResponse: CollectionDetailResponse = {
      collection: {
        ...createCollection('99'),
        description: 'A curated crypto collection.',
      },
      chart: {
        price: [
          { timestamp: '2023-01-01T00:00:00Z', price: 1, volume: null },
          { timestamp: '2023-01-02T00:00:00Z', price: 1.5, volume: null },
        ],
        volume: [
          { timestamp: '2023-01-01T00:00:00Z', price: null, volume: 100 },
        ],
      },
      listings: [
        { id: 'list-a', type: 'listing', timestamp: '2023-01-02T00:00:00Z' },
        { id: 'list-a', type: 'listing', timestamp: '2023-01-02T00:00:00Z' },
      ],
      purchases: [
        { id: 'buy-a', type: 'sale', timestamp: '2023-01-03T00:00:00Z' },
        { id: 'buy-b', type: 'sale', timestamp: '2023-01-04T00:00:00Z' },
        { id: 'buy-b', type: 'sale', timestamp: '2023-01-04T00:00:00Z' },
      ],
      alerts: [],
    };

    mockedFetchCollectionDetail.mockResolvedValue(detailResponse);

    const store = useCollectionsStore();
    await store.loadCollectionDetail('99');

    const detail = store.details['99'].data;
    expect(detail).toBeTruthy();
    expect(detail?.listings).toHaveLength(1);
    expect(detail?.purchases).toHaveLength(2);
  });
});
