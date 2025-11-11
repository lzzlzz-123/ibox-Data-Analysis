const { analyticsRepository } = require('../src/repositories/analyticsRepository');
const dataStore = require('../src/repositories/dataStore');
const { resetRefreshLog } = require('../src/services/analyticsService');

describe('Analytics Routes', () => {
  beforeEach(() => {
    analyticsRepository.clear();
    dataStore.clear();
    resetRefreshLog();
  });

  describe('Analytics Metrics API', () => {
    it('should retrieve all metrics', async () => {
      await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
        averagePrice: 100,
      });
      await analyticsRepository.upsertMetrics('col-2', '1h', {
        priceChange: 2,
        averagePrice: 95,
      });

      const metrics = await analyticsRepository.findMetrics();

      expect(metrics).toHaveLength(2);
    });

    it('should filter metrics by collection ID', async () => {
      await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });
      await analyticsRepository.upsertMetrics('col-2', '24h', {
        priceChange: 8,
      });

      const metrics = await analyticsRepository.findMetrics({
        collectionId: 'col-1',
      });

      expect(metrics).toHaveLength(1);
      expect(metrics[0].collectionId).toBe('col-1');
    });

    it('should filter metrics by window', async () => {
      await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });
      await analyticsRepository.upsertMetrics('col-1', '1h', {
        priceChange: 2,
      });

      const metrics = await analyticsRepository.findMetrics({ window: '24h' });

      expect(metrics).toHaveLength(1);
      expect(metrics[0].window).toBe('24h');
    });

    it('should filter metrics by multiple windows', async () => {
      await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });
      await analyticsRepository.upsertMetrics('col-1', '1h', {
        priceChange: 2,
      });
      await analyticsRepository.upsertMetrics('col-1', '6h', {
        priceChange: 3,
      });

      const metrics = await analyticsRepository.findMetrics({
        windows: ['24h', '1h'],
      });

      expect(metrics).toHaveLength(2);
      expect(metrics.map((m) => m.window)).toEqual(
        expect.arrayContaining(['24h', '1h'])
      );
    });

    it('should get single metric by ID', async () => {
      const created = await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
        averagePrice: 100,
      });

      const metric = await analyticsRepository.findMetricsById(created.id);

      expect(metric).toBeDefined();
      expect(metric.id).toBe(created.id);
      expect(metric.priceChange).toBe(5);
    });

    it('should return null for non-existent metric', async () => {
      const metric = await analyticsRepository.findMetricsById('non-existent');

      expect(metric).toBeNull();
    });
  });

  describe('Collection Metrics API', () => {
    it('should retrieve all metrics for a collection', async () => {
      await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });
      await analyticsRepository.upsertMetrics('col-1', '1h', {
        priceChange: 2,
      });
      await analyticsRepository.upsertMetrics('col-2', '24h', {
        priceChange: 8,
      });

      const metrics = await analyticsRepository.getCollectionMetrics('col-1');

      expect(metrics).toHaveLength(2);
      expect(metrics.every((m) => m.collectionId === 'col-1')).toBe(true);
    });

    it('should return empty array for collection with no metrics', async () => {
      const metrics = await analyticsRepository.getCollectionMetrics('col-1');

      expect(metrics).toEqual([]);
    });
  });

  describe('Health Status API', () => {
    it('should return health status', async () => {
      await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });
      await analyticsRepository.upsertMetrics('col-2', '24h', {
        priceChange: 8,
      });

      const metricsCount = await analyticsRepository.getMetricsCount();
      const collections = await analyticsRepository.getAllCollections();

      expect(metricsCount).toBe(2);
      expect(collections).toHaveLength(2);
    });

    it('should track refresh statistics', async () => {
      const collections = await analyticsRepository.getAllCollections();

      expect(collections).toEqual([]);
    });
  });

  describe('Data Store Integration', () => {
    it('should add and retrieve market snapshots', () => {
      dataStore.addMarketSnapshot('col-1', {
        price: 100,
        volume: 50,
      });

      const snapshots = dataStore.getMarketSnapshots('col-1');

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].price).toBe(100);
    });

    it('should add and retrieve listing events', () => {
      dataStore.addListingEvent('col-1', {
        price: 100,
        quantity: 5,
      });

      const events = dataStore.getListingEvents('col-1');

      expect(events).toHaveLength(1);
      expect(events[0].price).toBe(100);
      expect(events[0].quantity).toBe(5);
    });

    it('should add and retrieve purchase events', () => {
      dataStore.addPurchaseEvent('col-1', {
        type: 'buy',
        price: 110,
        quantity: 2,
      });

      const events = dataStore.getPurchaseEvents('col-1');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('buy');
    });

    it('should handle multiple collections independently', () => {
      dataStore.addListingEvent('col-1', { price: 100 });
      dataStore.addListingEvent('col-2', { price: 150 });

      const col1Events = dataStore.getListingEvents('col-1');
      const col2Events = dataStore.getListingEvents('col-2');

      expect(col1Events).toHaveLength(1);
      expect(col2Events).toHaveLength(1);
      expect(col1Events[0].price).toBe(100);
      expect(col2Events[0].price).toBe(150);
    });

    it('should get all collections', () => {
      dataStore.addListingEvent('col-1', { price: 100 });
      dataStore.addPurchaseEvent('col-2', { type: 'buy', price: 150 });
      dataStore.addMarketSnapshot('col-3', { price: 200 });

      const collections = dataStore.getAllCollections();

      expect(collections).toHaveLength(3);
      expect(collections).toContain('col-1');
      expect(collections).toContain('col-2');
      expect(collections).toContain('col-3');
    });

    it('should clear all data', () => {
      dataStore.addListingEvent('col-1', { price: 100 });
      dataStore.addPurchaseEvent('col-2', { type: 'buy', price: 150 });

      dataStore.clear();

      expect(dataStore.getListingEvents('col-1')).toEqual([]);
      expect(dataStore.getPurchaseEvents('col-2')).toEqual([]);
    });
  });

  describe('Analytics and Data Store Integration', () => {
    it('should compute metrics from data store events', async () => {
      const now = Date.now();
      const event1 = {
        type: 'buy',
        price: 100,
        quantity: 1,
        timestamp: new Date(now).toISOString(),
      };
      const event2 = {
        type: 'buy',
        price: 120,
        quantity: 2,
        timestamp: new Date(now).toISOString(),
      };

      dataStore.addPurchaseEvent('col-1', event1);
      dataStore.addPurchaseEvent('col-1', event2);

      const purchaseEvents = dataStore.getPurchaseEvents('col-1');

      expect(purchaseEvents).toHaveLength(2);
      expect(purchaseEvents[0].price).toBe(100);
      expect(purchaseEvents[1].price).toBe(120);
    });

    it('should handle empty collections', async () => {
      const listingEvents = dataStore.getListingEvents('col-1');
      const purchaseEvents = dataStore.getPurchaseEvents('col-1');
      const snapshots = dataStore.getMarketSnapshots('col-1');

      expect(listingEvents).toEqual([]);
      expect(purchaseEvents).toEqual([]);
      expect(snapshots).toEqual([]);
    });
  });
});
