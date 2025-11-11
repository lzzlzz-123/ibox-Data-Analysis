# Collections Dashboard API Documentation

This document provides comprehensive documentation for the Collections Dashboard API endpoints.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, the API does not require authentication. This may change in future versions.

## CORS Configuration

The API is configured to accept requests from:
- `http://localhost:3000` (default development port)
- `http://localhost:5173` (Vite default port)
- `http://localhost:8080`
- Any origin in `FRONTEND_URL` environment variable
- All origins in non-production environments

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `403` - Forbidden (CORS errors)
- `404` - Not Found
- `500` - Internal Server Error

## Collections Endpoints

### Get All Collections

Retrieve a list of all tracked collections with their latest metrics and 24-hour deltas.

**Endpoint:** `GET /api/collections`

**Query Parameters:** None

**Response:**
```json
{
  "collections": [
    {
      "id": "collection-1",
      "name": "collection-1",
      "latestSnapshot": {
        "id": "snapshot-123",
        "collectionId": "collection-1",
        "timestamp": "2023-01-01T12:00:00Z",
        "floorPrice": 1.5,
        "volume": 1000
      },
      "latestMetrics": {
        "id": "metric-456",
        "collectionId": "collection-1",
        "window": "24h",
        "timestamp": "2023-01-01T12:00:00Z",
        "priceChange": 10.5,
        "averagePrice": 2.0,
        "tradeVolume": 5000,
        "buySellRatio": 1.2
      },
      "delta24h": {
        "priceChange": 2.5,
        "averagePrice": 0.2,
        "tradeVolume": 1000,
        "buySellRatio": 0.1
      },
      "lastUpdated": "2023-01-01T12:00:00Z"
    }
  ]
}
```

**Example Request:**
```bash
curl http://localhost:3000/api/collections
```

### Get Collection by ID

Retrieve detailed information about a specific collection including metadata and all time-window metrics.

**Endpoint:** `GET /api/collections/{id}`

**Path Parameters:**
- `id` (string, required) - Collection identifier

**Response:**
```json
{
  "collection": {
    "id": "collection-1",
    "name": "collection-1",
    "metadata": {
      "totalSnapshots": 150,
      "totalListingEvents": 75,
      "totalPurchaseEvents": 45,
      "firstSnapshot": "2023-01-01T00:00:00Z",
      "lastSnapshot": "2023-01-01T12:00:00Z"
    },
    "latestSnapshot": {
      "id": "snapshot-123",
      "collectionId": "collection-1",
      "timestamp": "2023-01-01T12:00:00Z",
      "floorPrice": 1.5,
      "volume": 1000
    },
    "metrics": {
      "1h": {
        "id": "metric-1h",
        "collectionId": "collection-1",
        "window": "1h",
        "timestamp": "2023-01-01T12:00:00Z",
        "priceChange": 2.1,
        "averagePrice": 1.8,
        "tradeVolume": 500,
        "buySellRatio": 1.1
      },
      "6h": {
        "id": "metric-6h",
        "collectionId": "collection-1",
        "window": "6h",
        "timestamp": "2023-01-01T12:00:00Z",
        "priceChange": 5.3,
        "averagePrice": 1.9,
        "tradeVolume": 2000,
        "buySellRatio": 1.15
      },
      "24h": {
        "id": "metric-24h",
        "collectionId": "collection-1",
        "window": "24h",
        "timestamp": "2023-01-01T12:00:00Z",
        "priceChange": 10.5,
        "averagePrice": 2.0,
        "tradeVolume": 5000,
        "buySellRatio": 1.2
      },
      "72h": {
        "id": "metric-72h",
        "collectionId": "collection-1",
        "window": "72h",
        "timestamp": "2023-01-01T12:00:00Z",
        "priceChange": 15.2,
        "averagePrice": 2.1,
        "tradeVolume": 12000,
        "buySellRatio": 1.25
      }
    }
  }
}
```

**Example Request:**
```bash
curl http://localhost:3000/api/collections/collection-1
```

### Get Collection Snapshots

Retrieve time-series snapshot data for a collection with filtering and pagination.

**Endpoint:** `GET /api/collections/{id}/snapshots`

**Path Parameters:**
- `id` (string, required) - Collection identifier

**Query Parameters:**
- `from` (string, optional) - ISO 8601 start date (e.g., "2023-01-01T00:00:00Z")
- `to` (string, optional) - ISO 8601 end date (e.g., "2023-01-02T00:00:00Z")
- `interval` (string, optional) - Time interval: "1h", "6h", "24h", "72h" (default: "1h")
- `page` (integer, optional) - Page number (default: 1)
- `limit` (integer, optional) - Results per page, max 1000 (default: 100)

