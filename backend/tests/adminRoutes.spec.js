const request = require('supertest');
const express = require('express');
const adminRoutes = require('../src/routes/admin');
const dataStore = require('../src/repositories/dataStore');
const collectionRepository = require('../src/repositories/collectionRepository');
const logger = require('../src/utils/logger');

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Admin Routes', () => {
  let app;
  const validAdminKey = 'test-admin-key-123';

  beforeEach(() => {
    process.env.ADMIN_API_KEY = validAdminKey;

    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);

    dataStore.clear();
    collectionRepository.clear();
  });

  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
  });

  describe('POST /api/admin/refresh', () => {
    it('should reject request without API key', async () => {
      const response = await request(app)
        .post('/api/admin/refresh')
        .send({
          crawlerData: [],
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject request with invalid API key', async () => {
      const response = await request(app)
        .post('/api/admin/refresh')
        .send({
          apiKey: 'wrong-key',
          crawlerData: [],
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject request without ADMIN_API_KEY configured', async () => {
      delete process.env.ADMIN_API_KEY;

      const response = await request(app)
        .post('/api/admin/refresh')
        .send({
          apiKey: 'any-key',
          crawlerData: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Admin endpoint not configured');
    });

    it('should accept valid API key', async () => {
      const response = await request(app)
        .post('/api/admin/refresh')
        .send({
          apiKey: validAdminKey,
          crawlerData: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should process crawler data and ingest collections', async () => {
      const crawlerData = [
        {
          collectionId: 'test-col-1',
          metadata: { name: 'Test Collection 1' },
          snapshot: {
            id: 'snap-1',
            price: 100,
            volume: 50,
          },
          listingEvents: [
            {
              id: 'list-1',
              price: 105,
              quantity: 2,
            },
          ],
          purchaseEvents: [
            {
              id: 'purch-1',
              price: 102,
              quantity: 1,
            },
          ],
        },
      ];

      const response = await request(app)
        .post('/api/admin/refresh')
        .send({
          apiKey: validAdminKey,
          crawlerData,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalCollections).toBe(1);
      expect(response.body.summary.totalSnapshots).toBe(1);
      expect(response.body.summary.totalListingEvents).toBe(1);
      expect(response.body.summary.totalPurchaseEvents).toBe(1);
    });

    it('should return summary statistics', async () => {
      const crawlerData = [
        {
          collectionId: 'col-1',
          metadata: { name: 'Collection 1' },
          snapshot: { id: 'snap-1', price: 100 },
          listingEvents: [{ id: 'list-1', price: 105 }],
          purchaseEvents: [{ id: 'purch-1', price: 102 }],
        },
        {
          collectionId: 'col-2',
          metadata: { name: 'Collection 2' },
          snapshot: { id: 'snap-2', price: 200 },
          listingEvents: [
            { id: 'list-2', price: 210 },
            { id: 'list-3', price: 215 },
          ],
        },
      ];

      const response = await request(app)
        .post('/api/admin/refresh')
        .send({
          apiKey: validAdminKey,
          crawlerData,
        });

      expect(response.status).toBe(200);
      expect(response.body.summary.totalCollections).toBe(2);
      expect(response.body.summary.totalSnapshots).toBe(2);
      expect(response.body.summary.totalListingEvents).toBe(3);
      expect(response.body.summary.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty crawler data', async () => {
      const response = await request(app)
        .post('/api/admin/refresh')
        .send({
          apiKey: validAdminKey,
          crawlerData: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary.totalCollections).toBe(0);
    });

    it('should include failures in response', async () => {
      const crawlerData = [
        {
          collectionId: '', // Invalid: empty ID
          metadata: { name: 'Bad Collection' },
          snapshot: { id: 'snap-1', price: 100 },
        },
        {
          collectionId: 'col-1', // Valid
          metadata: { name: 'Good Collection' },
          snapshot: { id: 'snap-2', price: 200 },
        },
      ];

      const response = await request(app)
        .post('/api/admin/refresh')
        .send({
          apiKey: validAdminKey,
          crawlerData,
        });

      expect(response.status).toBe(200);
      expect(response.body.summary.totalCollections).toBe(1);
    });

    it('should accept API key in header', async () => {
      const response = await request(app)
        .post('/api/admin/refresh')
        .set('x-admin-key', validAdminKey)
        .send({
          crawlerData: [],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/admin/refresh')
        .send({
          apiKey: validAdminKey,
          crawlerData: 'not-an-array', // Invalid type
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation Error');
    });

    it('should store ingested data in data store', async () => {
      const crawlerData = [
        {
          collectionId: 'test-col',
          metadata: { name: 'Test' },
          snapshot: { id: 'snap-1', price: 100, volume: 50 },
          listingEvents: [
            { id: 'list-1', price: 105, quantity: 2 },
          ],
        },
      ];

      await request(app)
        .post('/api/admin/refresh')
        .send({
          apiKey: validAdminKey,
          crawlerData,
        });

      const snapshots = dataStore.getMarketSnapshots('test-col');
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].price).toBe(100);

      const listingEvents = dataStore.getListingEvents('test-col');
      expect(listingEvents).toHaveLength(1);
      expect(listingEvents[0].price).toBe(105);
    });
  });
});
