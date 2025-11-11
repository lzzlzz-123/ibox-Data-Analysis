jest.mock('axios');

const axios = require('axios');
const { webhookNotifier } = require('../src/notifications/webhookNotifier');

describe('WebhookNotifier', () => {
  const mockAlert = {
    id: '1',
    collectionId: 'col-1',
    type: 'price_drop',
    severity: 'warning',
    message: 'Price dropped 15% in 24h',
    triggeredAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WEBHOOK_URL = 'https://webhook.example.com/alerts';
    process.env.WEBHOOK_MAX_RETRIES = '3';
    process.env.WEBHOOK_BACKOFF_MS = '100';
  });

  afterEach(() => {
    delete process.env.WEBHOOK_URL;
  });

  describe('send', () => {
    it('should send webhook notification successfully', async () => {
      axios.post.mockResolvedValueOnce({ status: 200 });

      await webhookNotifier.send(mockAlert);

      expect(axios.post).toHaveBeenCalledWith(
        'https://webhook.example.com/alerts',
        expect.objectContaining({
          collectionId: mockAlert.collectionId,
          type: mockAlert.type,
          severity: mockAlert.severity,
          message: mockAlert.message,
          triggeredAt: mockAlert.triggeredAt,
        }),
        expect.any(Object)
      );
    });

    it('should format alert payload correctly', async () => {
      axios.post.mockResolvedValueOnce({ status: 200 });

      await webhookNotifier.send(mockAlert);

      const payload = axios.post.mock.calls[0][1];
      expect(payload).toEqual({
        collectionId: 'col-1',
        type: 'price_drop',
        severity: 'warning',
        message: 'Price dropped 15% in 24h',
        triggeredAt: expect.any(String),
      });
    });

    it('should skip webhook when URL is not configured', async () => {
      delete process.env.WEBHOOK_URL;

      await webhookNotifier.send(mockAlert);

      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      process.env.WEBHOOK_MAX_RETRIES = '1';
      process.env.WEBHOOK_BACKOFF_MS = '10';
      axios.post.mockRejectedValueOnce(new Error('Network error'));
      axios.post.mockResolvedValueOnce({ status: 200 });

      await webhookNotifier.send(mockAlert);

      expect(axios.post).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should send with correct headers', async () => {
      axios.post.mockResolvedValueOnce({ status: 200 });

      await webhookNotifier.send(mockAlert);

      const config = axios.post.mock.calls[0][2];
      expect(config).toEqual(
        expect.objectContaining({
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });
  });
});
