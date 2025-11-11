const logger = require('../src/utils/logger');

jest.mock('../src/utils/logger');
jest.mock('node-cron');

describe('Hourly Refresh Job', () => {
  let cronModule;

  beforeEach(() => {
    jest.clearAllMocks();
    cronModule = require('node-cron');
    cronModule.schedule = jest.fn((cronExpression, callback) => ({
      stop: jest.fn(),
      destroy: jest.fn(),
    }));
  });

  describe('runHourlyRefreshJob', () => {
    it('should run without errors', async () => {
      // Clear require cache before each test
      delete require.cache[require.resolve('../src/jobs/hourlyRefresh')];
      const { runHourlyRefreshJob } = require('../src/jobs/hourlyRefresh');
      const result = await runHourlyRefreshJob();

      expect(result.success).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should log start', async () => {
      delete require.cache[require.resolve('../src/jobs/hourlyRefresh')];
      const { runHourlyRefreshJob } = require('../src/jobs/hourlyRefresh');
      await runHourlyRefreshJob();

      expect(logger.info).toHaveBeenCalledWith(
        'Hourly refresh job started'
      );
    });

    it('should track duration', async () => {
      delete require.cache[require.resolve('../src/jobs/hourlyRefresh')];
      const { runHourlyRefreshJob } = require('../src/jobs/hourlyRefresh');
      const result = await runHourlyRefreshJob();

      expect(result.metrics.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return metrics', async () => {
      delete require.cache[require.resolve('../src/jobs/hourlyRefresh')];
      const { runHourlyRefreshJob } = require('../src/jobs/hourlyRefresh');
      const result = await runHourlyRefreshJob();

      expect(result.metrics).toHaveProperty('duration');
      expect(result.metrics).toHaveProperty('totalCollections');
    });
  });

  describe('scheduleHourlyRefresh', () => {
    it('should schedule the cron job with correct expression', () => {
      delete require.cache[require.resolve('../src/jobs/hourlyRefresh')];
      const { scheduleHourlyRefresh } = require('../src/jobs/hourlyRefresh');
      const result = scheduleHourlyRefresh();

      expect(cronModule.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
      expect(result.cancel).toBeDefined();
    });

    it('should return cancellable scheduled task', () => {
      delete require.cache[require.resolve('../src/jobs/hourlyRefresh')];
      const { scheduleHourlyRefresh } = require('../src/jobs/hourlyRefresh');
      const result = scheduleHourlyRefresh();

      expect(result).toBeDefined();
      expect(typeof result.cancel).toBe('function');
    });

    it('should return same cancellable task on duplicate calls', () => {
      delete require.cache[require.resolve('../src/jobs/hourlyRefresh')];
      const { scheduleHourlyRefresh } = require('../src/jobs/hourlyRefresh');
      const result1 = scheduleHourlyRefresh();
      const result2 = scheduleHourlyRefresh();

      // Both calls should return a cancellable result
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.cancel).toBeDefined();
      expect(result2.cancel).toBeDefined();
      // Should be the same wrapper object
      expect(result1).toBe(result2);
    });
  });

  describe('Integration', () => {
    it('should integrate with ingestion workflow', async () => {
      delete require.cache[require.resolve('../src/jobs/hourlyRefresh')];
      const { runHourlyRefreshJob } = require('../src/jobs/hourlyRefresh');
      const result = await runHourlyRefreshJob();

      expect(result.success).toBeDefined();
      expect(result.metrics).toBeDefined();
    });
  });
});
