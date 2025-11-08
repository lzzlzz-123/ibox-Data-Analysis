const express = require('express');
const { alertsRepository } = require('../repositories/alertsRepository');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const filters = {};

    if (req.query.collectionId) {
      filters.collectionId = req.query.collectionId;
    }

    if (req.query.resolved !== undefined) {
      filters.resolved = req.query.resolved === 'true';
    }

    if (req.query.severity) {
      filters.severity = req.query.severity;
    }

    if (req.query.type) {
      filters.type = req.query.type;
    }

    const alerts = await alertsRepository.findAll(filters);

    logger.info('Alerts retrieved', {
      count: alerts.length,
      filters,
    });

    res.json({ alerts });
  } catch (error) {
    logger.error('Error fetching alerts', {
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch alerts',
      message: error.message,
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const alert = await alertsRepository.findById(req.params.id);

    if (!alert) {
      logger.warn('Alert not found', { alertId: req.params.id });
      return res.status(404).json({
        error: 'Alert not found',
      });
    }

    res.json({ alert });
  } catch (error) {
    logger.error('Error fetching alert', {
      alertId: req.params.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch alert',
      message: error.message,
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { resolved } = req.body;

    const updates = {};
    if (resolved !== undefined) {
      updates.resolved = Boolean(resolved);
    }

    const alert = await alertsRepository.update(req.params.id, updates);

    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
      });
    }

    logger.info('Alert updated', {
      alertId: req.params.id,
      updates,
    });

    res.json({ alert });
  } catch (error) {
    logger.error('Error updating alert', {
      alertId: req.params.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to update alert',
      message: error.message,
    });
  }
});

router.put('/:id/resolve', async (req, res) => {
  try {
    const alert = await alertsRepository.markAsResolved(req.params.id);

    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
      });
    }

    logger.info('Alert marked as resolved', {
      alertId: req.params.id,
    });

    res.json({ alert });
  } catch (error) {
    logger.error('Error resolving alert', {
      alertId: req.params.id,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error.message,
    });
  }
});

module.exports = router;
