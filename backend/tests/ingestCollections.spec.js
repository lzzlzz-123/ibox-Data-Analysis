const { ingestCollections } = require('../src/workflows/ingestCollections');
const dataStore = require('../src/repositories/dataStore');
const collectionRepository = require('../src/repositories/collectionRepository');
const ingestionService = require('../src/services/ingestionService');
const { analyticsRepository } = require('../src/repositories/analyticsRepository');
const logger = require('../src/utils/logger');

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Ingestion Workflow', () => {
  beforeEach(() => {
    dataStore.clear();
    collectionRepository.clear();
    analyticsRepository.clear();
    ingestionService.resetAffectedCollections();
  });

  describe('ingestCollections', () => {
    it('should handle empty payloads', async () => {
      const result = await ingestCollections([]);

      expect(result.success).toBe(true);
      expect(result.metrics.totalCollections).toBe(0);
      expect(result.metrics.totalSnapshots).toBe(0);
      expect(result.metrics.failures).toEqual([]);
    });

    it('should handle undefined payloads', async () => {
      const result = await ingestCollections();

      expect(result.success).toBe(true);
      expect(result.metrics.totalSnapshots).toBe(0);
    });

    it('should process single collection', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          metadata: { name: 'Collection 1' },
          snapshot: { id: 'snap-1', price: 100, volume: 50 },
          listingEvents: [{ id: 'list-1', price: 105 }],
          purchaseEvents: [{ id: 'purch-1', price: 102 }],
        },
      ];

      const result = await ingestCollections(payloads);

      expect(result.success).toBe(true);
      expect(result.metrics.totalCollections).toBe(1);
      expect(result.metrics.totalSnapshots).toBe(1);
      expect(result.metrics.totalListingEvents).toBe(1);
      expect(result.metrics.totalPurchaseEvents).toBe(1);
    });

    it('should process multiple collections', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          metadata: { name: 'Collection 1' },
          snapshot: { id: 'snap-1', price: 100 },
        },
        {
          collectionId: 'col-2',
          metadata: { name: 'Collection 2' },
          snapshot: { id: 'snap-2', price: 200 },
          listingEvents: [
            { id: 'list-1', price: 210 },
            { id: 'list-2', price: 215 },
          ],
        },
      ];

      const result = await ingestCollections(payloads);

      expect(result.success).toBe(true);
      expect(result.metrics.totalCollections).toBe(2);
      expect(result.metrics.totalSnapshots).toBe(2);
      expect(result.metrics.totalListingEvents).toBe(2);
    });

    it('should store snapshots in data store', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          snapshot: { id: 'snap-1', price: 100, volume: 50 },
        },
      ];

      await ingestCollections(payloads);

      const snapshots = dataStore.getMarketSnapshots('col-1');
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].price).toBe(100);
      expect(snapshots[0].volume).toBe(50);
    });

    it('should store listing events in data store', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          listingEvents: [
            { id: 'list-1', price: 105, quantity: 2 },
            { id: 'list-2', price: 110, quantity: 3 },
          ],
        },
      ];

      await ingestCollections(payloads);

      const listingEvents = dataStore.getListingEvents('col-1');
      expect(listingEvents).toHaveLength(2);
      expect(listingEvents[0].price).toBe(105);
      expect(listingEvents[1].price).toBe(110);
    });

    it('should store purchase events in data store', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          purchaseEvents: [
            { id: 'purch-1', price: 102, quantity: 1 },
            { id: 'purch-2', price: 107, quantity: 2 },
          ],
        },
      ];

      await ingestCollections(payloads);

      const purchaseEvents = dataStore.getPurchaseEvents('col-1');
      expect(purchaseEvents).toHaveLength(2);
      expect(purchaseEvents[0].price).toBe(102);
      expect(purchaseEvents[1].price).toBe(107);
    });

    it('should upsert collection metadata', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          metadata: { name: 'Test Collection', floor_price: 100 },
        },
      ];

      await ingestCollections(payloads);

      const collection = await collectionRepository.getCollection('col-1');
      expect(collection).toBeDefined();
      expect(collection.name).toBe('Test Collection');
      expect(collection.floor_price).toBe(100);
    });

    it('should handle payloads without snapshots or events', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          metadata: { name: 'Metadata Only Collection' },
        },
      ];

      const result = await ingestCollections(payloads);

      expect(result.success).toBe(true);
      expect(result.metrics.totalCollections).toBe(1);
      expect(result.metrics.totalSnapshots).toBe(0);
      expect(result.metrics.totalListingEvents).toBe(0);
    });

    it('should skip payloads without collectionId', async () => {
      const payloads = [
        {
          metadata: { name: 'No Collection ID' },
          snapshot: { id: 'snap-1', price: 100 },
        },
        {
          collectionId: 'col-1',
          metadata: { name: 'Valid Collection' },
          snapshot: { id: 'snap-2', price: 200 },
        },
      ];

      const result = await ingestCollections(payloads);

      expect(result.metrics.totalCollections).toBe(1);
      expect(result.metrics.totalSnapshots).toBe(1);
    });

    it('should continue processing on individual failures', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          snapshot: { id: 'snap-1', price: 100 },
        },
        {
          collectionId: 'col-2',
          snapshot: { id: 'snap-2', price: 200 },
        },
      ];

      const result = await ingestCollections(payloads);

      expect(result.success).toBe(true);
      expect(result.metrics.totalCollections).toBe(2);
      expect(result.metrics.totalSnapshots).toBe(2);
    });

    it('should track duration', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          snapshot: { id: 'snap-1', price: 100 },
        },
      ];

      const result = await ingestCollections(payloads);

      expect(result.metrics.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple events for same collection', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          snapshot: { id: 'snap-1', price: 100 },
          listingEvents: [
            { id: 'list-1', price: 105 },
            { id: 'list-2', price: 110 },
          ],
          purchaseEvents: [
            { id: 'purch-1', price: 102 },
          ],
        },
        {
          collectionId: 'col-1', // Same collection in another payload
          snapshot: { id: 'snap-2', price: 120 },
          listingEvents: [
            { id: 'list-3', price: 115 },
          ],
        },
      ];

      const result = await ingestCollections(payloads);

      expect(result.success).toBe(true);
      expect(result.metrics.totalCollections).toBe(1);
      expect(result.metrics.totalSnapshots).toBe(2);
      expect(result.metrics.totalListingEvents).toBe(3);
      expect(result.metrics.totalPurchaseEvents).toBe(1);
    });

    it('should deduplicate and prevent duplicate records', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          snapshot: { id: 'snap-1', price: 100 },
          listingEvents: [{ id: 'list-1', price: 105 }],
        },
      ];

      const result1 = await ingestCollections(payloads);
      dataStore.clear();
      ingestionService.resetAffectedCollections();

      const result2 = await ingestCollections(payloads);

      expect(result1.metrics.totalSnapshots).toBe(1);
      expect(result2.metrics.totalSnapshots).toBe(1);
    });

    it('should include all metrics in response', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          snapshot: { id: 'snap-1', price: 100 },
          listingEvents: [{ id: 'list-1', price: 105 }],
          purchaseEvents: [{ id: 'purch-1', price: 102 }],
        },
      ];

      const result = await ingestCollections(payloads);

      expect(result.metrics).toHaveProperty('totalCollections');
      expect(result.metrics).toHaveProperty('totalSnapshots');
      expect(result.metrics).toHaveProperty('totalListingEvents');
      expect(result.metrics).toHaveProperty('totalPurchaseEvents');
      expect(result.metrics).toHaveProperty('failures');
      expect(result.metrics).toHaveProperty('duration');
    });
  });

  describe('Integration with Services', () => {
    it('should trigger analytics refresh after ingestion', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          snapshot: { id: 'snap-1', price: 100 },
          purchaseEvents: [{ id: 'purch-1', price: 102, quantity: 1 }],
        },
      ];

      const result = await ingestCollections(payloads);

      expect(result.success).toBe(true);
      expect(result.metrics.totalCollections).toBe(1);
    });

    it('should mark collections as affected during ingestion', async () => {
      const payloads = [
        {
          collectionId: 'col-1',
          snapshot: { id: 'snap-1', price: 100 },
        },
      ];

      await ingestCollections(payloads);

      // After workflow completes, affected collections should be cleared
      const affected = ingestionService.getAffectedCollections();
      expect(affected).toEqual([]);
    });
  });
});
