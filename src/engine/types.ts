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
  binauralDeltaHz0: number; // initial binaural beat delta
  binauralAmount: number; // binaural mix level
  overtonePower: number; // harmonic decay exponent
  voiceDelay: number; // seconds before voices emerge
  breathRate: number; // Hz — stereo breath oscillation

  // Dev-only feature toggles (default to true / enabled)
  enableStereoWidthLfo?: boolean;
  enableHaasDelay?: boolean;
  enableStateEvolution?: boolean;
  enableFm?: boolean;
  enableDetuneConvergence?: boolean;
}

export interface StereoAudio {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

export const AUDIO_SR = 44100;
export const CONTROL_HZ = 60.0;

/* Engine version: part of the reproducibility contract. The same
 * (engineVersion, params, seed) triple always produces bit-identical
 * audio on a given device. Bump whenever a change alters generated
 * output for identical inputs - e.g. v2 was the fused block engine
 * rewrite (sine table oscillators, block-interpolated envelopes). */
export const ENGINE_VERSION = 2;

// ── Web Worker message protocol ────────────────

export type WorkerRequest = {
  type: "generate";
  params: SynthParams;
};

export type WorkerResponse =
  | { type: "progress"; percent: number; section: string; elapsedMs?: number }
  | {
      type: "result";
      left: Float32Array;
      right: Float32Array;
      sampleRate: number;
      elapsedMs?: number;
    }
  | { type: "error"; message: string };
