# Collections Dashboard Backend

A Node.js/Express backend API for the Collections Dashboard with alert notification support. Evaluates analytics data against configurable thresholds and sends notifications via webhooks or email.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
cd backend
npm install
```

### Development Server

```bash
npm run dev
```

The API runs at [http://localhost:3000](http://localhost:3000) by default.

### Production Server

```bash
npm start
```

### Testing

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Environment Variables

Copy `.env.example` to `.env` and configure the following:

### Server Configuration

- `PORT` — Server port (default: `3000`)
- `DEBUG` — Enable debug logging (default: `false`)

### Alert Thresholds

Thresholds are specified as percentages. When analytics data crosses these thresholds, alerts are triggered:

- `ALERT_PRICE_DROP_PERCENT` — Price drop threshold (default: `10`%)
- `ALERT_VOLUME_SPIKE_PERCENT` — Volume increase threshold (default: `50`%)
- `ALERT_LISTING_DEPLETION_PERCENT` — Listing depletion threshold (default: `30`%)

Example:
```env
ALERT_PRICE_DROP_PERCENT=15
ALERT_VOLUME_SPIKE_PERCENT=75
ALERT_LISTING_DEPLETION_PERCENT=40
```

### Cooldown Configuration

- `ALERT_COOLDOWN_MINUTES` — Minimum time (in minutes) between duplicate alerts for the same collection and type (default: `60`)

This prevents alert fatigue by limiting notifications to once per cooldown period per collection/type combination.

Example:
```env
ALERT_COOLDOWN_MINUTES=120
```

### Cleanup Configuration

These settings control the retention policy and execution of the automated cleanup job:

- `DATA_RETENTION_HOURS` — Number of hours of data to retain (default: `72`). Entries older than the cutoff are removed from market snapshots, listing events, purchase events, and analytics metrics.
- `ENABLE_CLEANUP_CRON` — When set to `true`, schedules the cleanup job to run hourly at minute 10 (default: `false`).
- `CLEANUP_BATCH_SIZE` — Maximum number of records removed per batch when pruning old data (default: `500`).
- `CLEANUP_WARNING_THRESHOLD` — Emits a warning when deletions for a single table exceed this count in one run (default: `1000`).

### Webhook Notifier Configuration

To enable webhook notifications (e.g., to Slack, Feishu, Discord):

- `WEBHOOK_URL` — Webhook URL to send alerts to
- `WEBHOOK_MAX_RETRIES` — Number of retry attempts on failure (default: `3`)
- `WEBHOOK_BACKOFF_MS` — Initial backoff delay in milliseconds (default: `1000`)

The notifier uses exponential backoff: backoff = `WEBHOOK_BACKOFF_MS * 2^(retryAttempt)`

Example for Slack:
```env
WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
WEBHOOK_MAX_RETRIES=3
WEBHOOK_BACKOFF_MS=1000
```

Example for Feishu:
```env
WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN
WEBHOOK_MAX_RETRIES=3
WEBHOOK_BACKOFF_MS=1000
```

### Email Notifier Configuration (Optional)

To enable email notifications:

- `EMAIL_ENABLED` — Enable email notifications (default: `false`)
- `EMAIL_TO` — Recipient email address
- `EMAIL_FROM` — Sender email address

Example:
```env
EMAIL_ENABLED=true
EMAIL_TO=alerts@example.com
EMAIL_FROM=noreply@dashboard.example.com
```

## Data Retention & Cleanup

The backend keeps recent market activity while routinely pruning data older than the configured retention window. Records older than `DATA_RETENTION_HOURS` are deleted from market snapshots, listing events, purchase events, and analytics metrics, while collection metadata and recent alert activity are preserved.

### Scheduling the Cleanup Job

- Leave `ENABLE_CLEANUP_CRON=false` (default) to disable scheduled cleanup.
- Set `ENABLE_CLEANUP_CRON=true` to schedule the cleanup job hourly at minute 10.
- Batches are limited by `CLEANUP_BATCH_SIZE` to avoid long-running locks.
- When the number of deleted rows for a table exceeds `CLEANUP_WARNING_THRESHOLD`, a warning is emitted to the log so you can investigate spikes in data churn.

### Running Cleanup Manually

Use the following command to execute the cleanup once (helpful for local testing):

```bash
npm run cleanup:once
```

Logs will include a summary of rows removed per table and the total duration for the run.

## Data Ingestion

The backend provides an ingestion workflow for importing crawler data (snapshots, listing events, purchase events) into the system. Data is normalized, deduplicated via idempotent operations, and analytics are refreshed automatically.

### Ingestion Configuration

- `ENABLE_CRON` — When set to `true`, the hourly refresh job runs automatically at the top of each hour (default: `false`).
- `ADMIN_API_KEY` — API key required for on-demand manual refresh requests (must be set to enable admin endpoints).

Example:
```env
ENABLE_CRON=true
ADMIN_API_KEY=your-secret-admin-key-here
```

### Manual Data Refresh (On-Demand)

Trigger an immediate crawl and ingestion cycle with:

```bash
curl -X POST http://localhost:3000/api/admin/refresh \
  -H 'Content-Type: application/json' \
  -d '{
    "apiKey": "your-secret-admin-key-here",
    "crawlerData": [
      {
        "collectionId": "collection-1",
        "metadata": {
          "name": "Collection Name",
          "floor_price": 100
        },
        "snapshot": {
          "id": "snap-1",
          "price": 100.50,
          "volume": 1000
        },
        "listingEvents": [
          {
            "id": "list-1",
            "price": 105.00,
            "quantity": 5
          }
        ],
        "purchaseEvents": [
          {
            "id": "purch-1",
            "price": 102.00,
            "quantity": 1
          }
        ]
      }
    ]
  }'
