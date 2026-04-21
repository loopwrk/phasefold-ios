/**
 * Phasefold — DSP helpers
 *
 * Ports of the Python utility functions
 */

// ────────────────────────────────────────────────
// Seeded PRNG  (Mulberry32 + Box-Muller)
// ────────────────────────────────────────────────

export class SeededRNG {
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

// ────────────────────────────────────────────────
// Array helpers  (minimal NumPy equivalents)
// ────────────────────────────────────────────────

export function linspace(start: number, end: number, n: number): Float32Array {
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
export function interp(
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

// ────────────────────────────────────────────────
// One-pole low-pass  (smooth_envelope)
// ────────────────────────────────────────────────

/**
 * y[n] = y[n-1] + alpha * (x[n] - y[n-1])
 * where alpha = 1 - exp(-2 pi fc / sr)
 */
export function smoothEnvelope(
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

// ────────────────────────────────────────────────
// Simplex state-vector helpers
// ────────────────────────────────────────────────

const EPS = 1e-12;

/** Sigmoid-normalise a 2-element vector onto the probability simplex. */
export function stabilizeState(v: [number, number]): [number, number] {
  const c0 = Math.max(-8, Math.min(8, v[0]));
  const c1 = Math.max(-8, Math.min(8, v[1]));
  const s0 = 1.0 / (1.0 + Math.exp(-c0));
  const s1 = 1.0 / (1.0 + Math.exp(-c1));
  const s = s0 + s1 + EPS;
  return [s0 / s, s1 / s];
}

/** Retrocausal projection toward the "unified" state. */
function projP(v: [number, number]): [number, number] {
  const st = stabilizeState(v);
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
export function applyPhi(
  v: [number, number],
  lam: number,
  thetaStep: number,
  eps: number,
): [number, number] {
  lam = Math.max(0, Math.min(1, lam));
  const theta = Math.max(-0.05, Math.min(0.05, thetaStep));
  const vs = stabilizeState(v);
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