**Response:**
```json
{
  "snapshots": [
    {
      "id": "snapshot-1",
      "collectionId": "collection-1",
      "timestamp": "2023-01-01T00:00:00Z",
      "floorPrice": 1.0,
      "volume": 800,
      "listings": 50,
      "owners": 200
    },
    {
      "id": "snapshot-2",
      "collectionId": "collection-1",
      "timestamp": "2023-01-01T01:00:00Z",
      "floorPrice": 1.1,
      "volume": 850,
      "listings": 48,
      "owners": 202
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 100,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Example Requests:**
```bash
# Get all snapshots for collection
curl "http://localhost:3000/api/collections/collection-1/snapshots"

# Get snapshots for last 24 hours
curl "http://localhost:3000/api/collections/collection-1/snapshots?from=2023-01-01T00:00:00Z&to=2023-01-02T00:00:00Z"

# Get paginated snapshots
curl "http://localhost:3000/api/collections/collection-1/snapshots?page=2&limit=50"
```

### Get Collection Events

Retrieve recent listing and purchase events for a collection with filtering and pagination.

**Endpoint:** `GET /api/collections/{id}/events`

**Path Parameters:**
- `id` (string, required) - Collection identifier

**Query Parameters:**
- `type` (string, optional) - Event type: "listing" or "purchase"
- `page` (integer, optional) - Page number (default: 1)
- `limit` (integer, optional) - Results per page, max 1000 (default: 50)

**Response:**
```json
{
  "events": [
    {
      "id": "event-1",
      "collectionId": "collection-1",
      "timestamp": "2023-01-01T12:00:00Z",
      "type": "listing",
      "price": 1.5,
      "quantity": 1,
      "tokenId": "123",
      "seller": "0x123..."
    },
    {
      "id": "event-2",
      "collectionId": "collection-1",
      "timestamp": "2023-01-01T11:45:00Z",
      "type": "purchase",
      "price": 1.4,
      "quantity": 1,
      "tokenId": "124",
      "buyer": "0x456...",
      "seller": "0x789..."
    }
  ],
  "pagination": {
    "total": 500,
    "page": 1,
    "limit": 50,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Example Requests:**
```bash
# Get all events for collection
curl "http://localhost:3000/api/collections/collection-1/events"

# Get only listing events
curl "http://localhost:3000/api/collections/collection-1/events?type=listing"

# Get paginated events
curl "http://localhost:3000/api/collections/collection-1/events?page=2&limit=25"
```

## Alerts Endpoints

### Get All Alerts

Retrieve a list of alerts with filtering, sorting, and pagination options.

**Endpoint:** `GET /api/alerts`

**Query Parameters:**
- `collectionId` (string, optional) - Filter by collection ID
- `severity` (string, optional) - Filter by severity: "low", "medium", "high", "critical"
- `type` (string, optional) - Filter by alert type
- `resolved` (string, optional) - Filter by resolved status: "true" or "false"
- `page` (integer, optional) - Page number (default: 1)
- `limit` (integer, optional) - Results per page, max 1000 (default: 50)
- `sortBy` (string, optional) - Sort field: "triggeredAt", "severity", "type", "createdAt" (default: "triggeredAt")
- `sortOrder` (string, optional) - Sort order: "asc" or "desc" (default: "desc")

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert-1",
      "collectionId": "collection-1",
      "type": "price_threshold",
      "severity": "high",
      "triggeredAt": "2023-01-01T12:00:00Z",
      "message": "Price exceeded threshold of 2.0 ETH",
      "resolved": false,
      "createdAt": "2023-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 50,
    "hasNext": false,
    "hasPrev": false,
    "totalPages": 1
  },
  "summary": {
    "total": 25,
    "resolved": 10,
    "unresolved": 15,
    "bySeverity": {
      "low": 5,
      "medium": 8,
      "high": 10,
      "critical": 2
    },
    "byType": {
      "price_threshold": 12,
      "volume_spike": 8,
      "liquidity_drop": 5
    },
    "byCollection": {
      "collection-1": 15,
      "collection-2": 10
    }
  }
}
```

**Example Requests:**
```bash
# Get all alerts
curl "http://localhost:3000/api/alerts"

# Get unresolved high-severity alerts
curl "http://localhost:3000/api/alerts?severity=high&resolved=false"

# Get alerts for specific collection
curl "http://localhost:3000/api/alerts?collectionId=collection-1"

