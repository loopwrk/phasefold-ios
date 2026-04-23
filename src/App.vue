<template>
  <div class="app">
    <header class="app-header">
      <h1>Phasefold</h1>
      <p class="subtitle">Generative harmonic synthesizer</p>
    </header>

    <div class="controls">
      <!-- Preset selector-->
      <div class="section">
        <div class="section-title">Preset</div>
        <select v-model="currentPreset" @change="loadPreset" class="preset-select">
          <option v-for="name in presetNames" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
      </div>

      <!-- Core -->
      <div class="section">
        <div class="section-title">Core</div>
        <ParameterSlider label="Duration" v-model="p.dur" :min="60" :max="600" :step="1" suffix=" s" @info="showInfo" />
        <ParameterSlider label="Base frequency" v-model="p.baseF0" :min="20" :max="220" :step="0.1"
          :suffix="` Hz (${noteName})`" @info="showInfo" />
        <ParameterSlider label="Voices per layer" v-model="p.voices" :min="1" :max="9" :step="1" @info="showInfo" />
        <ParameterSlider label="Layers" v-model="p.layers" :min="1" :max="5" :step="1" @info="showInfo" />
      </div>

      <!-- Temporal -->
      <details class="section" open>
        <summary class="section-title clickable">Temporal</summary>
        <!-- Breath state selector -->
        <div class="breath-control">
          <div class="param-header">
            <span class="param-label">Breath rate</span>
          </div>
          <p class="param-subtitle">
            The pace at which the sound breathes — slower draws you deeper
            inward
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
      <details class="section">
        <summary class="section-title clickable">Spatial</summary>

        <!-- Mind state selector -->
        <div class="mind-state-control">
          <div class="param-header">
            <span class="param-label">Mind state</span>
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

        <ParameterSlider label="Binaural mix" v-model="p.binauralAmount" :min="0" :max="0.6" :step="0.01"
          @info="showInfo" />
      </details>

      <!-- Timbral -->
      <details class="section">
        <summary class="section-title clickable">Timbral</summary>
        <ParameterSlider label="Even harmonics" v-model="p.harmonicEven" :min="0" :max="0.6" :step="0.01"
          @info="showInfo" />
        <ParameterSlider label="Odd harmonics" v-model="p.harmonicOdd" :min="0" :max="0.6" :step="0.01"
          @info="showInfo" />
        <ParameterSlider label="Comb" v-model="p.combAmount" :min="0" :max="0.5" :step="0.01" @info="showInfo" />
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
          {{ isGenerating ? "Generating\u2026" : "Generate" }}
        </button>
        <button @click="onPlay" :disabled="!hasAudio || isGenerating" class="btn">
          {{ isPlaying ? "Pause" : "Play" }}
        </button>
        <button @click="onStop" :disabled="!isPlaying" class="btn">Stop</button>
        <button @click="onSave" :disabled="!hasAudio" class="btn">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watchEffect } from "vue";
import ParameterSlider from "./components/ParameterSlider.vue";
import { useAudioEngine } from "./composables/useAudioEngine";
import { PRESETS, type PresetValues } from "./data/presets";
import { freqToNoteName } from "./engine/dsp";
import { AUDIO_SR } from "./engine/types";
import type { SynthParams } from "./engine/types";

const {
  generate,
  play: playAudio,
  stop: stopAudio,
  exportWav,
  getDuration,
  isPlaying,
  isGenerating,
  generationProgress,
  currentAudio,
  playbackTime,
} = useAudioEngine();

const MIND_STATES = [
  {
    name: "Delta",
    hz: 2,
    min: 0.5,
    max: 4,
    step: 0.1,
    description: "Surrender into deep, restorative sleep",
  },
  {
    name: "Theta",
    hz: 6,
    min: 4,
    max: 8,
    step: 0.1,
    description: "The edge of dreaming — deep meditative release",
  },
  {
    name: "Alpha",
    hz: 10,
    min: 8,
    max: 13,
    step: 0.1,
    description: "Soft, restful awareness — the hypnagogic threshold",
  },
  {
    name: "Beta",
    hz: 18,
    min: 13,
    max: 30,
    step: 0.5,
    description: "Soft focus and clear, present-moment alertness",
  },
  {
    name: "Gamma",
    hz: 40,
    min: 30,
    max: 100,
    step: 1,
    description: "Heightened perception and sensitive awareness",
  },
];

