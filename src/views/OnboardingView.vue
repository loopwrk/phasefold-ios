<template>
  <div class="onboarding">
    <Transition name="fade" mode="out-in">
      <div v-if="step === 0" key="welcome" class="screen welcome-screen">
        <div class="welcome-content">
          <h1 class="welcome-title">Welcome to<br /><strong>Soneuro</strong></h1>
        </div>
      </div>

      <div v-else-if="step === 1" key="intent" class="screen intent-screen">
        <h2 class="intent-title">
          What can <strong>Soneuro</strong>
          <br> help you with <br> today?
        </h2>

        <div class="intent-options">
          <button v-for="option in INTENTS" :key="option.label" class="intent-btn" @click="selectIntent(option.label)">
            {{ option.label }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const step = ref(0)

const INTENTS = [
  { label: 'Reduce anxiety' },
  { label: 'Fall asleep' },
  { label: 'Increase focus' },
]

onMounted(() => {
  setTimeout(() => {
    step.value = 1
  }, 2600)
})

function selectIntent(label: string) {
  router.push('/')
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
  font-family: inherit;
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
