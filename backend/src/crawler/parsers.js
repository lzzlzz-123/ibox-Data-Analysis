/**
 * Parsing utilities for transforming raw HTML/JSON into normalized structures
 */

/**
 * Sanitize collection ID
 */
function sanitizeCollectionId(id) {
  if (!id) return null;
  return String(id).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
}

/**
 * Coerce number values safely
 */
function coerceNumber(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse collection metadata
 */
function parseCollectionMetadata(rawData) {
  if (!rawData) return null;

  try {
    // Handle both JSON and HTML-like structures
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

    return {
      collectionId: sanitizeCollectionId(data.id || data.collectionId),
      name: data.name || data.title || 'Unknown Collection',
      description: data.description || '',
      imageUrl: data.imageUrl || data.image || null,
      externalUrl: data.externalUrl || data.url || null,
      totalSupply: coerceNumber(data.totalSupply, data.supply),
      floorPrice: coerceNumber(data.floorPrice),
      volume24h: coerceNumber(data.volume24h, data.volume),
      marketCap: coerceNumber(data.marketCap),
      holdersCount: coerceNumber(data.holdersCount, data.holders),
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: new Date()
    };
  } catch (error) {
    console.warn('Failed to parse collection metadata:', error.message);
    return null;
  }
}

/**
 * Parse listing events
 */
function parseListingEvents(rawData, collectionId) {
  if (!rawData || !Array.isArray(rawData)) return [];

  const seen = new Set();
  const events = [];

  rawData.forEach(item => {
    try {
      const data = typeof item === 'string' ? JSON.parse(item) : item;
      
      // Create unique identifier for deduplication
      const uniqueId = `${data.id || data.listingId || ''}-${data.timestamp || Date.now()}`;
      if (seen.has(uniqueId)) return;
      seen.add(uniqueId);

      const event = {
        eventId: sanitizeCollectionId(data.id || data.listingId) || `listing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        collectionId: sanitizeCollectionId(collectionId),
        tokenId: sanitizeCollectionId(data.tokenId || data.token),
        seller: data.seller || data.sellerAddress || null,
        price: coerceNumber(data.price),
        marketplace: data.marketplace || 'unknown',
        createdAt: data.timestamp ? new Date(data.timestamp) : new Date()
      };

      events.push(event);
    } catch (error) {
      console.warn('Failed to parse listing event:', error.message);
    }
  });

  return events;
}

/**
 * Parse purchase events
 */
function parsePurchaseEvents(rawData, collectionId) {
  if (!rawData || !Array.isArray(rawData)) return [];

  const seen = new Set();
  const events = [];

  rawData.forEach(item => {
    try {
      const data = typeof item === 'string' ? JSON.parse(item) : item;
      
      // Create unique identifier for deduplication
      const uniqueId = `${data.id || data.purchaseId || data.txHash || ''}-${data.timestamp || Date.now()}`;
      if (seen.has(uniqueId)) return;
      seen.add(uniqueId);

      const event = {
        eventId: sanitizeCollectionId(data.id || data.purchaseId || data.txHash) || `purchase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        collectionId: sanitizeCollectionId(collectionId),
        tokenId: sanitizeCollectionId(data.tokenId || data.token),
        buyer: data.buyer || data.buyerAddress || null,
        seller: data.seller || data.sellerAddress || null,
        price: coerceNumber(data.price),
        marketplace: data.marketplace || 'unknown',
        transactionHash: data.txHash || data.transactionHash || null,
        createdAt: data.timestamp ? new Date(data.timestamp) : new Date()
      };

      events.push(event);
    } catch (error) {
      console.warn('Failed to parse purchase event:', error.message);
    }
  });

  return events;
}

/**
 * Parse collection snapshot
 */
function parseCollectionSnapshot(rawData, collectionId) {
  if (!rawData) return null;

  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

    return {
      collectionId: sanitizeCollectionId(collectionId),
      totalListings: coerceNumber(data.totalListings, data.listingsCount),
      floorPrice: coerceNumber(data.floorPrice),
      ceilingPrice: coerceNumber(data.ceilingPrice),
      averagePrice: coerceNumber(data.averagePrice, data.avgPrice),
      volume24h: coerceNumber(data.volume24h, data.volume),
      marketCap: coerceNumber(data.marketCap),
      holdersCount: coerceNumber(data.holdersCount, data.holders),
      uniqueOwners: coerceNumber(data.uniqueOwners, data.owners),
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
    };
  } catch (error) {
    console.warn('Failed to parse collection snapshot:', error.message);
    return null;
  }
}

/**
 * Normalize and validate complete payload
 */
function normalizePayload(rawPayload, collectionId) {
  const normalized = {
    collectionId: sanitizeCollectionId(collectionId),
    metadata: null,
    snapshot: null,
    listingEvents: [],
    purchaseEvents: [],
    errors: []
  };

  try {
    // Parse each component
    if (rawPayload.metadata) {
      normalized.metadata = parseCollectionMetadata(rawPayload.metadata);
      if (!normalized.metadata) {
        normalized.errors.push('Failed to parse metadata');
      }
    }

    if (rawPayload.snapshot) {
      normalized.snapshot = parseCollectionSnapshot(rawPayload.snapshot, collectionId);
      if (!normalized.snapshot) {
        normalized.errors.push('Failed to parse snapshot');
      }
    }

    if (rawPayload.listings) {
      normalized.listingEvents = parseListingEvents(rawPayload.listings, collectionId);
    }

    if (rawPayload.purchases) {
      normalized.purchaseEvents = parsePurchaseEvents(rawPayload.purchases, collectionId);
    }

    // Validate required fields
    if (!normalized.collectionId) {
      normalized.errors.push('Missing or invalid collectionId');
    }

  } catch (error) {
    normalized.errors.push(`Normalization error: ${error.message}`);
  }

  return normalized;
}

/**
 * Deduplicate events across multiple payloads
 */
function deduplicateEvents(allEvents, type = 'listing') {
  const seen = new Set();
  const deduped = [];

  allEvents.forEach(event => {
    const key = `${event.eventId}-${event.collectionId}-${event.tokenId}-${event.createdAt.getTime()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(event);
    }
  });

  return deduped;
}

module.exports = {
  sanitizeCollectionId,
  coerceNumber,
  parseCollectionMetadata,
  parseListingEvents,
  parsePurchaseEvents,
  parseCollectionSnapshot,
  normalizePayload,
  deduplicateEvents
};