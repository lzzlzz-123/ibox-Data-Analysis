<template>
  <article class="stat-card panel" role="status">
    <header>
      <span class="stat-title">{{ title }}</span>
      <slot name="icon">
        <div class="placeholder-icon" aria-hidden="true">📊</div>
      </slot>
    </header>
    <div class="stat-value">
      {{ displayValue }}
    </div>
    <footer>
      <span :class="['stat-delta', deltaClass]">
        <span v-if="delta !== null">
          {{ delta > 0 ? '+' : '' }}{{ delta.toFixed(displayDigits) }}{{ unit }}
        </span>
        <span v-else class="placeholder">No recent change</span>
      </span>
      <slot name="meta"></slot>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    value: number | null;
    delta?: number | null;
    unit?: string;
    precision?: number;
    placeholder?: string;
  }>(),
  {
    delta: null,
    unit: '',
    precision: 2,
    placeholder: '—',
  }
);

const displayDigits = computed(() => Math.max(0, Math.min(props.precision, 6)));

const displayValue = computed(() => {
  if (props.value === null || Number.isNaN(props.value)) {
    return props.placeholder;
  }
  return `${props.value.toLocaleString(undefined, {
    maximumFractionDigits: displayDigits.value,
  })}${props.unit}`;
});

const delta = computed(() => {
  if (props.delta === null || props.delta === undefined) {
    return null;
  }
  if (Number.isNaN(props.delta)) {
    return null;
  }
  return props.delta;
});

const deltaClass = computed(() => {
  if (delta.value === null) {
    return 'neutral';
  }
  if (delta.value > 0) {
    return 'positive';
  }
  if (delta.value < 0) {
    return 'negative';
  }
  return 'neutral';
});
</script>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: rgba(15, 23, 42, 0.85);
}

.stat-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #94a3b8;
  font-size: 0.95rem;
}

.placeholder-icon {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.15);
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 600;
  color: #f8fafc;
}

.stat-delta {
  font-weight: 500;
  font-size: 0.95rem;
}

.stat-delta.positive {
  color: #4ade80;
}

.stat-delta.negative {
  color: #f87171;
}

.stat-delta.neutral {
  color: #94a3b8;
}

.placeholder {
  color: #64748b;
}
</style>
