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
  "Delta - Neutral Awareness": {
    dur: 360,
    baseF0: 72.0,
    voices: 5,
    layers: 3,
    breathRate: 0.012,
    binauralDeltaHz0: 1.2,
    binauralAmount: 0.05,
  },

  "Delta - Sacred Ground": {
    dur: 260,
    baseF0: 136.1,
    voices: 7,
    layers: 4,
    breathRate: 0.012,
    binauralDeltaHz0: 2.5,
    binauralAmount: 0.18,
  },

  "Delta - Moonrise": {
    dur: 300,
    baseF0: 73.9,
    voices: 1,
    layers: 1,
    breathRate: 0.083,
    binauralDeltaHz0: 2.0,
    binauralAmount: 0.26,
  },

  "Delta - Crossing Currents": {
    dur: 240,
    baseF0: 165.0,
    voices: 2,
    layers: 2,
    breathRate: 0.05,
    binauralDeltaHz0: 1.7,
    binauralAmount: 0.6,
  },

  "Theta - Ancient Forest": {
    dur: 300,
    baseF0: 96.5,
    voices: 9,
    layers: 4,
    breathRate: 0.025,
    binauralDeltaHz0: 5.5,
    binauralAmount: 0.28,
  },

  "Theta - Gentle Rain": {
    dur: 300,
    baseF0: 67.0,
    voices: 2,
    layers: 2,
    breathRate: 0.083,
    binauralDeltaHz0: 7.0,
    binauralAmount: 0.5,
  },

  "Theta - Earth Resonance": {
    dur: 300,
    baseF0: 62.0,
    voices: 2,
    layers: 1,
    breathRate: 0.005,
    binauralDeltaHz0: 7.83,
    binauralAmount: 0.5,
  },

  "Alpha - Mandala": {
    dur: 240,
    baseF0: 110.0,
    voices: 4,
    layers: 3,
    breathRate: 0.05,
    binauralDeltaHz0: 11.0,
    binauralAmount: 0.5,
  },

  // 10 Hz: most clinically studied alpha frequency.
  // RCT on MDD (ScienceDirect S0965229921001060)
  // showed significant improvement in cognitive flexibility and working memory;
  // visual entrainment study found 10 Hz superior analgesic effect vs 8 and 12 Hz.
  "Alpha - Inner Light": {
    dur: 300,
    baseF0: 136.1,
    voices: 5,
    layers: 3,
    breathRate: 0.012, // Restorative
    binauralDeltaHz0: 10.0,
    binauralAmount: 0.4,
  },

  // 8.5 Hz: alpha-theta crossover, the hypnagogic boundary.
  // Multiple studies cite this border as optimal for meditative entrainment,
  // creativity, and the transition between waking awareness and dreaming.
  "Alpha - Twilight Threshold": {
    dur: 400,
    baseF0: 108.0,
    voices: 3,
    layers: 2,
    breathRate: 0.005, // Formless
    binauralDeltaHz0: 8.5,
    binauralAmount: 0.3,
  },

  // 9.5 Hz: mid-alpha, associated with grounded meditative states.
  // Low base frequency (G2) and rich odd harmonics produce a warm,
  // deep timbre; slow restorative breath and high layer count give
  // the sound a sustained, enveloping quality over 7.5 minutes.
  "Alpha - Deep Ember": {
    dur: 450,
    baseF0: 96.0,
    voices: 7,
    layers: 4,
    breathRate: 0.012, // Restorative
    binauralDeltaHz0: 9.5,
    binauralAmount: 0.35,
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
  // (PMC2572745); 15 Hz binaural beats enhanced functional brain connectivity
  // (MDPI Brain Sci 12/9/1161). Calm alertness without agitation.
  "Beta - Calm Focus": {
    dur: 240,
    baseF0: 110.0,
    voices: 4,
    layers: 2,
    breathRate: 0.025, // Meditative
    binauralDeltaHz0: 14.0,
    binauralAmount: 0.35,
  },

  // 18 Hz: mid-beta, studied in PMC12145584: beta BBT reduced anxiety,
  // heart rate, and diastolic blood pressure. Garcia-Argibay meta-analysis
  // included beta-range studies in the overall g=0.45 effect size.
  "Beta - Soft Vigilance": {
    dur: 240,
    baseF0: 165.0, // E3: bright but not harsh
    voices: 5,
    layers: 3,
    breathRate: 0.05, // Relaxed
    binauralDeltaHz0: 18.0,
    binauralAmount: 0.3,
  },

  // 40 Hz: the most-studied gamma frequency. Research on 40 Hz auditory
  // stimulation showed increased gamma power and reduced amyloid-beta
  // plaques in Alzheimer's mouse models (Iaccarino et al., Nature 2016).
  // Human studies show enhanced cognitive binding and working memory.
  "Gamma - Solar Wind": {
    dur: 300,
    baseF0: 138.6,
    voices: 3,
    layers: 1,
    breathRate: 0.083,
    binauralDeltaHz0: 40.0,
    binauralAmount: 0.4,
  },

  "Gamma - Golden Spiral": {
    dur: 300,
    baseF0: 196.0,
    voices: 4,
    layers: 2,
    breathRate: 0.005,
    binauralDeltaHz0: 33.0,
    binauralAmount: 0.4,
  },

  "Gamma - Interwoven": {
    dur: 200,
    baseF0: 110.0,
    voices: 2,
    layers: 2,
    breathRate: 0.025,
    binauralDeltaHz0: 36.0,
    binauralAmount: 0.4,
  },

  "Gamma - Bioluminescence": {
    dur: 200,
    baseF0: 165.0,
    voices: 6,
    layers: 3,
    breathRate: 0.05,
    binauralDeltaHz0: 42.0,
    binauralAmount: 0.35,
  },

  "Gamma - Oceanic Thoughts": {
    dur: 300,
    baseF0: 136.1,
    voices: 9,
    layers: 5,
    breathRate: 0.012,
    binauralDeltaHz0: 53.3,
    binauralAmount: 0.02,
  },

  "Gamma - Deep Waters": {
    dur: 300,
    baseF0: 136.1,
    voices: 8,
    layers: 5,
    breathRate: 0.012,
    binauralDeltaHz0: 53.3,
    binauralAmount: 0.02,
  },

  "Gamma - Aurora Weave": {
    dur: 120,
    baseF0: 140.0,
    voices: 7,
    layers: 2,
    breathRate: 0.005,
    binauralDeltaHz0: 40.0,
    binauralAmount: 0.4,
  },

  "Gamma - Impermanence": {
    dur: 120,
    baseF0: 132.0,
    voices: 5,
    layers: 3,
    breathRate: 0.005,
    binauralDeltaHz0: 35.0,
    binauralAmount: 0.4,
  },

  "Gamma - Sacred Geometry": {
    dur: 520,
    baseF0: 120.0,
    voices: 3,
    layers: 2,
    breathRate: 0.005,
    binauralDeltaHz0: 33.0,
    binauralAmount: 0.4,
  },

  "Gamma - Tidal Shift": {
    dur: 240,
    baseF0: 110.0,
    voices: 3,
    layers: 1,
    breathRate: 0.005,
    binauralDeltaHz0: 38.0,
    binauralAmount: 0.4,
  },
};
