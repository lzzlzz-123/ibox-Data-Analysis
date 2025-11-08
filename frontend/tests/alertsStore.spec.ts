import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/services/api', () => ({
  fetchAlerts: vi.fn(),
}));

import { fetchAlerts } from '@/services/api';
import type { Alert } from '@/services/api';
import { useAlertsStore } from '@/stores/alerts';

const mockedFetchAlerts = fetchAlerts as unknown as vi.MockedFunction<typeof fetchAlerts>;

const baseAlert: Alert = {
  id: 'alert-1',
  collectionId: '1',
  severity: 'warning',
  type: 'volume_spike',
  message: 'Volume increased rapidly.',
  triggeredAt: '2023-01-02T00:00:00Z',
  acknowledged: false,
};

beforeEach(() => {
  setActivePinia(createPinia());
  mockedFetchAlerts.mockReset();
});

describe('Alerts Store', () => {
  it('deduplicates alerts and sorts by triggeredAt', async () => {
    mockedFetchAlerts.mockResolvedValue({
      alerts: [
        baseAlert,
        { ...baseAlert },
        { ...baseAlert, id: 'alert-2', triggeredAt: '2023-01-03T00:00:00Z' },
      ],
    });

    const store = useAlertsStore();
    await store.loadAlerts();

    expect(store.alerts).toHaveLength(2);
    expect(store.alerts[0].id).toBe('alert-2');
  });

  it('acknowledges alerts individually and in bulk', async () => {
    mockedFetchAlerts.mockResolvedValue({ alerts: [baseAlert] });
    const store = useAlertsStore();

    await store.loadAlerts();
    expect(store.unreadCount).toBe(1);

    store.acknowledgeAlert('alert-1');
    expect(store.unreadCount).toBe(0);

    mockedFetchAlerts.mockResolvedValue({
      alerts: [
        { ...baseAlert, id: 'alert-3', triggeredAt: '2023-01-04T00:00:00Z', acknowledged: false },
        { ...baseAlert, id: 'alert-4', triggeredAt: '2023-01-05T00:00:00Z', acknowledged: false },
      ],
    });

    await store.loadAlerts();
    expect(store.unreadCount).toBe(2);

    store.acknowledgeAll();
    expect(store.unreadCount).toBe(0);
  });
});
