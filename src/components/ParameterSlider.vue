<template>
  <div class="param-slider">
    <div class="param-header" @click="$emit('info', label)">
      <span class="param-label">{{ label }}</span>
      <span class="param-value">{{ displayValue }}{{ suffix }}</span>
    </div>
    <p v-if="subtitle" class="param-subtitle">{{ subtitle }}</p>
    <input type="range" :min="min" :max="max" :step="step" :value="modelValue" @input="onInput" class="slider" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    modelValue: number
    min: number
    max: number
    step: number
    suffix?: string
    decimals?: number
    subtitle?: string
  }>(),
  {
    suffix: '',
    decimals: undefined,
    subtitle: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
  info: [label: string]
}>()

const displayValue = computed(() => {
  const d =
    props.decimals ??
    (props.step < 0.01 ? 3 : props.step < 1 ? 2 : 0)
  return props.modelValue.toFixed(d)
})

function onInput(e: Event) {
  const raw = parseFloat((e.target as HTMLInputElement).value)
  // Round to step to avoid floating-point drift
  const rounded = Math.round(raw / props.step) * props.step
  emit('update:modelValue', rounded)
}
</script>

<style scoped>
.param-slider {
  padding: 6px 0 10px;
}

.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.param-label {
  font-size: 14px;
  color: #1d1d1f;
  font-weight: 500;
}

.param-subtitle {
  font-size: 11px;
  color: #a0a0a8;
  margin: 0 0 5px;
  font-style: italic;
  line-height: 1.3;
}

.param-value {
  font-size: 13px;
  color: #86868b;
  font-variant-numeric: tabular-nums;
}

/* Range input */
.slider {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: #e5e5ea;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #5700ee;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}
</style>
