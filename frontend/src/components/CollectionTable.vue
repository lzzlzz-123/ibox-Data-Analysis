<template>
  <section class="collection-table panel">
    <header>
      <h2>{{ title }}</h2>
      <slot name="actions"></slot>
    </header>
    <table>
      <thead>
        <tr>
          <th scope="col">Collection</th>
          <th scope="col">Floor</th>
          <th scope="col">24h Volume</th>
          <th scope="col">24h Change</th>
          <th scope="col">Owners</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="5" class="placeholder">Loading data…</td>
        </tr>
        <tr v-else-if="!collections.length">
          <td colspan="5" class="placeholder">No collections available</td>
        </tr>
        <tr v-for="collection in collections" :key="collection.id">
          <th scope="row">
            <RouterLink :to="`/collections/${collection.id}`" class="collection-link">
              <div class="collection-name">
                <img v-if="collection.imageUrl" :src="collection.imageUrl" alt="" />
                <div>
                  <span>{{ collection.name }}</span>
                  <small v-if="collection.symbol">{{ collection.symbol }}</small>
                </div>
              </div>
            </RouterLink>
          </th>
          <td>{{ formatNumber(collection.floorPrice, 3) }}</td>
          <td>{{ formatNumber(collection.volume24h) }}</td>
          <td :class="deltaClass(collection.change24h)">
            <span v-if="collection.change24h !== null && collection.change24h !== undefined">
              {{ collection.change24h > 0 ? '+' : '' }}{{ collection.change24h.toFixed(2) }}%
            </span>
            <span v-else class="placeholder">—</span>
          </td>
          <td>{{ formatNumber(collection.ownerCount ?? null, 0) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
import type { CollectionSummary } from '@/services/api';

withDefaults(
  defineProps<{
    title: string;
    collections: CollectionSummary[];
    loading?: boolean;
  }>(),
  {
    loading: false,
  }
);

function formatNumber(value: number | null | undefined, fractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
  });
}

function deltaClass(delta: number | null | undefined) {
  if (delta === null || delta === undefined) {
    return 'neutral';
  }
  if (delta > 0) {
    return 'positive';
  }
  if (delta < 0) {
    return 'negative';
  }
  return 'neutral';
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

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

th,
 td {
  padding: 0.75rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

th {
  font-weight: 600;
  color: #cbd5f5;
}

.collection-link {
  color: inherit;
  text-decoration: none;
}

.collection-name {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.collection-name img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.collection-name small {
  display: block;
  color: #94a3b8;
}

.placeholder {
  text-align: center;
  color: #64748b;
}

.positive {
  color: #4ade80;
}

.negative {
  color: #f87171;
}

.neutral {
  color: #e2e8f0;
}
</style>
