const express = require('express');
const { analyticsRepository } = require('../repositories/analyticsRepository');
const { refreshMetrics, getRefreshLog } = require('../services/analyticsService');
const dataStore = require('../repositories/dataStore');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/metrics', async (req, res) => {
  try {
    const filters = {};

    if (req.query.collectionId) {
      filters.collectionId = req.query.collectionId;
    }

    if (req.query.window) {
      filters.window = req.query.window;
    }

    if (req.query.windows) {
      filters.windows = Array.isArray(req.query.windows)
        ? req.query.windows
        : [req.query.windows];
    }

    const metrics = await analyticsRepository.findMetrics(filters);

    logger.info('Analytics metrics retrieved', {
      count: metrics.length,
      filters,
    });

    res.json({ metrics });
  } catch (error) {
    logger.error('Error fetching analytics metrics', {
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch analytics metrics',
      message: error.message,
    });
  }
});

router.get('/metrics/:id', async (req, res) => {
  try {
    const metric = await analyticsRepository.findMetricsById(req.params.id);

    if (!metric) {
      logger.warn('Metric not found', { metricId: req.params.id });
      return res.status(404).json({
        error: 'Metric not found',
      });
    }

    res.json({ metric });
  } catch (error) {
    logger.error('Error fetching metric', {
      metricId: req.params.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch metric',
      message: error.message,
    });
  }
});

router.get('/collections/:collectionId/metrics', async (req, res) => {
  try {
    const metrics = await analyticsRepository.getCollectionMetrics(
      req.params.collectionId
    );

    logger.info('Collection metrics retrieved', {
      collectionId: req.params.collectionId,
      count: metrics.length,
    });

    res.json({ metrics });
  } catch (error) {
    logger.error('Error fetching collection metrics', {
      collectionId: req.params.collectionId,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch collection metrics',
      message: error.message,
    });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { collectionIds } = req.body;

    let collections = collectionIds;
    if (!collectionIds || collectionIds.length === 0) {
      collections = await dataStore.getAllCollections();
    }

    if (collections.length === 0) {
      logger.warn('No collections to refresh metrics for');
      return res.json({
        success: true,
        collectionsUpdated: 0,
        metricsGenerated: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await refreshMetrics(collections, dataStore, analyticsRepository);

    logger.info('Metrics refresh endpoint called', {
      collectionsRequested: collectionIds ? collectionIds.length : 'all',
      result,
    });

    res.json(result);
  } catch (error) {
    logger.error('Error refreshing metrics', {
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to refresh metrics',
      message: error.message,
    });
  }
});

router.get('/health/status', async (req, res) => {
  try {
    const refreshLog = getRefreshLog();
    const metricsCount = await analyticsRepository.getMetricsCount();
    const collections = await analyticsRepository.getAllCollections();

    res.json({
      status: 'ok',
      lastRefreshTime: refreshLog.lastRefreshTime,
      lastRefreshStats: {
        collectionsUpdated: refreshLog.collectionsUpdated,
        metricsGenerated: refreshLog.metricsGenerated,
      },
      currentStats: {
        totalMetrics: metricsCount,
        trackedCollections: collections.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching health status', {
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch health status',
      message: error.message,
    });
  }
});

module.exports = router;
