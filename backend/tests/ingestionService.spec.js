const {
  ingestMarketSnapshot,
  ingestListingEvent,
  ingestPurchaseEvent,
  refreshAffectedMetrics,
  getAffectedCollections,
  resetAffectedCollections,
} = require('../src/services/ingestionService');
const { analyticsRepository } = require('../src/repositories/analyticsRepository');
const dataStore = require('../src/repositories/dataStore');

describe('IngestionService', () => {
  beforeEach(() => {
    analyticsRepository.clear();
    dataStore.clear();
    resetAffectedCollections();
  });

  describe('ingestMarketSnapshot', () => {
    it('should ingest market snapshot', async () => {
      const result = await ingestMarketSnapshot('col-1', {
        id: 'snap-1',
        price: 100,
        volume: 50,
      });

      expect(result.success).toBe(true);
      expect(result.collectionId).toBe('col-1');
      expect(result.type).toBe('market_snapshot');
    });

    it('should mark collection as affected', async () => {
      await ingestMarketSnapshot('col-1', {
        id: 'snap-1',
        price: 100,
      });

      const affected = getAffectedCollections();
      expect(affected).toContain('col-1');
    });

    it('should store snapshot in data store', async () => {
      await ingestMarketSnapshot('col-1', {
        id: 'snap-1',
        price: 100,
      });

      const snapshots = dataStore.getMarketSnapshots('col-1');
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].price).toBe(100);
    });
  });

  describe('ingestListingEvent', () => {
    it('should ingest listing event', async () => {
      const result = await ingestListingEvent('col-1', {
        id: 'list-1',
        price: 100,
        quantity: 5,
      });

      expect(result.success).toBe(true);
      expect(result.collectionId).toBe('col-1');
      expect(result.type).toBe('listing_event');
    });

    it('should mark collection as affected', async () => {
      await ingestListingEvent('col-1', {
        id: 'list-1',
        price: 100,
      });

      const affected = getAffectedCollections();
      expect(affected).toContain('col-1');
    });

    it('should store event in data store', async () => {
      await ingestListingEvent('col-1', {
        id: 'list-1',
        price: 100,
        quantity: 5,
      });

      const events = dataStore.getListingEvents('col-1');
      expect(events).toHaveLength(1);
      expect(events[0].price).toBe(100);
    });
  });

  describe('ingestPurchaseEvent', () => {
    it('should ingest purchase event', async () => {
      const result = await ingestPurchaseEvent('col-1', {
        id: 'purch-1',
        type: 'buy',
        price: 110,
        quantity: 2,
      });

      expect(result.success).toBe(true);
      expect(result.collectionId).toBe('col-1');
      expect(result.type).toBe('purchase_event');
    });

    it('should mark collection as affected', async () => {
      await ingestPurchaseEvent('col-1', {
        id: 'purch-1',
        type: 'buy',
        price: 110,
      });

      const affected = getAffectedCollections();
      expect(affected).toContain('col-1');
    });

    it('should store event in data store', async () => {
      await ingestPurchaseEvent('col-1', {
        id: 'purch-1',
        type: 'buy',
        price: 110,
        quantity: 2,
      });

      const events = dataStore.getPurchaseEvents('col-1');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('buy');
    });
  });

  describe('getAffectedCollections', () => {
    it('should return affected collections', async () => {
      await ingestListingEvent('col-1', { price: 100 });
      await ingestPurchaseEvent('col-2', { type: 'buy', price: 110 });

      const affected = getAffectedCollections();

      expect(affected).toHaveLength(2);
      expect(affected).toContain('col-1');
      expect(affected).toContain('col-2');
    });

    it('should return unique collections', async () => {
      await ingestListingEvent('col-1', { price: 100 });
      await ingestListingEvent('col-1', { price: 110 });

      const affected = getAffectedCollections();

      expect(affected).toHaveLength(1);
      expect(affected).toContain('col-1');
    });

    it('should return empty array when no collections affected', () => {
      const affected = getAffectedCollections();

      expect(affected).toEqual([]);
    });
  });

  describe('resetAffectedCollections', () => {
    it('should reset affected collections', async () => {
      await ingestListingEvent('col-1', { price: 100 });

      resetAffectedCollections();

      const affected = getAffectedCollections();
      expect(affected).toEqual([]);
    });
  });

  describe('refreshAffectedMetrics', () => {
    it('should refresh metrics for affected collections', async () => {
      const now = Date.now();
      await ingestPurchaseEvent('col-1', {
        type: 'buy',
        price: 100,
        quantity: 1,
        timestamp: new Date(now).toISOString(),
      });
      await ingestPurchaseEvent('col-2', {
        type: 'buy',
        price: 110,
        quantity: 2,
        timestamp: new Date(now).toISOString(),
      });

      const result = await refreshAffectedMetrics(analyticsRepository);

      expect(result.success).toBe(true);
      expect(result.collectionsUpdated).toBe(2);
      expect(result.metricsGenerated).toBe(8); // 2 collections * 4 windows
    });

    it('should clear affected collections after refresh', async () => {
      await ingestListingEvent('col-1', { price: 100 });

      await refreshAffectedMetrics(analyticsRepository);

      const affected = getAffectedCollections();
      expect(affected).toEqual([]);
    });

    it('should handle no affected collections', async () => {
      const result = await refreshAffectedMetrics(analyticsRepository);

      expect(result.success).toBe(true);
      expect(result.collectionsRefreshed).toBe(0);
    });

    it('should store metrics in repository', async () => {
      const now = Date.now();
      await ingestPurchaseEvent('col-1', {
        type: 'buy',
        price: 100,
        quantity: 5,
        timestamp: new Date(now).toISOString(),
      });

      await refreshAffectedMetrics(analyticsRepository);

      const metrics = await analyticsRepository.getCollectionMetrics('col-1');

      expect(metrics).toHaveLength(4); // 4 windows
      expect(metrics[0].collectionId).toBe('col-1');
    });
  });

  describe('Integration Workflow', () => {
    it('should track multiple ingestions and refresh', async () => {
      const now = Date.now();

      await ingestMarketSnapshot('col-1', {
        id: 'snap-1',
        price: 100,
        timestamp: new Date(now).toISOString(),
      });

      await ingestListingEvent('col-1', {
        id: 'list-1',
        price: 105,
        quantity: 2,
        timestamp: new Date(now).toISOString(),
      });

      await ingestPurchaseEvent('col-1', {
        id: 'purch-1',
        type: 'buy',
        price: 102,
        quantity: 1,
        timestamp: new Date(now).toISOString(),
      });

      let affected = getAffectedCollections();
      expect(affected).toContain('col-1');
      expect(affected).toHaveLength(1);

      await refreshAffectedMetrics(analyticsRepository);

      affected = getAffectedCollections();
      expect(affected).toEqual([]);

      const metrics = await analyticsRepository.getCollectionMetrics('col-1');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should handle multiple collections independently', async () => {
      const now = Date.now();

      await ingestPurchaseEvent('col-1', {
        type: 'buy',
        price: 100,
        quantity: 1,
        timestamp: new Date(now).toISOString(),
      });

      await ingestPurchaseEvent('col-2', {
        type: 'buy',
        price: 150,
        quantity: 2,
        timestamp: new Date(now).toISOString(),
      });

      await refreshAffectedMetrics(analyticsRepository);

      const col1Metrics = await analyticsRepository.getCollectionMetrics('col-1');
      const col2Metrics = await analyticsRepository.getCollectionMetrics('col-2');

      expect(col1Metrics).toHaveLength(4);
      expect(col2Metrics).toHaveLength(4);
    });
  });
});
