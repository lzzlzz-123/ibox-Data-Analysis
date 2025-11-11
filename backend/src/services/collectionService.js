const dataStore = require('../repositories/dataStore');
const { analyticsRepository } = require('../repositories/analyticsRepository');
const logger = require('../utils/logger');

const collectionService = {
  async getAllCollectionsWithMetrics() {
    try {
      const collections = dataStore.getAllCollections();
      const collectionsData = [];

      for (const collectionId of collections) {
        const metrics = await analyticsRepository.findMetrics({ collectionId });
        const latest24h = metrics.find((m) => m.window === '24h');
        const snapshots = dataStore.getMarketSnapshots(collectionId);
        const latestSnapshot = snapshots[snapshots.length - 1] || null;

        // Calculate 24h deltas by comparing with previous 24h metrics
        const previous24h = metrics.filter((m) => m.window === '24h')[1]; // Second latest 24h metric
        let delta24h = null;
        
        if (latest24h && previous24h) {
          delta24h = {
            priceChange: latest24h.priceChange - previous24h.priceChange,
            averagePrice: latest24h.averagePrice - previous24h.averagePrice,
            tradeVolume: latest24h.tradeVolume - previous24h.tradeVolume,
            buySellRatio: latest24h.buySellRatio - previous24h.buySellRatio,
          };
        }

        collectionsData.push({
          id: collectionId,
          name: collectionId, // Could be enhanced with name mapping
          latestSnapshot,
          latestMetrics: latest24h || null,
          delta24h,
          lastUpdated: latest24h?.timestamp || latestSnapshot?.timestamp || null,
        });
      }

      logger.info('Collections with metrics retrieved', {
        count: collectionsData.length,
      });

      return collectionsData;
    } catch (error) {
      logger.error('Error fetching collections with metrics', {
        error: error.message,
      });
      throw error;
    }
  },

  async getCollectionById(collectionId) {
    try {
      // Check if collection exists in any data store
      const allCollections = dataStore.getAllCollections();
      if (!allCollections.includes(collectionId)) {
        return null;
      }

      const metrics = await analyticsRepository.findMetrics({ collectionId });
      const snapshots = dataStore.getMarketSnapshots(collectionId);
      const listingEvents = dataStore.getListingEvents(collectionId);
      const purchaseEvents = dataStore.getPurchaseEvents(collectionId);

      const groupedByWindow = {};
      metrics.forEach((m) => {
        groupedByWindow[m.window] = m;
      });

      const latestSnapshot = snapshots[snapshots.length - 1] || null;

      return {
        id: collectionId,
        name: collectionId,
        metadata: {
          totalSnapshots: snapshots.length,
          totalListingEvents: listingEvents.length,
          totalPurchaseEvents: purchaseEvents.length,
          firstSnapshot: snapshots[0]?.timestamp || null,
          lastSnapshot: latestSnapshot?.timestamp || null,
        },
        latestSnapshot,
        metrics: groupedByWindow,
      };
    } catch (error) {
      logger.error('Error fetching collection by ID', {
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async getCollectionSnapshots(collectionId, options = {}) {
    try {
      // Check if collection exists
      const allCollections = dataStore.getAllCollections();
      if (!allCollections.includes(collectionId)) {
        return { snapshots: [], pagination: { total: 0, page: 1, limit: 100 } };
      }

      const { from, to, interval = '1h' } = options;
      let snapshots = dataStore.getMarketSnapshots(collectionId);

      if (snapshots.length === 0) {
        return { snapshots: [], pagination: { total: 0, page: 1, limit: 100 } };
      }

      // Filter by date range
      if (from) {
        const fromDate = new Date(from);
        snapshots = snapshots.filter(s => new Date(s.timestamp) >= fromDate);
      }

      if (to) {
        const toDate = new Date(to);
        snapshots = snapshots.filter(s => new Date(s.timestamp) <= toDate);
      }

      // Sort by timestamp
      snapshots.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Apply interval grouping (simplified - in production would use proper time bucketing)
      if (interval !== '1h') {
        // For now, return all snapshots sorted
        // TODO: Implement proper interval grouping
      }

      // Pagination
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 100;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedSnapshots = snapshots.slice(startIndex, endIndex);

      return {
        snapshots: paginatedSnapshots,
        pagination: {
          total: snapshots.length,
          page,
          limit,
          hasNext: endIndex < snapshots.length,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error fetching collection snapshots', {
        collectionId,
        options,
        error: error.message,
      });
      throw error;
    }
  },

  async getCollectionEvents(collectionId, options = {}) {
    try {
      // Check if collection exists
      const allCollections = dataStore.getAllCollections();
      if (!allCollections.includes(collectionId)) {
        return { events: [], pagination: { total: 0, page: 1, limit: 50 } };
      }

      const { page = 1, limit = 50, type } = options;
      const listingEvents = dataStore.getListingEvents(collectionId);
      const purchaseEvents = dataStore.getPurchaseEvents(collectionId);

      let allEvents = [...listingEvents, ...purchaseEvents];

      // Filter by type if specified
      if (type) {
        allEvents = allEvents.filter(event => event.type === type);
      }

      // Sort by timestamp (most recent first)
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedEvents = allEvents.slice(startIndex, endIndex);

      return {
        events: paginatedEvents,
        pagination: {
          total: allEvents.length,
          page: parseInt(page),
          limit: parseInt(limit),
          hasNext: endIndex < allEvents.length,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Error fetching collection events', {
        collectionId,
        options,
        error: error.message,
      });
      throw error;
    }
  },
};

module.exports = collectionService;