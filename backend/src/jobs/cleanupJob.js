const dataStore = require('../repositories/dataStore');
const { analyticsRepository } = require('../repositories/analyticsRepository');
const logger = require('../utils/logger');
const env = require('../config/env');

const SKIPPED_TABLES = ['collections', 'alert_events'];
const MAX_BATCH_ITERATIONS = 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function normalizePositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeBatchSize(value, fallback) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function resolveTimestamp(value) {
  if (value instanceof Date) {
    return value.getTime();
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function buildThresholds(overrides = {}, defaultThreshold) {
  const thresholds = {
    market_snapshots: defaultThreshold,
    listing_events: defaultThreshold,
    purchase_events: defaultThreshold,
    analytics_metrics: defaultThreshold,
  };

  if (!overrides || typeof overrides !== 'object') {
    return thresholds;
  }

  Object.entries(overrides).forEach(([table, value]) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      thresholds[table] = parsed;
    }
  });

  return thresholds;
}

function getCutoffDate(retentionHours, referenceTimeMs) {
  const cutoffMs = referenceTimeMs - retentionHours * ONE_HOUR_MS;
  return new Date(cutoffMs);
}

async function processTable(tableName, deleteBatch, batchSize) {
  let totalDeleted = 0;
  let iteration = 0;

  while (true) {
    iteration += 1;
    const removedRaw = await Promise.resolve(deleteBatch());
    const removedNumber = Number(removedRaw);
    const removed = Number.isFinite(removedNumber) && removedNumber > 0 ? removedNumber : 0;
    totalDeleted += removed;

    if (batchSize <= 0 || removed < batchSize) {
      break;
    }

    if (iteration >= MAX_BATCH_ITERATIONS) {
      logger.warn('Cleanup batch iteration limit reached', {
        table: tableName,
        batchSize,
        iteration,
      });
      break;
    }
  }

  return totalDeleted;
}

function getDelayUntilNextRun(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const next = new Date(current.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(10);

  if (
    current.getMinutes() > 10 ||
    (current.getMinutes() === 10 && (current.getSeconds() > 0 || current.getMilliseconds() > 0))
  ) {
    next.setHours(next.getHours() + 1);
  }

  const delay = next.getTime() - current.getTime();
  return delay >= 0 ? delay : ONE_HOUR_MS + delay;
}

async function runCleanupJob(options = {}) {
  const retentionHours = normalizePositiveNumber(options.retentionHours, env.dataRetentionHours);
  const batchSize = normalizeBatchSize(options.batchSize, env.cleanupBatchSize);
  const thresholds = buildThresholds(options.warningThresholds, env.cleanupWarningThreshold);
  const nowMs = resolveTimestamp(options.now ?? Date.now());
  const cutoffDate = getCutoffDate(retentionHours, nowMs);

  const repositories = options.repositories || {};
  const dataStoreRepo = repositories.dataStore || dataStore;
  const analyticsRepo = repositories.analyticsRepository || analyticsRepository;

  const startTime = Date.now();

  logger.info('Data cleanup job started', {
    retentionHours,
    cutoff: cutoffDate.toISOString(),
    batchSize,
    skippedTables: SKIPPED_TABLES,
  });

  const summary = {};

  const tasks = [
    {
      name: 'market_snapshots',
      deleteBatch:
        dataStoreRepo && typeof dataStoreRepo.deleteMarketSnapshotsOlderThan === 'function'
          ? () => dataStoreRepo.deleteMarketSnapshotsOlderThan(cutoffDate, batchSize)
          : null,
    },
    {
      name: 'listing_events',
      deleteBatch:
        dataStoreRepo && typeof dataStoreRepo.deleteListingEventsOlderThan === 'function'
          ? () => dataStoreRepo.deleteListingEventsOlderThan(cutoffDate, batchSize)
          : null,
    },
    {
      name: 'purchase_events',
      deleteBatch:
        dataStoreRepo && typeof dataStoreRepo.deletePurchaseEventsOlderThan === 'function'
          ? () => dataStoreRepo.deletePurchaseEventsOlderThan(cutoffDate, batchSize)
          : null,
    },
    {
      name: 'analytics_metrics',
      deleteBatch:
        analyticsRepo && typeof analyticsRepo.deleteOlderThan === 'function'
          ? () => analyticsRepo.deleteOlderThan(cutoffDate, batchSize)
          : null,
    },
  ];

  for (const task of tasks) {
    if (typeof task.deleteBatch !== 'function') {
      logger.warn('Cleanup delete function missing', {
        table: task.name,
      });
      summary[task.name] = 0;
      continue;
    }

    try {
      const deleted = await processTable(task.name, task.deleteBatch, batchSize);
      summary[task.name] = deleted;

      const threshold = thresholds[task.name];
      if (Number.isFinite(threshold) && threshold >= 0 && deleted > threshold) {
        logger.warn('Cleanup deletions exceeded threshold', {
          table: task.name,
          deleted,
          threshold,
        });
      }
    } catch (error) {
      logger.error('Cleanup table processing failed', {
        table: task.name,
        error: error.message,
      });
      throw error;
    }
  }

  const durationMs = Date.now() - startTime;

  logger.info('Data cleanup job completed', {
    cutoff: cutoffDate.toISOString(),
    durationMs,
    summary,
  });

  return {
    cutoff: cutoffDate.toISOString(),
    durationMs,
    summary,
    skipped: [...SKIPPED_TABLES],
  };
}

function scheduleCleanup(options = {}) {
  const retentionHours = normalizePositiveNumber(options.retentionHours, env.dataRetentionHours);
  const batchSize = normalizeBatchSize(options.batchSize, env.cleanupBatchSize);
  const thresholds = buildThresholds(options.warningThresholds, env.cleanupWarningThreshold);

  let timeoutId = null;
  let stopped = false;

  const scheduleNext = () => {
    if (stopped) {
      return;
    }

    const delay = getDelayUntilNextRun(new Date());
    const nextRunAt = new Date(Date.now() + delay).toISOString();

    logger.info('Cleanup cron scheduled', {
      nextRunAt,
      delayMs: delay,
      retentionHours,
      batchSize,
    });

    timeoutId = setTimeout(async () => {
      try {
        await runCleanupJob({
          retentionHours,
          batchSize,
          warningThresholds: thresholds,
        });
      } catch (error) {
        logger.error('Scheduled cleanup job failed', {
          error: error.message,
        });
      } finally {
        scheduleNext();
      }
    }, delay);
  };

  scheduleNext();

  return {
    cancel() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      stopped = true;
    },
  };
}

module.exports = {
  runCleanupJob,
  scheduleCleanup,
  getDelayUntilNextRun,
};
