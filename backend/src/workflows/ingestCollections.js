const logger = require('../utils/logger');
const ingestionService = require('../services/ingestionService');
const collectionRepository = require('../repositories/collectionRepository');
const snapshotRepository = require('../repositories/snapshotRepository');
const eventRepository = require('../repositories/eventRepository');
const { analyticsRepository } = require('../repositories/analyticsRepository');

async function ingestCollections(crawlerPayloads = []) {
  const startTime = Date.now();
  const metrics = {
    totalCollections: 0,
    totalSnapshots: 0,
    totalListingEvents: 0,
    totalPurchaseEvents: 0,
    failures: [],
    duration: 0,
  };

  try {
    logger.info('Ingestion workflow started', {
      payloads: crawlerPayloads.length,
    });

    if (!Array.isArray(crawlerPayloads) || crawlerPayloads.length === 0) {
      logger.warn('No crawler payloads to ingest');
      return {
        success: true,
        metrics: {
          ...metrics,
          duration: Date.now() - startTime,
        },
      };
    }

    // Group payloads by collection
    const collectionMap = {};
    for (const payload of crawlerPayloads) {
      if (!payload.collectionId) {
        logger.warn('Payload missing collectionId', { payload });
        continue;
      }

      if (!collectionMap[payload.collectionId]) {
        collectionMap[payload.collectionId] = {
          metadata: {},
          snapshots: [],
          listingEvents: [],
          purchaseEvents: [],
        };
      }

      if (payload.metadata) {
        collectionMap[payload.collectionId].metadata = payload.metadata;
      }

      if (payload.snapshot) {
        collectionMap[payload.collectionId].snapshots.push(payload.snapshot);
      }

      if (Array.isArray(payload.listingEvents)) {
        collectionMap[payload.collectionId].listingEvents.push(...payload.listingEvents);
      }

      if (Array.isArray(payload.purchaseEvents)) {
        collectionMap[payload.collectionId].purchaseEvents.push(...payload.purchaseEvents);
      }
    }

    // Process each collection
    for (const [collectionId, data] of Object.entries(collectionMap)) {
      try {
        logger.debug('Processing collection', { collectionId });

        // Upsert collection metadata
        if (Object.keys(data.metadata).length > 0) {
          await collectionRepository.upsertCollection(collectionId, data.metadata);
        }

        // Ingest snapshots
        for (const snapshot of data.snapshots) {
          try {
            await ingestionService.ingestMarketSnapshot(collectionId, snapshot);
            metrics.totalSnapshots += 1;
          } catch (error) {
            logger.error('Failed to ingest snapshot', {
              collectionId,
              snapshotId: snapshot.id,
              error: error.message,
            });
            metrics.failures.push({
              type: 'snapshot',
              collectionId,
              id: snapshot.id,
              error: error.message,
            });
          }
        }

        // Ingest listing events
        for (const event of data.listingEvents) {
          try {
            await ingestionService.ingestListingEvent(collectionId, event);
            metrics.totalListingEvents += 1;
          } catch (error) {
            logger.error('Failed to ingest listing event', {
              collectionId,
              eventId: event.id,
              error: error.message,
            });
            metrics.failures.push({
              type: 'listing_event',
              collectionId,
              id: event.id,
              error: error.message,
            });
          }
        }

        // Ingest purchase events
        for (const event of data.purchaseEvents) {
          try {
            await ingestionService.ingestPurchaseEvent(collectionId, event);
            metrics.totalPurchaseEvents += 1;
          } catch (error) {
            logger.error('Failed to ingest purchase event', {
              collectionId,
              eventId: event.id,
              error: error.message,
            });
            metrics.failures.push({
              type: 'purchase_event',
              collectionId,
              id: event.id,
              error: error.message,
            });
          }
        }

        metrics.totalCollections += 1;
      } catch (error) {
        logger.error('Failed to process collection', {
          collectionId,
          error: error.message,
        });
        metrics.failures.push({
          type: 'collection',
          collectionId,
          error: error.message,
        });
      }
    }

    // Refresh analytics metrics for affected collections
    try {
      const refreshResult = await ingestionService.refreshAffectedMetrics(analyticsRepository);
      logger.info('Analytics metrics refreshed', refreshResult);
    } catch (error) {
      logger.error('Failed to refresh analytics metrics', {
        error: error.message,
      });
      metrics.failures.push({
        type: 'analytics_refresh',
        error: error.message,
      });
    }

    metrics.duration = Date.now() - startTime;

    logger.info('Ingestion workflow completed', metrics);

    return {
      success: metrics.failures.length === 0,
      metrics,
    };
  } catch (error) {
    metrics.duration = Date.now() - startTime;
    logger.error('Ingestion workflow failed', {
      error: error.message,
    });
    metrics.failures.push({
      type: 'workflow',
      error: error.message,
    });

    return {
      success: false,
      metrics,
      error: error.message,
    };
  }
}

module.exports = {
  ingestCollections,
};
