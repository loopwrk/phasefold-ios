<template>
  <!-- Compact variant-->
  <button v-if="variant === 'compact'" class="preset-card" @click="$emit('play')" aria-label="Play preset">
    <span class="preset-name">{{ name }}</span>
    <span class="play-icon" aria-hidden="true">
      <AppIcon name="play" :size="16" />
    </span>
  </button>

  <!-- Expanded variant -->
  <button v-else class="expanded-card" @click="$emit('play')" :aria-label="`Play ${name}`">
    <div class="expanded-left">
      <span class="expanded-meta">
        <span class="meta-mind-state">{{ mindStateLabel }}</span>
        <span class="meta-sep" aria-hidden="true">&middot;</span>
        <span class="meta-description">{{ mindStateDescription }}</span>
        <span class="meta-sep" aria-hidden="true">&middot;</span>
        <span class="meta-dur">{{ formattedDuration }}</span>
      </span>
      <span class="expanded-title">{{ name }}</span>
    </div>
    <span class="expanded-play" aria-hidden="true">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle class="play-ring" cx="22" cy="22" r="20" stroke-width="2" />
        <path class="play-tri"
          d="M17 13.54v16.92a1 1 0 0 0 1.5.87l13.5-8.46a1 1 0 0 0 0-1.74L18.5 12.67a1 1 0 0 0-1.5.87Z" />
      </svg>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../Icons/AppIcon.vue'
import { MIND_STATE_INFO, type MindState } from '../../data/presets'

export type PresetCardVariant = 'compact' | 'expanded'

const props = withDefaults(defineProps<{
  name: string
  variant?: PresetCardVariant
  mindState?: MindState
  durationSeconds?: number
}>(), {
  variant: 'compact',
})

defineEmits<{
  play: []
}>()

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const mindStateLabel = computed(() =>
  props.mindState ? props.mindState.charAt(0).toUpperCase() + props.mindState.slice(1) : '',
)

const mindStateBrief = computed(() =>
  props.mindState ? MIND_STATE_INFO[props.mindState].brief : '',
)

const mindStateDescription = computed(() =>
  props.mindState ? MIND_STATE_INFO[props.mindState].description : '',
)


const formattedDuration = computed(() =>
  props.durationSeconds != null ? formatDuration(props.durationSeconds) : '',
)
</script>

<style scoped>
/*  Compact variant (unchanged)                       */
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

/*  Expanded variant                                  */
.expanded-card {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 18px 20px;
  background: var(--cs-surf);
  border: 1px solid var(--cs-raised);
  border-radius: 16px;
  cursor: pointer;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.2s, transform 0.15s;
}

.expanded-card:hover {
  background: var(--cs-surf-hover);
}

.expanded-card:active {
  transform: scale(0.995);
}

.expanded-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  text-align: left;
}

.expanded-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--cs-action);
}

.meta-brief,
.meta-description,
.meta-dur,
.meta-sep {
  color: var(--cs-raised);
}

.meta-dur {
  font-variant-numeric: tabular-nums;
}

.expanded-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--cs-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.expanded-play {
  flex-shrink: 0;
  margin-left: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-ring {
  stroke: var(--cs-action);
  fill: none;
  transition: fill 0.2s, stroke 0.2s;
}

.play-tri {
  fill: var(--cs-action);
  transition: fill 0.2s;
}

.expanded-card:hover .play-ring {
  fill: var(--cs-action);
  stroke: var(--cs-action);
}

.expanded-card:hover .play-tri {
  fill: var(--cs-surf);
}
</style>
