<template>
  <button class="preset-card" @click="$emit('play')">
    <span class="preset-name">{{ name }}</span>
    <span class="play-icon" aria-label="Play">
      <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1.54v14.92a1 1 0 0 0 1.5.87l12.5-7.46a1 1 0 0 0 0-1.74L2.5.67A1 1 0 0 0 1 1.54Z"
          fill="currentColor" />
      </svg>
    </span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  name: string
}>()

defineEmits<{
  play: []
}>()
</script>

<style scoped>
.preset-card {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 16px;
  background: var(--cs-surf);
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s, transform 0.15s;
}

.preset-card:active {
  opacity: 0.85;
  transform: scale(0.98);
}

.preset-name {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--cs-text);
  text-align: center;
  padding-right: 16px;
}

.play-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cs-action);
}
</style>
