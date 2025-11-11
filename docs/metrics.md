# Analytics Metrics Documentation

## Overview

The analytics service computes rolling window metrics for NFT/digital asset collections. These metrics provide real-time insights into price trends, trading activity, and liquidity patterns.

## Time Windows

Metrics are computed for the following rolling time windows:

- **1h** (1 hour) — Short-term market dynamics
- **6h** (6 hours) — Medium-term trends
- **24h** (24 hours) — Daily performance and alert thresholds
- **72h** (72 hours) — 3-day trends for longer-term analysis

Each collection has metrics computed independently for each window.

## Metrics Reference

### Price Metrics

#### Price Change (%)
- **Field**: `priceChange`
- **Formula**: `((max_price - first_price) / first_price) * 100`
- **Unit**: Percentage
- **Range**: -100 to +∞
- **Data Source**: Market snapshots, listing events, purchase events
- **Interpretation**: 
  - Positive: Price increased from start to peak
  - Negative: Price decreased from start to low
  - Null: No price data available or zero starting price

#### Average Price
- **Field**: `averagePrice`
- **Formula**: `sum(prices) / count(prices)`
- **Unit**: Currency units
- **Data Source**: All transactions with price data
- **Interpretation**: Mean price across all events in the window
- **Edge Case**: Excludes null/undefined prices

#### Median Price
- **Field**: `medianPrice`
- **Formula**: Middle value in sorted price array (or average of two middle values for even count)
- **Unit**: Currency units
- **Data Source**: All transactions with price data
- **Interpretation**: Central tendency of prices, less affected by outliers
- **Edge Case**: Excludes null/undefined prices

### Volume Metrics

#### Trade Volume
- **Field**: `tradeVolume`
- **Formula**: `sum(quantities)` for all events
- **Unit**: Number of units/items traded
- **Data Source**: Quantity field from listing and purchase events
- **Interpretation**: Total units changed hands in the window
- **Edge Case**: Missing quantities treated as 0

#### Volume Change 24h
- **Field**: `volumeChange24h`
- **Formula**: Same as `tradeVolume` for 24h window
- **Unit**: Number of units
- **Data Source**: Purchase events in 24h window
- **Usage**: Used for volume spike alerts

### Listing Metrics

#### Buy Count
- **Field**: `buyCount`
- **Formula**: Count of events where `type === 'buy'`
- **Unit**: Number of transactions
- **Data Source**: Purchase events
- **Interpretation**: Number of purchase/buy transactions

#### Sell Count
- **Field**: `sellCount`
- **Formula**: Count of events where `type === 'sell'`
- **Unit**: Number of transactions
- **Data Source**: Purchase events or listings
- **Interpretation**: Number of sell/listing transactions

#### Listing Metrics
- **Field**: `listingMetrics`
- **Contains**: Separate calculations for listing events
- **Nested Fields**:
  - `priceChange`: Price change within listing events
  - `averagePrice`: Average listing price
  - `medianPrice`: Median listing price
  - `buyCount`: Number of listing events marked as buy
  - `sellCount`: Number of listing events marked as sell
  - `tradeVolume`: Total volume from listings

### Purchase Metrics
- **Field**: `purchaseMetrics`
- **Contains**: Separate calculations for purchase/transaction events
- **Nested Fields**: Same structure as listing metrics

### Liquidity Metrics

#### Liquidity Ratio
- **Field**: `liquidityRatio`
- **Formula**: `tradeVolume / eventCount`
- **Unit**: Average units per transaction
- **Data Source**: All events
- **Interpretation**: 
  - Higher ratio: Larger average transaction size (more liquid)
  - Lower ratio: Smaller average transactions (less liquid)
  - Can indicate market depth and trading patterns
- **Edge Case**: Null if no events

### Event Counting

#### Event Count
- **Field**: `eventCount`
- **Formula**: Total number of events (listings + purchases)
- **Unit**: Number of events
- **Data Source**: Combined listing and purchase events
- **Interpretation**: Activity level in the window

## API Endpoints

### Get All Metrics
```
GET /api/analytics/metrics
```

Query Parameters:
- `collectionId` — Filter by collection ID
- `window` — Filter by specific window (1h, 6h, 24h, 72h)
- `windows` — Filter by multiple windows (comma-separated or array)

Example:
```bash
GET /api/analytics/metrics?collectionId=col-1&window=24h
GET /api/analytics/metrics?windows=24h,72h
```

Response:
```json
{
  "metrics": [
    {
      "id": "metric-1",
      "collectionId": "col-1",
      "window": "24h",
      "timestamp": "2024-01-15T10:30:00Z",
      "priceChange": 5.5,
      "averagePrice": 1250.75,
      "medianPrice": 1248.00,
      "tradeVolume": 150,
      "buyCount": 42,
      "sellCount": 38,
      "liquidityRatio": 1.75,
      "eventCount": 80,
      "priceChange24h": 5.5,
      "volumeChange24h": 150,
      "listingMetrics": {...},
      "purchaseMetrics": {...}
    }
  ]
}
```

### Get Single Metric
```
GET /api/analytics/metrics/:id
```

### Get Collection Metrics
```
GET /api/analytics/collections/:collectionId/metrics
```

