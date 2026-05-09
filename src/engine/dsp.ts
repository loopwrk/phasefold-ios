/**
 * Phasefold — DSP helpers
 *
 * Ports of the Python utility functions
 */

// ────────────────────────────────────────────────
// Seeded PRNG  (Mulberry32 + Box-Muller)
// ────────────────────────────────────────────────

export interface ISeededRNG {
  next(): number;
  normal(mu: number, sigma: number): number;
  normalArray(mu: number, sigma: number, n: number): Float32Array;
  uniformArray(lo: number, hi: number, n: number): Float32Array;
}

export type SeededRNGFactory = (seed: number) => ISeededRNG;

class SeededRNGTS implements ISeededRNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed | 0;
  }

  /** Uniform in [0, 1) — Mulberry32 */
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Gaussian via Box-Muller */
  normal(mu: number, sigma: number): number {
    const u1 = this.next() || 1e-10; // avoid log(0)
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mu + sigma * z;
  }

  normalArray(mu: number, sigma: number, n: number): Float32Array {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = this.normal(mu, sigma);
    return a;
  }

  uniformArray(lo: number, hi: number, n: number): Float32Array {
    const a = new Float32Array(n);
    const range = hi - lo;
    for (let i = 0; i < n; i++) a[i] = lo + range * this.next();
    return a;
  }
}

let seededRNGFactory: SeededRNGFactory = (seed) => new SeededRNGTS(seed);

/** Create a SeededRNG instance (delegates to active implementation). */
export function createSeededRNG(seed: number): ISeededRNG {
  return seededRNGFactory(seed);
}

/** Replace the SeededRNG factory (e.g. with the Wasm version). */
export function setSeededRNGFactory(factory: SeededRNGFactory): void {
  seededRNGFactory = factory;
}

// Legacy export — keeps `new SeededRNG(seed)` working in existing code
export const SeededRNG = SeededRNGTS;

// ────────────────────────────────────────────────
// Array helpers  (minimal NumPy equivalents)
// ────────────────────────────────────────────────

export type LinspaceFn = (start: number, end: number, n: number) => Float32Array;
export type InterpFn = (x: Float32Array, xp: Float32Array, fp: Float32Array) => Float32Array;

function linspaceTS(start: number, end: number, n: number): Float32Array {
  const a = new Float32Array(n);
  if (n <= 1) {
    a[0] = start;
    return a;
  }
  const step = (end - start) / (n - 1);
  for (let i = 0; i < n; i++) a[i] = start + i * step;
  return a;
}

/**
 * 1-D linear interpolation — equivalent to np.interp(x, xp, fp).
 * Assumes xp is monotonically increasing.
 */
function interpTS(
  x: Float32Array,
  xp: Float32Array,
  fp: Float32Array,
): Float32Array {
  const out = new Float32Array(x.length);
  let j = 0;
  for (let i = 0; i < x.length; i++) {
    // Advance j so xp[j] <= x[i] < xp[j+1]
    while (j < xp.length - 2 && xp[j + 1] < x[i]) j++;
    const dx = xp[j + 1] - xp[j] || 1e-12;
    const t = (x[i] - xp[j]) / dx;
    out[i] = fp[j] + t * (fp[j + 1] - fp[j]);
  }
  return out;
}

let linspaceImpl: LinspaceFn = linspaceTS;
let interpImpl: InterpFn = interpTS;

export function linspace(start: number, end: number, n: number): Float32Array {
  return linspaceImpl(start, end, n);
}

export function interp(x: Float32Array, xp: Float32Array, fp: Float32Array): Float32Array {
  return interpImpl(x, xp, fp);
}

export function setLinspaceImpl(impl: LinspaceFn): void {
  linspaceImpl = impl;
}

export function setInterpImpl(impl: InterpFn): void {
  interpImpl = impl;
}

// ────────────────────────────────────────────────
// One-pole low-pass  (smooth_envelope)
// ────────────────────────────────────────────────

/**
 * y[n] = y[n-1] + alpha * (x[n] - y[n-1])
 * where alpha = 1 - exp(-2 pi fc / sr)
 */

export type SmoothEnvelopeFn = (
  input: Float32Array,
  cutoffHz: number,
  sampleRate: number,
  state?: number,
) => Float32Array;

function smoothEnvelopeTS(
  input: Float32Array,
  cutoffHz: number,
  sampleRate: number,
  state = 0,
): Float32Array {
  if (input.length === 0) return input;
  if (!isFinite(cutoffHz) || cutoffHz <= 0 || cutoffHz >= 0.5 * sampleRate) {
    return Float32Array.from(input);
  }
  const alpha = 1.0 - Math.exp((-2.0 * Math.PI * cutoffHz) / sampleRate);
  const out = new Float32Array(input.length);
  let acc = state;
  for (let i = 0; i < input.length; i++) {
    acc += alpha * (input[i] - acc);
    out[i] = acc;
  }
  return out;
}

