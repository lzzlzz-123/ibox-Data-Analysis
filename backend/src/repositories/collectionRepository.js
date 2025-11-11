const logger = require('../utils/logger');
const dataStore = require('./dataStore');

const collectionRepository = {
  async upsertCollection(collectionId, metadata = {}) {
    try {
      // In-memory store, maintain collection metadata
      if (!this.collections) {
        this.collections = {};
      }
      
      this.collections[collectionId] = {
        id: collectionId,
        ...metadata,
        updatedAt: new Date().toISOString(),
      };

      logger.debug('Collection upserted', {
        collectionId,
        metadata,
      });

      return this.collections[collectionId];
    } catch (error) {
      logger.error('Error upserting collection', {
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async getCollection(collectionId) {
    try {
      if (!this.collections) {
        this.collections = {};
      }
      return this.collections[collectionId] || null;
    } catch (error) {
      logger.error('Error fetching collection', {
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async getAllCollections() {
    try {
      if (!this.collections) {
        this.collections = {};
      }
      return Object.values(this.collections);
    } catch (error) {
      logger.error('Error fetching all collections', {
        error: error.message,
      });
      throw error;
    }
  },

  clear() {
    this.collections = {};
  },
};

module.exports = collectionRepository;
