const {
  computeMetricsForCollection,
  refreshMetrics,
  calculateMetrics,
  filterEventsByWindow,
  getRefreshLog,
  resetRefreshLog,
  TIME_WINDOWS,
} = require('../src/services/analyticsService');
const { analyticsRepository } = require('../src/repositories/analyticsRepository');

describe('AnalyticsService', () => {
  beforeEach(() => {
    analyticsRepository.clear();
    resetRefreshLog();
  });

  describe('calculateMetrics', () => {
    it('should return null metrics for empty events', () => {
      const result = calculateMetrics([], '24h');

      expect(result.priceChange).toBeNull();
      expect(result.averagePrice).toBeNull();
      expect(result.medianPrice).toBeNull();
      expect(result.tradeVolume).toBe(0);
      expect(result.buyCount).toBe(0);
      expect(result.sellCount).toBe(0);
      expect(result.liquidityRatio).toBeNull();
      expect(result.eventCount).toBe(0);
    });

    it('should calculate metrics for purchase events', () => {
      const events = [
        { type: 'buy', price: 100, quantity: 5, timestamp: new Date().toISOString() },
        { type: 'buy', price: 120, quantity: 3, timestamp: new Date().toISOString() },
        { type: 'sell', price: 110, quantity: 2, timestamp: new Date().toISOString() },
      ];

      const result = calculateMetrics(events, '24h');

      expect(result.buyCount).toBe(2);
      expect(result.sellCount).toBe(1);
      expect(result.tradeVolume).toBe(10); // 5 + 3 + 2
      expect(result.eventCount).toBe(3);
      expect(result.averagePrice).toBe((100 + 120 + 110) / 3);
      expect(result.medianPrice).toBe(110);
      expect(result.liquidityRatio).toBeCloseTo(10 / 3);
    });

    it('should calculate price change correctly', () => {
      const events = [
        { type: 'buy', price: 100, quantity: 1, timestamp: new Date().toISOString() },
        { type: 'buy', price: 150, quantity: 1, timestamp: new Date().toISOString() },
      ];

      const result = calculateMetrics(events, '24h');

      expect(result.priceChange).toBe(50); // (150 - 100) / 100 * 100
    });

    it('should handle zero division for price change', () => {
      const events = [
        { type: 'buy', price: 0, quantity: 1, timestamp: new Date().toISOString() },
        { type: 'buy', price: 150, quantity: 1, timestamp: new Date().toISOString() },
      ];

      const result = calculateMetrics(events, '24h');

      expect(result.priceChange).toBeNull();
    });

    it('should handle events with missing prices', () => {
      const events = [
        { type: 'buy', price: 100, quantity: 1, timestamp: new Date().toISOString() },
        { type: 'buy', price: null, quantity: 1, timestamp: new Date().toISOString() },
        { type: 'sell', quantity: 2, timestamp: new Date().toISOString() },
      ];

      const result = calculateMetrics(events, '24h');

      expect(result.averagePrice).toBe(100);
      expect(result.eventCount).toBe(3);
      expect(result.tradeVolume).toBe(4);
    });

    it('should calculate median price correctly for odd number of prices', () => {
      const events = [
        { type: 'buy', price: 100, quantity: 1, timestamp: new Date().toISOString() },
        { type: 'buy', price: 200, quantity: 1, timestamp: new Date().toISOString() },
        { type: 'buy', price: 300, quantity: 1, timestamp: new Date().toISOString() },
      ];

      const result = calculateMetrics(events, '24h');

      expect(result.medianPrice).toBe(200);
    });

    it('should calculate median price correctly for even number of prices', () => {
      const events = [
        { type: 'buy', price: 100, quantity: 1, timestamp: new Date().toISOString() },
        { type: 'buy', price: 200, quantity: 1, timestamp: new Date().toISOString() },
        { type: 'buy', price: 300, quantity: 1, timestamp: new Date().toISOString() },
        { type: 'buy', price: 400, quantity: 1, timestamp: new Date().toISOString() },
      ];

      const result = calculateMetrics(events, '24h');

      expect(result.medianPrice).toBe(250);
    });

    it('should handle missing quantity as 0', () => {
      const events = [
        { type: 'buy', price: 100, timestamp: new Date().toISOString() },
        { type: 'sell', price: 110, quantity: 5, timestamp: new Date().toISOString() },
      ];

      const result = calculateMetrics(events, '24h');

      expect(result.tradeVolume).toBe(5);
    });

    it('should return null for null events', () => {
      const result = calculateMetrics(null, '24h');

      expect(result.priceChange).toBeNull();
      expect(result.averagePrice).toBeNull();
      expect(result.eventCount).toBe(0);
    });
  });

  describe('filterEventsByWindow', () => {
    it('should filter events within time window', () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;

      const events = [
        { timestamp: new Date(now).toISOString(), price: 100 },
        { timestamp: new Date(oneHourAgo).toISOString(), price: 110 },
        { timestamp: new Date(twoHoursAgo).toISOString(), price: 120 },
      ];

      const result = filterEventsByWindow(events, 60 * 60 * 1000); // 1 hour

      expect(result).toHaveLength(2);
      expect(result.every((e) => e.price !== 120)).toBe(true);
    });

    it('should return empty array for null events', () => {
      const result = filterEventsByWindow(null, 60 * 60 * 1000);

      expect(result).toEqual([]);
    });

    it('should return all events if window is larger than all events', () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const events = [
        { timestamp: new Date(now).toISOString(), price: 100 },
        { timestamp: new Date(oneHourAgo).toISOString(), price: 110 },
      ];

      const result = filterEventsByWindow(events, 24 * 60 * 60 * 1000); // 24 hours

      expect(result).toHaveLength(2);
    });
  });

  describe('computeMetricsForCollection', () => {
    it('should compute metrics for all time windows', async () => {
      const now = Date.now();
      const events = [
        {
          type: 'buy',
          price: 100,
          quantity: 1,
          timestamp: new Date(now - 30 * 60 * 1000).toISOString(),
        },
        {
          type: 'sell',
          price: 120,
          quantity: 2,
          timestamp: new Date(now - 10 * 60 * 1000).toISOString(),
        },
      ];

      const result = await computeMetricsForCollection(
        'col-1',
        [],
        events,
        events,
        analyticsRepository
      );

      expect(Object.keys(result)).toEqual(['1h', '6h', '24h', '72h']);
      expect(result['24h']).toBeDefined();
      expect(result['24h'].eventCount).toBeGreaterThan(0);
    });

    it('should compute metrics with separate listing and purchase events', async () => {
      const now = Date.now();
      const listingEvents = [
        {
          type: 'listing',
          price: 100,
          quantity: 1,
          timestamp: new Date(now).toISOString(),
        },
      ];
      const purchaseEvents = [
        {
          type: 'buy',
          price: 110,
          quantity: 2,
          timestamp: new Date(now).toISOString(),
        },
      ];

      const result = await computeMetricsForCollection(
        'col-1',
        [],
        listingEvents,
        purchaseEvents,
        analyticsRepository
      );

      expect(result['24h'].listingMetrics).toBeDefined();
      expect(result['24h'].purchaseMetrics).toBeDefined();
    });

    it('should set priceChange24h for 24h window', async () => {
      const now = Date.now();
      const events = [
        {
          type: 'buy',
          price: 100,
          quantity: 1,
          timestamp: new Date(now).toISOString(),
        },
        {
          type: 'buy',
          price: 150,
          quantity: 1,
          timestamp: new Date(now).toISOString(),
        },
      ];

      const result = await computeMetricsForCollection(
        'col-1',
        [],
        events,
        events,
        analyticsRepository
      );

      expect(result['24h'].priceChange24h).toEqual(result['24h'].priceChange);
    });

    it('should set volumeChange24h for 24h window', async () => {
      const now = Date.now();
      const purchaseEvents = [
        {
          type: 'buy',
          price: 100,
          quantity: 5,
          timestamp: new Date(now).toISOString(),
        },
      ];

      const result = await computeMetricsForCollection(
        'col-1',
        [],
        [],
        purchaseEvents,
        analyticsRepository
      );

      expect(result['24h'].volumeChange24h).toBeDefined();
    });

    it('should handle empty events', async () => {
      const result = await computeMetricsForCollection(
        'col-1',
        [],
        [],
        [],
        analyticsRepository
      );

      expect(result['24h'].averagePrice).toBeNull();
      expect(result['24h'].eventCount).toBe(0);
    });
  });

  describe('refreshMetrics', () => {
    it('should refresh metrics for multiple collections', async () => {
      const dataStore = {
        getListingEvents: jest.fn().mockReturnValue([]),
        getPurchaseEvents: jest.fn().mockReturnValue([]),
        getMarketSnapshots: jest.fn().mockReturnValue([]),
      };

      const result = await refreshMetrics(
        ['col-1', 'col-2'],
        dataStore,
        analyticsRepository
      );

      expect(result.success).toBe(true);
      expect(result.collectionsUpdated).toBe(2);
      expect(result.metricsGenerated).toBe(8); // 2 collections * 4 windows
    });

    it('should update refresh log', async () => {
      resetRefreshLog();
      const dataStore = {
        getListingEvents: jest.fn().mockReturnValue([]),
        getPurchaseEvents: jest.fn().mockReturnValue([]),
        getMarketSnapshots: jest.fn().mockReturnValue([]),
      };

      await refreshMetrics(['col-1'], dataStore, analyticsRepository);

      const log = getRefreshLog();
      expect(log.lastRefreshTime).toBeDefined();
      expect(log.collectionsUpdated).toBe(1);
      expect(log.metricsGenerated).toBe(4);
    });

    it('should handle errors gracefully', async () => {
      const dataStore = {
        getListingEvents: jest.fn().mockReturnValue(null),
        getPurchaseEvents: jest.fn().mockReturnValue(null),
        getMarketSnapshots: jest.fn().mockReturnValue(null),
      };

      const result = await refreshMetrics(
        ['col-1', 'col-2'],
        dataStore,
        analyticsRepository
      );

      expect(result.success).toBe(true);
      expect(result.collectionsUpdated).toBe(2);
    });
  });

  describe('Time Windows', () => {
    it('should have defined time windows', () => {
      expect(TIME_WINDOWS['1h']).toBe(1 * 60 * 60 * 1000);
      expect(TIME_WINDOWS['6h']).toBe(6 * 60 * 60 * 1000);
      expect(TIME_WINDOWS['24h']).toBe(24 * 60 * 60 * 1000);
      expect(TIME_WINDOWS['72h']).toBe(72 * 60 * 60 * 1000);
    });
  });

  describe('getRefreshLog and resetRefreshLog', () => {
    it('should return refresh log', async () => {
      const dataStore = {
        getListingEvents: jest.fn().mockReturnValue([]),
        getPurchaseEvents: jest.fn().mockReturnValue([]),
        getMarketSnapshots: jest.fn().mockReturnValue([]),
      };

      await refreshMetrics(['col-1'], dataStore, analyticsRepository);

      const log = getRefreshLog();
      expect(log.lastRefreshTime).toBeDefined();
      expect(log.collectionsUpdated).toBe(1);
      expect(log.metricsGenerated).toBe(4);
    });

    it('should reset refresh log', () => {
      resetRefreshLog();

      const log = getRefreshLog();
      expect(log.lastRefreshTime).toBeNull();
      expect(log.collectionsUpdated).toBe(0);
      expect(log.metricsGenerated).toBe(0);
    });
  });
});
