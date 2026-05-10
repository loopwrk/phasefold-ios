<script setup lang="ts">
import PresetCard from "./PresetCard.vue";

function onPlay() {
  console.log("play fired");
}
</script>

<template>
  <Story title="Cards/PresetCard">
    <Variant title="Compact (default)">
      <PresetCard name="Deep Sleep Delta" @play="onPlay" />
    </Variant>
    <Variant title="Compact - long name">
      <PresetCard name="Morning Focus - High Beta Entrainment" @play="onPlay" />
    </Variant>
    <Variant title="Expanded - Beta">
      <PresetCard
        variant="expanded"
        name="Restore Focus"
        mind-state="beta"
        :duration-seconds="720"
        @play="onPlay"
      />
    </Variant>
    <Variant title="Expanded - Alpha">
      <PresetCard
        variant="expanded"
        name="Soft Open"
        mind-state="alpha"
        :duration-seconds="1080"
        @play="onPlay"
      />
    </Variant>
    <Variant title="Expanded - Delta">
      <PresetCard
        variant="expanded"
        name="Crossing Currents"
        mind-state="delta"
        :duration-seconds="600"
        @play="onPlay"
      />
    </Variant>
    <Variant title="Expanded - Gamma (long name)">
      <PresetCard
        variant="expanded"
        name="Unwavering Clarity of Mind"
        mind-state="gamma"
        :duration-seconds="2700"
        @play="onPlay"
      />
    </Variant>
  </Story>
</template>
