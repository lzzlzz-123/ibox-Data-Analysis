import { defineStore } from 'pinia';
import type { Alert } from '@/services/api';
import { fetchAlerts } from '@/services/api';

export type AlertFilter = 'all' | 'info' | 'warning' | 'critical';

interface AlertsState {
  alerts: Alert[];
  loading: boolean;
  error: string | null;
  filter: AlertFilter;
  autoRefreshInterval: number;
  lastUpdated: number | null;
}

function dedupeAlerts(alerts: Alert[]): Alert[] {
  const existing = new Map<string, Alert>();
  alerts.forEach((alert) => {
    if (!alert?.id) {
      return;
    }
    existing.set(alert.id, alert);
  });
  return Array.from(existing.values()).sort(
    (a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
  );
}

export const useAlertsStore = defineStore('alerts', {
  state: (): AlertsState => ({
    alerts: [],
    loading: false,
    error: null,
    filter: 'all',
    autoRefreshInterval: 60_000,
    lastUpdated: null,
  }),
  getters: {
    filteredAlerts(state): Alert[] {
      if (state.filter === 'all') {
        return state.alerts;
      }
      return state.alerts.filter((alert) => alert.severity === state.filter);
    },
    unreadCount(state): number {
      return state.alerts.filter((alert) => !alert.acknowledged).length;
    },
  },
  actions: {
    setFilter(filter: AlertFilter) {
      this.filter = filter;
    },
    setAutoRefreshInterval(interval: number) {
      if (Number.isFinite(interval) && interval >= 10_000) {
        this.autoRefreshInterval = interval;
      }
    },
    acknowledgeAlert(alertId: string) {
      this.alerts = this.alerts.map((alert) =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      );
    },
    acknowledgeAll() {
      this.alerts = this.alerts.map((alert) => ({ ...alert, acknowledged: true }));
    },
    async loadAlerts(params?: Record<string, unknown>) {
      this.loading = true;
      this.error = null;
      try {
        const { alerts } = await fetchAlerts(params);
        this.alerts = dedupeAlerts([...alerts, ...this.alerts]);
        this.lastUpdated = Date.now();
      } catch (error) {
        this.error = (error as Error).message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});
