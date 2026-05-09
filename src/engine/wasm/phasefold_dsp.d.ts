/** Type declarations for the wasm-pack generated module (built with --no-typescript). */
declare module '*phasefold_dsp.js' {
  export default function init(): Promise<void>

  export function smooth_envelope(
    input: Float32Array,
    cutoff_hz: number,
    sample_rate: number,
    state: number,
  ): Float32Array

  export function linspace(start: number, end: number, n: number): Float32Array
  export function interp(x: Float32Array, xp: Float32Array, fp: Float32Array): Float32Array
  export function stabilize_state(v0: number, v1: number): Float64Array
  export function apply_phi(v0: number, v1: number, lam: number, theta_step: number, eps: number): Float64Array

  export function synthesize_layer(
    conv_gain: Float32Array, ctrl_l: Float32Array, base_f: Float32Array,
    drift_phase: Float32Array, cents: Float32Array, phase0: Float32Array,
    layer_detune: number, fm_scale: number, am_scale: number, sample_rate: number,
  ): Float32Array

  export function mix_layers(
    layer_sums_flat: Float32Array, activity_env: Float32Array, layers: number,
  ): Float32Array

  export function apply_base_tone_and_harmonics(
    mix: Float32Array, base_f0: number, sample_rate: number,
    amp_env: Float32Array, breath: Float32Array, voice_emerge_env: Float32Array,
    conv_gain: Float32Array, base_effects_env: Float32Array,
    overtone_power: number, harmonic_even: number, harmonic_odd: number,
  ): Float32Array

  export function apply_stereo_binaural(
    mix: Float32Array, conv_gain: Float32Array, base_effects_env: Float32Array,
    breath: Float32Array, stereo_width_lfo: Float32Array, sample_times: Float32Array,
    base_f0: number, sample_rate: number, binaural_delta_hz0: number,
    binaural_amount: number, breath_rate: number,
  ): Float32Array

  export function finalize_stereo(
    left: Float32Array, right: Float32Array,
    pure_tone_vol_env: Float32Array, activity_ctrl_smooth: Float32Array,
    ctrl_progress: Float32Array, sample_rate: number, control_hz: number,
  ): Float32Array

  export class SeededRNG {
    constructor(seed: number)
    next(): number
    normal(mu: number, sigma: number): number
    normal_array(mu: number, sigma: number, n: number): Float32Array
    uniform_array(lo: number, hi: number, n: number): Float32Array
  }
}
