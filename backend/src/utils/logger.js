function formatLog(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const context = Object.keys(data).length > 0 ? JSON.stringify(data) : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${message} ${context}`.trim();
}

const logger = {
  info(message, data) {
    console.log(formatLog('info', message, data));
  },

  warn(message, data) {
    console.warn(formatLog('warn', message, data));
  },

  error(message, data) {
    console.error(formatLog('error', message, data));
  },

  debug(message, data) {
    if (process.env.DEBUG === 'true') {
      console.log(formatLog('debug', message, data));
    }
  },
};

module.exports = logger;
