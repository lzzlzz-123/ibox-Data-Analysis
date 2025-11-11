const logger = require('../utils/logger');

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
