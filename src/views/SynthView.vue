<template>
  <div class="synth-view">
    <header class="app-header">
      <h1>{{ t('synth.title') }}</h1>
      <p class="subtitle">{{ t('synth.subtitle') }}</p>
    </header>

    <div class="controls">
      <!-- Preset selector-->
      <div class="section">
        <div class="section-title">{{ t('synth.sections.preset') }}</div>
        <select v-model="currentPreset" @change="loadPreset" class="preset-select">
          <option v-for="name in presetNames" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
      </div>

      <!-- Core -->
      <div class="section">
        <div class="section-title">{{ t('synth.sections.core') }}</div>
        <ParameterSlider :label="t('synth.params.duration')" v-model="p.dur" :min="60" :max="1800" :step="1" suffix=" s"
          @info="showInfo" />
        <ParameterSlider :label="t('synth.params.baseFrequency')" v-model="p.baseF0" :min="20" :max="220" :step="0.1"
          :suffix="` Hz (${noteName})`" @info="showInfo" />
        <ParameterSlider :label="t('synth.params.voicesPerLayer')" v-model="p.voices" :min="1" :max="9" :step="1"
          @info="showInfo" />
        <ParameterSlider :label="t('synth.params.layers')" v-model="p.layers" :min="1" :max="5" :step="1"
          @info="showInfo" />
      </div>

      <!-- Temporal -->
      <details class="section" open>
        <summary class="section-title clickable">{{ t('synth.sections.temporal') }}</summary>
        <!-- Breath state selector -->
        <div class="breath-control">
          <div class="param-header">
            <span class="param-label">{{ t('synth.params.breathRate') }}</span>
          </div>
          <p class="param-subtitle">
            {{ t('synth.params.breathSubtitle') }}
          </p>
          <div class="breath-options">
            <button v-for="state in BREATH_STATES" :key="state.name"
              :class="['breath-btn', { active: p.breathRate === state.hz }]" @click="p.breathRate = state.hz">
              {{ state.name }}
            </button>
          </div>
        </div>
      </details>

      <!-- Spatial -->
      <details class="section" open>
        <summary class="section-title clickable">{{ t('synth.sections.spatial') }}</summary>

        <!-- Mind state selector -->
        <div class="mind-state-control">
          <div class="param-header">
            <span class="param-label">{{ t('synth.params.mindState') }}</span>
          </div>
          <div class="mind-state-options">
            <button v-for="state in MIND_STATES" :key="state.name"
              :class="['mind-btn', { active: activeMindState.name === state.name }]"
              @click="p.binauralDeltaHz0 = state.hz">
              {{ state.name }}
            </button>
          </div>
          <p class="mind-state-description">
            {{ activeMindState.description }}
          </p>
          <div class="mind-state-slider">
            <input type="range" class="freq-slider" :min="activeMindState.min" :max="activeMindState.max"
              :step="activeMindState.step" :value="p.binauralDeltaHz0"
              @input="p.binauralDeltaHz0 = parseFloat(($event.target as HTMLInputElement).value)" />
            <div class="freq-slider-labels">
              <span>{{ activeMindState.min }} Hz</span>
              <span class="freq-current">{{ p.binauralDeltaHz0.toFixed(1) }} Hz</span>
              <span>{{ activeMindState.max }} Hz</span>
            </div>
          </div>
        </div>

        <ParameterSlider :label="t('synth.params.binauralMix')" v-model="p.binauralAmount" :min="0" :max="0.6"
          :step="0.01" @info="showInfo" />
      </details>

      <!-- Parameter info -->
      <Transition name="fade">
        <div v-if="infoText" class="info-panel" @click="infoText = ''">
          <div class="info-title">{{ infoTitle }}</div>
          <div class="info-body">{{ infoText }}</div>
        </div>
      </Transition>
    </div>

    <!-- Action bar (sticky bottom) -->
    <div class="action-bar">
      <div class="status">{{ status }}</div>

      <div v-if="hasAudio" class="playback-row">
        <span class="time">{{ fmtTime(playbackTime) }}</span>
        <input type="range" class="scrubber" :min="0" :max="duration" :step="0.1" :value="playbackTime"
          @input="onScrub" />
        <span class="time">{{ fmtTime(duration) }}</span>
      </div>

      <div class="buttons">
        <button @click="onGenerate" :disabled="isGenerating" class="btn btn-primary">
          {{ isGenerating ? t('common.generating') : t('common.generate') }}
        </button>
        <button @click="onPlay" :disabled="!hasAudio || isGenerating" class="btn">
          {{ isPlaying ? t('common.pause') : t('common.play') }}
        </button>
        <button @click="onStop" :disabled="!isPlaying" class="btn">{{ t('common.stop') }}</button>
        <button @click="onSave" :disabled="!hasAudio" class="btn save">{{ t('common.save') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watchEffect } from "vue";
import { useI18n } from "vue-i18n";
import ParameterSlider from "../components/ParameterSlider.vue";
import { useAudioEngine } from "../composables/useAudioEngine";
import { warmupMedia } from "../engine/audioElement";
import { PRESETS, type PresetValues } from "../data/presets";
import { freqToNoteName } from "../engine/dsp";
import { AUDIO_SR } from "../engine/types";
import type { SynthParams } from "../engine/types";

const { t } = useI18n();

const {
  generate,
  play: playAudio,
  stop: stopAudio,
  setNowPlaying,
  exportWav,
  getDuration,
  isPlaying,
  isGenerating,
  generationProgress,
  hasAudio,
  playbackTime,
} = useAudioEngine();

const MIND_STATES = computed(() => [
  { name: t('synth.mindStates.delta.name'), hz: 2, min: 0.5, max: 4, step: 0.1, description: t('synth.mindStates.delta.description') },
  { name: t('synth.mindStates.theta.name'), hz: 6, min: 4, max: 8, step: 0.1, description: t('synth.mindStates.theta.description') },
  { name: t('synth.mindStates.alpha.name'), hz: 10, min: 8, max: 13, step: 0.1, description: t('synth.mindStates.alpha.description') },
  { name: t('synth.mindStates.beta.name'), hz: 18, min: 13, max: 30, step: 0.5, description: t('synth.mindStates.beta.description') },
  { name: t('synth.mindStates.gamma.name'), hz: 40, min: 30, max: 100, step: 1, description: t('synth.mindStates.gamma.description') },
]);

const BREATH_STATES = computed(() => [
  { name: t('synth.breathStates.formless'), hz: 0.005 },
  { name: t('synth.breathStates.restorative'), hz: 0.012 },
  { name: t('synth.breathStates.meditative'), hz: 0.025 },
  { name: t('synth.breathStates.relaxed'), hz: 0.05 },
  { name: t('synth.breathStates.awakened'), hz: 0.083 },
]);

// ── reactive state (initialised from first preset) ──
const presetEntries = Object.entries(PRESETS);
const [defaultPresetName, defaultPresetValues] = presetEntries[0] as [string, PresetValues];

const p = reactive<PresetValues>({ ...defaultPresetValues });
const currentPreset = ref(defaultPresetName);
const status = ref(t('synth.status.ready'));
const infoTitle = ref("");
const infoText = ref("");

// ── computed ───────────────────────────────────
const presetNames = computed(() => Object.keys(PRESETS));
const duration = computed(() => getDuration());
const noteName = computed(() => freqToNoteName(p.baseF0));
const activeMindState = computed(
  () =>
    MIND_STATES.value.find(
      (s) => p.binauralDeltaHz0 >= s.min && p.binauralDeltaHz0 <= s.max,
    ) ?? MIND_STATES.value[2],
);

// ── actions ────────────────────────────────────

function loadPreset() {
  const preset = PRESETS[currentPreset.value];
  if (!preset) return;
  Object.assign(p, preset);
}

function buildParams(): SynthParams {
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
  };
}

