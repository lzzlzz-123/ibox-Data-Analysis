jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../src/utils/logger');
const { runCleanupJob } = require('../src/jobs/cleanupJob');

describe('cleanupJob', () => {
  const baseNow = new Date('2024-05-20T18:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes the correct cutoff timestamp based on retention hours', async () => {
    const dataStoreMock = {
      deleteMarketSnapshotsOlderThan: jest.fn().mockReturnValue(0),
      deleteListingEventsOlderThan: jest.fn().mockReturnValue(0),
      deletePurchaseEventsOlderThan: jest.fn().mockReturnValue(0),
    };

    const analyticsMock = {
      deleteOlderThan: jest.fn().mockReturnValue(0),
    };

    const retentionHours = 72;
    const result = await runCleanupJob({
      retentionHours,
      now: baseNow,
      repositories: {
        dataStore: dataStoreMock,
        analyticsRepository: analyticsMock,
      },
    });

    const expectedCutoff = new Date(baseNow.getTime() - retentionHours * 60 * 60 * 1000);

    expect(dataStoreMock.deleteMarketSnapshotsOlderThan).toHaveBeenCalledTimes(1);
    expect(dataStoreMock.deleteListingEventsOlderThan).toHaveBeenCalledTimes(1);
    expect(dataStoreMock.deletePurchaseEventsOlderThan).toHaveBeenCalledTimes(1);
    expect(analyticsMock.deleteOlderThan).toHaveBeenCalledTimes(1);

    const [snapshotCutoff, snapshotBatchSize] = dataStoreMock.deleteMarketSnapshotsOlderThan.mock.calls[0];
    const [listingCutoff, listingBatchSize] = dataStoreMock.deleteListingEventsOlderThan.mock.calls[0];
    const [purchaseCutoff, purchaseBatchSize] = dataStoreMock.deletePurchaseEventsOlderThan.mock.calls[0];
    const [metricsCutoff, metricsBatchSize] = analyticsMock.deleteOlderThan.mock.calls[0];

    expect(snapshotCutoff.toISOString()).toBe(expectedCutoff.toISOString());
    expect(listingCutoff.toISOString()).toBe(expectedCutoff.toISOString());
    expect(purchaseCutoff.toISOString()).toBe(expectedCutoff.toISOString());
    expect(metricsCutoff.toISOString()).toBe(expectedCutoff.toISOString());

    expect(snapshotBatchSize).toBe(500);
    expect(listingBatchSize).toBe(500);
    expect(purchaseBatchSize).toBe(500);
    expect(metricsBatchSize).toBe(500);

    expect(result.summary).toEqual({
      market_snapshots: 0,
      listing_events: 0,
      purchase_events: 0,
      analytics_metrics: 0,
    });
  });

  it('returns skipped tables to signal preserved datasets', async () => {
    const dataStoreMock = {
      deleteMarketSnapshotsOlderThan: jest.fn().mockReturnValue(0),
      deleteListingEventsOlderThan: jest.fn().mockReturnValue(0),
      deletePurchaseEventsOlderThan: jest.fn().mockReturnValue(0),
    };
    const analyticsMock = { deleteOlderThan: jest.fn().mockReturnValue(0) };

    const result = await runCleanupJob({
      now: baseNow,
      repositories: {
        dataStore: dataStoreMock,
        analyticsRepository: analyticsMock,
      },
    });

    expect(result.skipped).toEqual(expect.arrayContaining(['collections', 'alert_events']));
    expect(logger.warn).not.toHaveBeenCalledWith(
      'Cleanup delete function missing',
      expect.anything()
    );
  });

  it('emits warnings when deletions exceed configured thresholds', async () => {
    const dataStoreMock = {
      deleteMarketSnapshotsOlderThan: jest.fn().mockReturnValue(12),
      deleteListingEventsOlderThan: jest.fn().mockReturnValue(0),
      deletePurchaseEventsOlderThan: jest.fn().mockReturnValue(0),
    };
    const analyticsMock = { deleteOlderThan: jest.fn().mockReturnValue(0) };

    await runCleanupJob({
      now: baseNow,
      batchSize: 50,
      warningThresholds: {
        market_snapshots: 10,
        listing_events: 10,
        purchase_events: 10,
        analytics_metrics: 10,
      },
      repositories: {
        dataStore: dataStoreMock,
        analyticsRepository: analyticsMock,
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'Cleanup deletions exceeded threshold',
      expect.objectContaining({
        table: 'market_snapshots',
        deleted: 12,
        threshold: 10,
      })
    );
  });
});