```

Response includes a summary:
```json
{
  "success": true,
  "summary": {
    "totalCollections": 1,
    "totalSnapshots": 1,
    "totalListingEvents": 1,
    "totalPurchaseEvents": 1,
    "failureCount": 0,
    "durationMs": 45
  }
}
```

### Automatic Hourly Refresh

When `ENABLE_CRON=true`, the system runs an automated refresh job hourly (at the top of each hour):

```env
ENABLE_CRON=true
```

The job:
- Executes at cron expression `0 * * * *` (every hour at minute 0)
- Logs start/completion and any failures
- Refreshes analytics metrics
- Handles errors gracefully without stopping the server

### Idempotency

The ingestion system ensures data consistency through idempotent operations:

- Snapshots with duplicate IDs are not duplicated in storage
- Listing and purchase events with duplicate IDs are treated as updates
- Rerunning ingestion with unchanged data does not create duplicate rows
- Collection metadata is upserted (updated or inserted)

### Repository Layer

The backend uses repository modules for data access:

- **collectionRepository**: Manages collection metadata (upsert, retrieval)
- **snapshotRepository**: Handles market snapshot operations (insert, delete by age)
- **eventRepository**: Manages listing and purchase events (insert, retrieval, deletion)

All repository operations maintain transaction semantics and handle rollback on failure.

## API Endpoints

### Get All Alerts

```
GET /api/alerts
```

Query parameters for filtering:

- `collectionId` — Filter by collection ID
- `resolved` — Filter by resolved state (`true` or `false`)
- `severity` — Filter by severity level (`info`, `warning`, `critical`)
- `type` — Filter by alert type (`price_drop`, `volume_spike`, `listing_depletion`)

Examples:

```bash
# Get all unresolved alerts
curl "http://localhost:3000/api/alerts?resolved=false"

# Get critical alerts for a specific collection
curl "http://localhost:3000/api/alerts?collectionId=col-1&severity=critical"

