<template>
  <div class="time-range-toggle" role="radiogroup" :aria-disabled="disabled">
    <label
      v-for="option in options"
      :key="option.value"
      :class="['toggle-option', { active: option.value === modelValue, disabled }]"
    >
      <input
        type="radio"
        :name="computedName"
        :value="option.value"
        :checked="option.value === modelValue"
        :disabled="disabled"
        @change="onSelect(option.value)"
      />
      <span>{{ option.label }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';

type TimeRangeValue = string | number;

interface TimeRangeOption {
  label: string;
  value: TimeRangeValue;
}

const props = withDefaults(
  defineProps<{
    modelValue: TimeRangeValue;
    options: TimeRangeOption[];
    disabled?: boolean;
    name?: string;
  }>(),
  {
    disabled: false,
    name: undefined,
  }
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: TimeRangeValue): void;
}>();

const instanceId = useId();

const computedName = computed(() => props.name ?? `time-range-toggle-${instanceId}`);

function onSelect(value: TimeRangeValue) {
  if (!props.disabled) {
    emit('update:modelValue', value);
  }
}
</script>

<style scoped>
.time-range-toggle {
  display: inline-flex;
  border-radius: 999px;
  padding: 0.25rem;
  background: rgba(148, 163, 184, 0.15);
}

.toggle-option {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  color: #cbd5f5;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-option.active {
  background: #38bdf8;
  color: #0f172a;
}

.toggle-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
