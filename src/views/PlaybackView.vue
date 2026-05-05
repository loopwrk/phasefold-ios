<template>
  <div class="playback">
    <router-link :to="{ name: 'onboarding', query: { step: '1' } }" class="logo">Soneuro</router-link>

    <div class="playback-content">
      <!-- Progress ring / playing state -->
      <div class="ring-container">
        <svg class="progress-ring" viewBox="0 0 120 120">
          <!-- Background track -->
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke="var(--cs-raised)"
            stroke-width="6"
          />
          <!-- Progress arc during generation -->
          <circle
            v-if="isGenerating"
            cx="60" cy="60" r="52"
            fill="none"
            stroke="var(--cs-action)"
            stroke-width="6"
            stroke-linecap="round"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="circumference - (circumference * generationProgress) / 100"
            class="progress-arc"
          />
          <!-- Filled ring when audio is ready -->
          <circle
            v-if="!isGenerating && hasAudio"
            cx="60" cy="60" r="52"
            fill="none"
            stroke="var(--cs-action)"
            stroke-width="6"
          />
        </svg>
      </div>

      <p class="playback-label">
        {{ isGenerating ? `Generating… ${generationProgress}%` : 'Playing' }}
      </p>
      <p class="playback-preset-name">{{ displayName }}</p>
    </div>

    <div class="playback-bar">
      <div class="playback-buttons">
        <button class="btn btn-play" :disabled="isGenerating" @click="onPlayPause">
          {{ isPlaying ? 'Pause' : 'Play' }}
        </button>
        <button class="btn btn-stop" :disabled="isGenerating || !isPlaying" @click="onStop">
          Stop
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAudioEngine } from '../composables/useAudioEngine'
import { PRESETS } from '../data/presets'
import { AUDIO_SR } from '../engine/types'
import type { SynthParams } from '../engine/types'

const route = useRoute()

const {
  generate,
  play: playAudio,
  stop: stopAudio,
  isPlaying,
  isGenerating,
  generationProgress,
  currentAudio,
  playbackTime,
} = useAudioEngine()

// Preset key passed via route param
const presetKey = computed(() => decodeURIComponent(route.params.preset as string))
const displayName = computed(() => presetKey.value.replace(/\s*\([^)]+\)$/, ''))
const hasAudio = computed(() => currentAudio.value !== null)

// Progress ring geometry
const circumference = 2 * Math.PI * 52

function buildParams(key: string): SynthParams {
  const p = PRESETS[key]
  return {
    dur: p.dur,
    sampleRate: AUDIO_SR,
    baseF0: p.baseF0,
    voices: Math.round(p.voices),
    layers: Math.round(p.layers),
    seed: 2025,
    fmIndex0: 1.6,
    amIndex0: 0.35,
    binauralDeltaHz0: p.binauralDeltaHz0,
    binauralAmount: p.binauralAmount,
    overtonePower: 1.3,
    voiceDelay: Math.min(30, Math.max(10, 0.08 * p.dur)),
    breathRate: p.breathRate,
  }
}

function onPlayPause() {
  if (isPlaying.value) {
    stopAudio()
  } else {
    playAudio(playbackTime.value)
  }
}

function onStop() {
  stopAudio()
  playbackTime.value = 0
}

// Generate and auto-play on mount
onMounted(async () => {
  const key = presetKey.value
  if (!PRESETS[key]) return

  try {
    await generate(buildParams(key))
    playAudio()
  } catch {
    // Generation failed - controls remain disabled
  }
})

// Stop playback if navigating away
onUnmounted(() => {
  stopAudio()
})
</script>

<style scoped>
.playback {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 32px;
  padding-top: calc(24px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  position: relative;
}

.logo {
  position: absolute;
  top: calc(16px + env(safe-area-inset-top, 0px));
  left: 32px;
  font-size: 18px;
  font-weight: 700;
  color: var(--cs-text);
  text-decoration: none;
  z-index: 1;
  -webkit-tap-highlight-color: transparent;
}

.playback-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 24px;
}

.ring-container {
  width: 120px;
  height: 120px;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-arc {
  transition: stroke-dashoffset 0.3s ease;
}

.playback-label {
  font-size: 20px;
  font-weight: 700;
  color: var(--cs-text);
  text-align: center;
  letter-spacing: -0.3px;
}

.playback-preset-name {
  font-size: 14px;
  color: var(--cs-raised);
  text-align: center;
}

.playback-bar {
  padding-top: 16px;
}

.playback-buttons {
  display: flex;
  gap: 10px;
}

.btn {
  flex: 1;
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

.btn:active {
  opacity: 0.85;
  transform: scale(0.97);
}

.btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.btn-play {
  background: var(--cs-action);
  color: var(--cs-bg);
}

.btn-stop {
  background: var(--cs-surf);
  color: var(--cs-text);
}
</style>
