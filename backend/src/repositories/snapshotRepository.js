const logger = require('../utils/logger');
const dataStore = require('./dataStore');

const snapshotRepository = {
  async insertSnapshot(collectionId, snapshotData) {
    try {
      if (!snapshotData.id) {
        snapshotData.id = Date.now().toString();
      }

      const snapshot = {
        id: snapshotData.id,
        collectionId,
        timestamp: snapshotData.timestamp || new Date().toISOString(),
        ...snapshotData,
      };

      dataStore.addMarketSnapshot(collectionId, snapshot);

      logger.debug('Snapshot inserted', {
        collectionId,
        snapshotId: snapshot.id,
      });

      return snapshot;
    } catch (error) {
      logger.error('Error inserting snapshot', {
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async getSnapshotById(snapshotId, collectionId) {
    try {
      const snapshots = dataStore.getMarketSnapshots(collectionId);
      return snapshots.find(s => s.id === snapshotId) || null;
    } catch (error) {
      logger.error('Error fetching snapshot', {
        snapshotId,
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async getCollectionSnapshots(collectionId) {
    try {
      return dataStore.getMarketSnapshots(collectionId);
    } catch (error) {
      logger.error('Error fetching collection snapshots', {
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async deleteOlderThan(cutoffDate, limit) {
    try {
      return dataStore.deleteMarketSnapshotsOlderThan(cutoffDate, limit);
    } catch (error) {
      logger.error('Error deleting old snapshots', {
        error: error.message,
      });
      throw error;
    }
  },
};

module.exports = snapshotRepository;
