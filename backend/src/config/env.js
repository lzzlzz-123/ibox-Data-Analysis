const dotenv = require('dotenv');

dotenv.config();

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

const env = {
  dataRetentionHours: toInt(process.env.DATA_RETENTION_HOURS, 72),
  cleanupBatchSize: toInt(process.env.CLEANUP_BATCH_SIZE, 500),
  cleanupWarningThreshold: toInt(process.env.CLEANUP_WARNING_THRESHOLD, 1000),
  enableCleanupCron: toBoolean(process.env.ENABLE_CLEANUP_CRON, false),
  enableHourlyCron: toBoolean(process.env.ENABLE_CRON, false),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'collections_dashboard',
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
  },
};

module.exports = env;
