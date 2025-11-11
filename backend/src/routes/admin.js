const express = require('express');
const Joi = require('joi');
const logger = require('../utils/logger');
const { ingestCollections } = require('../workflows/ingestCollections');

const router = express.Router();

// Validation schema for refresh request
const refreshSchema = Joi.object({
  apiKey: Joi.string().optional().allow(''),
  crawlerData: Joi.array()
    .items(
      Joi.object({
        collectionId: Joi.string().optional().allow(''),
        metadata: Joi.object().optional(),
        snapshot: Joi.object().optional(),
        listingEvents: Joi.array().optional(),
        purchaseEvents: Joi.array().optional(),
      })
    )
    .optional()
    .default([]),
});

// Middleware to validate admin API key
const validateAdminKey = (req, res, next) => {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    logger.warn('ADMIN_API_KEY not configured');
    return res.status(500).json({
      error: 'Admin endpoint not configured',
      message: 'ADMIN_API_KEY environment variable not set',
    });
  }

  const providedKey = req.body.apiKey || req.headers['x-admin-key'];
  if (!providedKey || providedKey !== adminKey) {
    logger.warn('Invalid admin API key attempt', {
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({
      error: 'Unauthorized',
      message: 'Invalid API credentials',
    });
  }

  next();
};

// POST /api/admin/refresh - Trigger crawl and ingestion
router.post('/refresh', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = refreshSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message,
      });
    }

    // Validate admin credentials
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) {
      logger.warn('ADMIN_API_KEY not configured');
      return res.status(500).json({
        error: 'Admin endpoint not configured',
        message: 'ADMIN_API_KEY environment variable not set',
      });
    }

    // Check API key from body or header
    const providedKey = value.apiKey || req.headers['x-admin-key'];
    if (!providedKey || providedKey !== adminKey) {
      logger.warn('Invalid admin API key attempt', {
        path: req.path,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Invalid API credentials',
      });
    }

    logger.info('Admin refresh triggered', {
      crawlerPayloads: value.crawlerData.length,
    });

    // Run ingestion workflow
    const result = await ingestCollections(value.crawlerData);

    logger.info('Admin refresh completed', result.metrics);

    res.json({
      success: result.success,
      summary: {
        totalCollections: result.metrics.totalCollections,
        totalSnapshots: result.metrics.totalSnapshots,
        totalListingEvents: result.metrics.totalListingEvents,
        totalPurchaseEvents: result.metrics.totalPurchaseEvents,
        failureCount: result.metrics.failures.length,
        durationMs: result.metrics.duration,
      },
      ...(result.metrics.failures.length > 0 && { failures: result.metrics.failures }),
    });
  } catch (error) {
    logger.error('Error in admin refresh endpoint', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process refresh request',
    });
  }
});

module.exports = router;