Returns all metrics (all windows) for a specific collection.

### Health Status
```
GET /api/analytics/health/status
```

Response:
```json
{
  "status": "ok",
  "lastRefreshTime": "2024-01-15T10:35:00Z",
  "lastRefreshStats": {
    "collectionsUpdated": 50,
    "metricsGenerated": 200
  },
  "currentStats": {
    "totalMetrics": 200,
    "trackedCollections": 50
  }
}
```

## Data Accuracy Guarantees

### Deduplication
- Events are timestamped as they arrive
- Database ensures no duplicate event IDs
- Filtering by time window prevents double-counting across windows

### Missing Data Handling
- **Null prices**: Excluded from price calculations, included in event count
- **Zero prices**: Handled gracefully (price change returns null to avoid division by zero)
- **Missing quantities**: Treated as 0
- **Empty windows**: Returns all-null metrics or 0 for counts

### Edge Cases

#### No Events in Window
```json
{
  "priceChange": null,
  "averagePrice": null,
  "medianPrice": null,
  "tradeVolume": 0,
  "buyCount": 0,
  "sellCount": 0,
  "liquidityRatio": null,
  "eventCount": 0
}
```

#### Sudden Price Spike
- `priceChange` accurately reflects peak-to-start change
- `averagePrice` and `medianPrice` may differ significantly
- Use both for complete understanding of price movement

#### Single Event
- `priceChange`: 0 (max_price == first_price)
- `averagePrice` and `medianPrice`: Same value (that event's price)
- `liquidityRatio`: Equals `tradeVolume` (only one event)

## Integration with Alert System

The analytics service feeds into the alert system:

- **Price Drop Alert**: Uses `priceChange24h` < -THRESHOLD
- **Volume Spike Alert**: Uses `volumeChange24h` > THRESHOLD
- **Listing Depletion Alert**: Uses `listingCount` change calculation

Alerts are evaluated after metrics are refreshed.

## Performance Considerations

### Computation Complexity
- **Time**: O(n) where n = events in window
- **Space**: O(n) for filtering and sorting prices
- **Optimization**: Uses streaming aggregation for large datasets

### Refresh Frequency
- Triggered after data ingestion
- Recommended interval: 5-15 minutes for real-time data
- Configurable based on collection size and data volume

### Scalability
- Metrics are computed independently per collection
- Parallel processing enabled for multiple collections
- Window calculations are isolated and reusable

## Examples

### Computing Daily Metrics for a Collection
```javascript
const events = [
  { type: 'buy', price: 1000, quantity: 1, timestamp: '2024-01-15T10:00:00Z' },
  { type: 'buy', price: 1050, quantity: 2, timestamp: '2024-01-15T12:00:00Z' },
  { type: 'sell', price: 1020, quantity: 1, timestamp: '2024-01-15T14:00:00Z' },
];

// Expected 24h metrics:
{
  priceChange: 2.0,           // (1050 - 1000) / 1000 * 100
  averagePrice: 1023.33,      // (1000 + 1050 + 1020) / 3
  medianPrice: 1020,          // Middle value when sorted
  tradeVolume: 4,             // 1 + 2 + 1
  buyCount: 2,                // Two buy events
  sellCount: 1,               // One sell event
  liquidityRatio: 1.33,       // 4 / 3
  eventCount: 3
}
```

### Trend Analysis
```
24h metrics: priceChange = 5.5%
6h metrics: priceChange = 2.1%
1h metrics: priceChange = 0.8%

Interpretation: Uptrend starting to slow down
Action: Monitor for reversal, consider volatility alerts
```

### Liquidity Assessment
```
Collection A: liquidityRatio = 10.5 (high)
Collection B: liquidityRatio = 1.2 (low)

Interpretation: Collection A has deeper liquidity
Action: Collection A suitable for larger trades
```

## Testing Strategy

### Unit Tests Cover:
- Edge cases (empty data, null prices, single event)
- Calculation accuracy for all metrics
- Window filtering correctness
- Error handling and graceful degradation

### Integration Tests Cover:
- End-to-end metric computation
- Multi-window calculations
- Collection independence
- Data persistence and retrieval

### Test Data Sets:
1. **Normal Trading**: Mixed buy/sell with varied prices
2. **Low Activity**: Single or few events per window
3. **High Volatility**: Sudden price spikes and drops
4. **Zero Division**: Edge cases with zero/null prices

## Troubleshooting

### Metrics Not Updating
1. Verify events are being ingested (check data store)
2. Ensure refresh endpoint is called after ingestion
3. Check for errors in analytics service logs

### Incorrect Price Change
1. Verify event timestamps are in correct timezone
2. Check if first event is truly the starting point
3. Ensure prices are parsed as numbers, not strings

### Missing Collections
1. Verify collection events exist in data store
2. Check that refresh is called with correct collection IDs
3. Confirm analytics repository has space

### High Memory Usage
1. Implement data archival for old metrics
2. Reduce refresh frequency if safe
3. Use pagination for large result sets

## Future Enhancements

- Persistent database backend (PostgreSQL, MongoDB)
- Real-time streaming metrics
- Statistical significance testing
- Anomaly detection
- Machine learning-based forecasting
- Multi-period comparison analysis
