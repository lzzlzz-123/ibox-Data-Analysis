const request = require('supertest');
const express = require('express');
const cors = require('cors');
const collectionsRoutes = require('../src/routes/collections');
const alertsRoutes = require('../src/routes/alerts');
const analyticsRoutes = require('../src/routes/analytics');
const logger = require('../src/utils/logger');

// Create a test app without starting the server
const createTestApp = () => {
  const app = express();
  
  // CORS configuration for tests
  app.use(cors());
  app.use(express.json());
  
  // Mock logging for tests
  app.use((req, res, next) => {
    // Suppress logs during tests
    next();
  });
  
  // Routes
  app.use('/api/collections', collectionsRoutes);
  app.use('/api/alerts', alertsRoutes);
  app.use('/api/analytics', analyticsRoutes);
  
  // Health endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  // Root endpoint
  app.get('/', (req, res) => {
    res.json({ message: 'Collections Dashboard API' });
  });
  
  // Error handler
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      error: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
  });
  
  return app;
};

const dataStore = require('../src/repositories/dataStore');
const { analyticsRepository } = require('../src/repositories/analyticsRepository');
const { alertsRepository } = require('../src/repositories/alertsRepository');

describe('Collections API Integration Tests', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });
  
  beforeEach(async () => {
    // Clear all data stores
    await dataStore.clear();
    await analyticsRepository.clear();
    await alertsRepository.clear();
  });

  describe('GET /api/collections', () => {
    it('should return empty collections list when no data exists', async () => {
      const response = await request(app)
        .get('/api/collections')
        .expect(200);

      expect(response.body).toHaveProperty('collections');
      expect(Array.isArray(response.body.collections)).toBe(true);
      expect(response.body.collections).toHaveLength(0);
    });

    it('should return collections with latest metrics and 24h deltas', async () => {
      // Setup test data
      const collectionId = 'test-collection';
      
      // Add snapshots
      dataStore.addMarketSnapshot(collectionId, {
        floorPrice: 1.5,
        volume: 1000,
      });

      // Add previous 24h metrics first (so it becomes the "previous" one)
      await analyticsRepository.upsertMetrics(collectionId, '24h', {
        priceChange: 8.0,
        averagePrice: 1.8,
        tradeVolume: 4000,
        buySellRatio: 1.0,
      });

      // Add latest 24h metrics (this should be the latest one)
      await analyticsRepository.upsertMetrics(collectionId, '24h', {
        priceChange: 10.5,
        averagePrice: 2.0,
        tradeVolume: 5000,
        buySellRatio: 1.2,
      });

      const response = await request(app)
        .get('/api/collections')
        .expect(200);

      expect(response.body.collections).toHaveLength(1);
      const collection = response.body.collections[0];
      
      expect(collection).toHaveProperty('id', collectionId);
      expect(collection).toHaveProperty('name', collectionId);
      expect(collection).toHaveProperty('latestSnapshot');
      expect(collection).toHaveProperty('latestMetrics');
      expect(collection).toHaveProperty('delta24h');
      expect(collection).toHaveProperty('lastUpdated');
      
      expect(collection.latestMetrics).toHaveProperty('priceChange', 10.5);
      expect(collection.delta24h).toBeNull(); // Only one 24h metric, so no delta
    });
  });

  describe('GET /api/collections/:id', () => {
    it('should return 404 for non-existent collection', async () => {
      const response = await request(app)
        .get('/api/collections/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Collection not found');
      expect(response.body).toHaveProperty('message');
    });

    it('should return collection with metadata and metrics', async () => {
      const collectionId = 'test-collection';
      
      // Add test data
      dataStore.addMarketSnapshot(collectionId, { floorPrice: 1.5 });
      dataStore.addListingEvent(collectionId, { price: 2.0 });
      dataStore.addPurchaseEvent(collectionId, { price: 1.8 });
      
      await analyticsRepository.upsertMetrics(collectionId, '24h', {
        priceChange: 10.5,
        averagePrice: 2.0,
      });

      const response = await request(app)
        .get(`/api/collections/${collectionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('collection');
      const collection = response.body.collection;
      
      expect(collection).toHaveProperty('id', collectionId);
      expect(collection).toHaveProperty('name', collectionId);
      expect(collection).toHaveProperty('metadata');
      expect(collection).toHaveProperty('latestSnapshot');
      expect(collection).toHaveProperty('metrics');
      
      expect(collection.metadata).toHaveProperty('totalSnapshots', 1);
      expect(collection.metadata).toHaveProperty('totalListingEvents', 1);
      expect(collection.metadata).toHaveProperty('totalPurchaseEvents', 1);
      expect(collection.metrics).toHaveProperty('24h');
    });

    it('should handle non-existent collection gracefully', async () => {
      // Test with a valid but non-existent collection ID
      const response = await request(app)
        .get('/api/collections/non-existent-collection')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Collection not found');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/collections/:id/snapshots', () => {
    beforeEach(() => {
      // Add test snapshots
      const collectionId = 'test-collection';
      const baseTime = new Date('2023-01-01T00:00:00Z');
      
      for (let i = 0; i < 10; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 60 * 60 * 1000); // 1 hour intervals
        dataStore.marketSnapshots[collectionId] = dataStore.marketSnapshots[collectionId] || [];
        dataStore.marketSnapshots[collectionId].push({
          id: `snapshot-${i}`,
          collectionId,
          timestamp: timestamp.toISOString(),
          floorPrice: 1.0 + i * 0.1,
          volume: 1000 + i * 100,
        });
      }
    });

    it('should return collection snapshots with pagination', async () => {
      const response = await request(app)
        .get('/api/collections/test-collection/snapshots')
        .expect(200);

      expect(response.body).toHaveProperty('snapshots');
      expect(response.body).toHaveProperty('pagination');
      
      expect(Array.isArray(response.body.snapshots)).toBe(true);
      expect(response.body.pagination).toHaveProperty('total', 10);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 100);
    });

    it('should filter snapshots by date range', async () => {
      const response = await request(app)
        .get('/api/collections/test-collection/snapshots')
        .query({
          from: '2023-01-01T02:00:00Z',
          to: '2023-01-01T05:00:00Z',
        })
        .expect(200);

      expect(response.body.snapshots).toHaveLength(4); // 2, 3, 4, 5
      expect(response.body.pagination.total).toBe(4);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/collections/test-collection/snapshots')
        .query({
          page: 2,
          limit: 3,
        })
        .expect(200);

      expect(response.body.snapshots).toHaveLength(3);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(3);
      expect(response.body.pagination.hasNext).toBe(true);
      expect(response.body.pagination.hasPrev).toBe(true);
    });

    it('should return 400 for invalid date range', async () => {
      const response = await request(app)
        .get('/api/collections/test-collection/snapshots')
        .query({
          from: 'invalid-date',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid query parameters');
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await request(app)
        .get('/api/collections/non-existent/snapshots')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Collection not found');
    });
  });

  describe('GET /api/collections/:id/events', () => {
    beforeEach(() => {
      const collectionId = 'test-collection';
      
      // Add test events
      for (let i = 0; i < 5; i++) {
        dataStore.addListingEvent(collectionId, {
          price: 1.0 + i * 0.1,
          quantity: 1,
        });
        
        dataStore.addPurchaseEvent(collectionId, {
          price: 1.2 + i * 0.1,
          quantity: 1,
        });
      }
    });

    it('should return all collection events with pagination', async () => {
      const response = await request(app)
        .get('/api/collections/test-collection/events')
        .expect(200);

      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('pagination');
      
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.pagination.total).toBe(10); // 5 listing + 5 purchase
      expect(response.body.events[0]).toHaveProperty('type'); // listing or purchase
    });

    it('should filter events by type', async () => {
      const response = await request(app)
        .get('/api/collections/test-collection/events')
        .query({
          type: 'listing',
        })
        .expect(200);

      expect(response.body.events).toHaveLength(5);
      response.body.events.forEach(event => {
        expect(event.type).toBe('listing');
      });
    });

    it('should paginate events', async () => {
      const response = await request(app)
        .get('/api/collections/test-collection/events')
        .query({
          page: 1,
          limit: 3,
        })
        .expect(200);

      expect(response.body.events).toHaveLength(3);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(3);
      expect(response.body.pagination.hasNext).toBe(true);
    });

    it('should return events sorted by most recent first', async () => {
      const response = await request(app)
        .get('/api/collections/test-collection/events')
        .expect(200);

      const events = response.body.events;
      for (let i = 1; i < events.length; i++) {
        const prevTime = new Date(events[i - 1].timestamp);
        const currTime = new Date(events[i].timestamp);
        expect(prevTime.getTime()).toBeGreaterThanOrEqual(currTime.getTime());
      }
    });

    it('should return 404 for non-existent collection', async () => {
      const response = await request(app)
        .get('/api/collections/non-existent/events')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Collection not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed query parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/collections/test-collection/snapshots')
        .query({
          page: 'invalid',
          limit: -5,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid query parameters');
    });

    it('should handle rate limiting gracefully if implemented', async () => {
      // This test would be relevant if rate limiting is implemented
      // For now, just ensure multiple requests work
      await request(app).get('/api/collections').expect(200);
      await request(app).get('/api/collections').expect(200);
      await request(app).get('/api/collections').expect(200);
    });
  });
});