const request = require('supertest');
const express = require('express');
const cors = require('cors');
const collectionsRoutes = require('../src/routes/collections');
const alertsRoutes = require('../src/routes/alerts');
const analyticsRoutes = require('../src/routes/analytics');

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

const { alertsRepository } = require('../src/repositories/alertsRepository');

describe('Alerts API Integration Tests', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });
  
  beforeEach(async () => {
    // Clear alerts repository
    await alertsRepository.clear();
  });

  describe('GET /api/alerts', () => {
    beforeEach(async () => {
      // Setup test alerts
      const baseTime = new Date('2023-01-01T00:00:00Z');
      
      await alertsRepository.create({
        collectionId: 'collection-1',
        type: 'price_threshold',
        severity: 'high',
        triggeredAt: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        message: 'Price exceeded threshold',
        resolved: false,
      });

      await alertsRepository.create({
        collectionId: 'collection-2',
        type: 'volume_spike',
        severity: 'medium',
        triggeredAt: new Date(baseTime.getTime() + 1 * 60 * 60 * 1000).toISOString(),
        message: 'Volume spike detected',
        resolved: true,
      });

      await alertsRepository.create({
        collectionId: 'collection-1',
        type: 'liquidity_drop',
        severity: 'low',
        triggeredAt: baseTime.toISOString(),
        message: 'Liquidity dropped',
        resolved: false,
      });
    });

    it('should return all alerts with pagination and summary', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .expect(200);

      expect(response.body).toHaveProperty('alerts');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('summary');

      expect(Array.isArray(response.body.alerts)).toBe(true);
      expect(response.body.alerts).toHaveLength(3);
      
      expect(response.body.pagination).toHaveProperty('total', 3);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 50);
      
      expect(response.body.summary).toHaveProperty('total', 3);
      expect(response.body.summary).toHaveProperty('resolved', 1);
      expect(response.body.summary).toHaveProperty('unresolved', 2);
      expect(response.body.summary).toHaveProperty('bySeverity');
      expect(response.body.summary).toHaveProperty('byType');
      expect(response.body.summary).toHaveProperty('byCollection');
    });

    it('should filter alerts by collection ID', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .query({
          collectionId: 'collection-1',
        })
        .expect(200);

      expect(response.body.alerts).toHaveLength(2);
      response.body.alerts.forEach(alert => {
        expect(alert.collectionId).toBe('collection-1');
      });
    });

    it('should filter alerts by severity', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .query({
          severity: 'high',
        })
        .expect(200);

      expect(response.body.alerts).toHaveLength(1);
      expect(response.body.alerts[0].severity).toBe('high');
    });

    it('should filter alerts by resolved status', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .query({ resolved: 'false' })
        .expect(200);

      expect(response.body.alerts).toHaveLength(2);
      response.body.alerts.forEach(alert => {
        expect(alert.resolved).toBe(false);
      });
    });

    it('should filter alerts by type', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .query({
          type: 'price_threshold',
        })
        .expect(200);

      expect(response.body.alerts).toHaveLength(1);
      expect(response.body.alerts[0].type).toBe('price_threshold');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .query({
          page: 1,
          limit: 2,
        })
        .expect(200);

      expect(response.body.alerts).toHaveLength(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.pagination.hasNext).toBe(true);
      expect(response.body.pagination.hasPrev).toBe(false);
    });

    it('should sort alerts by specified field', async () => {
      const response = await request(app)
        .get('/api/alerts?sortBy=severity&sortOrder=asc')
        .expect(200);

      const alerts = response.body.alerts;
      expect(alerts[0].severity).toBe('low');
      expect(alerts[1].severity).toBe('medium');
      expect(alerts[2].severity).toBe('high');
    });

    it('should return 400 for invalid query parameters', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .query({
          severity: 'invalid-severity',
          page: -1,
          limit: 2000,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid query parameters');
      expect(response.body).toHaveProperty('message');
    });

    it('should return empty result when no alerts match filters', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .query({
          collectionId: 'non-existent-collection',
        })
        .expect(200);

      expect(response.body.alerts).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
    });
  });

  describe('GET /api/alerts/:id', () => {
    it('should return specific alert by ID', async () => {
      const createdAlert = await alertsRepository.create({
        collectionId: 'test-collection',
        type: 'price_threshold',
        severity: 'high',
        triggeredAt: new Date().toISOString(),
        message: 'Test alert',
      });

      const response = await request(app)
        .get(`/api/alerts/${createdAlert.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('alert');
      expect(response.body.alert.id).toBe(createdAlert.id);
      expect(response.body.alert.collectionId).toBe('test-collection');
      expect(response.body.alert.type).toBe('price_threshold');
    });

    it('should return 404 for non-existent alert ID', async () => {
      const response = await request(app)
        .get('/api/alerts/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Alert not found');
      expect(response.body).toHaveProperty('message');
    });

    it('should handle invalid alert ID gracefully', async () => {
      // Test with a valid but non-existent alert ID
      const response = await request(app)
        .get('/api/alerts/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Alert not found');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('PUT /api/alerts/:id', () => {
    let testAlert;

    beforeEach(async () => {
      testAlert = await alertsRepository.create({
        collectionId: 'test-collection',
        type: 'price_threshold',
        severity: 'high',
        triggeredAt: new Date().toISOString(),
        message: 'Test alert',
        resolved: false,
      });
    });

    it('should update alert resolved status', async () => {
      const response = await request(app)
        .put(`/api/alerts/${testAlert.id}`)
        .send({
          resolved: true,
        })
        .expect(200);

      expect(response.body).toHaveProperty('alert');
      expect(response.body.alert.id).toBe(testAlert.id);
      expect(response.body.alert.resolved).toBe(true);
      expect(response.body.alert).toHaveProperty('updatedAt');
    });

    it('should return 404 when updating non-existent alert', async () => {
      const response = await request(app)
        .put('/api/alerts/non-existent-id')
        .send({
          resolved: true,
        })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Alert not found');
    });

    it('should return 400 for invalid request body', async () => {
      const response = await request(app)
        .put(`/api/alerts/${testAlert.id}`)
        .send({
          resolved: 'not-a-boolean',
          invalidField: 'value',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request body');
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .put(`/api/alerts/${testAlert.id}`)
        .send({})
        .expect(200);

      // Alert should remain unchanged
      expect(response.body.alert.resolved).toBe(false);
    });
  });

  describe('PUT /api/alerts/:id/resolve', () => {
    let testAlert;

    beforeEach(async () => {
      testAlert = await alertsRepository.create({
        collectionId: 'test-collection',
        type: 'price_threshold',
        severity: 'high',
        triggeredAt: new Date().toISOString(),
        message: 'Test alert',
        resolved: false,
      });
    });

    it('should mark alert as resolved', async () => {
      const response = await request(app)
        .put(`/api/alerts/${testAlert.id}/resolve`)
        .expect(200);

      expect(response.body).toHaveProperty('alert');
      expect(response.body.alert.id).toBe(testAlert.id);
      expect(response.body.alert.resolved).toBe(true);
      expect(response.body.alert).toHaveProperty('updatedAt');
    });

    it('should return 404 when resolving non-existent alert', async () => {
      const response = await request(app)
        .put('/api/alerts/non-existent-id/resolve')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Alert not found');
    });

    it('should handle already resolved alert', async () => {
      // First resolve the alert
      await request(app)
        .put(`/api/alerts/${testAlert.id}/resolve`)
        .expect(200);

      // Try to resolve again
      const response = await request(app)
        .put(`/api/alerts/${testAlert.id}/resolve`)
        .expect(200);

      expect(response.body.alert.resolved).toBe(true);
    });
  });

  describe('CORS and Error Handling', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/alerts')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .put('/api/alerts/test-id')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    it('should handle very large request payloads gracefully', async () => {
      const largeString = 'x'.repeat(1000000); // 1MB string
      
      const response = await request(app)
        .put('/api/alerts/non-existent-id')
        .send({
          resolved: true,
          largeData: largeString,
        })
        .expect(413); // Payload Too Large

      expect(response.status).toBe(413);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large number of alerts efficiently', async () => {
      // Create many alerts
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(alertsRepository.create({
          collectionId: `collection-${i % 10}`,
          type: 'test_type',
          severity: ['low', 'medium', 'high'][i % 3],
          triggeredAt: new Date(Date.now() - i * 1000).toISOString(),
          message: `Test alert ${i}`,
          resolved: i % 2 === 0,
        }));
      }
      await Promise.all(promises);

      const response = await request(app)
        .get('/api/alerts')
        .query({
          limit: 50,
        })
        .expect(200);

      expect(response.body.alerts).toHaveLength(50);
      expect(response.body.pagination.total).toBe(100);
    });

    it('should handle concurrent requests', async () => {
      // Create some test data
      await alertsRepository.create({
        collectionId: 'test-collection',
        type: 'test_type',
        severity: 'high',
        triggeredAt: new Date().toISOString(),
        message: 'Test alert',
      });

      // Make concurrent requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(request(app).get('/api/alerts'));
      }

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('alerts');
      });
    });
  });
});