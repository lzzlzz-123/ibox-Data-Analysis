import axios, { AxiosError, AxiosInstance } from 'axios';

export interface CollectionSummary {
  id: string;
  name: string;
  symbol?: string;
  floorPrice: number;
  volume24h: number;
  change24h: number;
  ownerCount?: number;
  imageUrl?: string;
  lastUpdated: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  price: number | null;
  volume: number | null;
}

export interface CollectionEvent {
  id: string;
  type: 'listing' | 'sale' | 'transfer' | string;
  price?: number;
  quantity?: number;
  from?: string;
  to?: string;
  txHash?: string;
  marketplace?: string;
  timestamp: string;
}

export interface Alert {
  id: string;
  collectionId: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'price_drop' | 'volume_spike' | 'listing_depletion' | string;
  message: string;
  triggeredAt: string;
  resolved?: boolean;
  createdAt?: string;
  updatedAt?: string;
  acknowledged?: boolean;
}

export interface CollectionsResponse {
  summaries: CollectionSummary[];
  topMovers: CollectionSummary[];
  globalSeries: TimeSeriesPoint[];
}

export interface CollectionDetailResponse {
  collection: CollectionSummary & {
    description?: string;
    supply?: number;
    website?: string;
    tags?: string[];
  };
  chart: {
    price: TimeSeriesPoint[];
    volume: TimeSeriesPoint[];
  };
  listings: CollectionEvent[];
  purchases: CollectionEvent[];
  alerts: Alert[];
}

export interface AlertsResponse {
  alerts: Alert[];
}

export type ToastLevel = 'success' | 'info' | 'warning' | 'error';

export interface ToastPayload {
  id: number;
  level: ToastLevel;
  message: string;
}

let toastListeners: Array<(toast: ToastPayload) => void> = [];

export function onToast(listener: (toast: ToastPayload) => void) {
  toastListeners.push(listener);
  return () => {
    toastListeners = toastListeners.filter((fn) => fn !== listener);
  };
}

function emitToast(level: ToastLevel, message: string) {
  const payload: ToastPayload = {
    id: Date.now() + Math.random(),
    level,
    message,
  };
  toastListeners.forEach((listener) => listener(payload));
}

const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? '';

const apiClient: AxiosInstance = axios.create({
  baseURL: apiBaseURL,
  timeout: 20000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    emitToast('error', message);
    return Promise.reject(error);
  }
);

function sanitizeSeries(series: TimeSeriesPoint[]): TimeSeriesPoint[] {
  const seen = new Set<string>();
  return series
    .filter((point) => {
      if (!point?.timestamp) {
        return false;
      }
      const key = point.timestamp;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((point) => ({
      timestamp: point.timestamp,
      price: typeof point.price === 'number' ? point.price : null,
      volume: typeof point.volume === 'number' ? point.volume : null,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function sanitizeSummaries(summaries: CollectionSummary[]): CollectionSummary[] {
  const seen = new Set<string>();
  return summaries
    .filter((summary) => {
      if (!summary?.id) {
        return false;
      }
      if (seen.has(summary.id)) {
        return false;
      }
      seen.add(summary.id);
      return true;
    })
    .map((summary) => ({
      ...summary,
      floorPrice: Number.isFinite(summary.floorPrice) ? summary.floorPrice : 0,
      volume24h: Number.isFinite(summary.volume24h) ? summary.volume24h : 0,
      change24h: Number.isFinite(summary.change24h) ? summary.change24h : 0,
      lastUpdated: summary.lastUpdated ?? new Date().toISOString(),
    }));
}

function sanitizeEvents(events: CollectionEvent[]): CollectionEvent[] {
  const seen = new Set<string>();
  return events
    .filter((event) => {
      if (!event?.id) {
        return false;
      }
      if (seen.has(event.id)) {
        return false;
      }
      seen.add(event.id);
      return true;
    })
    .map((event) => ({
      ...event,
      price: typeof event.price === 'number' ? event.price : undefined,
      quantity: typeof event.quantity === 'number' ? event.quantity : undefined,
      timestamp: event.timestamp ?? new Date().toISOString(),
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function sanitizeAlerts(alerts: Alert[]): Alert[] {
  const seen = new Set<string>();
  return alerts
    .filter((alert) => {
      if (!alert?.id) {
        return false;
      }
      if (seen.has(alert.id)) {
        return false;
      }
      seen.add(alert.id);
      return true;
    })
    .map((alert) => ({
      ...alert,
      severity: alert.severity ?? 'info',
      type: alert.type ?? 'unknown',
      message: alert.message?.trim() || 'No message provided',
      triggeredAt: alert.triggeredAt ?? new Date().toISOString(),
    }))
    .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
}

export async function fetchCollections(): Promise<CollectionsResponse> {
  const response = await apiClient.get<CollectionsResponse>('/api/collections');
  const data = response.data;
  return {
    summaries: sanitizeSummaries(data?.summaries ?? []),
    topMovers: sanitizeSummaries(data?.topMovers ?? []),
    globalSeries: sanitizeSeries(data?.globalSeries ?? []),
  };
}

export async function fetchCollectionDetail(collectionId: string, params?: Record<string, unknown>): Promise<CollectionDetailResponse> {
  const response = await apiClient.get<CollectionDetailResponse>(`/api/collections/${collectionId}`, { params });
  const data = response.data;
  return {
    collection: sanitizeSummaries([data.collection])[0],
    chart: {
      price: sanitizeSeries(data.chart?.price ?? []),
      volume: sanitizeSeries(data.chart?.volume ?? []),
    },
    listings: sanitizeEvents(data.listings ?? []),
    purchases: sanitizeEvents(data.purchases ?? []),
    alerts: sanitizeAlerts(data.alerts ?? []),
  };
}

export async function fetchAlerts(params?: Record<string, unknown>): Promise<AlertsResponse> {
  const response = await apiClient.get<AlertsResponse>('/api/alerts', { params });
  return {
    alerts: sanitizeAlerts(response.data?.alerts ?? []),
  };
}

export { apiClient };