const BREATH_STATES = [
  { name: "Formless", hz: 0.005 },
  { name: "Restorative", hz: 0.012 },
  { name: "Meditative", hz: 0.025 },
  { name: "Relaxed", hz: 0.05 },
  { name: "Awakened", hz: 0.083 },
];

// ── reactive state (initialised from first preset) ──
const presetEntries = Object.entries(PRESETS);
const [defaultPresetName, defaultPresetValues] = presetEntries[0] as [string, PresetValues];

const p = reactive<PresetValues>({ ...defaultPresetValues });
const currentPreset = ref(defaultPresetName);
const status = ref("Ready");
const infoTitle = ref("");
const infoText = ref("");

// ── computed ───────────────────────────────────
const presetNames = computed(() => Object.keys(PRESETS));
const hasAudio = computed(() => currentAudio.value !== null);
const duration = computed(() => getDuration());
const noteName = computed(() => freqToNoteName(p.baseF0));
const activeMindState = computed(
  () =>
    MIND_STATES.find(
      (s) => p.binauralDeltaHz0 >= s.min && p.binauralDeltaHz0 <= s.max,
    ) ?? MIND_STATES[2],
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
    harmonicEven: p.harmonicEven,
    harmonicOdd: p.harmonicOdd,
    combAmount: p.combAmount,
    voiceDelay: Math.min(30, Math.max(10, 0.08 * p.dur)),
    breathRate: p.breathRate,
  };
}

async function onGenerate() {
  status.value = "Generating\u2026";

  // Reactive progress updates while worker runs
  const stopWatch = watchEffect(() => {
    if (isGenerating.value && generationProgress.value > 0) {
      status.value = `Generating\u2026 ${generationProgress.value}%`;
    }
  });

  try {
    const audio = await generate(buildParams());
    const dur = audio.left.length / audio.sampleRate;
    status.value = `Generated ${dur.toFixed(1)} s at ${audio.sampleRate} Hz`;
  } catch (e: any) {
    status.value = `Error: ${e.message}`;
  } finally {
    stopWatch();
  }
}

function onPlay() {
  if (isPlaying.value) {
    stopAudio();
    status.value = "Paused";
  } else {
    playAudio(playbackTime.value);
    status.value = "Playing\u2026";
  }
}

function onStop() {
  stopAudio();
  playbackTime.value = 0;
  status.value = "Stopped";
}

function onSave() {
  exportWav();
  status.value = "WAV exported";
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
const PARAM_INFO: Record<string, string> = {
  Duration:
    "How long the piece evolves. Short (5 s) for testing, long (60\u2013300 s) for meditative textures.",
  "Base frequency":
    "The pitch everything is built around. 60\u2013120 Hz feels grounded; 150\u2013300 Hz feels bright.",
  "Voices per layer": "More voices = richer, thicker sound with more motion.",
  Layers:
    "Depth of recursion. 1\u20132 = clear/structural, 4\u20135 = complex folding sound fields.",
  "Voice delay":
    "Base tone starts alone; voices fade in after this delay. Creates an \u201carriving\u201d texture.",
  "Breath rate":
    "Sets the pace of the spatial breathing cycle. Also gently modulates the binaural beat frequency for a slowly drifting entrainment effect.",
  "Binaural mix": "How much binaural bed is mixed under the main signal.",
  "Even harmonics":
    "Adds round/sweet harmonic colour on top of the main tone (Chebyshev T\u2082).",
  "Odd harmonics": "Adds nasal/brighter harmonic colour (Chebyshev T\u2083).",
  Comb: "Subtle shimmery resonant texture tied to the base frequency.",
};

function showInfo(label: string) {
  infoTitle.value = label;
  infoText.value = PARAM_INFO[label] || "No description available.";
}

// ── formatting ─────────────────────────────────
function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
</script>

<!-- ── Global resets ─────────────────────────────── -->
<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue",
    sans-serif;
  background: #f5f5f7;
  color: #1d1d1f;
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
}
</style>

<!-- ── Scoped styles ─────────────────────────────── -->
<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  max-width: 480px;
  margin: 0 auto;
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
  font-family: inherit;
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
  font-family: inherit;
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