async function onGenerate() {
  // Prime the audio element while still in the tap's call stack
  // (iOS requires a gesture-blessed element for later play() calls)
  warmupMedia();

  // Stop any current playback and reset scrubber
  stopAudio();
  playbackTime.value = 0;

  status.value = t('common.generating');

  // Reactive progress updates while worker runs
  const stopWatch = watchEffect(() => {
    if (isGenerating.value && generationProgress.value > 0) {
      status.value = t('synth.status.generatingProgress', { progress: generationProgress.value });
    }
  });

  try {
    const track = await generate(buildParams());
    setNowPlaying(currentPreset.value);
    status.value = t('synth.status.generated', { dur: track.duration.toFixed(1), rate: track.sampleRate });
  } catch (e: any) {
    status.value = t('synth.status.error', { message: e.message });
  } finally {
    stopWatch();
  }
}

function onPlay() {
  if (isPlaying.value) {
    stopAudio();
    status.value = t('synth.status.paused');
  } else {
    playAudio(playbackTime.value);
    status.value = t('synth.status.playing');
  }
}

function onStop() {
  stopAudio();
  playbackTime.value = 0;
  status.value = t('synth.status.stopped');
}

function onSave() {
  exportWav();
  status.value = t('synth.status.exported');
}

function onScrub(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  playbackTime.value = val;
  if (isPlaying.value) {
    // Restart from scrubbed position
    stopAudio();
    playAudio(val);
  }
}

