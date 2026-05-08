<template>
  <div class="playback">
    <router-link :to="{ name: 'onboarding', query: { step: '1' } }" class="logo">{{ t('onboarding.appName')
    }}</router-link>

    <div class="playback-content">
      <!-- Progress ring / playing state -->
      <div class="ring-container">
        <svg class="progress-ring" viewBox="0 0 120 120">
          <!-- Background track -->
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--cs-raised)" stroke-width="6" />
          <!-- Progress arc during generation -->
          <circle v-if="isGenerating" cx="60" cy="60" r="52" fill="none" stroke="var(--cs-action)" stroke-width="6"
            stroke-linecap="round" :stroke-dasharray="circumference"
            :stroke-dashoffset="circumference - (circumference * generationProgress) / 100" class="progress-arc" />
          <!-- Filled ring when audio is ready -->
          <circle v-if="!isGenerating && hasAudio" cx="60" cy="60" r="52" fill="none" stroke="var(--cs-action)"
            stroke-width="6" />
        </svg>
      </div>

      <p class="playback-label" :class="{ 'playback-label--error': generationError }">
        {{ generationError
          ? t('playback.error')
          : isGenerating
            ? t('playback.generatingProgress', { progress: generationProgress })
            : t('playback.playing') }}
      </p>
      <p class="playback-preset-name">{{ displayName }}</p>
    </div>

    <div class="playback-bar">
      <div class="playback-buttons">
        <template v-if="generationError">
          <AppButton variant="action" @click="startGeneration">
            {{ t('playback.retry') }}
          </AppButton>
        </template>
        <template v-else>
          <AppButton variant="action" :disabled="isGenerating" @click="onPlayPause">
            {{ isPlaying ? t('common.pause') : t('common.play') }}
          </AppButton>
          <AppButton variant="surface" :disabled="isGenerating || !isPlaying" @click="onStop">
            {{ t('common.stop') }}
          </AppButton>
        </template>
      </div>

      <div class="playback-nav">
        <AppButton variant="surface" compact @click="goToPresets">
          <template #icon-left>
            <AppIcon name="arrow-left" :size="14" />
          </template>
          {{ t('playback.presets') }}
        </AppButton>
        <AppButton variant="surface" compact @click="goToCustom">
          {{ t('playback.custom') }}
          <template #icon-right>
            <AppIcon name="pencil" :size="14" />
          </template>
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppButton from '../components/Buttons/AppButton.vue'
import AppIcon from '../components/Icons/AppIcon.vue'
import { useAudioEngine } from '../composables/useAudioEngine'
import { PRESETS } from '../data/presets'
import { AUDIO_SR } from '../engine/types'
import type { SynthParams } from '../engine/types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const rustWorkerUrl = new URL('../engine/rust.audio.worker.ts', import.meta.url)

const {
  generate,
  cancelGeneration,
  play: playAudio,
  stop: stopAudio,
  isPlaying,
  isGenerating,
  generationProgress,
  currentAudio,
  playbackTime,
} = useAudioEngine({ workerUrl: rustWorkerUrl })

// Preset key passed via route param
const presetKey = computed(() => decodeURIComponent(route.params.preset as string))
const displayName = computed(() => presetKey.value.replace(/\s*\([^)]+\)$/, ''))
const hasAudio = computed(() => currentAudio.value !== null)
const generationError = ref(false)
let unmounted = false

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

// Derive intent from the preset's intents array
const intentSlug = computed(() => {
  const preset = PRESETS[presetKey.value]
  return preset?.intents[0] ?? 'sleep'
})

function goToPresets() {
  router.push({ name: 'guidance', params: { intent: intentSlug.value }, query: { page: 'presets' } })
}

function goToCustom() {
  router.push({ name: 'synth' })
}

async function startGeneration() {
  const key = presetKey.value
  if (!PRESETS[key]) return

  generationError.value = false
  try {
    await generate(buildParams(key))
    if (!unmounted) playAudio()
  } catch (err) {
    // Ignore cancellation from unmount; surface real failures
    if (!unmounted) {
      generationError.value = true
      console.error('[Soneuro] Audio generation failed:', err)
    }
  }
}

onMounted(() => {
  startGeneration()
})

onUnmounted(() => {
  unmounted = true
  cancelGeneration()
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

.playback-label--error {
  color: var(--cs-raised);
}

.playback-preset-name {
  font-size: 14px;
  color: var(--cs-text);
  text-align: center;
}

.playback-bar {
  padding-top: 16px;
}

.playback-buttons,
.playback-nav {
  display: flex;
  gap: 10px;
}

.playback-buttons>*,
.playback-nav>* {
  flex: 1;
}

.playback-nav {
  margin-top: 10px;
}
</style>
