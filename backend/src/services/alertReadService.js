const { alertsRepository } = require('../repositories/alertsRepository');
const logger = require('../utils/logger');

const alertReadService = {
  async getAlerts(filters = {}) {
    try {
      const {
        collectionId,
        severity,
        type,
        resolved,
        page = 1,
        limit = 50,
        sortBy = 'triggeredAt',
        sortOrder = 'desc'
      } = filters;

      const repositoryFilters = {};
      
      if (collectionId) {
        repositoryFilters.collectionId = collectionId;
      }
      
      if (severity) {
        repositoryFilters.severity = severity;
      }
      
      if (type) {
        repositoryFilters.type = type;
      }
      
      if (resolved !== undefined) {
        repositoryFilters.resolved = resolved === 'true' || resolved === true;
      }

      let alerts = await alertsRepository.findAll(repositoryFilters);

      // Apply additional sorting if needed
      if (sortBy !== 'triggeredAt') {
        alerts.sort((a, b) => {
          const aVal = a[sortBy] || '';
          const bVal = b[sortBy] || '';
          let comparison = 0;
          
          if (sortBy === 'severity') {
            const severityOrder = { 'low': 0, 'medium': 1, 'high': 2, 'critical': 3 };
            comparison = (severityOrder[aVal] || 0) - (severityOrder[bVal] || 0);
          } else if (sortBy === 'type') {
            comparison = aVal.localeCompare(bVal);
          } else {
            // Default string comparison
            comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          }
          
          return sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      // Calculate pagination
      const total = alerts.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedAlerts = alerts.slice(startIndex, endIndex);

      // Calculate summary statistics
      const summary = {
        total,
        resolved: alerts.filter(a => a.resolved === true).length,
        unresolved: alerts.filter(a => a.resolved === false).length,
        bySeverity: {},
        byType: {},
        byCollection: {},
      };

      alerts.forEach((alert) => {
        // Count by severity
        summary.bySeverity[alert.severity] = (summary.bySeverity[alert.severity] || 0) + 1;
        
        // Count by type
        summary.byType[alert.type] = (summary.byType[alert.type] || 0) + 1;
        
        // Count by collection
        summary.byCollection[alert.collectionId] = (summary.byCollection[alert.collectionId] || 0) + 1;
      });

      return {
        alerts: paginatedAlerts,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          hasNext: endIndex < total,
          hasPrev: page > 1,
          totalPages: Math.ceil(total / limit),
        },
        summary,
      };
    } catch (error) {
      logger.error('Error fetching alerts', {
        filters,
        error: error.message,
      });
      throw error;
    }
  },

  async getAlertById(alertId) {
    try {
      const alert = await alertsRepository.findById(alertId);
      
      if (!alert) {
        return null;
      }

      return alert;
    } catch (error) {
      logger.error('Error fetching alert by ID', {
        alertId,
        error: error.message,
      });
      throw error;
    }
  },

  async getAlertsByCollection(collectionId, options = {}) {
    try {
      const { includeResolved = false, limit = 100 } = options;
      
      const filters = {
        collectionId,
      };

      if (!includeResolved) {
        filters.resolved = false;
      }

      const alerts = await alertsRepository.findAll(filters);
      
      // Limit results and sort by most recent
      const limitedAlerts = alerts
        .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
        .slice(0, limit);

      // Calculate collection-specific summary
      const summary = {
        total: limitedAlerts.length,
        resolved: limitedAlerts.filter(a => a.resolved).length,
        unresolved: limitedAlerts.filter(a => !a.resolved).length,
        bySeverity: {},
        byType: {},
        latestAlert: limitedAlerts[0] || null,
      };

      limitedAlerts.forEach((alert) => {
        summary.bySeverity[alert.severity] = (summary.bySeverity[alert.severity] || 0) + 1;
        summary.byType[alert.type] = (summary.byType[alert.type] || 0) + 1;
      });

      return {
        collectionId,
        alerts: limitedAlerts,
        summary,
      };
    } catch (error) {
      logger.error('Error fetching alerts by collection', {
        collectionId,
        options,
        error: error.message,
      });
      throw error;
    }
  },

  async getAlertSummary(filters = {}) {
    try {
      const { timeWindow = '24h' } = filters;
      
      // Get all alerts first
      const allAlerts = await alertsRepository.findAll({});
      
      // Apply time window filter
      const now = new Date();
      let filteredAlerts = allAlerts;
      
      if (timeWindow !== 'all') {
        const windowMs = this._parseTimeWindow(timeWindow);
        const cutoffTime = new Date(now.getTime() - windowMs);
        filteredAlerts = allAlerts.filter(alert => 
          new Date(alert.triggeredAt) >= cutoffTime
        );
      }

      // Apply other filters
      if (filters.collectionId) {
        filteredAlerts = filteredAlerts.filter(alert => 
          alert.collectionId === filters.collectionId
        );
      }

      if (filters.severity) {
        filteredAlerts = filteredAlerts.filter(alert => 
          alert.severity === filters.severity
        );
      }

      // Calculate comprehensive summary
      const summary = {
        timeWindow,
        total: filteredAlerts.length,
        resolved: filteredAlerts.filter(a => a.resolved).length,
        unresolved: filteredAlerts.filter(a => !a.resolved).length,
        bySeverity: {},
        byType: {},
        byCollection: {},
        trends: {
          hourly: {},
          daily: {},
        },
      };

      // Group by various dimensions
      filteredAlerts.forEach((alert) => {
        // By severity
        summary.bySeverity[alert.severity] = (summary.bySeverity[alert.severity] || 0) + 1;
        
        // By type
        summary.byType[alert.type] = (summary.byType[alert.type] || 0) + 1;
        
        // By collection
        summary.byCollection[alert.collectionId] = (summary.byCollection[alert.collectionId] || 0) + 1;

        // Hourly trends (last 24 hours)
        const alertHour = new Date(alert.triggeredAt).toISOString().substring(0, 13); // YYYY-MM-DDTHH
        if (now - new Date(alert.triggeredAt) <= 24 * 60 * 60 * 1000) {
          summary.trends.hourly[alertHour] = (summary.trends.hourly[alertHour] || 0) + 1;
        }

        // Daily trends (last 7 days)
        const alertDay = new Date(alert.triggeredAt).toISOString().substring(0, 10); // YYYY-MM-DD
        if (now - new Date(alert.triggeredAt) <= 7 * 24 * 60 * 60 * 1000) {
          summary.trends.daily[alertDay] = (summary.trends.daily[alertDay] || 0) + 1;
        }
      });

      return summary;
    } catch (error) {
      logger.error('Error generating alert summary', {
        filters,
        error: error.message,
      });
      throw error;
    }
  },

  _parseTimeWindow(window) {
    const windows = {
      '1h': 1 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '72h': 72 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      'all': Infinity,
    };
    
    return windows[window] || windows['24h'];
  },
};

module.exports = alertReadService;