# Monitoring Database Schema

This document describes the MySQL schema that backs the collections monitoring platform. It includes the core tables for collections, real-time market activity, derived analytics, alerting, and supporting configuration data.

## Overview

The persistence layer is centered around the `collections` table. Market snapshots and real-time events reference collections, while analytics computations and alert events provide downstream insights. Configuration tables (such as `tracked_collections`) drive which collections participate in scheduled processing.

```
collections
 ├─ market_snapshots
 ├─ listing_events
 ├─ purchase_events
 ├─ analytics_metrics
 ├─ alert_events
 └─ tracked_collections (configuration)
```

All tables use the UTF8MB4 character set and InnoDB storage engine. Timestamps are stored in UTC using `DATETIME(3)` where millisecond precision matters. Retention is enforced by background jobs that prune data older than configurable thresholds using the `event_time`, `snapshot_time`, or `created_at` columns described below.

## Table Reference

| Table                | Purpose                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `collections`        | Master record for each monitored collection, including metadata and source identifiers. |
| `market_snapshots`   | Hourly/delta snapshots of market state (floor price, listings, volume, etc.).           |
| `listing_events`     | Raw listing events used to measure market supply and delist activity.                   |
| `purchase_events`    | Executed purchase events used to track sale velocity and pricing.                       |
| `analytics_metrics`  | Derived metrics (percent change, moving averages) keyed by collection and timeframe.    |
| `alert_events`       | Alert occurrences emitted by analytics evaluation with severity and resolution status.  |
| `tracked_collections`| Configuration for which collections are actively crawled, including per-collection knobs.|

### `collections`

| Column         | Type                | Notes                                                                                 |
| -------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `collection_id`| `VARCHAR(64)`       | Primary key used across the platform. Supplied by crawlers or configured manually.    |
| `slug`         | `VARCHAR(128)`      | Optional human-friendly identifier (unique when provided).                            |
| `name`         | `VARCHAR(255)`      | Display name for the collection.                                                      |
| `source`       | `VARCHAR(64)`       | External data source or marketplace (e.g., `ibox`, `magiceden`).                     |
| `metadata`     | `JSON`              | Raw metadata payload from crawlers (traits, images, etc.).                           |
| `created_at`   | `DATETIME`          | Insert timestamp.                                                                     |
| `updated_at`   | `DATETIME`          | Auto-updated on change.                                                               |

**Indexes**
- `PRIMARY KEY (collection_id)`
- `UNIQUE KEY uniq_collections_slug (slug)`

Collections are long-lived and are not pruned by retention jobs.

### `tracked_collections`

| Column             | Type                | Notes                                                                                           |
| ------------------ | ------------------- | ----------------------------------------------------------------------------------------------- |
| `id`               | `INT UNSIGNED`      | Surrogate primary key.                                                                          |
| `collection_id`    | `VARCHAR(64)`       | References `collections.collection_id`.                                                         |
| `display_name`     | `VARCHAR(255)`      | Friendly name surfaced to dashboards.                                                           |
| `is_enabled`       | `TINYINT(1)`        | Toggles crawler participation.                                                                  |
| `alert_thresholds` | `JSON`              | Optional per-collection overrides for alert thresholds.                                         |
| `notification_channel` | `VARCHAR(64)`  | Overrides default notifier routing (webhook, email group, etc.).                               |
| `created_at`       | `DATETIME`          | Insert timestamp.                                                                               |
| `updated_at`       | `DATETIME`          | Auto-updated on change.                                                                         |

**Indexes**
- `PRIMARY KEY (id)`
- `UNIQUE KEY uniq_tracked_collection (collection_id)`
- Foreign key `collection_id → collections.collection_id` (`ON DELETE CASCADE`)

Configuration rows are rarely deleted. When the associated collection is removed, configuration is cascaded.

### `market_snapshots`

