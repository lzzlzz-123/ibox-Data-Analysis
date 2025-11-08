<template>
  <section class="event-feed panel">
    <header>
      <h2>{{ title }}</h2>
      <slot name="actions"></slot>
    </header>
    <ul v-if="events.length">
      <li v-for="event in events" :key="event.id">
        <div class="event-meta">
          <span class="event-type">{{ event.type }}</span>
          <span class="timestamp">{{ formatTimestamp(event.timestamp) }}</span>
        </div>
        <div class="event-body">
          <span v-if="event.price !== undefined" class="price">Price: {{ formatNumber(event.price, 3) }}</span>
          <span v-if="event.quantity !== undefined" class="quantity">Qty: {{ event.quantity }}</span>
          <span v-if="event.marketplace" class="marketplace">{{ event.marketplace }}</span>
        </div>
        <div class="event-parties" v-if="event.from || event.to">
          <span v-if="event.from">From: {{ event.from }}</span>
          <span v-if="event.to">To: {{ event.to }}</span>
        </div>
      </li>
    </ul>
    <p v-else-if="loading" class="placeholder">Loading events…</p>
    <p v-else class="placeholder">No events found</p>
  </section>
</template>

<script setup lang="ts">
import type { CollectionEvent } from '@/services/api';

withDefaults(
  defineProps<{
    events: CollectionEvent[];
    loading?: boolean;
    title?: string;
  }>(),
  {
    loading: false,
    title: 'Activity'
  }
);

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  return date.toLocaleString();
}

function formatNumber(value: number | undefined, digits = 2) {
  if (value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
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
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

li {
  padding: 1rem;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.event-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  color: #94a3b8;
}

.event-type {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
}

.event-body,
.event-parties {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  color: #cbd5f5;
}

.price {
  color: #38bdf8;
}

.placeholder {
  text-align: center;
  color: #64748b;
}
</style>
