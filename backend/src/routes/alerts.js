const express = require('express');
const Joi = require('joi');
const alertReadService = require('../services/alertReadService');
const { alertsRepository } = require('../repositories/alertsRepository');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const alertIdSchema = Joi.string().required().messages({
  'string.empty': 'Alert ID is required',
  'any.required': 'Alert ID is required',
});

const alertsQuerySchema = Joi.object({
  collectionId: Joi.string().optional(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  type: Joi.string().optional(),
  resolved: Joi.string().valid('true', 'false').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(50),
  sortBy: Joi.string().valid('triggeredAt', 'severity', 'type', 'createdAt').default('triggeredAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const updateAlertSchema = Joi.object({
  resolved: Joi.boolean().optional(),
});

// Validation middleware
const validateAlertId = (req, res, next) => {
  const { error } = alertIdSchema.validate(req.params.id);
  if (error) {
    return res.status(400).json({
      error: 'Invalid alert ID',
      message: error.details[0].message,
    });
  }
  next();
};

const validateAlertsQuery = (req, res, next) => {
  const { error, value } = alertsQuerySchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      message: error.details[0].message,
    });
  }
  req.query = value; // Use validated values
  next();
};

const validateUpdateAlert = (req, res, next) => {
  const { error, value } = updateAlertSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Invalid request body',
      message: error.details[0].message,
    });
  }
  req.body = value; // Use validated values
  next();
};

router.get('/', validateAlertsQuery, async (req, res) => {
  try {
    const result = await alertReadService.getAlerts(req.query);

    logger.info('Alerts retrieved', {
      count: result.alerts.length,
      total: result.pagination.total,
      filters: req.query,
    });

    res.json(result);
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

router.get('/:id', validateAlertId, async (req, res) => {
  try {
    const alert = await alertReadService.getAlertById(req.params.id);

    if (!alert) {
      logger.warn('Alert not found', { alertId: req.params.id });
      return res.status(404).json({
        error: 'Alert not found',
        message: `Alert with ID '${req.params.id}' not found`,
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

router.put('/:id', validateAlertId, validateUpdateAlert, async (req, res) => {
  try {
    const { resolved } = req.body;

    const updates = {};
    if (resolved !== undefined) {
      updates.resolved = resolved;
    }

    const alert = await alertsRepository.update(req.params.id, updates);

    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        message: `Alert with ID '${req.params.id}' not found`,
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

router.put('/:id/resolve', validateAlertId, async (req, res) => {
  try {
    const alert = await alertsRepository.markAsResolved(req.params.id);

    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        message: `Alert with ID '${req.params.id}' not found`,
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
