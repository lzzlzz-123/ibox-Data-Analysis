# Collections Dashboard

A full-stack application for monitoring NFT/digital asset collections with real-time analytics and alert notifications.

## Project Structure

```
.
├── frontend/                 # Vue 3 + Vite dashboard application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── stores/          # Pinia state management
│   │   ├── services/        # API client
│   │   ├── views/           # Page components
│   │   └── composables/     # Shared composition functions
│   ├── tests/               # Frontend unit tests
│   └── package.json
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── services/        # Alert evaluation logic
│   │   ├── notifications/   # Webhook and email notifiers
│   │   ├── repositories/    # Data access layer
│   │   ├── routes/          # API endpoints
│   │   └── utils/           # Utilities (logging, etc.)
│   ├── tests/               # Backend unit tests
│   └── package.json
└── README.md                # This file
```

## Quick Start

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

### Backend Development

```bash
cd backend
npm install
npm run dev
```

Backend runs at `http://localhost:3000`

## Architecture

### Frontend

- **Vue 3** with TypeScript for reactive UI components
- **Pinia** for centralized state management
- **Vue Router** for navigation between views
- **Axios** for HTTP API communication
- **ECharts** for interactive data visualization
- **Vitest** for unit testing

Key Features:
- Real-time dashboard with collection analytics
- Interactive trend charts with price and volume data
- Filterable alert panel with severity levels
- Auto-refresh mechanism for live data updates
- Responsive design for various screen sizes

### Backend

- **Express.js** for RESTful API server
- **Alert Service** evaluates analytics against configurable thresholds
- **Notification System** sends alerts via webhooks and/or email
- **Repository Pattern** for data abstraction
- **Jest** for unit testing

Key Features:
- Dynamic alert thresholds via environment variables
- Cooldown mechanism prevents duplicate alert fatigue
- Retry logic with exponential backoff for webhooks
- Structured logging for debugging
- Flexible notifier architecture

## Alert System

### Overview

The alert system monitors collection analytics in real-time and triggers notifications when metrics cross configured thresholds.

### Alert Types

#### Price Drop Alert
- **Type**: `price_drop`
- **Severity**: `warning`
- **Triggers when**: Price drops more than configured percentage in 24 hours
- **Default threshold**: 10%

#### Volume Spike Alert
- **Type**: `volume_spike`
- **Severity**: `info`
- **Triggers when**: Volume increases more than configured percentage in 24 hours
- **Default threshold**: 50%

#### Listing Depletion Alert
- **Type**: `listing_depletion`
- **Severity**: `critical`
- **Triggers when**: Listings decrease by more than configured percentage
- **Default threshold**: 30%

### Configuration

#### Alert Thresholds

Configure thresholds via environment variables in `backend/.env`:

```env
# Percentage thresholds
ALERT_PRICE_DROP_PERCENT=10
ALERT_VOLUME_SPIKE_PERCENT=50
ALERT_LISTING_DEPLETION_PERCENT=30

# Cooldown period (minutes) - prevents duplicate alerts
ALERT_COOLDOWN_MINUTES=60
```

#### Webhook Configuration

Enable webhook notifications (e.g., Slack, Feishu, Discord):

```env
WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
WEBHOOK_MAX_RETRIES=3
WEBHOOK_BACKOFF_MS=1000
```

The webhook notifier includes:
- Automatic retries on failure with exponential backoff
- Configurable retry attempts and backoff timing
- Structured logging of all requests

**For Slack:**
```env
WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**For Feishu:**
```env
WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_TOKEN
```

#### Email Configuration (Optional)

To enable email notifications (requires email service integration):

```env
EMAIL_ENABLED=true
EMAIL_TO=alerts@example.com
EMAIL_FROM=noreply@dashboard.example.com
```

Note: Current implementation logs emails to console. To send actual emails, integrate an email service provider (SendGrid, AWS SES, etc.) in `backend/src/notifications/emailNotifier.js`.

### Cooldown Mechanism

The cooldown mechanism prevents alert fatigue by limiting notifications:

- Once an alert triggers for a collection, no duplicate alerts of the same type will be sent for that collection within the cooldown period
- After the cooldown expires, the next threshold breach will trigger a new alert
- Cooldown is per collection per alert type (e.g., collection A can have price drop throttled while volume spike triggers)

**Example:**
```
ALERT_COOLDOWN_MINUTES=60