/** Active implementation — defaults to TS, swappable to Wasm via setSmoothEnvelopeImpl. */
let smoothEnvelopeImpl: SmoothEnvelopeFn = smoothEnvelopeTS;

export function smoothEnvelope(
  input: Float32Array,
  cutoffHz: number,
  sampleRate: number,
  state = 0,
): Float32Array {
  return smoothEnvelopeImpl(input, cutoffHz, sampleRate, state);
}

/** Replace the smoothEnvelope implementation (e.g. with the Wasm version). */
export function setSmoothEnvelopeImpl(impl: SmoothEnvelopeFn): void {
  smoothEnvelopeImpl = impl;
}

// ────────────────────────────────────────────────
// Simplex state-vector helpers
// ────────────────────────────────────────────────

const EPS = 1e-12;

export type StabilizeStateFn = (v: [number, number]) => [number, number];
export type ApplyPhiFn = (v: [number, number], lam: number, thetaStep: number, eps: number) => [number, number];

/** Sigmoid-normalise a 2-element vector onto the probability simplex. */
function stabilizeStateTS(v: [number, number]): [number, number] {
  const c0 = Math.max(-8, Math.min(8, v[0]));
  const c1 = Math.max(-8, Math.min(8, v[1]));
  const s0 = 1.0 / (1.0 + Math.exp(-c0));
  const s1 = 1.0 / (1.0 + Math.exp(-c1));
  const s = s0 + s1 + EPS;
  return [s0 / s, s1 / s];
}

/** Retrocausal projection toward the "unified" state. */
function projP(v: [number, number]): [number, number] {
  const st = stabilizeStateTS(v);
  const s = st[0] + st[1];
  return [s, 0];
}

/** Bistochastic mixing matrix (returns [a,b,c,d] for [[a,b],[c,d]]). */
function mixR(theta: number): [number, number, number, number] {
  const c = 0.5 * (1.0 + Math.cos(theta));
  const s = 0.5 * (1.0 + Math.sin(theta));
  return [c, s, 1.0 - c, 1.0 - s];
}

/** Asymmetry tilt matrix. */
function tiltA(eps: number): [number, number, number, number] {
  const e = Math.max(0, Math.min(0.25, eps));
  return [1.0, e, 0.0, 1.0 - e];
}

/**
 * Core recursive transformation Phi.
 * Combines projection (lambda), tilt (eps), and rotation (thetaStep).
 */
function applyPhiTS(
  v: [number, number],
  lam: number,
  thetaStep: number,
  eps: number,
): [number, number] {
  lam = Math.max(0, Math.min(1, lam));
  const theta = Math.max(-0.05, Math.min(0.05, thetaStep));
  const vs = stabilizeStateTS(v);
  const p = projP(vs);

  // Step 1 — blend toward projection
  const v1_0 = (1 - lam) * vs[0] + lam * p[0];
  const v1_1 = (1 - lam) * vs[1] + lam * p[1];

  // Step 2 — tilt
  const T = tiltA(eps);
  const v2_0 = T[0] * v1_0 + T[1] * v1_1;
  const v2_1 = T[2] * v1_0 + T[3] * v1_1;

  // Step 3 — rotation
  const M = mixR(theta);
  let v3_0 = M[0] * v2_0 + M[1] * v2_1;
  let v3_1 = M[2] * v2_0 + M[3] * v2_1;

  // Renormalise
  v3_0 = Math.max(EPS, Math.min(1, v3_0));
  v3_1 = Math.max(EPS, Math.min(1, v3_1));
  const sum = v3_0 + v3_1;
  return [v3_0 / sum, v3_1 / sum];
}

let stabilizeStateImpl: StabilizeStateFn = stabilizeStateTS;
let applyPhiImpl: ApplyPhiFn = applyPhiTS;

export function stabilizeState(v: [number, number]): [number, number] {
  return stabilizeStateImpl(v);
}

export function applyPhi(
  v: [number, number],
  lam: number,
  thetaStep: number,
  eps: number,
): [number, number] {
  return applyPhiImpl(v, lam, thetaStep, eps);
}

export function setStabilizeStateImpl(impl: StabilizeStateFn): void {
  stabilizeStateImpl = impl;
}

export function setApplyPhiImpl(impl: ApplyPhiFn): void {
  applyPhiImpl = impl;
}

