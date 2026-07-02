<template>
  <div class="guidance">
    <div class="top-bar">
      <router-link :to="{ name: 'onboarding', query: { step: '1' } }" class="logo">{{ t('onboarding.appName')
        }}</router-link>
      <AppButton variant="surface" icon @click="goToHowItWorks">
        <AppIcon name="question" :size="24" />
      </AppButton>
    </div>
    <Transition name="slide" mode="out-in">

      <div v-if="page < presetPageIndex" :key="page" class="screen">
        <div class="screen-content guidance-body">
          <div v-if="currentPage.showIcon" class="guidance-icon">
            <AppIcon name="headphones" :size="40" />
          </div>

          <!-- Body paragraphs -->
          <p v-for="(para, i) in currentPage.body" :key="i"
            :class="['text-body', para.modifier ? `text-body--${para.modifier}` : '']" v-html="para.text" />
          <p class="text-body text-body--muted">{{ currentPage.cta }}</p>
        </div>

        <div class="nav-bar">
          <div class="step-dots">
            <span v-for="i in totalPages" :key="i" :class="['dot', { active: i - 1 === page }]" />
          </div>

          <div class="nav-buttons">
            <button class="btn btn-back" @click="goBack">
              {{ t('common.back') }}
            </button>
            <button class="btn btn-next" @click="advance">
              {{ t('common.next') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Preset picker -->
      <div v-else key="presets" class="screen">
        <div class="preset-screen">
          <h2 class="preset-heading">{{ t('guidance.choosePreset') }}</h2>
          <div class="preset-list">
            <PresetCard v-for="preset in intentPresets" :key="preset.key" variant="expanded" :name="preset.displayName"
              :mind-state="preset.mindState" :duration-seconds="preset.dur" @play="selectPreset(preset.key)" />
          </div>
        </div>

        <div v-if="isDev" class="dev-toggles">
          <label class="dev-toggle">
            <input type="checkbox" v-model="binauralEnabled" />
            <span class="dev-toggle-label">Binaural beats</span>
            <span class="dev-badge">DEV</span>
          </label>
          <label class="dev-toggle">
            <input type="checkbox" v-model="stereoWidthLfoEnabled" />
            <span class="dev-toggle-label">Stereo width LFO</span>
            <span class="dev-badge">DEV</span>
          </label>
          <label class="dev-toggle">
            <input type="checkbox" v-model="haasDelayEnabled" />
            <span class="dev-toggle-label">Stereo delay (Haas)</span>
            <span class="dev-badge">DEV</span>
          </label>
          <label class="dev-toggle">
            <input type="checkbox" v-model="stateEvolutionEnabled" />
            <span class="dev-toggle-label">State evolution (phi)</span>
            <span class="dev-badge">DEV</span>
          </label>
          <label class="dev-toggle">
            <input type="checkbox" v-model="fmEnabled" />
            <span class="dev-toggle-label">FM synthesis</span>
            <span class="dev-badge">DEV</span>
          </label>
          <label class="dev-toggle">
            <input type="checkbox" v-model="detuneConvergenceEnabled" />
            <span class="dev-toggle-label">Detune convergence</span>
            <span class="dev-badge">DEV</span>
          </label>
        </div>

        <div class="nav-bar">
          <div class="step-dots">
            <span v-for="i in totalPages" :key="i" :class="['dot', { active: i - 1 === page }]" />
          </div>

          <div class="nav-buttons">
            <button class="btn btn-back" @click="page--">
              {{ t('common.back') }}
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
import { useI18n } from 'vue-i18n'
import AppButton from '../components/Buttons/AppButton.vue'
import AppIcon from '../components/Icons/AppIcon.vue'
import PresetCard from '../components/Cards/PresetCard.vue'
import { PRESETS, type Intent, type MindState } from '../data/presets'
import { warmupMedia } from '../engine/audioElement'
import { useDevFlags } from '../composables/useDevFlags'

const { t, tm } = useI18n()
const route = useRoute()
const router = useRouter()
const { binauralEnabled, stereoWidthLfoEnabled, haasDelayEnabled, stateEvolutionEnabled, fmEnabled, detuneConvergenceEnabled } = useDevFlags()
const intentSlug = computed(() => route.params.intent as string)

// Engine feature toggles are a development tool only: Vite replaces
// import.meta.env.DEV with false in production builds, so the block
// never renders on deployed sites.
const isDev = import.meta.env.DEV

// Page content definition: show icon?, body paragraphs, and optional
// text modifier. Driven entirely by the locale JSON.
// Declared before resolveInitialPage which depends on it.

interface GuidancePara {
  text: string
  modifier?: string
}

interface GuidancePage {
  showIcon?: boolean
  body: GuidancePara[]
  cta: string
}

// Maps each intent to its ordered guidance pages.
const PAGE_DEFS: Record<string, (t: (key: string) => string) => GuidancePage[]> = {
  sleep: (t) => [
    {
      showIcon: true,
      body: [
        { text: t('guidance.sleep.page0.icon') },
        { text: t('guidance.sleep.page0.position') },
        { text: t('guidance.sleep.page0.prompt'), modifier: '500' },
        { text: t('guidance.sleep.page0.adjust') },
      ],
      cta: t('guidance.sleep.page0.cta'),
    },
    {
      body: [
        { text: t('guidance.sleep.page1.breathe') },
        { text: t('guidance.sleep.page1.release') },
      ],
      cta: t('guidance.sleep.page1.cta'),
    },
  ],
  anxiety: (t) => [
    {
      showIcon: true,
      body: [
        { text: t('guidance.anxiety.page0.icon') },
        { text: t('guidance.anxiety.page0.comfort') },
      ],
      cta: t('guidance.anxiety.page0.cta'),
    },
    {
      body: [
        { text: t('guidance.anxiety.page1.arc') },
        { text: t('guidance.anxiety.page1.permission') },
      ],
      cta: t('guidance.anxiety.page1.cta'),
    },
  ],
  focus: (t) => [
    {
      showIcon: true,
      body: [
        { text: t('guidance.focus.page0.icon') },
        { text: t('guidance.focus.page0.approach') },
        { text: t('guidance.focus.page0.distractions') },
      ],
      cta: t('guidance.focus.page0.cta'),
    },
  ],
}

function resolveInitialPage(): number {
  const pageQuery = route.query.page as string | undefined
  if (pageQuery === 'presets') {
    const defs = PAGE_DEFS[route.params.intent as string]
    return defs ? defs(t).length : 0
  }
  return Number(pageQuery) || 0
}
const page = ref(resolveInitialPage())

const guidancePages = computed(() => PAGE_DEFS[intentSlug.value]?.(t) ?? [])
const currentPage = computed<GuidancePage>(() =>
  guidancePages.value[page.value] ?? { body: [], cta: '' }
)

// Total pages = guidance steps + 1 for the preset picker
const totalPages = computed(() => guidancePages.value.length + 1)
const presetPageIndex = computed(() => guidancePages.value.length)

// Filter presets by intent; return both the full key and a cleaned display name
const intentPresets = computed(() => {
  const slug = intentSlug.value as Intent
  return Object.entries(PRESETS)
    .filter(([, preset]) => preset.intents.includes(slug))
    .map(([key, preset]) => {
      const dashIdx = key.indexOf(' - ')
      const mindState = dashIdx > 0 ? key.slice(0, dashIdx).toLowerCase() as MindState : 'delta' as MindState
      const afterDash = dashIdx > 0 ? key.slice(dashIdx + 3) : key
      const displayName = afterDash.replace(/\s*\([^)]+\)$/, '')
      return { key, displayName, mindState, dur: preset.dur }
    })
})

function selectPreset(presetKey: string) {
  // Prime the shared audio element now, while still in the tap's call
  // stack: iOS only allows programmatic play() on a gesture-blessed
  // element. PlaybackView reuses the same element after navigation.
  warmupMedia()
  router.push({ name: 'playback', params: { preset: presetKey } })
}

function goBack() {
  if (page.value > 0) {
    page.value--
  } else {
    router.push({ name: 'onboarding', query: { step: '1' } })
  }
}

function goToHowItWorks() {
  router.push({ name: 'about' })
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

.top-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: calc(16px + env(safe-area-inset-top, 0px)) 32px 0;
  z-index: 1;
}

.logo {
  font-size: 18px;
  font-weight: 700;
  color: var(--cs-text);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

.screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 32px;
  padding-top: calc(24px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(76px + env(safe-area-inset-bottom, 0px));
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
  justify-content: center;
  min-height: 0;
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
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}

.dev-toggles {
  display: flex;
  flex-direction: column;
}

.dev-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  font-size: 13px;
  color: var(--cs-raised);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.dev-toggle input {
  accent-color: var(--cs-action);
}

.dev-toggle-label {
  flex: 1;
}

.dev-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--cs-raised);
  color: var(--cs-bg);
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