Event Timeline:
10:00 AM - Price drop detected for collection A → Alert sent, cooldown starts
10:30 AM - Another price drop for collection A → Throttled (within 60min cooldown)
11:15 AM - Price drop for collection A → Alert sent (cooldown expired)
11:00 AM - Volume spike for collection A → Alert sent (different alert type)
```

## API Endpoints

### Collections

- `GET /api/collections` — Get collection summaries and global metrics
- `GET /api/collections/:id` — Get detailed collection data with charts

### Alerts

- `GET /api/alerts` — Get all alerts (supports filtering)
- `GET /api/alerts?collectionId=col-1` — Get alerts for a collection
- `GET /api/alerts?resolved=false` — Get unresolved alerts
- `GET /api/alerts?severity=critical` — Get alerts by severity
- `GET /api/alerts?type=price_drop` — Get alerts by type
- `GET /api/alerts/:id` — Get alert details
- `PUT /api/alerts/:id` — Update alert (e.g., mark as resolved)
- `PUT /api/alerts/:id/resolve` — Mark alert as resolved

## Development

### Running Tests

Frontend:
```bash
cd frontend
npm test
npm run test:watch  # Watch mode
```

Backend:
```bash
cd backend
npm test
npm run test:watch  # Watch mode
```

### Building for Production

Frontend:
```bash
cd frontend
npm run build
```

Output: `frontend/dist/`

Backend:
```bash
cd backend
npm start
```

## Troubleshooting

### Alerts Not Appearing

1. Check backend is running:
   ```bash
   curl http://localhost:3000/health
   ```

2. Verify alert thresholds are configured:
   ```bash
   cat backend/.env | grep ALERT_
   ```

3. Enable debug logging:
   ```bash
   DEBUG=true npm start
   ```

4. Check browser console for API errors (frontend)

### Webhook Notifications Failing

1. Verify webhook URL is correct:
   ```bash
   echo $WEBHOOK_URL
   ```

2. Test webhook connectivity:
   ```bash
   curl -X POST -H 'Content-Type: application/json' \
     -d '{"test":"alert"}' \
     $WEBHOOK_URL
   ```

3. Check webhook server logs/dashboard for errors

4. Increase retry attempts if network is unreliable:
   ```env
   WEBHOOK_MAX_RETRIES=5
   WEBHOOK_BACKOFF_MS=2000
   ```

### High Alert Volume

Increase the cooldown period to reduce duplicate notifications:

```env
ALERT_COOLDOWN_MINUTES=120  # 2 hours instead of 1
```

### Data Not Updating

Check auto-refresh is enabled in frontend store and ensure API is accessible:

```bash
# Test API response
curl http://localhost:3000/api/collections
```

## Deployment

### Frontend Deployment

Build the frontend:
```bash
cd frontend
npm run build
```

Deploy the `frontend/dist/` directory to your hosting service:
- Static hosting (Netlify, Vercel, S3/CloudFront, GitHub Pages)
- Ensure API base URL is configured via `VITE_API_BASE_URL` if needed

### Backend Deployment

1. Set environment variables on the server:
   ```bash
   PORT=3000
   ALERT_PRICE_DROP_PERCENT=10
   ALERT_VOLUME_SPIKE_PERCENT=50
   ALERT_LISTING_DEPLETION_PERCENT=30
   ALERT_COOLDOWN_MINUTES=60
   WEBHOOK_URL=https://your-webhook-url
   ```

2. Install dependencies and start:
   ```bash
   cd backend
   npm install
   npm start
   ```

3. Use a process manager (PM2, systemd, Docker, etc.) to keep the service running

Example Docker deployment:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/src ./src
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
```

## Environment Variables

See `backend/.env.example` for complete configuration reference.

### Critical Variables

- `WEBHOOK_URL` — Webhook endpoint for alerts (optional but recommended)
- `ALERT_COOLDOWN_MINUTES` — Cooldown period between duplicate alerts
- `ALERT_PRICE_DROP_PERCENT` — Price drop threshold
- `ALERT_VOLUME_SPIKE_PERCENT` — Volume spike threshold
- `ALERT_LISTING_DEPLETION_PERCENT` — Listing depletion threshold

## Monitoring

### Backend Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok"
}
```

### Frontend Auto-Refresh

Frontend automatically refreshes data every 60 seconds. Interval can be configured in Pinia store:

```javascript
// frontend/src/stores/alerts.ts
setAutoRefreshInterval(120_000)  // 2 minutes
```

## Performance Considerations

- **Alert Cooldown**: Prevents duplicate alerts but may miss rapid changes; adjust based on use case
- **Webhook Timeout**: Set to 10 seconds; increase if experiencing timeout issues
- **Auto-Refresh**: Frontend refreshes every 60 seconds; reduce for real-time needs or increase for lower load
- **Alert Repository**: Currently in-memory; implement persistent storage (database) for production

## Contributing

1. Create feature branch
2. Make changes
3. Run tests to verify
4. Submit pull request

## License

MIT
