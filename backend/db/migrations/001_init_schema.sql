-- 001_init_schema.sql
--
-- Initializes the collections monitoring schema with core data, analytics, alerting, and configuration tables.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS collections (
  collection_id VARCHAR(64) NOT NULL,
  slug VARCHAR(128) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  source VARCHAR(64) DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_id),
  UNIQUE KEY uniq_collections_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tracked_collections (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_id VARCHAR(64) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  alert_thresholds JSON DEFAULT NULL,
  notification_channel VARCHAR(64) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_tracked_collection (collection_id),
  CONSTRAINT fk_tracked_collections_collection
    FOREIGN KEY (collection_id) REFERENCES collections (collection_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS market_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_id VARCHAR(64) NOT NULL,
  snapshot_time DATETIME(3) NOT NULL,
  floor_price DECIMAL(10,4) DEFAULT NULL,
  ceiling_price DECIMAL(10,4) DEFAULT NULL,
  listed_count INT DEFAULT NULL,
  sales_24h INT DEFAULT NULL,
  volume_24h DECIMAL(12,4) DEFAULT NULL,
  raw_payload JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_market_snapshots_collection_time (collection_id, snapshot_time),
  KEY idx_market_snapshots_collection (collection_id),
  KEY idx_market_snapshots_time (snapshot_time),
  CONSTRAINT fk_market_snapshots_collection
    FOREIGN KEY (collection_id) REFERENCES collections (collection_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_id VARCHAR(64) NOT NULL,
  source_id VARCHAR(128) NOT NULL,
  event_time DATETIME(3) NOT NULL,
  price DECIMAL(10,4) NOT NULL,
  quantity INT DEFAULT 1,
  seller VARCHAR(128) DEFAULT NULL,
  raw_payload JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_listing_events_source (source_id),
  KEY idx_listing_events_collection_time (collection_id, event_time),
  KEY idx_listing_events_collection_price (collection_id, price),
  CONSTRAINT fk_listing_events_collection
    FOREIGN KEY (collection_id) REFERENCES collections (collection_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_id VARCHAR(64) NOT NULL,
  source_id VARCHAR(128) NOT NULL,
  event_time DATETIME(3) NOT NULL,
  price DECIMAL(10,4) NOT NULL,
  quantity INT DEFAULT 1,
  buyer VARCHAR(128) DEFAULT NULL,
  seller VARCHAR(128) DEFAULT NULL,
  raw_payload JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_purchase_events_source (source_id),
  KEY idx_purchase_events_collection_time (collection_id, event_time),
  KEY idx_purchase_events_collection_price (collection_id, price),
  CONSTRAINT fk_purchase_events_collection
    FOREIGN KEY (collection_id) REFERENCES collections (collection_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_id VARCHAR(64) NOT NULL,
  metric_date DATE NOT NULL,
  metric_type VARCHAR(64) NOT NULL,
  metric_timeframe VARCHAR(32) NOT NULL,
  metric_value DECIMAL(16,6) NOT NULL,
  computed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  raw_payload JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_analytics_metrics (collection_id, metric_date, metric_type, metric_timeframe),
  KEY idx_analytics_metrics_collection_type (collection_id, metric_type),
  CONSTRAINT fk_analytics_metrics_collection
    FOREIGN KEY (collection_id) REFERENCES collections (collection_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alert_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_id VARCHAR(64) NOT NULL,
  alert_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  message TEXT NOT NULL,
  event_time DATETIME(3) NOT NULL,
  resolved TINYINT(1) NOT NULL DEFAULT 0,
  resolved_at DATETIME(3) DEFAULT NULL,
  raw_payload JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_alert_events_dedupe (collection_id, alert_type, event_time),
  KEY idx_alert_events_collection_resolved (collection_id, resolved),
  KEY idx_alert_events_type (alert_type),
  CONSTRAINT fk_alert_events_collection
    FOREIGN KEY (collection_id) REFERENCES collections (collection_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed starter configuration
INSERT INTO collections (collection_id, slug, name, source, metadata)
VALUES (
  'demo-collection',
  'demo-collection',
  'Demo Collection',
  'seed',
  JSON_OBJECT('description', 'Starter collection for local development', 'category', 'demo')
)
ON DUPLICATE KEY UPDATE
  slug = VALUES(slug),
  name = VALUES(name),
  source = VALUES(source),
  metadata = VALUES(metadata);

INSERT INTO tracked_collections (collection_id, display_name, is_enabled, alert_thresholds, notification_channel)
VALUES (
  'demo-collection',
  'Demo Collection',
  1,
  JSON_OBJECT('price_drop_percent', 10, 'volume_spike_percent', 50),
  'default'
)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  is_enabled = VALUES(is_enabled),
  alert_thresholds = VALUES(alert_thresholds),
  notification_channel = VALUES(notification_channel);
