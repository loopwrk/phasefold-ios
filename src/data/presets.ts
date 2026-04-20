export interface PresetValues {
  dur: number;
  baseF0: number;
  voices: number;
  layers: number;
  breathRate: number;
  binauralDeltaHz0: number;
  binauralAmount: number;
  harmonicEven: number;
  harmonicOdd: number;
  combAmount: number;
  collapseCurve: number;
}

export const PRESETS: Record<string, PresetValues> = {
  "Delta - Sacred Ground": {
    dur: 240,
    baseF0: 136.1,
    voices: 9,
    layers: 5,
    breathRate: 0.083,
    binauralDeltaHz0: 2.5,
    binauralAmount: 0.18,
    harmonicEven: 0.12,
    harmonicOdd: 0.45,
    combAmount: 0.4,
    collapseCurve: 3.5,
  },

  "Delta - Neutral Awareness": {
    dur: 300,
    baseF0: 72.0,
    voices: 5,
    layers: 3,
    breathRate: 0.012,
    binauralDeltaHz0: 1.2,
    binauralAmount: 0.05,
    harmonicEven: 0.06,
    harmonicOdd: 0.1,
    combAmount: 0.04,
    collapseCurve: 1.7,
  },

  "Delta - Moonrise": {
    dur: 300,
    baseF0: 73.9,
    voices: 1,
    layers: 1,
    breathRate: 0.083,
    binauralDeltaHz0: 2.0,
    binauralAmount: 0.26,
    harmonicEven: 0.0,
    harmonicOdd: 0.0,
    combAmount: 0.0,
    collapseCurve: 2.3,
  },

  "Delta - Crossing Currents": {
    dur: 240,
    baseF0: 165.0,
    voices: 2,
    layers: 2,
    breathRate: 0.05,
    binauralDeltaHz0: 1.7,
    binauralAmount: 0.6,
    harmonicEven: 0.02,
    harmonicOdd: 0.02,
    combAmount: 0.0,
    collapseCurve: 2.6,
  },

  "Delta - Murmuration": {
    dur: 190,
    baseF0: 220.0,
    voices: 9,
    layers: 5,
    breathRate: 0.083,
    binauralDeltaHz0: 3.7,
    binauralAmount: 0.35,
    harmonicEven: 0.6,
    harmonicOdd: 0.6,
    combAmount: 0.5,
    collapseCurve: 2.9,
  },

  "Theta - Ancient Forest": {
    dur: 300,
    baseF0: 96.5,
    voices: 9,
    layers: 4,
    breathRate: 0.025,
    binauralDeltaHz0: 5.5,
    binauralAmount: 0.28,
    harmonicEven: 0.22,
    harmonicOdd: 0.38,
    combAmount: 0.22,
    collapseCurve: 1.25,
  },

  "Theta - Meandering River": {
    dur: 240,
    baseF0: 220.0,
    voices: 5,
    layers: 2,
    breathRate: 0.005,
    binauralDeltaHz0: 6.66,
    binauralAmount: 0.6,
    harmonicEven: 0.0,
    harmonicOdd: 0.0,
    combAmount: 0.0,
    collapseCurve: 2.8,
  },

  "Theta - Gentle Rain": {
    dur: 300,
    baseF0: 67.0,
    voices: 2,
    layers: 2,
    breathRate: 0.083,
    binauralDeltaHz0: 7.0,
    binauralAmount: 0.5,
    harmonicEven: 0.05,
    harmonicOdd: 0.02,
    combAmount: 0.06,
    collapseCurve: 1.75,
  },

  "Theta - Earth Resonance": {
    dur: 300,
    baseF0: 25.0,
    voices: 2,
    layers: 1,
    breathRate: 0.005,
    binauralDeltaHz0: 7.83,
    binauralAmount: 0.6,
    harmonicEven: 0.02,
    harmonicOdd: 0.02,
    combAmount: 0.05,
    collapseCurve: 1.6,
  },

  "Alpha - Mandala": {
    dur: 240,
    baseF0: 110.0,
    voices: 4,
    layers: 3,
    breathRate: 0.05,
    binauralDeltaHz0: 11.0,
    binauralAmount: 0.5,
    harmonicEven: 0.25,
    harmonicOdd: 0.37,
    combAmount: 0.15,
    collapseCurve: 2.3,
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
    harmonicEven: 0.1,
    harmonicOdd: 0.15,
    combAmount: 0.08,
    collapseCurve: 2.0,
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
    harmonicEven: 0.0,
    harmonicOdd: 0.05,
    combAmount: 0.02,
    collapseCurve: 1.5,
  },

  "Beta - Wolf Moon": {
    dur: 120,
    baseF0: 196.0,
    voices: 2,
    layers: 3,
    breathRate: 0.012,
    binauralDeltaHz0: 14.75,
    binauralAmount: 0.6,
    harmonicEven: 0.28,
    harmonicOdd: 0.34,
    combAmount: 0.15,
    collapseCurve: 1.9,
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
    harmonicEven: 0.15,
    harmonicOdd: 0.12,
    combAmount: 0.06,
    collapseCurve: 1.8,
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
    harmonicEven: 0.2,
    harmonicOdd: 0.18,
    combAmount: 0.1,
    collapseCurve: 2.0,
  },

  "Gamma - Solar Wind": {
    dur: 300,
    baseF0: 138.6,
    voices: 3,
    layers: 1,
    breathRate: 0.083,
    binauralDeltaHz0: 100.0,
    binauralAmount: 0.6,
    harmonicEven: 0.0,
    harmonicOdd: 0.0,
    combAmount: 0.04,
    collapseCurve: 1.6,
  },

  "Gamma - Golden Spiral": {
    dur: 300,
    baseF0: 196.0,
    voices: 4,
    layers: 2,
    breathRate: 0.005,
    binauralDeltaHz0: 74.02,
    binauralAmount: 0.6,
    harmonicEven: 0.02,
    harmonicOdd: 0.02,
    combAmount: 0.06,
    collapseCurve: 1.65,
  },

  "Gamma - Interwoven": {
    dur: 200,
    baseF0: 88.0,
    voices: 2,
    layers: 2,
    breathRate: 0.025,
    binauralDeltaHz0: 44.0,
    binauralAmount: 0.6,
    harmonicEven: 0.15,
    harmonicOdd: 0.12,
    combAmount: 0.1,
    collapseCurve: 1.9,
  },

  "Gamma - Bioluminescence": {
    dur: 180,
    baseF0: 165.0,
    voices: 6,
    layers: 5,
    breathRate: 0.05,
    binauralDeltaHz0: 47.3,
    binauralAmount: 0.6,
    harmonicEven: 0.52,
    harmonicOdd: 0.55,
    combAmount: 0.42,
    collapseCurve: 2.2,
  },

  "Gamma - Coral Bloom": {
    dur: 323,
    baseF0: 164.8,
    voices: 6,
    layers: 5,
    breathRate: 0.05,
    binauralDeltaHz0: 47.3,
    binauralAmount: 0.6,
    harmonicEven: 0.52,
    harmonicOdd: 0.55,
    combAmount: 0.42,
    collapseCurve: 1.3,
  },

  "Gamma - Oceanic Thoughts": {
    dur: 300,
    baseF0: 136.1,
    voices: 9,
    layers: 5,
    breathRate: 0.012,
    binauralDeltaHz0: 53.3,
    binauralAmount: 0.02,
    harmonicEven: 0.0,
    harmonicOdd: 0.0,
    combAmount: 0.2,
    collapseCurve: 3.05,
  },

  "Gamma - Deep Waters": {
    dur: 300,
    baseF0: 136.1,
    voices: 8,
    layers: 5,
    breathRate: 0.012,
    binauralDeltaHz0: 53.3,
    binauralAmount: 0.02,
    harmonicEven: 0.0,
    harmonicOdd: 0.0,
    combAmount: 0.2,
    collapseCurve: 3.2,
  },

  "Gamma - Aurora Weave": {
    dur: 45,
    baseF0: 140.0,
    voices: 7,
    layers: 2,
    breathRate: 0.005,
    binauralDeltaHz0: 100.0,
    binauralAmount: 0.6,
    harmonicEven: 0.0,
    harmonicOdd: 0.0,
    combAmount: 0.05,
    collapseCurve: 1.3,
  },

  "Gamma - Impermanence": {
    dur: 107,
    baseF0: 132.0,
    voices: 5,
    layers: 3,
    breathRate: 0.005,
    binauralDeltaHz0: 100.0,
    binauralAmount: 0.6,
    harmonicEven: 0.0,
    harmonicOdd: 0.0,
    combAmount: 0.03,
    collapseCurve: 2.6,
  },

  "Gamma - Sacred Geometry": {
    dur: 520,
    baseF0: 120.0,
    voices: 3,
    layers: 2,
    breathRate: 0.005,
    binauralDeltaHz0: 100.0,
    binauralAmount: 0.6,
    harmonicEven: 0.0,
    harmonicOdd: 0.0,
    combAmount: 0.05,
    collapseCurve: 1.65,
  },

  "Gamma - Tidal Shift": {
    dur: 240,
    baseF0: 110.0,
    voices: 3,
    layers: 1,
    breathRate: 0.005,
    binauralDeltaHz0: 100.0,
    binauralAmount: 0.6,
    harmonicEven: 0.0,
    harmonicOdd: 0.0,
    combAmount: 0.04,
    collapseCurve: 1.6,
  },
};
