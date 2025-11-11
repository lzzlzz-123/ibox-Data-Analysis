const fs = require('fs');
const path = require('path');
const {
  sanitizeCollectionId,
  coerceNumber,
  parseCollectionMetadata,
  parseListingEvents,
  parsePurchaseEvents,
  parseCollectionSnapshot,
  normalizePayload,
  deduplicateEvents
} = require('../src/crawler/parsers');

describe('Crawler Parsers', () => {
  const fixturesPath = path.join(__dirname, '..', 'src', 'crawler', '__fixtures__');

  describe('sanitizeCollectionId', () => {
    test('should sanitize basic IDs', () => {
      expect(sanitizeCollectionId('My Collection_001')).toBe('my-collection_001');
      expect(sanitizeCollectionId('  TEST-ID  ')).toBe('test-id');
      expect(sanitizeCollectionId('Hello@World#123')).toBe('helloworld123');
    });

    test('should handle null/undefined', () => {
      expect(sanitizeCollectionId(null)).toBeNull();
      expect(sanitizeCollectionId(undefined)).toBeNull();
      expect(sanitizeCollectionId('')).toBeNull();
    });
  });

  describe('coerceNumber', () => {
    test('should coerce valid numbers', () => {
      expect(coerceNumber('123.45')).toBe(123.45);
      expect(coerceNumber(42)).toBe(42);
      expect(coerceNumber('0')).toBe(0);
    });

    test('should handle invalid values', () => {
      expect(coerceNumber('abc')).toBe(0);
      expect(coerceNumber('')).toBe(0);
      expect(coerceNumber(null)).toBe(0);
      expect(coerceNumber(undefined)).toBe(0);
      expect(coerceNumber(NaN)).toBe(0);
    });

    test('should use default value', () => {
      expect(coerceNumber('invalid', 99)).toBe(99);
      expect(coerceNumber(null, -1)).toBe(-1);
    });
  });

  describe('parseCollectionMetadata', () => {
    test('should parse valid collection metadata', () => {
      const rawData = JSON.parse(fs.readFileSync(path.join(fixturesPath, 'ibox-collection.json'), 'utf8'));
      const result = parseCollectionMetadata(rawData);

      expect(result).toMatchObject({
        collectionId: 'ibox-sample-001',
        name: 'iBox Digital Collectibles',
        description: 'A premium collection of digital art pieces from renowned artists',
        imageUrl: 'https://example.com/images/ibox-collection.jpg',
        externalUrl: 'https://ibox.example.com/collections/001',
        totalSupply: 10000,
        floorPrice: 0.5,
        volume24h: 1250.75,
        marketCap: 5000000,
        holdersCount: 3250
      });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test('should handle string JSON input', () => {
      const jsonString = '{"id": "test-123", "name": "Test Collection"}';
      const result = parseCollectionMetadata(jsonString);

      expect(result.collectionId).toBe('test-123');
      expect(result.name).toBe('Test Collection');
    });

    test('should return null for invalid input', () => {
      expect(parseCollectionMetadata(null)).toBeNull();
      expect(parseCollectionMetadata('invalid json')).toBeNull();
    });
  });

  describe('parseListingEvents', () => {
    test('should parse listing events with deduplication', () => {
      const rawData = JSON.parse(fs.readFileSync(path.join(fixturesPath, 'ibox-listings.json'), 'utf8'));
      const result = parseListingEvents(rawData, 'test-collection');

      // Should deduplicate the duplicate entry
      expect(result).toHaveLength(3);
      
      result.forEach(event => {
        expect(event).toMatchObject({
          collectionId: 'test-collection',
          marketplace: 'iBox'
        });
        expect(event.eventId).toBeTruthy();
        expect(event.tokenId).toBeTruthy();
        expect(event.seller).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(typeof event.price).toBe('number');
        expect(event.createdAt).toBeInstanceOf(Date);
      });
    });

    test('should handle empty or invalid input', () => {
      expect(parseListingEvents(null, 'test')).toEqual([]);
      expect(parseListingEvents([], 'test')).toEqual([]);
      expect(parseListingEvents('not an array', 'test')).toEqual([]);
    });

    test('should generate IDs for missing ones', () => {
      const events = [{ tokenId: 'token1', price: 1.0 }];
      const result = parseListingEvents(events, 'test');

      expect(result[0].eventId).toMatch(/^listing-\d+-[a-z0-9]+$/);
    });
  });

  describe('parsePurchaseEvents', () => {
    test('should parse purchase events with deduplication', () => {
      const rawData = JSON.parse(fs.readFileSync(path.join(fixturesPath, 'ibox-purchases.json'), 'utf8'));
      const result = parsePurchaseEvents(rawData, 'test-collection');

      // Should deduplicate the duplicate entry
      expect(result).toHaveLength(2);
      
      result.forEach(event => {
        expect(event).toMatchObject({
          collectionId: 'test-collection',
          marketplace: 'iBox'
        });
        expect(event.eventId).toBeTruthy();
        expect(event.tokenId).toBeTruthy();
        expect(event.buyer).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(event.seller).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(typeof event.price).toBe('number');
        expect(event.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(event.createdAt).toBeInstanceOf(Date);
      });
    });

    test('should handle empty or invalid input', () => {
      expect(parsePurchaseEvents(null, 'test')).toEqual([]);
      expect(parsePurchaseEvents([], 'test')).toEqual([]);
      expect(parsePurchaseEvents('not an array', 'test')).toEqual([]);
    });
  });

  describe('parseCollectionSnapshot', () => {
    test('should parse collection snapshot', () => {
      const rawData = JSON.parse(fs.readFileSync(path.join(fixturesPath, 'ibox-snapshot.json'), 'utf8'));
      const result = parseCollectionSnapshot(rawData, 'test-collection');

      expect(result).toMatchObject({
        collectionId: 'test-collection',
        totalListings: 156,
        floorPrice: 0.5,
        ceilingPrice: 2.5,
        averagePrice: 0.85,
        volume24h: 1250.75,
        marketCap: 5000000,
        holdersCount: 3250,
        uniqueOwners: 2850
      });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should return null for invalid input', () => {
      expect(parseCollectionSnapshot(null, 'test')).toBeNull();
      expect(parseCollectionSnapshot('invalid json', 'test')).toBeNull();
    });
  });

  describe('normalizePayload', () => {
    test('should normalize complete payload', () => {
      const metadata = JSON.parse(fs.readFileSync(path.join(fixturesPath, 'ibox-collection.json'), 'utf8'));
      const listings = JSON.parse(fs.readFileSync(path.join(fixturesPath, 'ibox-listings.json'), 'utf8'));
      const purchases = JSON.parse(fs.readFileSync(path.join(fixturesPath, 'ibox-purchases.json'), 'utf8'));
      const snapshot = JSON.parse(fs.readFileSync(path.join(fixturesPath, 'ibox-snapshot.json'), 'utf8'));

      const rawPayload = { metadata, listings, purchases, snapshot };
      const result = normalizePayload(rawPayload, 'ibox-sample-001');

      expect(result.collectionId).toBe('ibox-sample-001');
      expect(result.metadata).toBeTruthy();
      expect(result.snapshot).toBeTruthy();
      expect(result.listingEvents).toHaveLength(3); // deduplicated
      expect(result.purchaseEvents).toHaveLength(2); // deduplicated
      expect(result.errors).toHaveLength(0);
    });

    test('should handle missing components gracefully', () => {
      const result = normalizePayload({}, 'test-collection');

      expect(result.collectionId).toBe('test-collection');
      expect(result.metadata).toBeNull();
      expect(result.snapshot).toBeNull();
      expect(result.listingEvents).toEqual([]);
      expect(result.purchaseEvents).toEqual([]);
      expect(result.errors).toHaveLength(0);
    });

    test('should collect errors for invalid components', () => {
      const rawPayload = {
        metadata: 'invalid json',
        snapshot: null,
        listings: 'not an array'
      };

      const result = normalizePayload(rawPayload, 'test');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('metadata'))).toBe(true);
    });

    test('should handle invalid collectionId', () => {
      const result = normalizePayload({}, '');

      expect(result.errors).toContain('Missing or invalid collectionId');
    });
  });

  describe('deduplicateEvents', () => {
    test('should deduplicate events by key', () => {
      const events = [
        { eventId: 'event1', collectionId: 'col1', tokenId: 'token1', createdAt: new Date('2024-01-01') },
        { eventId: 'event1', collectionId: 'col1', tokenId: 'token1', createdAt: new Date('2024-01-01') }, // duplicate
        { eventId: 'event2', collectionId: 'col1', tokenId: 'token2', createdAt: new Date('2024-01-01') }
      ];

      const result = deduplicateEvents(events, 'listing');

      expect(result).toHaveLength(2);
      expect(result.map(e => e.eventId)).toEqual(['event1', 'event2']);
    });

    test('should handle empty array', () => {
      expect(deduplicateEvents([], 'listing')).toEqual([]);
    });
  });
});