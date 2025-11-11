const { loadCrawlerConfig } = require('./targets');
const RequestHandler = require('./request');
const { normalizePayload, deduplicateEvents } = require('./parsers');

/**
 * Main crawler orchestrator
 */
class Crawler {
  constructor(config = null) {
    this.config = config || loadCrawlerConfig();
    this.requestHandler = new RequestHandler(this.config);
    this.metrics = {
      startTime: null,
      endTime: null,
      totalTargets: 0,
      successfulTargets: 0,
      failedTargets: 0,
      totalRequests: 0,
      totalListings: 0,
      totalPurchases: 0,
      errors: []
    };
  }

  /**
   * Run crawler against all configured targets
   */
  async runAll(options = {}) {
    this.metrics.startTime = new Date();
    this.metrics.totalTargets = this.config.targets.length;

    if (this.config.global.enableLogging) {
      console.log(`Starting crawler for ${this.metrics.totalTargets} targets...`);
    }

    const results = [];

    for (const target of this.config.targets) {
      try {
        const result = await this.runTarget(target, options);
        results.push(result);
        
        if (result.success) {
          this.metrics.successfulTargets++;
          this.metrics.totalListings += result.payload.listingEvents.length;
          this.metrics.totalPurchases += result.payload.purchaseEvents.length;
        } else {
          this.metrics.failedTargets++;
          this.metrics.errors.push(...result.errors);
        }
      } catch (error) {
        const errorResult = {
          targetId: target.id,
          success: false,
          errors: [`Target execution failed: ${error.message}`],
          payload: null
        };
        results.push(errorResult);
        this.metrics.failedTargets++;
        this.metrics.errors.push(errorResult.errors[0]);
      }
    }

    this.metrics.endTime = new Date();
    this.logSummary();

    return {
      success: this.metrics.failedTargets === 0,
      metrics: this.metrics,
      results
    };
  }

  /**
   * Run crawler for a specific target
   */
  async runTarget(target, options = {}) {
    const collectionId = options.collectionId || target.id;
    const startTime = Date.now();

    try {
      if (this.config.global.enableLogging) {
        console.log(`Processing target: ${target.name || target.id}`);
      }

      // Build request endpoints
      const endpoints = {
        collection: target.endpoints.collection.replace('{collectionId}', collectionId),
        listings: target.endpoints.listings.replace('{collectionId}', collectionId),
        purchases: target.endpoints.purchases.replace('{collectionId}', collectionId),
        snapshot: target.endpoints.snapshot.replace('{collectionId}', collectionId)
      };

      // Make requests concurrently
      const requests = [
        { target, endpoint: endpoints.collection },
        { target, endpoint: endpoints.listings },
        { target, endpoint: endpoints.purchases },
        { target, endpoint: endpoints.snapshot }
      ].filter(req => options.skipEndpoints ? !options.skipEndpoints.includes(req.endpoint) : true);

      const responses = await this.requestHandler.makeMultipleRequests(requests);
      this.metrics.totalRequests += requests.length;

      // Process responses
      const [collectionResponse, listingsResponse, purchasesResponse, snapshotResponse] = responses;
      
      const rawPayload = {
        metadata: collectionResponse.status === 'fulfilled' ? collectionResponse.value : null,
        listings: listingsResponse.status === 'fulfilled' ? listingsResponse.value : [],
        purchases: purchasesResponse.status === 'fulfilled' ? purchasesResponse.value : [],
        snapshot: snapshotResponse.status === 'fulfilled' ? snapshotResponse.value : null
      };

      // Collect errors
      const errors = [];
      if (collectionResponse.status === 'rejected') errors.push(`Collection request failed: ${collectionResponse.reason.message}`);
      if (listingsResponse.status === 'rejected') errors.push(`Listings request failed: ${listingsResponse.reason.message}`);
      if (purchasesResponse.status === 'rejected') errors.push(`Purchases request failed: ${purchasesResponse.reason.message}`);
      if (snapshotResponse.status === 'rejected') errors.push(`Snapshot request failed: ${snapshotResponse.reason.message}`);

      // Normalize payload
      const payload = normalizePayload(rawPayload, collectionId);
      errors.push(...payload.errors);

      const duration = Date.now() - startTime;
      
      if (this.config.global.enableLogging) {
        console.log(`Target ${target.id} completed in ${duration}ms - ${payload.listingEvents.length} listings, ${payload.purchaseEvents.length} purchases`);
      }

      return {
        targetId: target.id,
        success: errors.length === 0,
        errors,
        payload,
        duration,
        requestStats: this.requestHandler.getStats()
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (this.config.global.enableLogging) {
        console.error(`Target ${target.id} failed after ${duration}ms:`, error.message);
      }

      return {
        targetId: target.id,
        success: false,
        errors: [error.message],
        payload: null,
        duration,
        requestStats: this.requestHandler.getStats()
      };
    }
  }

  /**
   * Run crawler for specific collection IDs
   */
  async runCollections(collectionIds, options = {}) {
    const results = [];
    
    for (const collectionId of collectionIds) {
      // Find matching target or use first available
      const target = this.config.targets.find(t => t.id === collectionId) || this.config.targets[0];
      if (!target) {
        results.push({
          collectionId,
          success: false,
          errors: ['No matching target found'],
          payload: null
        });
        continue;
      }

      try {
        const result = await this.runTarget(target, { ...options, collectionId });
        results.push({
          collectionId,
          ...result
        });
      } catch (error) {
        results.push({
          collectionId,
          success: false,
          errors: [error.message],
          payload: null
        });
      }
    }

    return {
      success: results.every(r => r.success),
      results,
      collectionIds
    };
  }

  /**
   * Get crawler metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      requestStats: this.requestHandler.getStats()
    };
  }

  /**
   * Reset crawler metrics
   */
  resetMetrics() {
    this.metrics = {
      startTime: null,
      endTime: null,
      totalTargets: 0,
      successfulTargets: 0,
      failedTargets: 0,
      totalRequests: 0,
      totalListings: 0,
      totalPurchases: 0,
      errors: []
    };
    this.requestHandler.resetStats();
  }

  /**
   * Log execution summary
   */
  logSummary() {
    if (!this.config.global.enableLogging) return;

    const duration = this.metrics.endTime - this.metrics.startTime;
    console.log('\n=== Crawler Execution Summary ===');
    console.log(`Duration: ${duration}ms`);
    console.log(`Targets: ${this.metrics.successfulTargets}/${this.metrics.totalTargets} successful`);
    console.log(`Requests: ${this.metrics.totalRequests}`);
    console.log(`Listings found: ${this.metrics.totalListings}`);
    console.log(`Purchases found: ${this.metrics.totalPurchases}`);
    
    if (this.metrics.errors.length > 0) {
      console.log(`Errors: ${this.metrics.errors.length}`);
      this.metrics.errors.slice(0, 5).forEach(error => {
        console.log(`  - ${error}`);
      });
      if (this.metrics.errors.length > 5) {
        console.log(`  ... and ${this.metrics.errors.length - 5} more`);
      }
    }
    console.log('===============================\n');
  }
}

module.exports = Crawler;