const { analyticsRepository } = require('../repositories/analyticsRepository');
const logger = require('../utils/logger');

const analyticsReadService = {
  async getCollectionAnalytics(collectionId, windows = null) {
    try {
      let metrics;
      if (windows && Array.isArray(windows)) {
        metrics = await analyticsRepository.findMetrics({
          collectionId,
          windows,
        });
      } else {
        metrics = await analyticsRepository.getCollectionMetrics(collectionId);
      }

      if (metrics.length === 0) {
        return null;
      }

      // Group metrics by window and calculate summary statistics
      const groupedByWindow = {};
      const summary = {
        totalMetrics: metrics.length,
        lastUpdated: null,
        windows: [],
      };

      metrics.forEach((metric) => {
        groupedByWindow[metric.window] = metric;
        
        if (!summary.windows.includes(metric.window)) {
          summary.windows.push(metric.window);
        }

        // Track the most recent timestamp
        if (!summary.lastUpdated || new Date(metric.timestamp) > new Date(summary.lastUpdated)) {
          summary.lastUpdated = metric.timestamp;
        }
      });

      // Sort windows by duration (shortest to longest)
      const windowOrder = ['1h', '6h', '24h', '72h'];
      summary.windows.sort((a, b) => {
        const aIndex = windowOrder.indexOf(a);
        const bIndex = windowOrder.indexOf(b);
        return aIndex - bIndex;
      });

      return {
        collectionId,
        summary,
        metrics: groupedByWindow,
      };
    } catch (error) {
      logger.error('Error fetching collection analytics', {
        collectionId,
        windows,
        error: error.message,
      });
      throw error;
    }
  },

  async getAnalyticsSummary(filters = {}) {
    try {
      const { collectionIds, windows } = filters;
      let allMetrics = await analyticsRepository.findMetrics();

      // Filter by collection IDs if specified
      if (collectionIds && Array.isArray(collectionIds)) {
        allMetrics = allMetrics.filter(m => collectionIds.includes(m.collectionId));
      }

      // Filter by windows if specified
      if (windows && Array.isArray(windows)) {
        allMetrics = allMetrics.filter(m => windows.includes(m.window));
      }

      // Group by collection and calculate summaries
      const collectionsSummary = {};
      const globalSummary = {
        totalCollections: 0,
        totalMetrics: allMetrics.length,
        windows: [],
        lastUpdated: null,
      };

      allMetrics.forEach((metric) => {
        const { collectionId, window } = metric;

        // Initialize collection summary if needed
        if (!collectionsSummary[collectionId]) {
          collectionsSummary[collectionId] = {
            collectionId,
            metrics: {},
            lastUpdated: null,
          };
          globalSummary.totalCollections++;
        }

        // Add metric to collection
        collectionsSummary[collectionId].metrics[window] = metric;

        // Update last updated timestamp for collection
        const metricTime = new Date(metric.timestamp);
        const collectionLastUpdated = collectionsSummary[collectionId].lastUpdated;
        if (!collectionLastUpdated || metricTime > new Date(collectionLastUpdated)) {
          collectionsSummary[collectionId].lastUpdated = metric.timestamp;
        }

        // Track global windows
        if (!globalSummary.windows.includes(window)) {
          globalSummary.windows.push(window);
        }

        // Track global last updated
        if (!globalSummary.lastUpdated || metricTime > new Date(globalSummary.lastUpdated)) {
          globalSummary.lastUpdated = metric.timestamp;
        }
      });

      // Sort global windows
      const windowOrder = ['1h', '6h', '24h', '72h'];
      globalSummary.windows.sort((a, b) => {
        const aIndex = windowOrder.indexOf(a);
        const bIndex = windowOrder.indexOf(b);
        return aIndex - bIndex;
      });

      return {
        summary: globalSummary,
        collections: Object.values(collectionsSummary),
      };
    } catch (error) {
      logger.error('Error fetching analytics summary', {
        filters,
        error: error.message,
      });
      throw error;
    }
  },

  async getMetricsByWindow(window, collectionIds = null) {
    try {
      const filters = { window };
      if (collectionIds && Array.isArray(collectionIds)) {
        filters.collectionIds = collectionIds;
      }

      const metrics = await analyticsRepository.findMetrics(filters);

      // Group by collection and calculate statistics
      const byCollection = {};
      let totalMetrics = metrics.length;

      metrics.forEach((metric) => {
        const { collectionId } = metric;
        
        if (!byCollection[collectionId]) {
          byCollection[collectionId] = [];
        }
        
        byCollection[collectionId].push(metric);
      });

      // Calculate window-level statistics
      const windowStats = {
        window,
        totalCollections: Object.keys(byCollection).length,
        totalMetrics,
        averagePriceChange: 0,
        averageTradeVolume: 0,
        lastUpdated: null,
      };

      let totalPriceChange = 0;
      let totalTradeVolume = 0;
      let metricCount = 0;

      Object.values(byCollection).forEach((collectionMetrics) => {
        collectionMetrics.forEach((metric) => {
          if (metric.priceChange !== undefined && metric.priceChange !== null) {
            totalPriceChange += metric.priceChange;
          }
          if (metric.tradeVolume !== undefined && metric.tradeVolume !== null) {
            totalTradeVolume += metric.tradeVolume;
          }
          
          metricCount++;
          
          // Track latest timestamp
          if (!windowStats.lastUpdated || new Date(metric.timestamp) > new Date(windowStats.lastUpdated)) {
            windowStats.lastUpdated = metric.timestamp;
          }
        });
      });

      if (metricCount > 0) {
        windowStats.averagePriceChange = totalPriceChange / metricCount;
        windowStats.averageTradeVolume = totalTradeVolume / metricCount;
      }

      return {
        windowStats,
        collections: byCollection,
      };
    } catch (error) {
      logger.error('Error fetching metrics by window', {
        window,
        collectionIds,
        error: error.message,
      });
      throw error;
    }
  },

  async getAvailableWindows() {
    try {
      return await analyticsRepository.getTimeWindows();
    } catch (error) {
      logger.error('Error fetching available windows', {
        error: error.message,
      });
      throw error;
    }
  },
};

module.exports = analyticsReadService;