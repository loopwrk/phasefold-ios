<template>
  <div class="guidance">
    <router-link :to="{ name: 'onboarding', query: { step: '1' } }" class="logo">Soneuro</router-link>
    <Transition name="slide" mode="out-in">
      <div v-if="page < presetPageIndex" :key="page" class="screen">
        <div v-if="intentSlug === 'sleep' && page === 0" class="screen-content guidance-body">
          <div class="guidance-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5ZM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5Z"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <p class="text-body">Wear headphones and set to
            <br /> low-medium volume.
          </p>
          <p class="text-body">Lie on your back, or whichever sleeping position is comfortable for you whilst
            wearing headphones. Then, ask yourself, </p>
          <p class="text-body text-body--500">"What can I do to be just 1% more comfortable?"</p>
          <p class="text-body">Move your shoulders, adjust clothing, or wiggle your hips until you're in a position
            you'd be comfortable to fall
            asleep in.</p>
          <p class="text-body text-body--muted">Ready? Let's continue</p>
        </div>

        <div v-else-if="intentSlug === 'sleep' && page === 1" class="screen-content guidance-body">
          <p class="text-body">Take a long, slow breath in through your nose, filling the lungs completely. Hold
            it for a few seconds, and then let it out through your mouth with a soft sigh. Do this 3-5 times</p>
          <p class="text-body">Then, let go of any control over the breath. Allow the body to breathe naturally.</p>
          <p class="text-body text-body--muted">Now, let's begin</p>
        </div>

        <!-- Anxiety - page 1 -->
        <div v-else-if="intentSlug === 'anxiety' && page === 0" class="screen-content guidance-body">
          <div class="guidance-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5ZM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5Z"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <p class="text-body">Wear headphones and set to <br /> low-medium volume.</p>
          <p class="text-body">If you'd like to, sit or lie down, but if you prefer where you are now, that's perfectly
            fine.</p>
          <p class="text-body text-body--muted">Ready? Let's continue</p>
        </div>

        <!-- Anxiety - page 2 -->
        <div v-else-if="intentSlug === 'anxiety' && page === 1" class="screen-content guidance-body">

          <p class="text-body">The audio is designed to start with more texture and movement. Over time, it gradually
            softens, guiding you towards stillness.</p>
          <p class="text-body">There's nothing you need to do - just listen. If at any point the sound feels like
            too much, it's completely okay to take a break or stop.</p>
          <p class="text-body text-body--muted">Now, let's begin</p>
        </div>

        <!-- Focus - page 1 -->
        <div v-else-if="intentSlug === 'focus' && page === 0" class="screen-content guidance-body">
          <div class="guidance-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                stroke-linejoin="round" />
              <path
                d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5ZM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5Z"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <p class="text-body">Wear headphones and set to <br /> low-medium volume.</p>
          <p class="text-body">You can listen while you work, or simply close your eyes and let the audio be your
            focus - either approach works well.</p>
          <p class="text-body">If working, minimise distractions and if focusing on a specific task, have it ready
            in front of you.</p>
          <p class="text-body text-body--muted">Ready? Let's begin</p>
        </div>

        <div class="nav-bar">
          <div class="step-dots">
            <span v-for="i in totalPages" :key="i" :class="['dot', { active: i - 1 === page }]" />
          </div>

          <div class="nav-buttons">
            <button v-if="page > 0" class="btn btn-back" @click="page--">
              Back
            </button>
            <button class="btn btn-next" @click="advance">
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Page 2: preset picker -->
      <div v-else key="presets" class="screen">
        <div class="preset-screen">
          <h2 class="preset-heading">Choose a preset</h2>
          <div class="preset-list">
            <PresetCard v-for="preset in intentPresets" :key="preset.key" :name="preset.displayName"
              @play="selectPreset(preset.key)" />
          </div>
        </div>

        <div class="nav-bar">
          <div class="step-dots">
            <span v-for="i in totalPages" :key="i" :class="['dot', { active: i - 1 === page }]" />
          </div>

          <div class="nav-buttons">
            <button class="btn btn-back" @click="page--">
              Back
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PresetCard from '../components/Cards/PresetCard.vue'
import { PRESETS } from '../data/presets'
import { warmup } from '../engine/audioContext'

const route = useRoute()
const router = useRouter()
const initialPage = Number(route.query.page) || 0
const page = ref(initialPage)

// Intent slug from route param (e.g. "sleep", "anxiety", "focus")
const intentSlug = computed(() => route.params.intent as string)

const INTENT_CONFIG: Record<string, { label: string; pages: string[]; presetTag: string }> = {
  sleep: {
    label: 'Sleep better',
    pages: ['Physical positioning', 'Breathing guidance', 'Choose a preset'],
    presetTag: 'Sleep and rest',
  },
  anxiety: {
    label: 'Reduce anxiety',
    pages: ['Grounding', 'Breathing guidance', 'Choose a preset'],
    presetTag: 'Anxiety reduction',
  },
  focus: {
    label: 'Increase focus',
    pages: ['Setting your space', 'Choose a preset'],
    presetTag: 'Cognitive enhancement',
  },
}

const intentLabel = computed(() => INTENT_CONFIG[intentSlug.value]?.label ?? intentSlug.value)
const pageLabels = computed(() => INTENT_CONFIG[intentSlug.value]?.pages ?? ['Page 1', 'Page 2', 'Page 3'])

const totalPages = computed(() => INTENT_CONFIG[intentSlug.value]?.pages.length)
const presetPageIndex = computed(() => totalPages.value - 1)

// Filter presets by intent tag; return both the full key and a cleaned display name
const intentPresets = computed(() => {
  const tag = INTENT_CONFIG[intentSlug.value]?.presetTag
  if (!tag) return []
  return Object.keys(PRESETS)
    .filter((name) => name.includes(`(${tag})`))
    .map((key) => ({
      key,
      displayName: key.replace(/\s*\([^)]+\)$/, ''),
    }))
})

function selectPreset(presetKey: string) {
  // Unlock the AudioContext now, while still in the tap's call stack.
  // PlaybackView will reuse this same context after navigation.
  warmup()
  router.push({ name: 'playback', params: { preset: presetKey } })
}

function advance() {
  if (page.value < presetPageIndex.value) {
    page.value++
  }
}
</script>

<style scoped>
.guidance {
  height: 100%;
  overflow: hidden;
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

.screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 32px;
  padding-top: calc(24px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
}

.screen-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--cs-text);
  text-align: center;
  letter-spacing: -0.3px;
}

.page-subtitle {
  font-size: 16px;
  color: var(--cs-raised);
  text-align: center;
}

.nav-bar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 16px;
}

.step-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cs-raised);
  transition: background 0.25s, transform 0.25s;
}

.dot.active {
  background: var(--cs-action);
  transform: scale(1.25);
}

.nav-buttons {
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

.btn-back {
  background: var(--cs-surf);
  color: var(--cs-text);
}

.btn-next {
  background: var(--cs-action);
  color: var(--cs-bg);
}

/* ── Guidance body (custom page content) ──── */

.guidance-body {
  justify-content: center;
  gap: 20px;
  padding: 0 8px;
}

.guidance-icon {
  color: var(--cs-action);
}

.preset-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-top: 48px;
}

.preset-heading {
  font-size: 22px;
  font-weight: 700;
  color: var(--cs-text);
  text-align: center;
  letter-spacing: -0.3px;
  padding-bottom: 20px;
  flex-shrink: 0;
}

.preset-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
