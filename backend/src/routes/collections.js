const express = require('express');
const { analyticsRepository } = require('../repositories/analyticsRepository');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const collections = await analyticsRepository.getAllCollections();
    const metricsData = [];

    for (const collectionId of collections) {
      const metrics = await analyticsRepository.getCollectionMetrics(collectionId);
      const latest24h = metrics.find((m) => m.window === '24h');

      metricsData.push({
        id: collectionId,
        name: collectionId, // Could be enhanced with name mapping
        latestMetrics: latest24h || null,
        allMetrics: metrics,
      });
    }

    logger.info('Collections retrieved', {
      count: collections.length,
    });

    res.json({
      collections: metricsData,
    });
  } catch (error) {
    logger.error('Error fetching collections', {
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch collections',
      message: error.message,
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const metrics = await analyticsRepository.getCollectionMetrics(req.params.id);

    if (metrics.length === 0) {
      logger.warn('Collection not found', { collectionId: req.params.id });
      return res.status(404).json({
        error: 'Collection not found',
      });
    }

    const groupedByWindow = {};
    metrics.forEach((m) => {
      groupedByWindow[m.window] = m;
    });

    res.json({
      collection: {
        id: req.params.id,
        name: req.params.id,
        metrics: groupedByWindow,
      },
    });
  } catch (error) {
    logger.error('Error fetching collection', {
      collectionId: req.params.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch collection',
      message: error.message,
    });
  }
});

module.exports = router;