# Get paginated alerts sorted by severity
curl "http://localhost:3000/api/alerts?sortBy=severity&sortOrder=asc&page=1&limit=20"
```

### Get Alert by ID

Retrieve a specific alert by its ID.

**Endpoint:** `GET /api/alerts/{id}`

**Path Parameters:**
- `id` (string, required) - Alert identifier

**Response:**
```json
{
  "alert": {
    "id": "alert-1",
    "collectionId": "collection-1",
    "type": "price_threshold",
    "severity": "high",
    "triggeredAt": "2023-01-01T12:00:00Z",
    "message": "Price exceeded threshold of 2.0 ETH",
    "resolved": false,
    "createdAt": "2023-01-01T12:00:00Z",
    "updatedAt": "2023-01-01T12:00:00Z"
  }
}
```

**Example Request:**
```bash
curl http://localhost:3000/api/alerts/alert-1
```

### Update Alert

Update alert properties (currently only resolved status).

**Endpoint:** `PUT /api/alerts/{id}`

**Path Parameters:**
- `id` (string, required) - Alert identifier

**Request Body:**
```json
{
  "resolved": true
}
```

**Response:**
```json
{
  "alert": {
    "id": "alert-1",
    "collectionId": "collection-1",
    "type": "price_threshold",
    "severity": "high",
    "triggeredAt": "2023-01-01T12:00:00Z",
    "message": "Price exceeded threshold of 2.0 ETH",
    "resolved": true,
    "createdAt": "2023-01-01T12:00:00Z",
    "updatedAt": "2023-01-01T12:30:00Z"
  }
}
```

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/alerts/alert-1 \
  -H "Content-Type: application/json" \
  -d '{"resolved": true}'
```

### Resolve Alert

Mark an alert as resolved (shortcut for updating resolved status to true).

**Endpoint:** `PUT /api/alerts/{id}/resolve`

**Path Parameters:**
- `id` (string, required) - Alert identifier

**Response:**
```json
{
  "alert": {
    "id": "alert-1",
    "collectionId": "collection-1",
    "type": "price_threshold",
    "severity": "high",
    "triggeredAt": "2023-01-01T12:00:00Z",
    "message": "Price exceeded threshold of 2.0 ETH",
    "resolved": true,
    "createdAt": "2023-01-01T12:00:00Z",
    "updatedAt": "2023-01-01T12:30:00Z"
  }
}
```

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/alerts/alert-1/resolve
```

## Analytics Endpoints

The analytics endpoints from the existing implementation remain available:

### Get Analytics Metrics
`GET /api/analytics/metrics` - Retrieve analytics metrics with filters

### Refresh Analytics
`POST /api/analytics/refresh` - Refresh metrics for collections

### Health Status
`GET /api/analytics/health/status` - Check analytics service health

## Data Models

### Collection Metrics

```json
{
  "priceChange": 10.5,        // Percentage change in price
  "averagePrice": 2.0,        // Average price in the time window
  "medianPrice": 1.8,         // Median price in the time window
  "tradeVolume": 5000,        // Total trade volume
  "buyCount": 25,             // Number of buy transactions
  "sellCount": 20,            // Number of sell transactions
  "buySellRatio": 1.25,       // Ratio of buys to sells
  "liquidityRatio": 50.0      // Trade volume per event
}
```

### Alert Types

- `price_threshold` - Price exceeds configured threshold
- `volume_spike` - Unusual volume increase detected
- `liquidity_drop` - Sudden decrease in liquidity
- `floor_price_change` - Significant floor price movement

### Alert Severities

- `low` - Minor changes or informational alerts
- `medium` - Notable changes requiring attention
- `high` - Significant changes requiring immediate attention
- `critical` - Extreme changes requiring urgent action

## Rate Limiting

Currently, no rate limiting is implemented. This may be added in future versions.

## Time Windows

Analytics metrics are calculated for the following time windows:
- `1h` - Last hour
- `6h` - Last 6 hours
- `24h` - Last 24 hours
- `72h` - Last 72 hours

## Pagination

All list endpoints support pagination with the following parameters:
- `page` - Page number (starting from 1)
- `limit` - Number of items per page

Pagination metadata includes:
- `total` - Total number of items
- `page` - Current page number
- `limit` - Items per page
- `hasNext` - Whether there are more pages
- `hasPrev` - Whether there are previous pages
- `totalPages` - Total number of pages (alerts endpoint only)

## Error Examples

### Validation Error (400)
```json
{
  "error": "Invalid query parameters",
  "message": "\"severity\" must be one of [low, medium, high, critical]"
}
```

### Not Found Error (404)
```json
{
  "error": "Collection not found",
  "message": "Collection with ID 'non-existent' not found"
}
```

### CORS Error (403)
```json
{
  "error": "CORS Error",
  "message": "Cross-origin request not allowed"
}
```

### Internal Server Error (500)
```json
{
  "error": "Internal Server Error",
  "message": "Database connection failed"
}
```

## Testing

The API includes comprehensive integration tests. Run tests with:

```bash
npm test
```

Tests cover:
- Success scenarios for all endpoints
- Error handling and validation
- Pagination and filtering
- CORS configuration
- Edge cases and performance scenarios