// ────────────────────────────────────────────────
// Layer synthesis inner loop
// ────────────────────────────────────────────────

export type SynthesizeLayerFn = (
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
) => Float32Array;

const TWO_PI_DSP = 2 * Math.PI;

function synthesizeLayerTS(
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
  const N = convGain.length;
  const voices = cents.length;
  if (N === 0 || voices === 0) return new Float32Array(N);

  const phaseModL = new Float32Array(N);
  let cumMod = 0;
  for (let i = 0; i < N; i++) {
    const fmL = Math.min(fmScale * convGain[i], 0.6);
    cumMod += (TWO_PI_DSP * ctrlL[i] * fmL) / sampleRate;
    phaseModL[i] = cumMod;
  }

  const midsumL = new Float32Array(N);
  for (let v = 0; v < voices; v++) {
    const centV = cents[v];
    let phaseCum = phase0[v];
    for (let i = 0; i < N; i++) {
      const df = Math.pow(2, (centV / 1200.0) * convGain[i]);
      phaseCum += (TWO_PI_DSP * df * baseF[i] * layerDetune) / sampleRate;
      const totalPhase = phaseCum + driftPhase[i] + phaseModL[i];
      const amL = Math.min(amScale * convGain[i], 0.4);
      const amp = 1 - amL + amL * ctrlL[i];
      midsumL[i] += Math.sin(totalPhase) * amp;
    }
  }

  for (let i = 0; i < N; i++) midsumL[i] /= voices;
  return midsumL;
}

let synthesizeLayerImpl: SynthesizeLayerFn = synthesizeLayerTS;

export function synthesizeLayer(
  convGain: Float32Array, ctrlL: Float32Array, baseF: Float32Array,
  driftPhase: Float32Array, cents: Float32Array, phase0: Float32Array,
  layerDetune: number, fmScale: number, amScale: number, sampleRate: number,
): Float32Array {
  return synthesizeLayerImpl(convGain, ctrlL, baseF, driftPhase, cents, phase0, layerDetune, fmScale, amScale, sampleRate);
}

export function setSynthesizeLayerImpl(impl: SynthesizeLayerFn): void {
  synthesizeLayerImpl = impl;
}

// ────────────────────────────────────────────────
// Collapse-aware layer weighting
// ────────────────────────────────────────────────

export type MixLayersFn = (
  layerSums: Float32Array[],
  activityEnv: Float32Array,
) => Float32Array;

function mixLayersTS(
  layerSums: Float32Array[],
  activityEnv: Float32Array,
): Float32Array {
  const layers = layerSums.length;
  const N = activityEnv.length;
  if (N === 0 || layers === 0) return new Float32Array(N);

  const mix = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let wSum = 0;
    let signal = 0;
    for (let ell = 0; ell < layers; ell++) {
      const w = Math.pow(activityEnv[i], ell + 1);
      signal += w * layerSums[ell][i];
      wSum += w;
    }
    mix[i] = signal / Math.max(1e-9, wSum);
  }
  return mix;
}

let mixLayersImpl: MixLayersFn = mixLayersTS;

export function mixLayers(
  layerSums: Float32Array[],
  activityEnv: Float32Array,
): Float32Array {
  return mixLayersImpl(layerSums, activityEnv);
}

export function setMixLayersImpl(impl: MixLayersFn): void {
  mixLayersImpl = impl;
}

// ────────────────────────────────────────────────
// Base tone + Chebyshev harmonics
// ────────────────────────────────────────────────

export type ApplyBaseToneAndHarmonicsFn = (
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
) => Float32Array;

function applyBaseToneAndHarmonicsTS(
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
  const N = mix.length;
  if (N === 0) return new Float32Array(0);

  const out = new Float32Array(N);

  // Section 14: base tone
  let basePhaseAcc = 0;
  for (let i = 0; i < N; i++) {
    basePhaseAcc += (TWO_PI_DSP * baseF0) / sampleRate;
    const core = Math.sin(basePhaseAcc) * ampEnv[i] * (0.5 + 0.5 * breath[i]);
    const gain = Math.max(0.75, Math.min(1.25,
      1.0 + 0.15 * (1 - voiceEmergeEnv[i]) - 0.1 * voiceEmergeEnv[i] * convGain[i],
    ));
    const baseTone = core * gain;
    out[i] = Math.tanh(0.9 * (baseTone + (mix[i] - baseTone) * voiceEmergeEnv[i]));
  }

  // Section 15: Chebyshev harmonics
  for (let i = 0; i < N; i++) {
    const x = Math.max(-1, Math.min(1, out[i]));
    const even = 2 * x * x - 1;
    const odd = 4 * x * x * x - 3 * x;
    const env = Math.pow(convGain[i], overtonePower) * baseEffectsEnv[i];
    out[i] = Math.tanh(out[i] + env * (harmonicEven * even + harmonicOdd * odd));
  }

  return out;
}

