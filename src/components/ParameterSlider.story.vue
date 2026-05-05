<script setup lang="ts">
import { ref } from "vue";
import ParameterSlider from "./ParameterSlider.vue";

const frequency = ref(7.83);
const amplitude = ref(0.5);
</script>

<template>
  <Story title="ParameterSlider">
    <Variant title="Frequency">
      <ParameterSlider
        label="Frequency"
        v-model="frequency"
        :min="0.5"
        :max="40"
        :step="0.01"
        suffix=" Hz"
        subtitle="Base oscillation rate"
      />
    </Variant>
    <Variant title="Amplitude (no subtitle)">
      <ParameterSlider
        label="Amplitude"
        v-model="amplitude"
        :min="0"
        :max="1"
        :step="0.01"
      />
    </Variant>
  </Story>
</template>
