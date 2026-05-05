<script setup lang="ts">
import PresetCard from "./PresetCard.vue";

function onPlay() {
  console.log("play fired");
}
</script>

<template>
  <Story title="Cards/PresetCard">
    <Variant title="Default">
      <PresetCard name="Deep Sleep Delta" @play="onPlay" />
    </Variant>
    <Variant title="Long name">
      <PresetCard name="Morning Focus - High Beta Entrainment" @play="onPlay" />
    </Variant>
  </Story>
</template>
