<template>
  <div class="onboarding">
    <Transition name="fade" mode="out-in">
      <div v-if="step === 0" key="welcome" class="screen welcome-screen">
        <div class="welcome-content">
          <h1 class="welcome-title">{{ t('onboarding.welcomeTo') }}<br /><strong>{{ t('onboarding.appName') }}</strong></h1>
        </div>
      </div>

      <div v-else-if="step === 1" key="intent" class="screen intent-screen">
        <h2 class="intent-title" v-html="t('onboarding.intentQuestion', { appName: `<strong>${t('onboarding.appName')}</strong>` })" />

        <div class="intent-options">
          <button v-for="option in INTENTS" :key="option.slug" class="intent-btn" @click="selectIntent(option.slug)">
            {{ t(`onboarding.intents.${option.slug}`) }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// Skip the welcome splash if arriving from guidance (via ?step=1)
const initialStep = route.query.step === '1' ? 1 : 0
const step = ref(initialStep)

const INTENTS = [
  { slug: 'focus' },
  { slug: 'sleep' },
  { slug: 'anxiety' },
]

onMounted(() => {
  if (step.value === 0) {
    setTimeout(() => {
      step.value = 1
    }, 2600)
  }
})

function selectIntent(slug: string) {
  router.push({ name: 'guidance', params: { intent: slug } })
}
</script>

<style scoped>
.onboarding {
  height: 100%;
  overflow: hidden;
}

.screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 72px;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.welcome-screen {
  justify-content: center;
  align-items: center;
  position: relative;
}

.welcome-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-title {
  font-size: 36px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--cs-text);
  text-align: center;
  letter-spacing: -0.5px;
}

.welcome-title strong {
  font-weight: 800;
}

.welcome-footnote {
  font-size: 13px;
  color: var(--cs-raised);
  padding-bottom: 24px;
}

.intent-screen {
  justify-content: center;
  gap: 40px;
}

.intent-title {
  font-size: 30px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--cs-text);
  text-align: center;
  letter-spacing: -0.3px;
  padding-top: 60px;
}

.intent-title strong {
  font-weight: 800;
}

.intent-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 8px;
}

.intent-btn {
  padding: 20px 24px;
  font-size: 18px;
  font-weight: 600;
  color: var(--cs-bg);
  background: var(--cs-action);
  border: none;
  border-radius: 16px;
  cursor: pointer;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
