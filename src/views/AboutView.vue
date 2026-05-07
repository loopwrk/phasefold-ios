<template>
  <div class="about">
    <div class="top-bar">
      <router-link :to="{ name: 'onboarding', query: { step: '1' } }" class="logo">{{ t('onboarding.appName')
        }}</router-link>
    </div>

    <div class="about-content">
      <div class="about-section">
        <h2 class="about-heading">{{ t('about.whatYoullHear') }}</h2>
        <p class="about-body">{{ t('about.whatYoullHearIntro') }}</p>
        <p class="about-body">{{ t('about.whatYoullHearDescription') }}</p>
      </div>

      <div class="about-section">
        <h2 class="about-heading">{{ t('about.howItWorks') }}</h2>
        <p class="about-body">{{ t('about.howItWorksP1') }}</p>
        <p class="about-body">{{ t('about.howItWorksP2') }}</p>
        <p class="about-body">{{ t('about.howItWorksP3') }}</p>
        <p class="about-body">{{ t('about.howItWorksP4') }}</p>
      </div>
    </div>

    <div class="about-bar">
      <AppButton variant="surface" @click="router.back()">
        <template #icon-left>
          <AppIcon name="arrow-left" :size="14" />
        </template>
        {{ t('common.back') }}
      </AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppButton from '../components/Buttons/AppButton.vue'
import AppIcon from '../components/Icons/AppIcon.vue'

const { t } = useI18n()
const router = useRouter()
</script>

<style scoped>
.about {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(16px + env(safe-area-inset-top, 0px)) 32px 0;
  flex-shrink: 0;
}

.logo {
  font-size: 18px;
  font-weight: 700;
  color: var(--cs-text);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

.about-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 32px 32px 8px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.about-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.about-heading {
  font-size: 20px;
  font-weight: 700;
  color: var(--cs-text);
  letter-spacing: -0.3px;
}

.about-body {
  font-size: 15px;
  line-height: 1.6;
  color: var(--cs-text);
}

.about-bar {
  padding: 16px 32px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
}
</style>
