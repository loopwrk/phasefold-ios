/**
 * Phasefold — Wasm DSP bridge
 *
 * Lazy-loads the Rust/Wasm module and re-exports DSP functions with
 * the same signatures as the TypeScript originals in ../dsp.ts.
 *
 * Usage in the worker:
 *   import { smoothEnvelope } from './wasm/dsp'
 *
 * The Wasm module is initialised once on first call. Subsequent calls
 * reuse the cached instance.
 */

// wasm-pack --target web generates an ES module with an `init` default
// export and named function exports. The path is relative to this file
// after Vite resolves it.
//
// NOTE: After running `crate/build.sh`, the built module lives at
// `crate/pkg/phasefold_dsp.js`. Vite handles the .wasm asset.
import wasmInit, {
  smooth_envelope as wasmSmoothEnvelope,
  linspace as wasmLinspace,
  interp as wasmInterp,
  stabilize_state as wasmStabilizeState,
  apply_phi as wasmApplyPhi,
  synthesize_layer as wasmSynthesizeLayer,
  mix_layers as wasmMixLayers,
  apply_base_tone_and_harmonics as wasmApplyBaseToneAndHarmonics,
  apply_stereo_binaural as wasmApplyStereoBinaural,
  SeededRNG as WasmSeededRNG,
} from '../../../crate/pkg/phasefold_dsp.js'

let initialised = false

/**
 * Ensure the Wasm module is loaded. Safe to call multiple times -
 * only the first call does real work.
 */
export async function initWasm(): Promise<void> {
  if (initialised) return
  await wasmInit()
  initialised = true
}

/**
 * One-pole low-pass filter — Rust/Wasm implementation.
 *
 * Signature matches the TypeScript original in dsp.ts:
 *   smoothEnvelope(input, cutoffHz, sampleRate, state?) => Float32Array
 *
 * IMPORTANT: initWasm() must be awaited before calling this.
 */
export function smoothEnvelope(
  input: Float32Array,
  cutoffHz: number,
  sampleRate: number,
  state = 0,
): Float32Array {
  // wasm-bindgen accepts plain number arrays or typed arrays for &[f32].
  // It returns a Vec<f32> as a plain JS array, so we wrap it.
  const result = wasmSmoothEnvelope(input, cutoffHz, sampleRate, state)
  return result instanceof Float32Array ? result : new Float32Array(result)
}

/**
 * Generate n evenly spaced values from start to end — Rust/Wasm implementation.
 *
 * Signature matches the TypeScript original in dsp.ts:
 *   linspace(start, end, n) => Float32Array
 */
export function linspace(
  start: number,
  end: number,
  n: number,
): Float32Array {
  const result = wasmLinspace(start, end, n)
  return result instanceof Float32Array ? result : new Float32Array(result)
}

/**
 * 1-D linear interpolation — Rust/Wasm implementation.
 *
 * Signature matches the TypeScript original in dsp.ts:
 *   interp(x, xp, fp) => Float32Array
 */
export function interp(
  x: Float32Array,
  xp: Float32Array,
  fp: Float32Array,
): Float32Array {
  const result = wasmInterp(x, xp, fp)
  return result instanceof Float32Array ? result : new Float32Array(result)
}

/**
 * Sigmoid-normalise a 2-element vector onto the probability simplex.
 * Signature matches the TypeScript original in dsp.ts.
 */
export function stabilizeState(v: [number, number]): [number, number] {
  const result = wasmStabilizeState(v[0], v[1])
  return [result[0], result[1]]
}

/**
 * Core recursive transformation Phi.
 * Signature matches the TypeScript original in dsp.ts.
 */
export function applyPhi(
  v: [number, number],
  lam: number,
  thetaStep: number,
  eps: number,
): [number, number] {
  const result = wasmApplyPhi(v[0], v[1], lam, thetaStep, eps)
  return [result[0], result[1]]
}

/**
 * Inner loop of layer synthesis - Rust/Wasm implementation.
 * Signature matches the swappable function in dsp.ts.
 */
