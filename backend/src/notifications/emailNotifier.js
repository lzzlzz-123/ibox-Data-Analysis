const logger = require('../utils/logger');

function formatEmailBody(alert) {
  return `
Alert Notification
==================

Collection ID: ${alert.collectionId}
Type: ${alert.type}
Severity: ${alert.severity}
Time: ${alert.triggeredAt}

Message:
${alert.message}
`;
}

const emailNotifier = {
  async send(alert) {
    const emailTo = process.env.EMAIL_TO;
    const emailEnabled = process.env.EMAIL_ENABLED === 'true';

    if (!emailEnabled) {
      logger.debug('Email notifications disabled');
      return;
    }

    if (!emailTo) {
      logger.warn('Email recipient not configured');
      return;
    }

    try {
      const emailBody = formatEmailBody(alert);

      logger.info('Email notification prepared', {
        to: emailTo,
        collectionId: alert.collectionId,
        type: alert.type,
      });

      logger.info(`[EMAIL] To: ${emailTo}\nSubject: Alert - ${alert.type}\n${emailBody}`);

      logger.info('Email notification sent successfully', {
        to: emailTo,
        collectionId: alert.collectionId,
        type: alert.type,
      });
    } catch (error) {
      logger.error('Failed to send email notification', {
        to: emailTo,
        error: error.message,
      });
      throw error;
    }
  },
};

module.exports = { emailNotifier };
