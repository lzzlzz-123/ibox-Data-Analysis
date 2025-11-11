const logger = require('../utils/logger');
const { webhookNotifier } = require('../notifications/webhookNotifier');
const { emailNotifier } = require('../notifications/emailNotifier');

const DEFAULT_THRESHOLDS = {
  priceDrop: parseFloat(process.env.ALERT_PRICE_DROP_PERCENT || 10),
  volumeSpike: parseFloat(process.env.ALERT_VOLUME_SPIKE_PERCENT || 50),
  listingDepletion: parseFloat(process.env.ALERT_LISTING_DEPLETION_PERCENT || 30),
};

const COOLDOWN_WINDOW = parseInt(process.env.ALERT_COOLDOWN_MINUTES || 60, 10) * 60 * 1000;

const alertCooldowns = new Map();

function getCooldownKey(collectionId, alertType) {
  return `${collectionId}:${alertType}`;
}

function shouldThrottle(collectionId, alertType) {
  const key = getCooldownKey(collectionId, alertType);
  const lastTriggered = alertCooldowns.get(key);

  if (!lastTriggered) {
    return false;
  }

  const elapsed = Date.now() - lastTriggered;
  return elapsed < COOLDOWN_WINDOW;
}

function recordTrigger(collectionId, alertType) {
  const key = getCooldownKey(collectionId, alertType);
  alertCooldowns.set(key, Date.now());
}

async function evaluateAlerts(analytics, alertsRepository) {
  if (!analytics || !alertsRepository) {
    logger.warn('Missing analytics data or repository for alert evaluation');
    return [];
  }

  const triggeredAlerts = [];

  try {
    const { collectionId, priceChange24h, volumeChange24h, listingCount, previousListingCount } =
      analytics;

    if (!collectionId) {
      logger.warn('Collection ID missing from analytics data');
      return triggeredAlerts;
    }

    // Check price drop alert
    if (priceChange24h !== undefined && priceChange24h !== null) {
      if (priceChange24h < -DEFAULT_THRESHOLDS.priceDrop) {
        const alertType = 'price_drop';
        if (!shouldThrottle(collectionId, alertType)) {
          const alert = {
            collectionId,
            type: alertType,
            severity: 'warning',
            message: `Price dropped ${Math.abs(priceChange24h).toFixed(2)}% in 24h`,
            triggeredAt: new Date().toISOString(),
          };
          triggeredAlerts.push(alert);
          recordTrigger(collectionId, alertType);
          logger.info(`Alert triggered: ${alertType} for collection ${collectionId}`, {
            collectionId,
            alertType,
            priceChange: priceChange24h,
          });
        } else {
          logger.debug(`Alert throttled: ${alertType} for collection ${collectionId}`);
        }
      }
    }

    // Check volume spike alert
    if (volumeChange24h !== undefined && volumeChange24h !== null) {
      if (volumeChange24h > DEFAULT_THRESHOLDS.volumeSpike) {
        const alertType = 'volume_spike';
        if (!shouldThrottle(collectionId, alertType)) {
          const alert = {
            collectionId,
            type: alertType,
            severity: 'info',
            message: `Volume spiked ${volumeChange24h.toFixed(2)}% in 24h`,
            triggeredAt: new Date().toISOString(),
          };
          triggeredAlerts.push(alert);
          recordTrigger(collectionId, alertType);
          logger.info(`Alert triggered: ${alertType} for collection ${collectionId}`, {
            collectionId,
            alertType,
            volumeChange: volumeChange24h,
          });
        } else {
          logger.debug(`Alert throttled: ${alertType} for collection ${collectionId}`);
        }
      }
    }

    // Check listing depletion alert
    if (
      listingCount !== undefined &&
      listingCount !== null &&
      previousListingCount !== undefined &&
      previousListingCount !== null &&
      previousListingCount > 0
    ) {
      const listingDepletion = ((previousListingCount - listingCount) / previousListingCount) * 100;
      if (listingDepletion > DEFAULT_THRESHOLDS.listingDepletion) {
        const alertType = 'listing_depletion';
        if (!shouldThrottle(collectionId, alertType)) {
          const alert = {
            collectionId,
            type: alertType,
            severity: 'critical',
            message: `Listings depleted by ${listingDepletion.toFixed(2)}%`,
            triggeredAt: new Date().toISOString(),
          };
          triggeredAlerts.push(alert);
          recordTrigger(collectionId, alertType);
          logger.info(`Alert triggered: ${alertType} for collection ${collectionId}`, {
            collectionId,
            alertType,
            listingDepletion,
          });
        } else {
          logger.debug(`Alert throttled: ${alertType} for collection ${collectionId}`);
        }
      }
    }

    // Persist alerts and notify
    for (const alert of triggeredAlerts) {
      try {
        const persistedAlert = await alertsRepository.create(alert);
        await notifyAlert(persistedAlert);
      } catch (error) {
        logger.error('Failed to persist or notify alert', {
          collectionId: alert.collectionId,
          type: alert.type,
          error: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Error evaluating alerts', { error: error.message });
  }

  return triggeredAlerts;
}

async function notifyAlert(alert) {
  const notifiers = [];

  if (process.env.WEBHOOK_URL) {
    notifiers.push(webhookNotifier.send(alert));
  }

  if (process.env.EMAIL_ENABLED === 'true' && process.env.EMAIL_TO) {
    notifiers.push(emailNotifier.send(alert));
  }

  if (notifiers.length === 0) {
    logger.warn('No notifiers configured for alerts', {
      collectionId: alert.collectionId,
      type: alert.type,
    });
    return;
  }

  try {
    await Promise.all(notifiers);
  } catch (error) {
    logger.error('Error notifying alert', {
      collectionId: alert.collectionId,
      type: alert.type,
      error: error.message,
    });
  }
}

function getThresholds() {
  return { ...DEFAULT_THRESHOLDS };
}

function getCooldownWindow() {
  return COOLDOWN_WINDOW;
}

function clearCooldowns() {
  alertCooldowns.clear();
}

module.exports = {
  evaluateAlerts,
  getThresholds,
  getCooldownWindow,
  clearCooldowns,
};
