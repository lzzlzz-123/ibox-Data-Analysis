const DEFAULT_BATCH_SIZE = 500;

function resolveCutoffTime(cutoffDate) {
  if (cutoffDate instanceof Date) {
    return cutoffDate.getTime();
  }

  if (typeof cutoffDate === 'number') {
    return cutoffDate;
  }

  const parsed = new Date(cutoffDate).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLimit(limit) {
  const parsed = parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return parsed;
}

function deleteFromCollections(collectionMap, cutoffDate, limit = DEFAULT_BATCH_SIZE) {
  const cutoffTime = resolveCutoffTime(cutoffDate);
  if (!Number.isFinite(cutoffTime)) {
    return 0;
  }

  const batchLimit = normalizeLimit(limit);
  let deleted = 0;

  for (const collectionId of Object.keys(collectionMap)) {
    if (deleted >= batchLimit) {
      break;
    }

    const entries = collectionMap[collectionId];
    if (!Array.isArray(entries) || entries.length === 0) {
      continue;
    }

    const retained = [];

    for (let i = 0; i < entries.length; i += 1) {
      if (deleted >= batchLimit) {
        retained.push(...entries.slice(i));
        break;
      }

      const entry = entries[i];
      const timestamp = new Date(entry.timestamp).getTime();

      if (Number.isFinite(timestamp) && timestamp < cutoffTime) {
        deleted += 1;
      } else {
        retained.push(entry);
      }
    }

    collectionMap[collectionId] = retained;
  }

  return deleted;
}

const dataStore = {
  marketSnapshots: {},
  listingEvents: {},
  purchaseEvents: {},

  addMarketSnapshot(collectionId, snapshot) {
    if (!this.marketSnapshots[collectionId]) {
      this.marketSnapshots[collectionId] = [];
    }
    this.marketSnapshots[collectionId].push({
      id: Date.now().toString(),
      collectionId,
      timestamp: new Date().toISOString(),
      ...snapshot,
    });
  },

  addListingEvent(collectionId, event) {
    if (!this.listingEvents[collectionId]) {
      this.listingEvents[collectionId] = [];
    }
    this.listingEvents[collectionId].push({
      id: Date.now().toString(),
      collectionId,
      timestamp: new Date().toISOString(),
      type: 'listing',
      ...event,
    });
  },

  addPurchaseEvent(collectionId, event) {
    if (!this.purchaseEvents[collectionId]) {
      this.purchaseEvents[collectionId] = [];
    }
    this.purchaseEvents[collectionId].push({
      id: Date.now().toString(),
      collectionId,
      timestamp: new Date().toISOString(),
      ...event,
    });
  },

  getMarketSnapshots(collectionId) {
    return this.marketSnapshots[collectionId] || [];
  },

  getListingEvents(collectionId) {
    return this.listingEvents[collectionId] || [];
  },

  getPurchaseEvents(collectionId) {
    return this.purchaseEvents[collectionId] || [];
  },

  deleteMarketSnapshotsOlderThan(cutoffDate, limit) {
    return deleteFromCollections(this.marketSnapshots, cutoffDate, limit);
  },

  deleteListingEventsOlderThan(cutoffDate, limit) {
    return deleteFromCollections(this.listingEvents, cutoffDate, limit);
  },

  deletePurchaseEventsOlderThan(cutoffDate, limit) {
    return deleteFromCollections(this.purchaseEvents, cutoffDate, limit);
  },

  getAllCollections() {
    const collections = new Set();
    Object.keys(this.marketSnapshots).forEach((c) => collections.add(c));
    Object.keys(this.listingEvents).forEach((c) => collections.add(c));
    Object.keys(this.purchaseEvents).forEach((c) => collections.add(c));
    return Array.from(collections);
  },

  clear() {
    this.marketSnapshots = {};
    this.listingEvents = {};
    this.purchaseEvents = {};
  },
};

module.exports = dataStore;
