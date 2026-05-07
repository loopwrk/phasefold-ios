<script setup lang="ts">
import AppIcon from './AppIcon.vue'
</script>

<template>
  <Story title="Icons/AppIcon">
    <Variant title="Headphones">
      <AppIcon name="headphones" :size="40" />
    </Variant>
    <Variant title="Arrow left">
      <AppIcon name="arrow-left" :size="14" />
    </Variant>
    <Variant title="Arrow right">
      <AppIcon name="arrow-right" :size="14" />
    </Variant>
    <Variant title="Play">
      <AppIcon name="play" :size="16" />
    </Variant>
    <Variant title="Question">
      <AppIcon name="question" :size="24" />
    </Variant>
    <Variant title="Large (48px)">
      <AppIcon name="headphones" :size="48" />
    </Variant>
  </Story>
</template>