# Get price drop alerts
curl "http://localhost:3000/api/alerts?type=price_drop"
```

### Get Alert by ID

```
GET /api/alerts/:id
```

### Update Alert

```
PUT /api/alerts/:id
```

Request body:

```json
{
  "resolved": true
}
```

### Mark Alert as Resolved

```
PUT /api/alerts/:id/resolve
```

## Alert Types and Severity

### Price Drop Alert

- **Type**: `price_drop`
- **Severity**: `warning`
- **Condition**: When price drops more than `ALERT_PRICE_DROP_PERCENT`% in 24 hours
- **Message Example**: "Price dropped 15.50% in 24h"

### Volume Spike Alert

- **Type**: `volume_spike`
- **Severity**: `info`
- **Condition**: When volume increases more than `ALERT_VOLUME_SPIKE_PERCENT`% in 24 hours
- **Message Example**: "Volume spiked 75.25% in 24h"

### Listing Depletion Alert

- **Type**: `listing_depletion`
- **Severity**: `critical`
- **Condition**: When listings decrease by more than `ALERT_LISTING_DEPLETION_PERCENT`%
- **Message Example**: "Listings depleted by 45.00%"

## Alert Evaluation Flow

1. **Metrics Computation**: Analytics pipeline computes price changes, volume changes, and listing counts
2. **Threshold Evaluation**: Alert service evaluates metrics against configured thresholds
3. **Cooldown Check**: Verifies if alert was already triggered within the cooldown window
4. **Persistence**: Triggered alerts are stored in the alerts repository
5. **Notification**: Alert is sent to configured notifiers (webhook and/or email)

## Cooldown Behavior

Once an alert is triggered for a specific collection and alert type, no duplicate alerts of the same type will be sent for that collection until the cooldown period expires.

Example:
- Cooldown period: 60 minutes
- First price drop alert for collection A: 10:00 AM
- Second price drop alert for collection A: 10:30 AM (within cooldown → throttled, not sent)
- Third price drop alert for collection A: 11:15 AM (after cooldown → sent)

## Troubleshooting

### Webhook Notifications Not Sending

**Issue**: Alerts are created but webhook notifications fail

**Debugging Steps**:

1. Verify `WEBHOOK_URL` is configured:
   ```bash
   echo $WEBHOOK_URL
   ```

2. Check logs for retry attempts and error details:
   ```bash
   # In debug mode
   DEBUG=true npm start
   ```

3. Test webhook connectivity:
   ```bash
   curl -X POST \
     -H 'Content-Type: application/json' \
     -d '{"test": "alert"}' \
     $WEBHOOK_URL
   ```

4. Verify webhook server is accepting requests (check webhook logs/dashboard)

**Common Issues**:

- **Connection refused**: Webhook URL is incorrect or server is down
- **Timeout**: Network latency; consider increasing `WEBHOOK_BACKOFF_MS`
- **401/403 errors**: Authentication token or webhook URL is invalid
- **400 errors**: Payload format doesn't match webhook expectations

### High Alert Volume / Alert Fatigue

**Issue**: Receiving too many duplicate alerts

**Solution**: Increase the cooldown period:

```env
ALERT_COOLDOWN_MINUTES=240  # 4 hours instead of 1 hour
```

### Alerts Not Triggering

**Issue**: Analytics data passes thresholds but no alerts are created

**Debugging Steps**:

1. Verify thresholds are configured correctly:
   ```bash
   echo "Price drop: $ALERT_PRICE_DROP_PERCENT%"
   echo "Volume spike: $ALERT_VOLUME_SPIKE_PERCENT%"
   echo "Listing depletion: $ALERT_LISTING_DEPLETION_PERCENT%"
   ```

2. Enable debug logging to see evaluation results:
   ```bash
   DEBUG=true npm start
   ```

3. Check alert repository for throttled alerts:
   ```bash
   # Query with debug logging enabled
   curl http://localhost:3000/api/alerts?resolved=false
   ```

**Common Issues**:

- **Thresholds too high**: Adjust threshold values to match your data ranges
- **Cooldown active**: Alert was recently triggered; wait for cooldown to expire
- **Missing analytics data**: Ensure analytics pipeline provides required fields

### Email Notifications Not Sending

**Issue**: `EMAIL_ENABLED=true` but emails are not received

**Note**: The current implementation logs email notifications to console. To enable actual email delivery, implement an email service provider (SendGrid, AWS SES, etc.) in `emailNotifier.js`.

**Current Behavior**:

```bash
# Email output appears in logs as:
# [TIMESTAMP] INFO: [EMAIL] To: recipient@example.com
# Subject: Alert - price_drop
# ...
```

To enable real email delivery:

1. Integrate an email service (e.g., `nodemailer` with SendGrid)
2. Update `backend/src/notifications/emailNotifier.js` to use the service
3. Add service credentials to `.env`

### Monitoring Alert System Health

Check the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

## Alert Data Model

```javascript
{
  id: string,                    // Unique alert identifier
  collectionId: string,          // Collection that triggered the alert
  type: string,                  // Alert type (price_drop, volume_spike, listing_depletion)
  severity: string,              // Severity level (info, warning, critical)
  message: string,               // Human-readable alert message
  triggeredAt: string,           // ISO 8601 timestamp when alert triggered
  resolved: boolean,             // Whether alert has been resolved
  createdAt: string,             // ISO 8601 timestamp when alert was created
  updatedAt?: string,            // ISO 8601 timestamp of last update
}
```

## Development Notes

### Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── env.js                     # Environment variable defaults and parsing
│   ├── jobs/
│   │   ├── cleanupJob.js              # Data retention job implementation
│   │   └── runCleanupOnce.js          # CLI entrypoint for manual cleanup
│   ├── index.js                       # Express server entry point
│   ├── routes/
│   │   └── alerts.js                  # Alert API routes
│   ├── services/
│   │   └── alertService.js            # Alert evaluation logic
│   ├── notifications/
│   │   ├── webhookNotifier.js         # Webhook notification sender
│   │   └── emailNotifier.js           # Email notification sender
│   ├── repositories/
│   │   ├── analyticsRepository.js     # Analytics metrics store
│   │   ├── dataStore.js               # In-memory data storage
│   │   └── alertsRepository.js        # Alert data access layer
│   └── utils/
│       └── logger.js                  # Logging utility
├── tests/
│   ├── alertService.spec.js           # Alert service tests
│   ├── analyticsService.spec.js       # Analytics computation tests
│   ├── cleanupJob.spec.js             # Data cleanup job tests
│   └── ...                            # Additional API and repository tests
├── package.json
├── jest.config.js                     # Jest configuration
├── .env.example                       # Example environment variables
└── README.md                          # This file
```

### Adding Custom Alert Types

1. Add threshold configuration in `.env`:
   ```env
   ALERT_CUSTOM_THRESHOLD=25
   ```

2. Add evaluation logic in `src/services/alertService.js`:
   ```javascript
   if (analytics.customMetric !== undefined && analytics.customMetric > DEFAULT_THRESHOLDS.custom) {
     // Create alert...
   }
   ```

3. Add test case in `tests/alertService.spec.js`

## License

MIT
