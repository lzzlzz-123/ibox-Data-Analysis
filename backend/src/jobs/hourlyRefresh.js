const cron = require('node-cron');
const logger = require('../utils/logger');
const { ingestCollections } = require('../workflows/ingestCollections');

let scheduledTask = null;
let scheduledTaskWrapper = null;

async function runHourlyRefreshJob() {
  const startTime = Date.now();

  try {
    logger.info('Hourly refresh job started');

    // Run ingestion workflow with empty payloads (just triggers metrics refresh)
    const result = await ingestCollections([]);

    const duration = Date.now() - startTime;

    if (result.success) {
      logger.info('Hourly refresh job completed successfully', {
        duration,
        metrics: result.metrics,
      });
    } else {
      logger.warn('Hourly refresh job completed with failures', {
        duration,
        failures: result.metrics.failures,
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Hourly refresh job failed', {
      error: error.message,
      duration,
    });
    throw error;
  }
}

function scheduleHourlyRefresh() {
  if (scheduledTask) {
    logger.warn('Hourly refresh job already scheduled');
    return scheduledTaskWrapper;
  }

  try {
    // Cron expression: 0 * * * * (run at the top of every hour)
    scheduledTask = cron.schedule('0 * * * *', async () => {
      try {
        await runHourlyRefreshJob();
      } catch (error) {
        logger.error('Scheduled hourly refresh job failed', {
          error: error.message,
        });
      }
    });

    logger.info('Hourly refresh job scheduled', {
      cronExpression: '0 * * * *',
      description: 'Runs at the top of every hour',
    });

    scheduledTaskWrapper = {
      cancel() {
        if (scheduledTask) {
          scheduledTask.stop();
          scheduledTask.destroy();
          scheduledTask = null;
          scheduledTaskWrapper = null;
          logger.info('Hourly refresh job cancelled');
        }
      },
    };

    return scheduledTaskWrapper;
  } catch (error) {
    logger.error('Failed to schedule hourly refresh job', {
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  runHourlyRefreshJob,
  scheduleHourlyRefresh,
};