| Column           | Type                 | Notes                                                                                           |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `id`             | `BIGINT UNSIGNED`    | Surrogate primary key.                                                                           |
| `collection_id`  | `VARCHAR(64)`        | References `collections.collection_id`.                                                          |
| `snapshot_time`  | `DATETIME(3)`        | Effective time of the snapshot (UTC).                                                            |
| `floor_price`    | `DECIMAL(10,4)`      | Floor price at snapshot time.                                                                    |
| `ceiling_price`  | `DECIMAL(10,4)`      | Highest listing price at snapshot time.                                                          |
| `listed_count`   | `INT`                | Number of active listings.                                                                       |
| `sales_24h`      | `INT`                | Completed sales in previous 24 hours.                                                            |
| `volume_24h`     | `DECIMAL(12,4)`      | Notional trade volume past 24 hours.                                                             |
| `raw_payload`    | `JSON`               | Original snapshot payload (for auditing/backfills).                                              |
| `created_at`     | `DATETIME`           | Insert timestamp (used for retention and auditing).                                              |

**Indexes**
- `PRIMARY KEY (id)`
- `UNIQUE KEY uniq_market_snapshots_collection_time (collection_id, snapshot_time)` prevents duplicates
- `KEY idx_market_snapshots_collection (collection_id)`
- `KEY idx_market_snapshots_time (snapshot_time)`
- Foreign key `collection_id → collections.collection_id` (`ON DELETE CASCADE`)

Snapshots are time-series data and are trimmed by retention policies using either `snapshot_time` or `created_at`.

### `listing_events`

| Column          | Type                 | Notes                                                                                            |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| `id`            | `BIGINT UNSIGNED`    | Surrogate primary key.                                                                           |
| `collection_id` | `VARCHAR(64)`        | References `collections.collection_id`.                                                          |
| `source_id`     | `VARCHAR(128)`       | Unique identifier from the upstream marketplace (prevents duplicates).                           |
| `event_time`    | `DATETIME(3)`        | When the listing occurred.                                                                       |
| `price`         | `DECIMAL(10,4)`      | Listing price.                                                                                   |
| `quantity`      | `INT`                | Quantity listed.                                                                                 |
| `seller`        | `VARCHAR(128)`       | Seller wallet/account.                                                                           |
| `raw_payload`   | `JSON`               | Original event payload.                                                                          |
| `created_at`    | `DATETIME`           | Insert timestamp (used for retention cleanup).                                                   |

**Indexes**
- `PRIMARY KEY (id)`
- `UNIQUE KEY uniq_listing_events_source (source_id)` deduplicates listings from repeated ingestion runs
- `KEY idx_listing_events_collection_time (collection_id, event_time)` supports chronological queries
- `KEY idx_listing_events_collection_price (collection_id, price)` supports price band analytics
- Foreign key `collection_id → collections.collection_id` (`ON DELETE CASCADE`)

Listing events are pruned by retention jobs using `event_time` / `created_at`.

### `purchase_events`

| Column          | Type                 | Notes                                                                                            |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| `id`            | `BIGINT UNSIGNED`    | Surrogate primary key.                                                                           |
| `collection_id` | `VARCHAR(64)`        | References `collections.collection_id`.                                                          |
| `source_id`     | `VARCHAR(128)`       | Unique identifier from the upstream marketplace (prevents duplicates).                           |
| `event_time`    | `DATETIME(3)`        | When the purchase settled.                                                                       |
| `price`         | `DECIMAL(10,4)`      | Purchase price.                                                                                  |
| `quantity`      | `INT`                | Quantity purchased.                                                                              |
| `buyer`         | `VARCHAR(128)`       | Buyer wallet/account.                                                                            |
| `seller`        | `VARCHAR(128)`       | Seller wallet/account.                                                                           |
| `raw_payload`   | `JSON`               | Original event payload.                                                                          |
| `created_at`    | `DATETIME`           | Insert timestamp (used for retention cleanup).                                                   |

**Indexes**
- `PRIMARY KEY (id)`
- `UNIQUE KEY uniq_purchase_events_source (source_id)` deduplicates repeated ingestion results
- `KEY idx_purchase_events_collection_time (collection_id, event_time)` enables timeframe filters
- `KEY idx_purchase_events_collection_price (collection_id, price)` enables distribution queries
- Foreign key `collection_id → collections.collection_id` (`ON DELETE CASCADE`)