export function synthesizeLayer(
  convGain: Float32Array,
  ctrlL: Float32Array,
  baseF: Float32Array,
  driftPhase: Float32Array,
  cents: Float32Array,
  phase0: Float32Array,
  layerDetune: number,
  fmScale: number,
  amScale: number,
  sampleRate: number,
): Float32Array {
  const result = wasmSynthesizeLayer(
    convGain, ctrlL, baseF, driftPhase,
    cents, phase0, layerDetune, fmScale, amScale, sampleRate,
  )
  return result instanceof Float32Array ? result : new Float32Array(result)
}

/**
 * Collapse-aware layer weighting - Rust/Wasm implementation.
 * Accepts layerSums as an array of Float32Arrays (one per layer),
 * flattens them for the Wasm call, and returns the weighted mix.
 */
export function mixLayers(
  layerSums: Float32Array[],
  activityEnv: Float32Array,
): Float32Array {
  const layers = layerSums.length
  if (layers === 0) return new Float32Array(activityEnv.length)
  const n = activityEnv.length

  const flat = new Float32Array(layers * n)
  for (let ell = 0; ell < layers; ell++) {
    flat.set(layerSums[ell], ell * n)
  }

  const result = wasmMixLayers(flat, activityEnv, layers)
  return result instanceof Float32Array ? result : new Float32Array(result)
}

/**
 * Base tone + Chebyshev harmonics - Rust/Wasm implementation.
 * Signature matches the swappable function in dsp.ts.
 */
export function applyBaseToneAndHarmonics(
  mix: Float32Array,
  baseF0: number,
  sampleRate: number,
  ampEnv: Float32Array,
  breath: Float32Array,
  voiceEmergeEnv: Float32Array,
  convGain: Float32Array,
  baseEffectsEnv: Float32Array,
  overtonePower: number,
  harmonicEven: number,
  harmonicOdd: number,
): Float32Array {
  const result = wasmApplyBaseToneAndHarmonics(
    mix, baseF0, sampleRate, ampEnv, breath,
    voiceEmergeEnv, convGain, baseEffectsEnv,
    overtonePower, harmonicEven, harmonicOdd,
  )
  return result instanceof Float32Array ? result : new Float32Array(result)
}

/**
 * Stereo + binaural rendering - Rust/Wasm implementation.
 * Returns { left: Float32Array, right: Float32Array } de-interleaved
 * from the Wasm output.
 */
export function applyStereoBinaural(
  mix: Float32Array,
  convGain: Float32Array,
  baseEffectsEnv: Float32Array,
  breath: Float32Array,
  stereoWidthLFO: Float32Array,
  sampleTimes: Float32Array,
  baseF0: number,
  sampleRate: number,
  binauralDeltaHz0: number,
  binauralAmount: number,
  breathRate: number,
): { left: Float32Array; right: Float32Array } {
  const raw = wasmApplyStereoBinaural(
    mix, convGain, baseEffectsEnv, breath,
    stereoWidthLFO, sampleTimes,
    baseF0, sampleRate, binauralDeltaHz0, binauralAmount, breathRate,
  )
  const interleaved = raw instanceof Float32Array ? raw : new Float32Array(raw)
  const n = interleaved.length / 2
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    left[i] = interleaved[2 * i]
    right[i] = interleaved[2 * i + 1]
  }
  return { left, right }
}

/**
 * Seeded PRNG — Rust/Wasm implementation.
 *
 * Wraps the Wasm SeededRNG struct with the same API as the TS class
 * so it can be used as a drop-in replacement.
 */
export class SeededRNG {
  private inner: WasmSeededRNG

  constructor(seed: number) {
    this.inner = new WasmSeededRNG(seed)
  }

  next(): number {
    return this.inner.next()
  }

  normal(mu: number, sigma: number): number {
    return this.inner.normal(mu, sigma)
  }

  normalArray(mu: number, sigma: number, n: number): Float32Array {
    const result = this.inner.normal_array(mu, sigma, n)
    return result instanceof Float32Array ? result : new Float32Array(result)
  }

  uniformArray(lo: number, hi: number, n: number): Float32Array {
    const result = this.inner.uniform_array(lo, hi, n)
    return result instanceof Float32Array ? result : new Float32Array(result)
  }
}