let applyBaseToneAndHarmonicsImpl: ApplyBaseToneAndHarmonicsFn = applyBaseToneAndHarmonicsTS;

export function applyBaseToneAndHarmonics(
  mix: Float32Array, baseF0: number, sampleRate: number,
  ampEnv: Float32Array, breath: Float32Array, voiceEmergeEnv: Float32Array,
  convGain: Float32Array, baseEffectsEnv: Float32Array,
  overtonePower: number, harmonicEven: number, harmonicOdd: number,
): Float32Array {
  return applyBaseToneAndHarmonicsImpl(mix, baseF0, sampleRate, ampEnv, breath, voiceEmergeEnv, convGain, baseEffectsEnv, overtonePower, harmonicEven, harmonicOdd);
}

export function setApplyBaseToneAndHarmonicsImpl(impl: ApplyBaseToneAndHarmonicsFn): void {
  applyBaseToneAndHarmonicsImpl = impl;
}

// ────────────────────────────────────────────────
// Stereo + binaural rendering
// ────────────────────────────────────────────────

export type ApplyStereoBinauralFn = (
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
) => { left: Float32Array; right: Float32Array };

function applyStereoBinauralTS(
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
  const N = mix.length;
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  if (N === 0) return { left: L, right: R };

  // Binaural oscillators
  const bL = new Float32Array(N);
  const bR = new Float32Array(N);
  let binLPhase = 0;
  let binRPhase = 0;
  const BD_DEPTH = 0.1;
  for (let i = 0; i < N; i++) {
    const binEnv = Math.pow(convGain[i], 1.4);
    const binauralDeltaModulated =
      binauralDeltaHz0 * (1 + BD_DEPTH * Math.sin(TWO_PI_DSP * breathRate * sampleTimes[i]));
    const deltaT = binauralDeltaModulated * binEnv * baseEffectsEnv[i];
    binLPhase += (TWO_PI_DSP * (baseF0 - 0.5 * deltaT)) / sampleRate;
    binRPhase += (TWO_PI_DSP * (baseF0 + 0.5 * deltaT)) / sampleRate;
    bL[i] = Math.sin(binLPhase);
    bR[i] = Math.sin(binRPhase);
  }

  // Stereo delay (48 samples ~ 1.1 ms)
  const delaySamps = 48;
  const delayed = new Float32Array(N);
  for (let i = delaySamps; i < N; i++) {
    delayed[i] = mix[i - delaySamps];
  }

  // Compose L / R
  for (let i = 0; i < N; i++) {
    const binEnv = Math.pow(convGain[i], 1.4);
    const be = baseEffectsEnv[i];
    const breathPan = convGain[i] * be;
    const breathL = 0.5 + breathPan * (0.1 + 0.4 * breath[i] - 0.5);
    const breathR = 0.5 + breathPan * (0.1 + 0.4 * (1 - breath[i]) - 0.5);

    const lBase = mix[i] * breathL + binauralAmount * binEnv * bL[i];
    const rBase = mix[i] * breathR + binauralAmount * binEnv * bR[i];

    const stEnv = 0.5 * stereoWidthLFO[i] * convGain[i] * be;
    L[i] = lBase + stEnv * delayed[i];
    R[i] = rBase - stEnv * delayed[i];
  }

  return { left: L, right: R };
}

let applyStereoBinauralImpl: ApplyStereoBinauralFn = applyStereoBinauralTS;

export function applyStereoBinaural(
  mix: Float32Array, convGain: Float32Array, baseEffectsEnv: Float32Array,
  breath: Float32Array, stereoWidthLFO: Float32Array, sampleTimes: Float32Array,
  baseF0: number, sampleRate: number,
  binauralDeltaHz0: number, binauralAmount: number, breathRate: number,
): { left: Float32Array; right: Float32Array } {
  return applyStereoBinauralImpl(mix, convGain, baseEffectsEnv, breath, stereoWidthLFO, sampleTimes, baseF0, sampleRate, binauralDeltaHz0, binauralAmount, breathRate);
}

export function setApplyStereoBinauralImpl(impl: ApplyStereoBinauralFn): void {
  applyStereoBinauralImpl = impl;
}

// ────────────────────────────────────────────────
// Post-processing (fade, collapse detect, normalise)
// ────────────────────────────────────────────────

