<template>
  <aside class="alerts-panel panel" role="feed">
    <header>
      <h2>{{ title }}</h2>
      <slot name="actions"></slot>
    </header>
    <ul v-if="alerts.length">
      <li v-for="alert in alerts" :key="alert.id" :class="[`level-${alert.severity}`]">
        <div class="alert-header">
          <span class="pill">{{ alert.severity }}</span>
          <span class="timestamp">{{ formatTimestamp(alert.triggeredAt) }}</span>
        </div>
        <h3>{{ formatAlertType(alert.type) }}</h3>
        <p>{{ alert.message }}</p>
      </li>
    </ul>
    <p v-else-if="loading" class="placeholder">Loading alerts…</p>
    <p v-else class="placeholder">No alerts to display</p>
  </aside>
</template>

<script setup lang="ts">
import type { Alert } from '@/services/api';

const props = withDefaults(
  defineProps<{
    title?: string;
    alerts: Alert[];
    loading?: boolean;
  }>(),
  {
    title: 'Recent Alerts',
    loading: false,
  }
);

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  return date.toLocaleString();
}

function formatAlertType(type: string) {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
</script>

<style scoped>
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

h2 {
  margin: 0;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

li {
  background: rgba(15, 23, 42, 0.6);
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.alert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.pill {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
}

.timestamp {
  color: #94a3b8;
  font-size: 0.85rem;
}

.level-info .pill {
  color: #38bdf8;
}

.level-warning .pill {
  color: #facc15;
}

.level-critical .pill {
  color: #f87171;
}

.placeholder {
  text-align: center;
  color: #64748b;
}

h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

p {
  margin: 0;
  color: #cbd5f5;
  line-height: 1.4;
}
</style>