// ── parameter descriptions ─────────────────────
const PARAM_INFO_KEYS: Record<string, string> = {
  [t('synth.params.duration')]: 'synth.paramInfo.duration',
  [t('synth.params.baseFrequency')]: 'synth.paramInfo.baseFrequency',
  [t('synth.params.voicesPerLayer')]: 'synth.paramInfo.voicesPerLayer',
  [t('synth.params.layers')]: 'synth.paramInfo.layers',
  [t('synth.params.breathRate')]: 'synth.paramInfo.breathRate',
  [t('synth.params.binauralMix')]: 'synth.paramInfo.binauralMix',
};

function showInfo(label: string) {
  infoTitle.value = label;
  const key = PARAM_INFO_KEYS[label];
  infoText.value = key ? t(key) : t('synth.paramInfo.noDescription');
}

// ── formatting ─────────────────────────────────
function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
</script>

<style scoped>
.synth-view {
  background: #fff;
}

.app-header {
  padding: 16px 20px 12px;
  padding-top: calc(16px + env(safe-area-inset-top, 0px));
  background: #5700ee;
  color: white;
}

.app-header h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.subtitle {
  font-size: 13px;
  opacity: 0.8;
  margin-top: 2px;
}

.controls {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  -webkit-overflow-scrolling: touch;
}

.section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #86868b;
  margin-bottom: 6px;
  list-style: none;
}

.section-title::-webkit-details-marker {
  display: none;
}

.section-title.clickable {
  cursor: pointer;
  padding: 6px 0;
}

.section-title.clickable::before {
  content: "\25B6\00a0";
  font-size: 9px;
  display: inline-block;
  transition: transform 0.2s;
}

details[open]>.section-title.clickable::before {
  transform: rotate(90deg);
}

.preset-select {
  width: 100%;
  padding: 10px 12px;
  font-size: 16px;
  border: 1px solid #d2d2d7;
  border-radius: 10px;
  background: #f5f5f7;
  color: #1d1d1f;
  -webkit-appearance: none;
  appearance: none;
}

.breath-control {
  padding: 6px 0 10px;
}

.breath-control .param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.breath-control .param-label {
  font-size: 14px;
  color: #1d1d1f;
  font-weight: 500;
}

.breath-control .param-subtitle {
  font-size: 11px;
  color: #a0a0a8;
  margin: 0 0 10px;
  font-style: italic;
  line-height: 1.3;
}

.breath-options {
  display: flex;
  gap: 6px;
}

.breath-btn {
  flex: 1;
  padding: 7px 2px;
  font-size: 11px;
  font-weight: 500;
  color: #86868b;
  background: #f0f0f5;
  border: 1px solid #e0e0e5;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.breath-btn.active {
  background: #5700ee;
  color: #fff;
  border-color: #5700ee;
}

.mind-state-control {
  padding: 6px 0 4px;
}

.mind-state-control .param-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.mind-state-control .param-label {
  font-size: 14px;
  color: #1d1d1f;
  font-weight: 500;
}

.mind-state-options {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.mind-btn {
  flex: 1;
  padding: 7px 2px;
  font-size: 11px;
  font-weight: 500;
  color: #86868b;
  background: #f0f0f5;
  border: 1px solid #e0e0e5;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.mind-btn.active {
  background: #5700ee;
  color: #fff;
  border-color: #5700ee;
}

.mind-state-description {
  font-size: 11px;
  color: #a0a0a8;
  margin: 0 0 8px;
  font-style: italic;
  line-height: 1.3;
  min-height: 1.3em;
  transition: opacity 0.2s;
}

.mind-state-slider {
  margin-bottom: 10px;
}

.freq-slider {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #e0e0e5;
  border-radius: 2px;
  outline: none;
  margin: 0;
}

.freq-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #5700ee;
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.freq-slider-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 10px;
  color: #a0a0a8;
}

.freq-current {
  font-weight: 600;
  color: #5700ee;
  font-size: 11px;
}

.info-panel {
  background: #f5f5f7;
  border-radius: 10px;
  padding: 12px 16px;
  margin-top: 8px;
  cursor: pointer;
}

.info-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.info-body {
  font-size: 13px;
  color: #666;
  line-height: 1.4;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.action-bar {
  padding: 10px 20px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #e5e5ea;
  background: #fafafa;
}

.status {
  font-size: 12px;
  color: #86868b;
  margin-bottom: 6px;
  text-align: center;
}

.playback-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.scrubber {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: #e5e5ea;
  outline: none;
}

.scrubber::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #5700ee;
}

.time {
  font-size: 12px;
  color: #86868b;
  font-variant-numeric: tabular-nums;
  min-width: 36px;
  text-align: center;
}

.buttons {
  display: flex;
  gap: 8px;
}

.btn {
  flex: 1;
  padding: 12px 6px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: #e5e5ea;
  color: #1d1d1f;
  transition: opacity 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.btn.save {
  display: none;
}

.btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.btn:active:not(:disabled) {
  opacity: 0.6;
}

.btn-primary {
  background: #5700ee;
  color: white;
}
</style>
