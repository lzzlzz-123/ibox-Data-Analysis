# Architecture Overview

This document describes the high-level architecture of the Collections Dashboard application, including module boundaries, data flow, and system interactions.

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vue 3 + TS    │    │  Express.js     │    │   MySQL 8.0     │
│   Frontend      │◄──►│   Backend API   │◄──►│   Database      │
│   Dashboard     │    │   Service       │    │   Storage       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  External APIs  │
                       │  (Crawler)      │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Webhook/Email  │
                       │  Notifications  │
                       └─────────────────┘
```

## Module Boundaries

### Frontend Layer (`frontend/`)

**Responsibilities:**
- User interface and interaction
- Data visualization and presentation
- Client-side state management
- API communication

**Key Components:**
- **Views**: Dashboard, Collections, Alerts pages
- **Components**: Reusable UI elements (charts, tables, forms)
- **Stores**: Pinia state management for collections, alerts, analytics
- **Services**: API client for backend communication
- **Router**: Vue Router for navigation

**Technology Stack:**
- Vue 3 with Composition API
- TypeScript for type safety
- Pinia for state management
- Vue Router for navigation
- ECharts for data visualization
- Vite for build tooling

### Backend API Layer (`backend/src/`)

**Responsibilities:**
- RESTful API endpoints
- Business logic implementation
- Data validation and transformation
- Alert evaluation and triggering
- Scheduled job management

**Key Modules:**

#### Routes (`routes/`)
- `collections.js` - Collection CRUD and analytics endpoints
- `alerts.js` - Alert management and resolution
- `analytics.js` - Metrics calculation and refresh
- `admin.js` - Administrative operations

#### Services (`services/`)
- `alertService.js` - Alert evaluation logic
- `ingestionService.js` - Data ingestion processing
- `analyticsService.js` - Metrics calculation

#### Repositories (`repositories/`)
- `collectionRepository.js` - Collection metadata access
- `snapshotRepository.js` - Market snapshot storage
- `eventRepository.js` - Listing/purchase event storage
- `alertRepository.js` - Alert persistence

#### Workflows (`workflows/`)
- `ingestCollections.js` - Data ingestion orchestration
- Business process coordination

#### Jobs (`jobs/`)
- `cleanupJob.js` - Scheduled data cleanup
- `hourlyRefresh.js` - Automated data refresh
- Cron-based task scheduling

#### Notifications (`notifications/`)
- `webhookNotifier.js` - Webhook alert delivery
- `emailNotifier.js` - Email alert delivery

### Database Layer (`backend/db/`)

**Responsibilities:**
- Persistent data storage
- Data consistency and integrity
- Query performance optimization

**Schema:**
- `collections` - Collection metadata
- `market_snapshots` - Time-series market data
- `listing_events` - Listing change events
- `purchase_events` - Transaction events
- `alerts` - Alert records and status
- `schema_migrations` - Migration tracking

### Crawler System (`backend/src/crawler/`)

**Responsibilities:**
- External API data collection
- Data normalization and validation
- Error handling and retry logic
- Rate limiting and politeness policies

**Components:**
- HTTP client with retry mechanisms
- Data parsers and transformers
- Configuration management
- Logging and monitoring

## Data Flow

### 1. Data Ingestion Flow

```
External APIs → Crawler → Normalization → Ingestion Service → Repositories → Database
                      ↓
                 Event Processing → Alert Evaluation → Notification System
```

1. **Crawling**: Scheduled jobs trigger crawlers to fetch data from external APIs
2. **Normalization**: Raw data is transformed into standardized format
3. **Ingestion**: Workflow orchestrates storage of collections, snapshots, and events
4. **Alert Evaluation**: Service analyzes incoming data against configured thresholds
5. **Notification**: Triggered alerts are sent via webhook or email

### 2. API Request Flow

```
Frontend → API Gateway → Route Handler → Service Layer → Repository Layer → Database
         ←              ←               ←              ←                ←
    Response ← JSON Format ← Business Logic ← Data Access ← Query Results
```

1. **Request**: Frontend makes HTTP request to backend API
2. **Routing**: Express routes request to appropriate handler
3. **Business Logic**: Service layer processes request and applies rules
4. **Data Access**: Repository layer queries database
5. **Response**: Data is formatted and returned as JSON

### 3. Alert Processing Flow

```
Incoming Data → Alert Service → Threshold Check → Cooldown Check → Alert Creation → Notification
                                                                 ↓
                                                            Alert Repository
```

1. **Data Processing**: New data triggers alert evaluation
2. **Threshold Analysis**: Metrics compared against configured limits
3. **Cooldown Check**: Prevents duplicate alerts within time window
4. **Alert Generation**: Alert record created and stored
5. **Notification Delivery**: Webhook/email sent with alert details

## Key Architectural Patterns

### Repository Pattern
Data access is abstracted through repository classes, providing:
- Clean separation between business logic and data access
- Consistent interface for data operations
- Easy mocking for testing
- Potential for caching layer implementation

### Service Layer Pattern
Business logic is encapsulated in service classes:
- Clear separation of concerns
- Reusable business operations
- Transaction management
- Error handling and logging

### Event-Driven Architecture
System responds to data changes through events:
- Decoupled components
- Scalable alert processing
- Extensible notification system
- Audit trail through event logging

### Configuration-Driven Behavior
Runtime behavior controlled through environment variables:
- Flexible alert thresholds
- Toggleable features
- Environment-specific settings
- Easy deployment configuration

## Security Considerations

### API Security
- CORS configuration for frontend access
- Input validation on all endpoints
- Rate limiting and request throttling
- Admin API key protection

### Data Protection
- Environment variable encryption
- Database connection encryption
- Sensitive data masking in logs
- Secure webhook delivery

### Infrastructure Security
- Non-root container execution
- Network segmentation via Docker networks
- Health checks for service monitoring
- Volume isolation for data persistence

## Scalability and Performance

### Database Optimization
- Connection pooling for efficient resource usage
- Indexed queries for fast data retrieval
- Batch operations for bulk data processing
- Automated cleanup for data retention

### Application Performance
- Async/await patterns for non-blocking operations
- Pagination for large dataset handling
- Caching strategies for frequently accessed data
- Background job processing for heavy tasks

### Monitoring and Observability
- Structured logging with correlation IDs
- Health check endpoints for service monitoring
- Metrics collection for performance analysis
- Error tracking and alerting

## Deployment Architecture

### Container Strategy
- Multi-stage builds for optimized images
- Separate containers for each service
- Health checks for service reliability
- Volume mounts for configuration and data

### Orchestration
- Docker Compose for local development
- Service dependencies management
- Network isolation and communication
- Environment-specific configurations

### Environment Management
- Development, staging, and production configurations
- Environment variable injection
- Secret management strategies
- Configuration validation

This architecture provides a solid foundation for a scalable, maintainable collections monitoring system with clear separation of concerns and flexible configuration options.