<template>
  <div class="guidance">
    <router-link :to="{ name: 'onboarding', query: { step: '1' } }" class="logo">Soneuro</router-link>
    <Transition name="slide" mode="out-in">
      <div :key="page" class="screen">
        <div v-if="page < 2" class="screen-content">
          <h1 class="page-title">{{ intentLabel }} - page {{ page + 1 }}</h1>
          <p class="page-subtitle">{{ pageLabels[page] }}</p>
        </div>

        <div v-else class="preset-screen">
          <h2 class="preset-heading">Choose a preset</h2>
          <div class="preset-list">
            <PresetCard
              v-for="preset in intentPresets"
              :key="preset"
              :name="preset"
            />
          </div>
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
              {{ page < totalPages - 1 ? 'Next' : 'Begin' }} </button>
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

const route = useRoute()
const router = useRouter()
const page = ref(0)
const totalPages = 3

// Intent slug from route param (e.g. "sleep", "anxiety", "focus")
const intentSlug = computed(() => route.params.intent as string)

const INTENT_CONFIG: Record<string, { label: string; pages: string[]; presetTag: string }> = {
  sleep: {
    label: 'Fall asleep',
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
    pages: ['Setting your space', 'Attention priming', 'Choose a preset'],
    presetTag: 'Cognitive enhancement',
  },
}

const intentLabel = computed(() => INTENT_CONFIG[intentSlug.value]?.label ?? intentSlug.value)
const pageLabels = computed(() => INTENT_CONFIG[intentSlug.value]?.pages ?? ['Page 1', 'Page 2', 'Page 3'])

// Filter presets by intent tag and strip the parenthetical suffix for display
const intentPresets = computed(() => {
  const tag = INTENT_CONFIG[intentSlug.value]?.presetTag
  if (!tag) return []
  return Object.keys(PRESETS)
    .filter((name) => name.includes(`(${tag})`))
    .map((name) => name.replace(/\s*\([^)]+\)$/, ''))
})

function advance() {
  if (page.value < totalPages - 1) {
    page.value++
  } else {
    router.push('/')
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
