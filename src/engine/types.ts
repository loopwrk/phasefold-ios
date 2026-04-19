/**
 * Phasefold — Type definitions
 *
 * These mirror the Python original's parameter space exactly.
 * The generator accepts a full SynthParams object; the UI maps
 * its user-facing subset into one before calling generateAudio().
 */

export interface SynthParams {
  dur: number; // seconds
  sampleRate: number; // Hz (44 100)
  baseF0: number; // root frequency in Hz
  voices: number; // oscillators per layer
  layers: number; // recursive depth layers
  seed: number; // PRNG seed for detune / phase
  fmIndex0: number; // initial FM modulation depth
  amIndex0: number; // initial AM modulation depth
  collapseCurve: number; // exponent controlling convergence shape
  binauralDeltaHz0: number; // initial binaural beat delta
  binauralAmount: number; // binaural mix level
  overtonePower: number; // harmonic decay exponent
  harmonicEven: number; // even Chebyshev harmonic level
  harmonicOdd: number; // odd Chebyshev harmonic level
  combAmount: number; // comb filter intensity
  voiceDelay: number; // seconds before voices emerge
  breathRate: number; // Hz — stereo breath oscillation
}

export interface StereoAudio {
  left: Float64Array;
  right: Float64Array;
  sampleRate: number;
}

export const AUDIO_SR = 44100;
export const CONTROL_HZ = 60.0;