export type FinalizeStereoFn = (
  left: Float32Array,
  right: Float32Array,
  pureToneVolEnv: Float32Array,
  activityCtrlSmooth: Float32Array,
  ctrlProgress: Float32Array,
  sampleRate: number,
  controlHz: number,
) => { left: Float32Array; right: Float32Array };

function finalizeStereoTS(
  left: Float32Array,
  right: Float32Array,
  pureToneVolEnv: Float32Array,
  activityCtrlSmooth: Float32Array,
  ctrlProgress: Float32Array,
  sampleRate: number,
  controlHz: number,
): { left: Float32Array; right: Float32Array } {
  const N = left.length;
  if (N === 0) return { left: new Float32Array(0), right: new Float32Array(0) };

  const L = Float32Array.from(left);
  const R = Float32Array.from(right);

  // 17. Fade in (0.5 s)
  const fadeInSamps = Math.floor(0.5 * sampleRate);
  for (let i = 0; i < fadeInSamps && i < N; i++) {
    const f = i / (fadeInSamps - 1 || 1);
    L[i] *= f;
    R[i] *= f;
  }

  // Pure tone volume envelope
  for (let i = 0; i < N; i++) {
    L[i] *= pureToneVolEnv[i];
    R[i] *= pureToneVolEnv[i];
  }

  // 18. Collapse detection
  const Nc = activityCtrlSmooth.length;

  const dCtrl = new Float32Array(Nc);
  for (let i = 1; i < Nc; i++) {
    dCtrl[i] = Math.abs(activityCtrlSmooth[i] - activityCtrlSmooth[i - 1]) * controlHz;
  }
  const dCtrlSmooth = smoothEnvelope(dCtrl, 0.5, controlHz);

  const eps = 1e-3;
  const quietSecs = 21.0;
  const quietSteps = Math.max(1, Math.round(quietSecs * controlHz));

  let lastActive = -1;
  for (let i = 0; i < Nc; i++) {
    if (dCtrlSmooth[i] > eps) lastActive = i;
  }

  const stopCtrlIdx = lastActive >= 0 ? Math.min(Nc - 1, lastActive + quietSteps) : Nc - 1;
  const stopT = ctrlProgress[stopCtrlIdx];
  const stopIdx = Math.max(1, Math.min(Math.round(stopT * N), N));

  // 19. Decide final length
  const minLength = Math.floor(0.85 * N);
  const outLen = stopIdx < minLength ? N : stopIdx;

  const finalL = new Float32Array(outLen);
  const finalR = new Float32Array(outLen);
  finalL.set(L.subarray(0, outLen));
  finalR.set(R.subarray(0, outLen));

  // 20. Fade out (equal-power, 1 s)
  const fadeOutSamps = Math.max(1, Math.min(Math.round(1.0 * sampleRate), finalL.length));
  for (let i = 0; i < fadeOutSamps; i++) {
    const f = Math.cos((0.5 * Math.PI * i) / (fadeOutSamps - 1 || 1));
    const idx = finalL.length - fadeOutSamps + i;
    finalL[idx] *= f;
    finalR[idx] *= f;
  }

  // 21. Headroom normalise (-1.5 dBFS)
  let peak = 1e-12;
  for (let i = 0; i < finalL.length; i++) {
    peak = Math.max(peak, Math.abs(finalL[i]), Math.abs(finalR[i]));
  }
  const gain = Math.pow(10, -1.5 / 20) / peak;
  for (let i = 0; i < finalL.length; i++) {
    finalL[i] *= gain;
    finalR[i] *= gain;
  }

  return { left: finalL, right: finalR };
}

let finalizeStereoImpl: FinalizeStereoFn = finalizeStereoTS;

export function finalizeStereo(
  left: Float32Array, right: Float32Array, pureToneVolEnv: Float32Array,
  activityCtrlSmooth: Float32Array, ctrlProgress: Float32Array,
  sampleRate: number, controlHz: number,
): { left: Float32Array; right: Float32Array } {
  return finalizeStereoImpl(left, right, pureToneVolEnv, activityCtrlSmooth, ctrlProgress, sampleRate, controlHz);
}

export function setFinalizeStereoImpl(impl: FinalizeStereoFn): void {
  finalizeStereoImpl = impl;
}

// ────────────────────────────────────────────────
// Note naming
// ────────────────────────────────────────────────

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export function freqToNoteName(freq: number): string {
  if (freq <= 0) return "---";
  const semitones = 12 * Math.log2(freq / 440);
  const idx = Math.round(semitones);
  const noteIdx = (((9 + idx) % 12) + 12) % 12;
  const octave = 4 + Math.floor((9 + idx) / 12);
  return `${NOTE_NAMES[noteIdx]}${octave}`;
}
