const { runCleanupJob } = require('./cleanupJob');
const logger = require('../utils/logger');
require('../config/env');

(async () => {
  try {
    const result = await runCleanupJob();
    logger.info('Cleanup job executed via CLI', {
      cutoff: result.cutoff,
      durationMs: result.durationMs,
      summary: result.summary,
      skipped: result.skipped,
    });
    process.exit(0);
  } catch (error) {
    logger.error('Cleanup job failed', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
})();
