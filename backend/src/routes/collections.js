const express = require('express');
const Joi = require('joi');
const collectionService = require('../services/collectionService');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const collectionIdSchema = Joi.string().required().messages({
  'string.empty': 'Collection ID is required',
  'any.required': 'Collection ID is required',
});

const querySchema = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional().min(Joi.ref('from')),
  interval: Joi.string().valid('1h', '6h', '24h', '72h').default('1h'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  type: Joi.string().valid('listing', 'purchase').optional(),
});

// Validation middleware
const validateCollectionId = (req, res, next) => {
  const { error } = collectionIdSchema.validate(req.params.id);
  if (error) {
    return res.status(400).json({
      error: 'Invalid collection ID',
      message: error.details[0].message,
    });
  }
  next();
};

const validateQuery = (req, res, next) => {
  const { error, value } = querySchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      error: 'Invalid query parameters',
      message: error.details[0].message,
    });
  }
  req.query = value; // Use validated values
  next();
};

router.get('/', async (req, res) => {
  try {
    const collectionsData = await collectionService.getAllCollectionsWithMetrics();

    logger.info('Collections retrieved', {
      count: collectionsData.length,
    });

    res.json({
      collections: collectionsData,
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

router.get('/:id', validateCollectionId, async (req, res) => {
  try {
    const collection = await collectionService.getCollectionById(req.params.id);

    if (!collection) {
      logger.warn('Collection not found', { collectionId: req.params.id });
      return res.status(404).json({
        error: 'Collection not found',
        message: `Collection with ID '${req.params.id}' not found`,
      });
    }

    res.json({
      collection,
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

// GET /api/collections/:id/snapshots
router.get('/:id/snapshots', validateCollectionId, validateQuery, async (req, res) => {
  try {
    const { from, to, interval, page, limit } = req.query;
    
    const result = await collectionService.getCollectionSnapshots(req.params.id, {
      from,
      to,
      interval,
      page,
      limit,
    });

    // Check if collection exists (result will be empty for non-existent collections)
    const allCollections = require('../repositories/dataStore').getAllCollections();
    if (!allCollections.includes(req.params.id)) {
      return res.status(404).json({
        error: 'Collection not found',
        message: `Collection with ID '${req.params.id}' not found`,
      });
    }

    logger.info('Collection snapshots retrieved', {
      collectionId: req.params.id,
      count: result.snapshots.length,
      total: result.pagination.total,
    });

    res.json(result);
  } catch (error) {
    logger.error('Error fetching collection snapshots', {
      collectionId: req.params.id,
      query: req.query,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch collection snapshots',
      message: error.message,
    });
  }
});

// GET /api/collections/:id/events
router.get('/:id/events', validateCollectionId, validateQuery, async (req, res) => {
  try {
    const { page, limit, type } = req.query;
    
    const result = await collectionService.getCollectionEvents(req.params.id, {
      page,
      limit,
      type,
    });

    // Check if collection exists (result will be empty for non-existent collections)
    const allCollections = require('../repositories/dataStore').getAllCollections();
    if (!allCollections.includes(req.params.id)) {
      return res.status(404).json({
        error: 'Collection not found',
        message: `Collection with ID '${req.params.id}' not found`,
      });
    }

    logger.info('Collection events retrieved', {
      collectionId: req.params.id,
      count: result.events.length,
      total: result.pagination.total,
      type,
    });

    res.json(result);
  } catch (error) {
    logger.error('Error fetching collection events', {
      collectionId: req.params.id,
      query: req.query,
      error: error.message,
    });
    res.status(500).json({
      error: 'Failed to fetch collection events',
      message: error.message,
    });
  }
});

module.exports = router;
