const logger = require('../utils/logger');

const TIME_WINDOWS = {
  '1h': 1 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '72h': 72 * 60 * 60 * 1000,
};

const refreshLog = {
  lastRefreshTime: null,
  collectionsUpdated: 0,
  metricsGenerated: 0,
};

function calculateMetrics(events, window) {
  if (!events || events.length === 0) {
    return {
      priceChange: null,
      averagePrice: null,
      medianPrice: null,
      tradeVolume: 0,
      buyCount: 0,
      sellCount: 0,
      liquidityRatio: null,
      eventCount: 0,
    };
  }

  const prices = events
    .filter((e) => e.price !== null && e.price !== undefined)
    .map((e) => parseFloat(e.price));

  const buyEvents = events.filter((e) => e.type === 'buy').length;
  const sellEvents = events.filter((e) => e.type === 'sell').length;
  const totalEvents = events.length;

  let priceChange = null;
  let averagePrice = null;
  let medianPrice = null;
  let liquidityRatio = null;

  if (prices.length > 0) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const firstPrice = prices[0];

    if (firstPrice !== 0) {
      priceChange = ((maxPrice - firstPrice) / firstPrice) * 100;
    }

    averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;

    const sortedPrices = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sortedPrices.length / 2);
    medianPrice =
      sortedPrices.length % 2 !== 0
        ? sortedPrices[mid]
        : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;
  }

  const tradeVolume = events.reduce((sum, e) => {
    const quantity = parseFloat(e.quantity || 0);
    return sum + quantity;
  }, 0);

  // Liquidity ratio: trade volume / event count
  if (totalEvents > 0) {
    liquidityRatio = tradeVolume / totalEvents;
  }

  return {
    priceChange,
    averagePrice,
    medianPrice,
    tradeVolume,
    buyCount: buyEvents,
    sellCount: sellEvents,
    liquidityRatio,
    eventCount: totalEvents,
  };
}

function filterEventsByWindow(events, windowMs) {
  if (!events) {
    return [];
  }

  const now = Date.now();
  const cutoff = now - windowMs;

  return events.filter((event) => {
    const eventTime = new Date(event.timestamp).getTime();
    return eventTime >= cutoff && eventTime <= now;
  });
}

async function computeMetricsForCollection(
  collectionId,
  marketSnapshots,
  listingEvents,
  purchaseEvents,
  analyticsRepository
) {
  try {
    const results = {};

    for (const [window, windowMs] of Object.entries(TIME_WINDOWS)) {
      const listingEventsInWindow = filterEventsByWindow(listingEvents, windowMs);
      const purchaseEventsInWindow = filterEventsByWindow(purchaseEvents, windowMs);

      const listingMetrics = calculateMetrics(listingEventsInWindow, window);
      const purchaseMetrics = calculateMetrics(purchaseEventsInWindow, window);

      // Calculate consolidated metrics
      const allEvents = [...listingEventsInWindow, ...purchaseEventsInWindow];

      const metrics = calculateMetrics(allEvents, window);
      metrics.listingMetrics = listingMetrics;
      metrics.purchaseMetrics = purchaseMetrics;

      // Calculate 24h price change specifically
      if (window === '24h' && metrics.priceChange !== null) {
        metrics.priceChange24h = metrics.priceChange;
      }

      // Calculate volume change for 24h
      if (window === '24h' && purchaseMetrics.tradeVolume !== undefined) {
        metrics.volumeChange24h = purchaseMetrics.tradeVolume;
      }

      await analyticsRepository.upsertMetrics(collectionId, window, metrics);

      logger.debug('Computed metrics', {
        collectionId,
        window,
        metricsKeys: Object.keys(metrics),
      });

      results[window] = metrics;
    }

    return results;
  } catch (error) {
    logger.error('Error computing metrics for collection', {
      collectionId,
      error: error.message,
    });
    throw error;
  }
}

async function refreshMetrics(collectionIds, dataStore, analyticsRepository) {
  try {
    let totalUpdated = 0;
    let totalGenerated = 0;

    logger.info('Starting metrics refresh', {
      collectionsToUpdate: collectionIds.length,
    });

    for (const collectionId of collectionIds) {
      try {
        const listingEvents = dataStore.getListingEvents(collectionId) || [];
        const purchaseEvents = dataStore.getPurchaseEvents(collectionId) || [];
        const marketSnapshots = dataStore.getMarketSnapshots(collectionId) || [];

        const metrics = await computeMetricsForCollection(
          collectionId,
          marketSnapshots,
          listingEvents,
          purchaseEvents,
          analyticsRepository
        );

        totalUpdated += 1;
        totalGenerated += Object.keys(metrics).length;

        logger.info('Collection metrics refreshed', {
          collectionId,
          windowsUpdated: Object.keys(metrics).length,
        });
      } catch (error) {
        logger.error('Error refreshing metrics for collection', {
          collectionId,
          error: error.message,
        });
      }
    }

    refreshLog.lastRefreshTime = new Date().toISOString();
    refreshLog.collectionsUpdated = totalUpdated;
    refreshLog.metricsGenerated = totalGenerated;

    logger.info('Metrics refresh completed', {
      collectionsUpdated: totalUpdated,
      metricsGenerated: totalGenerated,
    });

    return {
      success: true,
      collectionsUpdated: totalUpdated,
      metricsGenerated: totalGenerated,
      timestamp: refreshLog.lastRefreshTime,
    };
  } catch (error) {
    logger.error('Error refreshing metrics', {
      error: error.message,
    });
    throw error;
  }
}

function getRefreshLog() {
  return { ...refreshLog };
}

function resetRefreshLog() {
  refreshLog.lastRefreshTime = null;
  refreshLog.collectionsUpdated = 0;
  refreshLog.metricsGenerated = 0;
}

module.exports = {
  computeMetricsForCollection,
  refreshMetrics,
  calculateMetrics,
  filterEventsByWindow,
  getRefreshLog,
  resetRefreshLog,
  TIME_WINDOWS,
};
