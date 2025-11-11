const { analyticsRepository } = require('../src/repositories/analyticsRepository');

describe('AnalyticsRepository', () => {
  beforeEach(() => {
    analyticsRepository.clear();
  });

  describe('upsertMetrics', () => {
    it('should create new metrics', async () => {
      const metricsData = {
        priceChange: 5.5,
        averagePrice: 100,
        medianPrice: 99,
        tradeVolume: 150,
      };

      const result = await analyticsRepository.upsertMetrics(
        'col-1',
        '24h',
        metricsData
      );

      expect(result.id).toBeDefined();
      expect(result.collectionId).toBe('col-1');
      expect(result.window).toBe('24h');
      expect(result.priceChange).toBe(5.5);
      expect(result.timestamp).toBeDefined();
    });

    it('should update existing metrics', async () => {
      const metricsData1 = {
        priceChange: 5.5,
        averagePrice: 100,
      };
      const metricsData2 = {
        priceChange: 10.0,
        averagePrice: 110,
      };

      const result1 = await analyticsRepository.upsertMetrics(
        'col-1',
        '24h',
        metricsData1
      );
      const result2 = await analyticsRepository.upsertMetrics(
        'col-1',
        '24h',
        metricsData2
      );

      expect(result1.id).toBe(result2.id);
      expect(result2.priceChange).toBe(10.0);
      expect(result2.averagePrice).toBe(110);
    });

    it('should handle different collections independently', async () => {
      const metricsData = {
        priceChange: 5.5,
        averagePrice: 100,
      };

      const result1 = await analyticsRepository.upsertMetrics(
        'col-1',
        '24h',
        metricsData
      );
      const result2 = await analyticsRepository.upsertMetrics(
        'col-2',
        '24h',
        metricsData
      );

      expect(result1.id).not.toBe(result2.id);
    });

    it('should handle different windows independently', async () => {
      const metricsData = {
        priceChange: 5.5,
        averagePrice: 100,
      };

      const result1 = await analyticsRepository.upsertMetrics(
        'col-1',
        '24h',
        metricsData
      );
      const result2 = await analyticsRepository.upsertMetrics(
        'col-1',
        '1h',
        metricsData
      );

      expect(result1.id).not.toBe(result2.id);
      expect(result1.window).toBe('24h');
      expect(result2.window).toBe('1h');
    });
  });

  describe('findMetrics', () => {
    beforeEach(async () => {
      await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });
      await analyticsRepository.upsertMetrics('col-1', '1h', {
        priceChange: 2,
      });
      await analyticsRepository.upsertMetrics('col-2', '24h', {
        priceChange: 8,
      });
    });

    it('should find all metrics', async () => {
      const result = await analyticsRepository.findMetrics();

      expect(result).toHaveLength(3);
    });

    it('should filter by collection ID', async () => {
      const result = await analyticsRepository.findMetrics({
        collectionId: 'col-1',
      });

      expect(result).toHaveLength(2);
      expect(result.every((m) => m.collectionId === 'col-1')).toBe(true);
    });

    it('should filter by window', async () => {
      const result = await analyticsRepository.findMetrics({ window: '24h' });

      expect(result).toHaveLength(2);
      expect(result.every((m) => m.window === '24h')).toBe(true);
    });

    it('should filter by multiple windows', async () => {
      const result = await analyticsRepository.findMetrics({
        windows: ['24h', '1h'],
      });

      expect(result).toHaveLength(3);
    });

    it('should filter by collection and window', async () => {
      const result = await analyticsRepository.findMetrics({
        collectionId: 'col-1',
        window: '24h',
      });

      expect(result).toHaveLength(1);
      expect(result[0].collectionId).toBe('col-1');
      expect(result[0].window).toBe('24h');
    });

    it('should sort by timestamp descending', async () => {
      const result = await analyticsRepository.findMetrics();

      for (let i = 1; i < result.length; i++) {
        const prevTime = new Date(result[i - 1].timestamp).getTime();
        const currTime = new Date(result[i].timestamp).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    });
  });

  describe('findMetricsById', () => {
    it('should find metric by ID', async () => {
      const created = await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });

      const result = await analyticsRepository.findMetricsById(created.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(created.id);
      expect(result.priceChange).toBe(5);
    });

    it('should return null for non-existent ID', async () => {
      const result = await analyticsRepository.findMetricsById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getCollectionMetrics', () => {
    beforeEach(async () => {
      await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });
      await analyticsRepository.upsertMetrics('col-1', '1h', {
        priceChange: 2,
      });
      await analyticsRepository.upsertMetrics('col-2', '24h', {
        priceChange: 8,
      });
    });

    it('should get all metrics for a collection', async () => {
      const result = await analyticsRepository.getCollectionMetrics('col-1');

      expect(result).toHaveLength(2);
      expect(result.every((m) => m.collectionId === 'col-1')).toBe(true);
    });

    it('should return empty array for collection with no metrics', async () => {
      const result = await analyticsRepository.getCollectionMetrics('col-3');

      expect(result).toEqual([]);
    });
  });

  describe('getAllCollections', () => {
    beforeEach(async () => {
      await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });
      await analyticsRepository.upsertMetrics('col-2', '24h', {
        priceChange: 8,
      });
      await analyticsRepository.upsertMetrics('col-3', '1h', {
        priceChange: 3,
      });
    });

    it('should get all unique collections', async () => {
      const result = await analyticsRepository.getAllCollections();

      expect(result).toHaveLength(3);
      expect(result).toContain('col-1');
      expect(result).toContain('col-2');
      expect(result).toContain('col-3');
    });

    it('should return empty array when no metrics exist', async () => {
      analyticsRepository.clear();
      const result = await analyticsRepository.getAllCollections();

      expect(result).toEqual([]);
    });
  });

  describe('getTimeWindows', () => {
    it('should return all time windows', async () => {
      const result = await analyticsRepository.getTimeWindows();

      expect(result).toEqual(['1h', '6h', '24h', '72h']);
    });
  });

  describe('getWindowDuration', () => {
    it('should return duration in milliseconds for valid window', async () => {
      const result1h = await analyticsRepository.getWindowDuration('1h');
      const result24h = await analyticsRepository.getWindowDuration('24h');

      expect(result1h).toBe(1 * 60 * 60 * 1000);
      expect(result24h).toBe(24 * 60 * 60 * 1000);
    });

    it('should return null for invalid window', async () => {
      const result = await analyticsRepository.getWindowDuration('invalid');

      expect(result).toBeNull();
    });
  });

  describe('getLastRefreshTime', () => {
    it('should return last refresh time for collection', async () => {
      const metric1 = await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const metric2 = await analyticsRepository.upsertMetrics('col-1', '1h', {
        priceChange: 2,
      });

      const result = await analyticsRepository.getLastRefreshTime('col-1');

      expect(result).toBe(metric2.timestamp);
    });

    it('should return null for collection with no metrics', async () => {
      const result = await analyticsRepository.getLastRefreshTime('col-1');

      expect(result).toBeNull();
    });
  });

  describe('getMetricsCount', () => {
    it('should return total metrics count', async () => {
      await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });
      await analyticsRepository.upsertMetrics('col-2', '24h', {
        priceChange: 8,
      });
      await analyticsRepository.upsertMetrics('col-1', '1h', {
        priceChange: 2,
      });

      const result = await analyticsRepository.getMetricsCount();

      expect(result).toBe(3);
    });

    it('should return 0 when no metrics exist', async () => {
      const result = await analyticsRepository.getMetricsCount();

      expect(result).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all metrics', async () => {
      await analyticsRepository.upsertMetrics('col-1', '24h', {
        priceChange: 5,
      });
      await analyticsRepository.upsertMetrics('col-2', '24h', {
        priceChange: 8,
      });

      await analyticsRepository.clear();

      const result = await analyticsRepository.findMetrics();
      expect(result).toEqual([]);
    });
  });
});