Purchases are pruned by retention logic based on `event_time` / `created_at`.

### `analytics_metrics`

| Column          | Type                 | Notes                                                                                            |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| `id`            | `BIGINT UNSIGNED`    | Surrogate primary key.                                                                           |
| `collection_id` | `VARCHAR(64)`        | References `collections.collection_id`.                                                          |
| `metric_date`   | `DATE`               | Calendar date associated with the metric.                                                        |
| `metric_type`   | `VARCHAR(64)`        | Metric identifier (e.g., `floor_change_pct`, `volume_24h`).                                      |
| `metric_timeframe` | `VARCHAR(32)`     | Time window or aggregation scope (`24h`, `7d`, etc.).                                            |
| `metric_value`  | `DECIMAL(16,6)`      | Numeric value with ample precision for ratios and percentages.                                   |
| `computed_at`   | `DATETIME(3)`        | When the metric was computed.                                                                    |
| `raw_payload`   | `JSON`               | Optional structured breakdown for debugging.                                                     |
| `created_at`    | `DATETIME`           | Insert timestamp (aligned with retention policies).                                              |

**Indexes**
- `PRIMARY KEY (id)`
- `UNIQUE KEY uniq_analytics_metrics (collection_id, metric_date, metric_type, metric_timeframe)`
- `KEY idx_analytics_metrics_collection_type (collection_id, metric_type)`
- Foreign key `collection_id → collections.collection_id` (`ON DELETE CASCADE`)

Analytics tables are typically backfilled and can be re-computed safely because of the unique key.

### `alert_events`

| Column          | Type                 | Notes                                                                                            |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| `id`            | `BIGINT UNSIGNED`    | Surrogate primary key.                                                                           |
| `collection_id` | `VARCHAR(64)`        | References `collections.collection_id`.                                                          |
| `alert_type`    | `VARCHAR(64)`        | Alert type identifier (`price_drop`, `volume_spike`, etc.).                                      |
| `severity`      | `VARCHAR(16)`        | Severity level (`info`, `warning`, `critical`).                                                  |
| `message`       | `TEXT`               | Rendered message delivered to notification channels.                                             |
| `event_time`    | `DATETIME(3)`        | When the alert condition was triggered.                                                          |
| `resolved`      | `TINYINT(1)`         | Resolution flag.                                                                                 |
| `resolved_at`   | `DATETIME(3)`        | Timestamp when the alert was resolved (nullable).                                                |
| `raw_payload`   | `JSON`               | Additional evaluation context used by notifiers or analytics.                                    |
| `created_at`    | `DATETIME`           | Insert timestamp.                                                                                |

**Indexes**
- `PRIMARY KEY (id)`
- `UNIQUE KEY uniq_alert_events_dedupe (collection_id, alert_type, event_time)` avoids duplicates
- `KEY idx_alert_events_collection_resolved (collection_id, resolved)`
- `KEY idx_alert_events_type (alert_type)`
- Foreign key `collection_id → collections.collection_id` (`ON DELETE CASCADE`)

Alerts are retained for historical analysis but can be pruned after long-term archival needs.

## Seed Data

The initialization migration seeds a starter collection and tracked configuration entry to demonstrate the relationship between `collections` and `tracked_collections`. Additional seed data can be added via subsequent migrations or manual inserts.

## Retention Strategy

Data retention is handled by background cleanup jobs that inspect the following timestamps:

- `market_snapshots.snapshot_time` / `created_at`
- `listing_events.event_time` / `created_at`
- `purchase_events.event_time` / `created_at`
- `analytics_metrics.metric_date` / `created_at`
- `alert_events.event_time` / `created_at`

Rows older than the configured retention window (`DATA_RETENTION_HOURS`) are deleted in batches to keep the dataset lean while preserving essential metadata and configuration tables.

## Migration Tracking

Migrations are stored as `.sql` files under `backend/db/migrations`. The migration runner maintains a `schema_migrations` bookkeeping table that records each applied filename with an `applied_at` timestamp, guaranteeing idempotent execution on repeated runs. See the backend README for instructions on executing migrations.
