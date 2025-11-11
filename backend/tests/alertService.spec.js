const {
  evaluateAlerts,
  getThresholds,
  getCooldownWindow,
  clearCooldowns,
} = require('../src/services/alertService');

describe('AlertService', () => {
  const mockRepository = {
    create: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearCooldowns();
    mockRepository.create.mockResolvedValue({
      id: '1',
      collectionId: 'col-1',
      type: 'price_drop',
      severity: 'warning',
      message: 'Price dropped 15% in 24h',
      triggeredAt: new Date().toISOString(),
    });

    process.env.ALERT_PRICE_DROP_PERCENT = '10';
    process.env.ALERT_VOLUME_SPIKE_PERCENT = '50';
    process.env.ALERT_LISTING_DEPLETION_PERCENT = '30';
    process.env.ALERT_COOLDOWN_MINUTES = '60';
  });

  describe('evaluateAlerts - Price Drop', () => {
    it('should trigger price drop alert when threshold is exceeded', async () => {
      const analytics = {
        collectionId: 'col-1',
        priceChange24h: -15,
        volumeChange24h: 0,
      };

      const alerts = await evaluateAlerts(analytics, mockRepository);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('price_drop');
      expect(alerts[0].severity).toBe('warning');
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should not trigger price drop alert when threshold is not exceeded', async () => {
      const analytics = {
        collectionId: 'col-1',
        priceChange24h: -5,
        volumeChange24h: 0,
      };

      const alerts = await evaluateAlerts(analytics, mockRepository);

      expect(alerts).toHaveLength(0);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should handle undefined price change', async () => {
      const analytics = {
        collectionId: 'col-1',
        priceChange24h: undefined,
        volumeChange24h: 0,
      };

      const alerts = await evaluateAlerts(analytics, mockRepository);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('evaluateAlerts - Volume Spike', () => {
    it('should trigger volume spike alert when threshold is exceeded', async () => {
      const analytics = {
        collectionId: 'col-1',
        priceChange24h: 0,
        volumeChange24h: 75,
      };

      const alerts = await evaluateAlerts(analytics, mockRepository);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('volume_spike');
      expect(alerts[0].severity).toBe('info');
    });

    it('should not trigger volume spike alert when threshold is not exceeded', async () => {
      const analytics = {
        collectionId: 'col-1',
        priceChange24h: 0,
        volumeChange24h: 30,
      };

      const alerts = await evaluateAlerts(analytics, mockRepository);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('evaluateAlerts - Listing Depletion', () => {
    it('should trigger listing depletion alert when threshold is exceeded', async () => {
      const analytics = {
        collectionId: 'col-1',
        priceChange24h: 0,
        volumeChange24h: 0,
        listingCount: 50,
        previousListingCount: 100,
      };

      const alerts = await evaluateAlerts(analytics, mockRepository);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('listing_depletion');
      expect(alerts[0].severity).toBe('critical');
    });

    it('should not trigger listing depletion alert when threshold is not exceeded', async () => {
      const analytics = {
        collectionId: 'col-1',
        priceChange24h: 0,
        volumeChange24h: 0,
        listingCount: 75,
        previousListingCount: 100,
      };

      const alerts = await evaluateAlerts(analytics, mockRepository);

      expect(alerts).toHaveLength(0);
    });
  });

  describe('Cooldown Enforcement', () => {
    it('should enforce cooldown for duplicate alerts', async () => {
      const analytics = {
        collectionId: 'col-1',
        priceChange24h: -15,
        volumeChange24h: 0,
      };

      const firstRun = await evaluateAlerts(analytics, mockRepository);
      expect(firstRun).toHaveLength(1);
      expect(mockRepository.create).toHaveBeenCalledTimes(1);

      const secondRun = await evaluateAlerts(analytics, mockRepository);
      expect(secondRun).toHaveLength(0);
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should allow alert after cooldown expires', async () => {
      process.env.ALERT_COOLDOWN_MINUTES = '0.01';
      clearCooldowns();

      const analytics = {
        collectionId: 'col-1',
        priceChange24h: -15,
        volumeChange24h: 0,
      };

      const firstRun = await evaluateAlerts(analytics, mockRepository);
      expect(firstRun).toHaveLength(1);

      await new Promise((resolve) => setTimeout(resolve, 700));

      const secondRun = await evaluateAlerts(analytics, mockRepository);
      expect(secondRun).toHaveLength(1);
      expect(mockRepository.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing collection ID gracefully', async () => {
      const analytics = {
        priceChange24h: -15,
        volumeChange24h: 0,
      };

      const alerts = await evaluateAlerts(analytics, mockRepository);

      expect(alerts).toHaveLength(0);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      mockRepository.create.mockRejectedValueOnce(new Error('Database error'));

      const analytics = {
        collectionId: 'col-1',
        priceChange24h: -15,
        volumeChange24h: 0,
      };

      const alerts = await evaluateAlerts(analytics, mockRepository);

      expect(alerts).toHaveLength(1);
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should handle null analytics', async () => {
      const alerts = await evaluateAlerts(null, mockRepository);

      expect(alerts).toHaveLength(0);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Alerts', () => {
    it('should trigger multiple alerts simultaneously', async () => {
      const analytics = {
        collectionId: 'col-1',
        priceChange24h: -15,
        volumeChange24h: 75,
        listingCount: 50,
        previousListingCount: 100,
      };

      const alerts = await evaluateAlerts(analytics, mockRepository);

      expect(alerts).toHaveLength(3);
      expect(alerts.some((a) => a.type === 'price_drop')).toBe(true);
      expect(alerts.some((a) => a.type === 'volume_spike')).toBe(true);
      expect(alerts.some((a) => a.type === 'listing_depletion')).toBe(true);
      expect(mockRepository.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('Thresholds', () => {
    it('should return current thresholds', () => {
      const thresholds = getThresholds();

      expect(thresholds.priceDrop).toBe(10);
      expect(thresholds.volumeSpike).toBe(50);
      expect(thresholds.listingDepletion).toBe(30);
    });

    it('should return cooldown window', () => {
      const cooldown = getCooldownWindow();

      expect(cooldown).toBe(60 * 60 * 1000);
    });
  });
});
