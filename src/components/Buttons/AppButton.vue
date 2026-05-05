<template>
  <button :class="['app-btn', `app-btn--${variant}`, { 'app-btn--compact': compact }]" :disabled="disabled">
    <span v-if="$slots['icon-left']" class="app-btn__icon">
      <slot name="icon-left" />
    </span>
    <span class="app-btn__label">
      <slot />
    </span>
    <span v-if="$slots['icon-right']" class="app-btn__icon">
      <slot name="icon-right" />
    </span>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'default' | 'action' | 'surface'
    compact?: boolean
    disabled?: boolean
  }>(),
  {
    variant: 'default',
    compact: false,
    disabled: false,
  },
)
</script>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  text-align: center;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s, transform 0.15s;
}

.app-btn:active:not(:disabled) {
  opacity: 0.85;
  transform: scale(0.97);
}

.app-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

/* ── Variants ──────────────────────────────── */

.app-btn--default {
  background: var(--cs-raised);
  color: var(--cs-text);
}

.app-btn--action {
  background: var(--cs-action);
  color: var(--cs-bg);
}

.app-btn--surface {
  background: var(--cs-surf);
  color: var(--cs-text);
}

/* ── Compact size ──────────────────────────── */

.app-btn--compact {
  padding: 10px 16px;
  font-size: 14px;
  border-radius: 10px;
}

/* ── Icon slots ────────────────────────────── */

.app-btn__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-btn__label {
  flex: 1;
  min-width: 0;
}
</style>
