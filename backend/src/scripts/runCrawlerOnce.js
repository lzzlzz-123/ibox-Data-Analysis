#!/usr/bin/env node

require('dotenv').config();
const Crawler = require('../crawler');

/**
 * CLI script to run crawler once and output results
 */
async function runCrawlerOnce() {
  try {
    console.log('🕷️  Starting crawler execution...\n');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {
      collectionIds: [],
      verbose: false,
      outputFormat: 'summary' // 'summary' or 'full'
    };

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--collections' || arg === '-c') {
        const collections = args[++i];
        if (collections) {
          options.collectionIds = collections.split(',').map(id => id.trim());
        }
      } else if (arg === '--verbose' || arg === '-v') {
        options.verbose = true;
      } else if (arg === '--output' || arg === '-o') {
        const format = args[++i];
        if (['summary', 'full'].includes(format)) {
          options.outputFormat = format;
        }
      } else if (arg === '--help' || arg === '-h') {
        console.log(`
Usage: node runCrawlerOnce.js [options]

Options:
  -c, --collections <ids>    Comma-separated list of collection IDs to crawl
  -v, --verbose              Enable verbose logging
  -o, --output <format>      Output format: 'summary' (default) or 'full'
  -h, --help                 Show this help message

Environment Variables:
  CRAWLER_BASE_URL           Base URL for API endpoints
  CRAWLER_TARGETS            JSON string of custom targets configuration
  CRAWLER_DELAY_MS           Delay between requests in milliseconds
  CRAWLER_REQUESTS_PER_SECOND  Max requests per second per target
  CRAWLER_TIMEOUT_MS         Request timeout in milliseconds
  CRAWLER_RETRIES            Number of retry attempts
  CRAWLER_CONCURRENCY        Max concurrent requests

Examples:
  node runCrawlerOnce.js
  node runCrawlerOnce.js -c collection1,collection2 -v
  node runCrawlerOnce.js --output full
        `);
        process.exit(0);
      }
    }

    // Initialize crawler
    const crawler = new Crawler();

    // Run crawler
    let result;
    if (options.collectionIds.length > 0) {
      console.log(`🎯 Running crawler for specific collections: ${options.collectionIds.join(', ')}`);
      result = await crawler.runCollections(options.collectionIds);
    } else {
      console.log('🌐 Running crawler for all configured targets...');
      result = await crawler.runAll();
    }

    // Output results
    console.log('\n📊 RESULTS:');
    console.log('=' .repeat(50));

    if (result.success) {
      console.log('✅ Crawler completed successfully!');
    } else {
      console.log('❌ Crawler completed with errors!');
    }

    const metrics = result.metrics || {};
    
    if (metrics.totalTargets) {
      console.log(`\n📈 Summary Metrics:`);
      console.log(`   Duration: ${metrics.endTime - metrics.startTime}ms`);
      console.log(`   Targets: ${metrics.successfulTargets}/${metrics.totalTargets} successful`);
      console.log(`   Requests: ${metrics.totalRequests}`);
      console.log(`   Listings found: ${metrics.totalListings}`);
      console.log(`   Purchases found: ${metrics.totalPurchases}`);
      
      if (metrics.errors && metrics.errors.length > 0) {
        console.log(`   Errors: ${metrics.errors.length}`);
      }
    }

    // Show detailed results if requested
    if (options.outputFormat === 'full' && result.results) {
      console.log('\n🔍 Detailed Results:');
      console.log('-'.repeat(50));
      
      result.results.forEach((item, index) => {
        const targetId = item.targetId || item.collectionId;
        console.log(`\n${index + 1}. ${targetId}`);
        
        if (item.success) {
          console.log(`   ✅ Success (${item.duration}ms)`);
          
          if (item.payload) {
            console.log(`   📦 Listings: ${item.payload.listingEvents.length}`);
            console.log(`   💰 Purchases: ${item.payload.purchaseEvents.length}`);
            
            if (item.payload.metadata) {
              console.log(`   📋 Collection: ${item.payload.metadata.name}`);
            }
            
            if (item.payload.snapshot) {
              console.log(`   📊 Floor Price: ${item.payload.snapshot.floorPrice}`);
            }
          }
        } else {
          console.log(`   ❌ Failed`);
          if (item.errors && item.errors.length > 0) {
            item.errors.forEach(error => {
              console.log(`      • ${error}`);
            });
          }
        }
      });
    }

    // Show errors if any
    if (metrics.errors && metrics.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      console.log('-'.repeat(50));
      metrics.errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      
      if (metrics.errors.length > 10) {
        console.log(`... and ${metrics.errors.length - 10} more errors`);
      }
    }

    // Show request stats if verbose
    if (options.verbose && metrics.requestStats) {
      console.log('\n🔧 Request Statistics:');
      console.log('-'.repeat(50));
      console.log(`   Active requests: ${metrics.requestStats.activeRequests}`);
      console.log(`   Pending requests: ${metrics.requestStats.pendingRequests}`);
      
      if (metrics.requestStats.requestCounts) {
        console.log('   Request counts per target:');
        Object.entries(metrics.requestStats.requestCounts).forEach(([target, count]) => {
          console.log(`     ${target}: ${count}`);
        });
      }
    }

    console.log('\n🏁 Crawler execution finished.\n');

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Fatal error during crawler execution:');
    console.error(error.message);
    
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  runCrawlerOnce();
}

module.exports = runCrawlerOnce;