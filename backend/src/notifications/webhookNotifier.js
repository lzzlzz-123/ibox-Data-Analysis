const axios = require('axios');
const logger = require('../utils/logger');

const MAX_RETRIES = parseInt(process.env.WEBHOOK_MAX_RETRIES || 3, 10);
const INITIAL_BACKOFF_MS = parseInt(process.env.WEBHOOK_BACKOFF_MS || 1000, 10);

function formatAlertPayload(alert) {
  return {
    collectionId: alert.collectionId,
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    triggeredAt: alert.triggeredAt,
  };
}

async function sendWithRetry(url, payload, retries = 0) {
  try {
    await axios.post(url, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info('Webhook notification sent successfully', {
      collectionId: payload.collectionId,
      type: payload.type,
      url,
    });
  } catch (error) {
    if (retries < MAX_RETRIES) {
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retries);
      logger.warn(`Webhook request failed, retrying in ${backoffMs}ms`, {
        collectionId: payload.collectionId,
        type: payload.type,
        attempt: retries + 1,
        error: error.message,
      });

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return sendWithRetry(url, payload, retries + 1);
    }

    logger.error('Webhook notification failed after retries', {
      collectionId: payload.collectionId,
      type: payload.type,
      url,
      error: error.message,
      retries: MAX_RETRIES,
    });

    throw error;
  }
}

const webhookNotifier = {
  async send(alert) {
    const webhookUrl = process.env.WEBHOOK_URL;

    if (!webhookUrl) {
      logger.warn('Webhook URL not configured');
      return;
    }

    const payload = formatAlertPayload(alert);

    try {
      await sendWithRetry(webhookUrl, payload);
    } catch (error) {
      logger.error('Failed to send webhook notification', {
        error: error.message,
        alert,
      });
      throw error;
    }
  },
};

module.exports = { webhookNotifier };
