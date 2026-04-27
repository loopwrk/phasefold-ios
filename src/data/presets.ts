export interface PresetValues {
  dur: number;
  baseF0: number;
  voices: number;
  layers: number;
  breathRate: number;
  binauralDeltaHz0: number;
  binauralAmount: number;
}

export const PRESETS: Record<string, PresetValues> = {
  "Delta - Neutral Awareness (Sleep and rest)": {
    dur: 360,
    baseF0: 72.0,
    voices: 5,
    layers: 3,
    breathRate: 0.012,
    binauralDeltaHz0: 1.2,
    binauralAmount: 0.05,
  },

  "Delta - Moonrise (Sleep and rest)": {
    dur: 450,
    baseF0: 73.9,
    voices: 1,
    layers: 1,
    breathRate: 0.083,
    binauralDeltaHz0: 2.0,
    binauralAmount: 0.26,
  },

  "Delta - Crossing Currents (Sleep and rest)": {
    dur: 600,
    baseF0: 165.0,
    voices: 2,
    layers: 2,
    breathRate: 0.05,
    binauralDeltaHz0: 1.7,
    binauralAmount: 0.6,
  },

  "Theta - Quieting the Storm (Anxiety reduction)": {
    dur: 500,
    baseF0: 67.0,
    voices: 2,
    layers: 2,
    breathRate: 0.083,
    binauralDeltaHz0: 7.0,
    binauralAmount: 0.5,
  },

  "Theta - Earth Resonance (Anxiety reduction)": {
    dur: 300,
    baseF0: 62.0,
    voices: 2,
    layers: 1,
    breathRate: 0.005,
    binauralDeltaHz0: 7.83,
    binauralAmount: 0.5,
  },

  // 10 Hz: most clinically studied alpha frequency.
  // RCT on MDD (ScienceDirect S0965229921001060)
  // showed significant improvement in cognitive flexibility and working memory;
  // visual entrainment study found 10 Hz superior analgesic effect vs 8 and 12 Hz.
  "Alpha - Inner Light (Anxiety reduction)": {
    dur: 300,
    baseF0: 136.1,
    voices: 5,
    layers: 3,
    breathRate: 0.012, // Restorative
    binauralDeltaHz0: 10.0,
    binauralAmount: 0.4,
  },

  // 9.5 Hz: mid-alpha, associated with grounded meditative states.
  // Low base frequency (G2) and rich odd harmonics produce a warm,
  // deep timbre; slow restorative breath and high layer count give
  // the sound a sustained, enveloping quality over 7.5 minutes.
  "Alpha - Deep Ember (Anxiety reduction)": {
    dur: 450,
    baseF0: 96.0,
    voices: 7,
    layers: 4,
    breathRate: 0.012, // Restorative
    binauralDeltaHz0: 9.5,
    binauralAmount: 0.35,
  },

  // 8.5 Hz: alpha-theta crossover, the hypnagogic boundary.
  // Multiple studies cite this border as optimal for meditative entrainment,
  // creativity, and the transition between waking awareness and dreaming.
  "Alpha - Twilight Threshold (Anxiety reduction)": {
    dur: 400,
    baseF0: 108.0,
    voices: 3,
    layers: 2,
    breathRate: 0.005, // Formless
    binauralDeltaHz0: 8.5,
    binauralAmount: 0.3,
  },

  "Beta - Wolf Moon": {
    dur: 120,
    baseF0: 196.0,
    voices: 2,
    layers: 3,
    breathRate: 0.012,
    binauralDeltaHz0: 14.75,
    binauralAmount: 0.6,
  },

  // 14 Hz: sensorimotor rhythm (SMR, 12–15 Hz).
  // Neurofeedback research: improved sleep spindle density and declarative memory
  "Beta - Restore Focus (Cognitive enhancement)": {
    dur: 240,
    baseF0: 110.0,
    voices: 2,
    layers: 2,
    breathRate: 0.012, // Restorative
    binauralDeltaHz0: 14.0,
    binauralAmount: 0.22,
  },

  // 40 Hz: the most-studied gamma frequency. Research on 40 Hz auditory
  // stimulation showed increased gamma power and reduced amyloid-beta
  // plaques in Alzheimer's mouse models (Iaccarino et al., Nature 2016).
  // Human studies show enhanced c ognitive binding and working memory.
  "Gamma - Solar Wind (Cognitive enhancement)": {
    dur: 300,
    baseF0: 138.6,
    voices: 3,
    layers: 1,
    breathRate: 0.083,
    binauralDeltaHz0: 40.0,
    binauralAmount: 0.4,
  },

  "Gamma - Golden Spiral (Cognitive enhancement)": {
    dur: 300,
    baseF0: 196.0,
    voices: 4,
    layers: 2,
    breathRate: 0.005,
    binauralDeltaHz0: 33.0,
    binauralAmount: 0.4,
  },

  "Gamma - Interwoven (Cognitive enhancement)": {
    dur: 200,
    baseF0: 110.0,
    voices: 2,
    layers: 2,
    breathRate: 0.025,
    binauralDeltaHz0: 36.0,
    binauralAmount: 0.4,
  },

  "Gamma - Bioluminescence (Cognitive enhancement)": {
    dur: 200,
    baseF0: 165.0,
    voices: 6,
    layers: 3,
    breathRate: 0.05,
    binauralDeltaHz0: 42.0,
    binauralAmount: 0.35,
  },

  "Gamma - Oceanic Thoughts (Cognitive enhancement)": {
    dur: 300,
    baseF0: 136.1,
    voices: 9,
    layers: 5,
    breathRate: 0.012,
    binauralDeltaHz0: 53.3,
    binauralAmount: 0.02,
  },

  "Gamma - Impermanence (Cognitive enhancement)": {
    dur: 120,
    baseF0: 132.0,
    voices: 5,
    layers: 3,
    breathRate: 0.005,
    binauralDeltaHz0: 35.0,
    binauralAmount: 0.4,
  },

  "Gamma - Tidal Shift (Cognitive enhancement)": {
    dur: 240,
    baseF0: 110.0,
    voices: 3,
    layers: 1,
    breathRate: 0.005,
    binauralDeltaHz0: 38.0,
    binauralAmount: 0.4,
  },
};
