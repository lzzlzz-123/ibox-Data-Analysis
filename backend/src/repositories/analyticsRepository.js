const logger = require('../utils/logger');

const analyticsMetrics = [];
let metricsId = 0;

const TIME_WINDOWS = {
  '1h': 1 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '72h': 72 * 60 * 60 * 1000,
};

const analyticsRepository = {
  async upsertMetrics(collectionId, window, metricsData) {
    try {
      const timestamp = new Date().toISOString();
      const existingIndex = analyticsMetrics.findIndex(
        (m) => m.collectionId === collectionId && m.window === window
      );

      const metric = {
        ...(existingIndex >= 0 && { id: analyticsMetrics[existingIndex].id }),
        ...(existingIndex < 0 && { id: String(++metricsId) }),
        collectionId,
        window,
        timestamp,
        ...metricsData,
      };

      if (existingIndex >= 0) {
        analyticsMetrics[existingIndex] = metric;
        logger.info('Metrics updated', {
          collectionId,
          window,
          timestamp,
        });
      } else {
        analyticsMetrics.push(metric);
        logger.info('Metrics created', {
          collectionId,
          window,
          timestamp,
        });
      }

      return metric;
    } catch (error) {
      logger.error('Error upserting metrics', {
        collectionId,
        window,
        error: error.message,
      });
      throw error;
    }
  },

  async findMetrics(filters = {}) {
    try {
      let result = [...analyticsMetrics];

      if (filters.collectionId) {
        result = result.filter((m) => m.collectionId === filters.collectionId);
      }

      if (filters.window) {
        result = result.filter((m) => m.window === filters.window);
      }

      if (filters.windows && Array.isArray(filters.windows)) {
        result = result.filter((m) => filters.windows.includes(m.window));
      }

      return result.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      logger.error('Error fetching metrics', {
        error: error.message,
      });
      throw error;
    }
  },

  async findMetricsById(metricId) {
    try {
      return analyticsMetrics.find((m) => m.id === metricId) || null;
    } catch (error) {
      logger.error('Error finding metric', {
        metricId,
        error: error.message,
      });
      throw error;
    }
  },

  async getCollectionMetrics(collectionId) {
    try {
      return analyticsMetrics.filter((m) => m.collectionId === collectionId);
    } catch (error) {
      logger.error('Error fetching collection metrics', {
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async getAllCollections() {
    try {
      const collections = new Set(analyticsMetrics.map((m) => m.collectionId));
      return Array.from(collections);
    } catch (error) {
      logger.error('Error fetching all collections', {
        error: error.message,
      });
      throw error;
    }
  },

  async getTimeWindows() {
    return Object.keys(TIME_WINDOWS);
  },

  async getWindowDuration(window) {
    return TIME_WINDOWS[window] || null;
  },

  async clear() {
    analyticsMetrics.length = 0;
    metricsId = 0;
  },

  async getLastRefreshTime(collectionId) {
    try {
      const metrics = analyticsMetrics.filter((m) => m.collectionId === collectionId);
      if (metrics.length === 0) {
        return null;
      }
      return metrics.reduce((latest, m) => {
        const mTime = new Date(m.timestamp).getTime();
        const latestTime = new Date(latest.timestamp).getTime();
        return mTime > latestTime ? m : latest;
      }).timestamp;
    } catch (error) {
      logger.error('Error getting last refresh time', {
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async getMetricsCount() {
    return analyticsMetrics.length;
  },
};

module.exports = { analyticsRepository };
