const path = require('path');

/**
 * Default crawler configuration
 * Can be overridden by environment variables
 */
const defaultConfig = {
  targets: [
    {
      id: 'ibox-sample',
      name: 'iBox Sample Collection',
      enabled: true,
      baseUrl: 'https://api.example.com',
      rateLimit: {
        requestsPerSecond: 2,
        delayBetweenRequests: 500
      },
      selectors: {
        collection: '.collection-data',
        listings: '.listing-item',
        purchases: '.purchase-item',
        snapshot: '.snapshot-data'
      },
      endpoints: {
        collection: '/collection/{collectionId}',
        listings: '/collection/{collectionId}/listings',
        purchases: '/collection/{collectionId}/purchases',
        snapshot: '/collection/{collectionId}/snapshot'
      },
      headers: {
        'User-Agent': 'Collections-Dashboard-Crawler/1.0',
        'Accept': 'application/json'
      }
    }
  ],
  global: {
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    concurrency: 3,
    enableLogging: true
  }
};

/**
 * Load crawler configuration with environment variable overrides
 */
function loadCrawlerConfig() {
  const config = JSON.parse(JSON.stringify(defaultConfig)); // Deep clone

  // Override with environment variables
  if (process.env.CRAWLER_BASE_URL) {
    config.targets.forEach(target => {
      target.baseUrl = process.env.CRAWLER_BASE_URL;
    });
  }

  if (process.env.CRAWLER_TARGETS) {
    try {
      const customTargets = JSON.parse(process.env.CRAWLER_TARGETS);
      config.targets = customTargets;
    } catch (error) {
      console.warn('Invalid CRAWLER_TARGETS JSON, using defaults:', error.message);
    }
  }

  if (process.env.CRAWLER_DELAY_MS) {
    const delay = parseInt(process.env.CRAWLER_DELAY_MS, 10);
    if (!isNaN(delay) && delay > 0) {
      config.targets.forEach(target => {
        target.rateLimit.delayBetweenRequests = delay;
      });
    }
  }

  if (process.env.CRAWLER_REQUESTS_PER_SECOND) {
    const rps = parseInt(process.env.CRAWLER_REQUESTS_PER_SECOND, 10);
    if (!isNaN(rps) && rps > 0) {
      config.targets.forEach(target => {
        target.rateLimit.requestsPerSecond = rps;
      });
    }
  }

  if (process.env.CRAWLER_TIMEOUT_MS) {
    const timeout = parseInt(process.env.CRAWLER_TIMEOUT_MS, 10);
    if (!isNaN(timeout) && timeout > 0) {
      config.global.timeout = timeout;
    }
  }

  if (process.env.CRAWLER_RETRIES) {
    const retries = parseInt(process.env.CRAWLER_RETRIES, 10);
    if (!isNaN(retries) && retries >= 0) {
      config.global.retries = retries;
    }
  }

  if (process.env.CRAWLER_CONCURRENCY) {
    const concurrency = parseInt(process.env.CRAWLER_CONCURRENCY, 10);
    if (!isNaN(concurrency) && concurrency > 0) {
      config.global.concurrency = concurrency;
    }
  }

  // Filter enabled targets only
  config.targets = config.targets.filter(target => target.enabled !== false);

  return config;
}

module.exports = {
  loadCrawlerConfig,
  defaultConfig
};