const logger = require('../utils/logger');
const dataStore = require('../repositories/dataStore');
const { refreshMetrics } = require('./analyticsService');

const affectedCollections = new Set();

async function ingestMarketSnapshot(collectionId, snapshotData) {
  try {
    dataStore.addMarketSnapshot(collectionId, snapshotData);
    affectedCollections.add(collectionId);

    logger.info('Market snapshot ingested', {
      collectionId,
      snapshotId: snapshotData.id,
    });

    return {
      success: true,
      collectionId,
      type: 'market_snapshot',
    };
  } catch (error) {
    logger.error('Error ingesting market snapshot', {
      collectionId,
      error: error.message,
    });
    throw error;
  }
}

async function ingestListingEvent(collectionId, eventData) {
  try {
    dataStore.addListingEvent(collectionId, eventData);
    affectedCollections.add(collectionId);

    logger.info('Listing event ingested', {
      collectionId,
      eventId: eventData.id,
    });

    return {
      success: true,
      collectionId,
      type: 'listing_event',
    };
  } catch (error) {
    logger.error('Error ingesting listing event', {
      collectionId,
      error: error.message,
    });
    throw error;
  }
}

async function ingestPurchaseEvent(collectionId, eventData) {
  try {
    dataStore.addPurchaseEvent(collectionId, eventData);
    affectedCollections.add(collectionId);

    logger.info('Purchase event ingested', {
      collectionId,
      eventId: eventData.id,
    });

    return {
      success: true,
      collectionId,
      type: 'purchase_event',
    };
  } catch (error) {
    logger.error('Error ingesting purchase event', {
      collectionId,
      error: error.message,
    });
    throw error;
  }
}

async function refreshAffectedMetrics(analyticsRepository) {
  try {
    if (affectedCollections.size === 0) {
      logger.info('No affected collections to refresh metrics for');
      return {
        success: true,
        collectionsRefreshed: 0,
      };
    }

    const collections = Array.from(affectedCollections);
    logger.info('Refreshing metrics for affected collections', {
      count: collections.length,
      collections,
    });

    const result = await refreshMetrics(collections, dataStore, analyticsRepository);

    affectedCollections.clear();

    logger.info('Metrics refresh completed', {
      collectionsUpdated: result.collectionsUpdated,
      metricsGenerated: result.metricsGenerated,
    });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    logger.error('Error refreshing affected metrics', {
      error: error.message,
    });
    throw error;
  }
}

function getAffectedCollections() {
  return Array.from(affectedCollections);
}

function resetAffectedCollections() {
  affectedCollections.clear();
}

module.exports = {
  ingestMarketSnapshot,
  ingestListingEvent,
  ingestPurchaseEvent,
  refreshAffectedMetrics,
  getAffectedCollections,
  resetAffectedCollections,
};
