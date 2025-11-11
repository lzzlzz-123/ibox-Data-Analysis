const logger = require('../utils/logger');
const dataStore = require('./dataStore');

const eventRepository = {
  async insertListingEvent(collectionId, eventData) {
    try {
      if (!eventData.id) {
        eventData.id = Date.now().toString();
      }

      const event = {
        id: eventData.id,
        collectionId,
        type: 'listing',
        timestamp: eventData.timestamp || new Date().toISOString(),
        ...eventData,
      };

      dataStore.addListingEvent(collectionId, event);

      logger.debug('Listing event inserted', {
        collectionId,
        eventId: event.id,
      });

      return event;
    } catch (error) {
      logger.error('Error inserting listing event', {
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async insertPurchaseEvent(collectionId, eventData) {
    try {
      if (!eventData.id) {
        eventData.id = Date.now().toString();
      }

      const event = {
        id: eventData.id,
        collectionId,
        type: 'purchase',
        timestamp: eventData.timestamp || new Date().toISOString(),
        ...eventData,
      };

      dataStore.addPurchaseEvent(collectionId, event);

      logger.debug('Purchase event inserted', {
        collectionId,
        eventId: event.id,
      });

      return event;
    } catch (error) {
      logger.error('Error inserting purchase event', {
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async getListingEvents(collectionId) {
    try {
      return dataStore.getListingEvents(collectionId);
    } catch (error) {
      logger.error('Error fetching listing events', {
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async getPurchaseEvents(collectionId) {
    try {
      return dataStore.getPurchaseEvents(collectionId);
    } catch (error) {
      logger.error('Error fetching purchase events', {
        collectionId,
        error: error.message,
      });
      throw error;
    }
  },

  async getEventById(eventId, collectionId, type) {
    try {
      let events = [];
      if (type === 'listing') {
        events = dataStore.getListingEvents(collectionId);
      } else if (type === 'purchase') {
        events = dataStore.getPurchaseEvents(collectionId);
      }
      return events.find(e => e.id === eventId) || null;
    } catch (error) {
      logger.error('Error fetching event', {
        eventId,
        collectionId,
        type,
        error: error.message,
      });
      throw error;
    }
  },

  async deleteListingEventsOlderThan(cutoffDate, limit) {
    try {
      return dataStore.deleteListingEventsOlderThan(cutoffDate, limit);
    } catch (error) {
      logger.error('Error deleting old listing events', {
        error: error.message,
      });
      throw error;
    }
  },

  async deletePurchaseEventsOlderThan(cutoffDate, limit) {
    try {
      return dataStore.deletePurchaseEventsOlderThan(cutoffDate, limit);
    } catch (error) {
      logger.error('Error deleting old purchase events', {
        error: error.message,
      });
      throw error;
    }
  },
};

module.exports = eventRepository;
