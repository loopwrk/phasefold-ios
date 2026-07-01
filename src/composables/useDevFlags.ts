/**
 * Shared dev-only feature flags.
 *
 * State lives in module-scope refs so it persists across route
 * navigations without a store. These flags are intended for
 * development and testing only - they are not exposed to end users.
 */

import { ref } from 'vue'

const binauralEnabled = ref(true)
const stereoWidthLfoEnabled = ref(true)
const haasDelayEnabled = ref(true)
const stateEvolutionEnabled = ref(true)
const fmEnabled = ref(true)
const detuneConvergenceEnabled = ref(true)

export function useDevFlags() {
  return {
    binauralEnabled,
    stereoWidthLfoEnabled,
    haasDelayEnabled,
    stateEvolutionEnabled,
    fmEnabled,
    detuneConvergenceEnabled,
  }
}
