<template>
  <svg :width="size" :height="size" :viewBox="icon.viewBox" fill="none" xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true">
    <path v-for="(d, i) in icon.paths" :key="i" :d="d" :stroke="icon.fill ? undefined : 'currentColor'"
      :stroke-width="icon.fill ? undefined : icon.strokeWidth" :stroke-linecap="icon.fill ? undefined : 'round'"
      :stroke-linejoin="icon.fill ? undefined : 'round'" :fill="icon.fill ? 'currentColor' : undefined" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type IconName = 'headphones' | 'arrow-left' | 'arrow-right' | 'play' | 'pencil' | 'question'

interface IconDef {
  viewBox: string
  paths: string[]
  fill?: boolean
  strokeWidth?: number
}

const ICONS: Record<IconName, IconDef> = {
  headphones: {
    viewBox: '0 0 24 24',
    strokeWidth: 1.5,
    paths: [
      'M3 18v-6a9 9 0 0 1 18 0v6',
      'M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5ZM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5Z',
    ],
  },
  'arrow-left': {
    viewBox: '0 0 14 14',
    strokeWidth: 2,
    paths: ['M13 7H1m0 0l5-5M1 7l5 5'],
  },
  'arrow-right': {
    viewBox: '0 0 14 14',
    strokeWidth: 2,
    paths: ['M1 7h12m0 0L8 2m5 5L8 12'],
  },
  play: {
    viewBox: '0 0 16 18',
    fill: true,
    paths: ['M1 1.54v14.92a1 1 0 0 0 1.5.87l12.5-7.46a1 1 0 0 0 0-1.74L2.5.67A1 1 0 0 0 1 1.54Z'],
  },
  pencil: {
    viewBox: '0 0 24 24',
    strokeWidth: 2,
    paths: [
      'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z',
    ],
  },
  question: {
    viewBox: '0 0 24 24',
    strokeWidth: 2,
    paths: [
      'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3',
      'M12 17h.01',
    ],
  },
}

const props = withDefaults(defineProps<{
  name: IconName
  size?: number
}>(), {
  size: 24,
})

const icon = computed(() => ICONS[props.name])
</script>
