const logger = require('../utils/logger');

const alerts = [];
let alertId = 0;

const alertsRepository = {
  async create(alertData) {
    try {
      const alert = {
        id: String(++alertId),
        ...alertData,
        resolved: alertData.resolved !== undefined ? alertData.resolved : false,
        createdAt: new Date().toISOString(),
      };

      alerts.push(alert);

      logger.info('Alert created', {
        alertId: alert.id,
        collectionId: alert.collectionId,
        type: alert.type,
      });

      return alert;
    } catch (error) {
      logger.error('Error creating alert', {
        error: error.message,
      });
      throw error;
    }
  },

  async findAll(filters = {}) {
    try {
      let result = [...alerts];

      if (filters.collectionId) {
        result = result.filter((a) => a.collectionId === filters.collectionId);
      }

      if (filters.resolved !== undefined) {
        result = result.filter((a) => a.resolved === filters.resolved);
      }

      if (filters.severity) {
        result = result.filter((a) => a.severity === filters.severity);
      }

      if (filters.type) {
        result = result.filter((a) => a.type === filters.type);
      }

      return result.sort(
        (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
      );
    } catch (error) {
      logger.error('Error fetching alerts', {
        error: error.message,
      });
      throw error;
    }
  },

  async findById(alertId) {
    try {
      return alerts.find((a) => a.id === alertId) || null;
    } catch (error) {
      logger.error('Error finding alert', {
        alertId,
        error: error.message,
      });
      throw error;
    }
  },

  async update(alertId, updates) {
    try {
      const alert = alerts.find((a) => a.id === alertId);

      if (!alert) {
        logger.warn('Alert not found', { alertId });
        return null;
      }

      const updated = {
        ...alert,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      const index = alerts.indexOf(alert);
      alerts[index] = updated;

      logger.info('Alert updated', {
        alertId,
        updates: Object.keys(updates),
      });

      return updated;
    } catch (error) {
      logger.error('Error updating alert', {
        alertId,
        error: error.message,
      });
      throw error;
    }
  },

  async markAsResolved(alertId) {
    return this.update(alertId, { resolved: true });
  },

  async clear() {
    alerts.length = 0;
    alertId = 0;
  },
};

module.exports = { alertsRepository };
