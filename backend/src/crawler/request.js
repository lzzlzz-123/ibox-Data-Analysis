const axios = require('axios');
const { default: pLimit } = require('p-limit');

/**
 * HTTP request handler with retry logic and rate limiting
 */
class RequestHandler {
  constructor(config) {
    this.config = config;
    this.concurrencyLimit = pLimit(config.global.concurrency);
    this.requestCounts = new Map(); // Track requests per target for rate limiting
  }

  /**
   * Make HTTP request with retry logic and rate limiting
   */
  async makeRequest(target, endpoint, options = {}) {
    const targetKey = target.id;
    const url = this.buildUrl(target.baseUrl, endpoint);
    
    // Apply rate limiting
    await this.applyRateLimit(target);

    const requestConfig = {
      timeout: this.config.global.timeout,
      headers: {
        ...target.headers,
        ...options.headers
      },
      ...options
    };

    return this.concurrencyLimit(async () => {
      return this.withRetry(targetKey, async () => {
        try {
          const response = await axios.get(url, requestConfig);
          return response.data;
        } catch (error) {
          if (error.response) {
            // HTTP error response
            throw new Error(`HTTP ${error.response.status} for ${url}: ${error.response.statusText}`);
          } else if (error.request) {
            // Network error
            throw new Error(`Network error for ${url}: ${error.message}`);
          } else {
            // Other error
            throw error;
          }
        }
      });
    });
  }

  /**
   * Make multiple requests concurrently with controlled concurrency
   */
  async makeMultipleRequests(requests) {
    const promises = requests.map(({ target, endpoint, options }) =>
      this.makeRequest(target, endpoint, options)
    );
    
    return Promise.allSettled(promises);
  }

  /**
   * Apply rate limiting delay between requests
   */
  async applyRateLimit(target) {
    const now = Date.now();
    const lastRequest = this.requestCounts.get(target.id) || 0;
    const timeSinceLastRequest = now - lastRequest;
    const minDelay = 1000 / target.rateLimit.requestsPerSecond;

    if (timeSinceLastRequest < minDelay) {
      const delay = minDelay - timeSinceLastRequest;
      await this.sleep(delay);
    }

    // Also apply configured delay between requests
    if (target.rateLimit.delayBetweenRequests > 0) {
      await this.sleep(target.rateLimit.delayBetweenRequests);
    }

    this.requestCounts.set(target.id, Date.now());
  }

  /**
   * Execute operation with retry logic
   */
  async withRetry(targetKey, operation) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.global.retries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt <= this.config.global.retries) {
          const delay = this.config.global.retryDelay * Math.pow(2, attempt - 1);
          if (this.config.global.enableLogging) {
            console.warn(`Attempt ${attempt} failed for ${targetKey}, retrying in ${delay}ms:`, error.message);
          }
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Build URL from base and endpoint
   */
  buildUrl(baseUrl, endpoint) {
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${cleanBaseUrl}${cleanEndpoint}`;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get request statistics
   */
  getStats() {
    return {
      activeRequests: this.concurrencyLimit.activeCount,
      pendingRequests: this.concurrencyLimit.pendingCount,
      requestCounts: Object.fromEntries(this.requestCounts)
    };
  }

  /**
   * Reset request counters
   */
  resetStats() {
    this.requestCounts.clear();
  }
}

module.exports = RequestHandler;