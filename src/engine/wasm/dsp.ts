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
