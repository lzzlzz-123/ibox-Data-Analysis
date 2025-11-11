# Analytics API Integration Guide

## Overview

This guide demonstrates how to use the analytics API endpoints to compute, retrieve, and monitor metrics for NFT/digital asset collections.

## Workflow

### 1. Ingest Data

First, ingest market snapshots, listing events, and purchase events:

```bash
# Ingest a market snapshot
POST /api/data/snapshots
{
  "collectionId": "col-1",
  "price": 1250.50,
  "volume": 250,
  "timestamp": "2024-01-15T10:00:00Z"
}

# Ingest a listing event
POST /api/data/listings
{
  "collectionId": "col-1",
  "price": 1300,
  "quantity": 2,
  "timestamp": "2024-01-15T10:05:00Z"
}

# Ingest a purchase event
POST /api/data/purchases
{
  "collectionId": "col-1",
  "type": "buy",
  "price": 1275.50,
  "quantity": 1,
  "timestamp": "2024-01-15T10:10:00Z"
}
```

### 2. Refresh Metrics

After ingesting data, refresh the analytics metrics:

```bash
# Refresh metrics for all collections
POST /api/analytics/refresh
{}

# Or refresh specific collections
POST /api/analytics/refresh
{
  "collectionIds": ["col-1", "col-2"]
}

Response:
{
  "success": true,
  "collectionsUpdated": 1,
  "metricsGenerated": 4,
  "timestamp": "2024-01-15T10:15:00Z"
}
```

### 3. Retrieve Metrics

Get computed metrics for analysis:

```bash
# Get all metrics
GET /api/analytics/metrics

# Filter by collection
GET /api/analytics/metrics?collectionId=col-1

# Filter by time window
GET /api/analytics/metrics?collectionId=col-1&window=24h

# Filter by multiple windows
GET /api/analytics/metrics?windows=24h,72h

Response:
{
  "metrics": [
    {
      "id": "metric-1",
      "collectionId": "col-1",
      "window": "24h",
      "timestamp": "2024-01-15T10:15:00Z",
      "priceChange": 5.5,
      "averagePrice": 1260.25,
      "medianPrice": 1258.75,
      "tradeVolume": 3,
      "buyCount": 1,
      "sellCount": 0,
      "liquidityRatio": 3.0,
      "eventCount": 1,
      "listingMetrics": {...},
      "purchaseMetrics": {...}
    }
  ]
}
```

### 4. Monitor Collections

Get a dashboard view of all collections:

```bash
GET /api/collections

Response:
{
  "collections": [
    {
      "id": "col-1",
      "name": "col-1",
      "latestMetrics": {
        "collectionId": "col-1",
        "window": "24h",
        "priceChange": 5.5,
        "averagePrice": 1260.25
      },
      "allMetrics": [...]
    }
  ]
}
```

### 5. Check Health

Monitor when analytics were last updated:

```bash
GET /api/analytics/health/status

Response:
{
  "status": "ok",
  "lastRefreshTime": "2024-01-15T10:15:00Z",
  "lastRefreshStats": {
    "collectionsUpdated": 1,
    "metricsGenerated": 4
  },
  "currentStats": {
    "totalMetrics": 4,
    "trackedCollections": 1
  }
}
```

## JavaScript Example

Here's a complete example using the ingestion service:

```javascript
const {
  ingestMarketSnapshot,
  ingestListingEvent,
  ingestPurchaseEvent,
  refreshAffectedMetrics,
} = require('backend/src/services/ingestionService');
const { analyticsRepository } = require('backend/src/repositories/analyticsRepository');

async function processCollectionData(collectionId, rawEvents) {
  try {
    // Ingest all events
    for (const event of rawEvents) {
      if (event.type === 'snapshot') {
        await ingestMarketSnapshot(collectionId, {
          id: event.id,
          price: event.price,
          volume: event.volume,
          timestamp: event.timestamp,
        });
      } else if (event.type === 'listing') {
        await ingestListingEvent(collectionId, {
          id: event.id,
          price: event.price,
          quantity: event.quantity,
          timestamp: event.timestamp,
        });
      } else if (event.type === 'purchase') {
        await ingestPurchaseEvent(collectionId, {
          id: event.id,
          type: event.side, // 'buy' or 'sell'
          price: event.price,
          quantity: event.quantity,
          timestamp: event.timestamp,
        });
      }
    }

    // Refresh metrics after ingestion
    const refreshResult = await refreshAffectedMetrics(analyticsRepository);

    console.log('Metrics refreshed:', refreshResult);

    // Retrieve the computed metrics
    const metrics = await analyticsRepository.getCollectionMetrics(collectionId);

    console.log('Collection metrics:', metrics);

    return metrics;
  } catch (error) {
    console.error('Error processing collection data:', error);
    throw error;
  }
}

// Usage
const events = [
  {
    type: 'purchase',
    id: 'p1',
    side: 'buy',
    price: 1000,
    quantity: 1,
    timestamp: new Date().toISOString(),
  },
  {
    type: 'purchase',
    id: 'p2',
    side: 'buy',
    price: 1050,
    quantity: 2,
    timestamp: new Date().toISOString(),
  },
];

processCollectionData('col-1', events)
  .then((metrics) => {
    console.log('Final metrics:', metrics);
  })
  .catch((error) => {
    console.error('Failed:', error);
  });
```

## Using Metrics in Alerts

The alert system reads from the computed metrics:

```javascript
const { evaluateAlerts } = require('backend/src/services/alertService');
const { alertsRepository } = require('backend/src/repositories/alertsRepository');

async function checkAlertsForCollection(collectionId, metrics) {
  const alertData = {
    collectionId,
    priceChange24h: metrics.find((m) => m.window === '24h')?.priceChange,
    volumeChange24h: metrics.find((m) => m.window === '24h')?.tradeVolume,
    listingCount: metrics.find((m) => m.window === '24h')?.buyCount,
    previousListingCount: 100, // from previous state
  };

  const alerts = await evaluateAlerts(alertData, alertsRepository);

  if (alerts.length > 0) {
    console.log('Alerts triggered:', alerts);
  }

  return alerts;
}
```

## Caching and Optimization

The in-memory implementation is optimized for:

1. **Fast Lookups**: O(n) filtering with indexed access
2. **Incremental Updates**: Only affected collections refresh metrics
3. **Minimal Storage**: Metrics compressed to essential fields
4. **Stateless Design**: No database roundtrips

For production with large datasets, consider:

- PostgreSQL for persistent storage
- Redis for caching frequently accessed metrics
- Kafka for event streaming
- Worker jobs for background metric computation

## Error Handling

All endpoints return appropriate HTTP status codes:

```
200 OK       - Successfully retrieved or refreshed data
400 Bad Request - Invalid input parameters
404 Not Found   - Collection or metric not found
500 Server Error - Unexpected error during computation
```

Example error response:

```json
{
  "error": "Failed to refresh metrics",
  "message": "Collection 'col-invalid' not found"
}
```

## Performance Tips

1. **Batch Ingest**: Collect multiple events before refreshing
2. **Selective Refresh**: Only refresh affected collections
3. **Pagination**: Use filters to reduce response size
4. **Caching**: Cache metrics locally in frontend

## Testing

Test the integration with seed data:

```bash
# Run all tests
npm test

# Run only analytics tests
npm test -- --testPathPattern='analytics|ingestion'

# Watch mode
npm run test:watch
```

## Troubleshooting

### Metrics Not Updating

1. Verify events are ingested
2. Call refresh endpoint manually
3. Check health status for last refresh time

### Missing Collections

1. Ensure events were ingested for the collection
2. Check data store has the collection
3. Verify refresh was called

### High Memory Usage

1. Reduce refresh frequency
2. Implement data archival
3. Clear old metrics periodically

## See Also

- [Metrics Documentation](./metrics.md) - Detailed metric definitions
- [Backend README](../backend/README.md) - Backend configuration
- [Alert System](../README.md#alert-system) - Alert integration
