//! Phasefold DSP — Rust/Wasm engine
//!
//! Incremental port of the TypeScript DSP helpers. Each function is
//! exposed to JS via wasm-bindgen and accepts/returns raw f32 slices
//! through shared linear memory.

use wasm_bindgen::prelude::*;
use std::f32::consts::PI;
use std::f64::consts::PI as PI_F64;

const TWO_PI: f32 = 2.0 * PI;
const TWO_PI_F64: f64 = 2.0 * PI_F64;

// ────────────────────────────────────────────────
// Seeded PRNG (Mulberry32 + Box-Muller)
// ────────────────────────────────────────────────

/// Deterministic PRNG matching the TypeScript SeededRNG class exactly.
///
/// Uses Mulberry32 for uniform generation and Box-Muller for gaussian.
/// All intermediate math uses the same types as JS to ensure bit-identical
/// output:
///   - `next()`: u32 wrapping arithmetic → f64 division (matches JS >>> 0 / 4294967296)
///   - `normal()`: f64 throughout (matches JS Math.sqrt/log/cos which are f64)
///   - Array outputs truncate to f32 at the boundary (matches Float32Array storage)
#[wasm_bindgen]
pub struct SeededRNG {
    s: u32,
}

#[wasm_bindgen]
impl SeededRNG {
    /// Create a new PRNG with the given seed.
    /// The `| 0` in TS converts to i32; we store as u32 for wrapping ops.
    #[wasm_bindgen(constructor)]
    pub fn new(seed: i32) -> SeededRNG {
        SeededRNG { s: seed as u32 }
    }

    /// Uniform in [0, 1) — Mulberry32.
    /// Returns f64 to match JS number precision.
    pub fn next(&mut self) -> f64 {
        // self.s += 0x6D2B79F5  (wrapping)
        self.s = self.s.wrapping_add(0x6D2B_79F5);
        let mut t = self.s;
        // t = Math.imul(t ^ (t >>> 15), t | 1)
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        // t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t));
        // ((t ^ (t >>> 14)) >>> 0) / 4294967296
        let out = t ^ (t >> 14);
        (out as f64) / 4_294_967_296.0
    }

    /// Gaussian via Box-Muller — uses f64 throughout to match JS Math.
    pub fn normal(&mut self, mu: f64, sigma: f64) -> f64 {
        let u1 = {
            let v = self.next();
            if v == 0.0 { 1e-10 } else { v }
        };
        let u2 = self.next();
        let z = (-2.0 * u1.ln()).sqrt() * (TWO_PI_F64 * u2).cos();
        mu + sigma * z
    }

    /// Generate n gaussian samples as Float32Array.
    /// f64 → f32 truncation happens here, matching TS Float32Array storage.
    pub fn normal_array(&mut self, mu: f64, sigma: f64, n: usize) -> Vec<f32> {
        let mut a = vec![0.0_f32; n];
        for i in 0..n {
            a[i] = self.normal(mu, sigma) as f32;
        }
        a
    }

    /// Generate n uniform samples in [lo, hi) as Float32Array.
    pub fn uniform_array(&mut self, lo: f64, hi: f64, n: usize) -> Vec<f32> {
        let mut a = vec![0.0_f32; n];
        let range = hi - lo;
        for i in 0..n {
            a[i] = (lo + range * self.next()) as f32;
        }
        a
    }
}

// ────────────────────────────────────────────────
// Simplex state-vector helpers
// ────────────────────────────────────────────────

const EPS: f64 = 1e-12;

/// Sigmoid-normalise a 2-element vector onto the probability simplex.
/// Returns [s0/sum, s1/sum] where s_i = sigmoid(clamp(v_i, -8, 8)).
fn stabilize_state_inner(v0: f64, v1: f64) -> (f64, f64) {
    let c0 = v0.max(-8.0).min(8.0);
    let c1 = v1.max(-8.0).min(8.0);
    let s0 = 1.0 / (1.0 + (-c0).exp());
    let s1 = 1.0 / (1.0 + (-c1).exp());
    let s = s0 + s1 + EPS;
    (s0 / s, s1 / s)
}

/// Retrocausal projection toward the "unified" state.
fn proj_p(v0: f64, v1: f64) -> (f64, f64) {
    let (st0, st1) = stabilize_state_inner(v0, v1);
    let s = st0 + st1;
    (s, 0.0)
}

/// Bistochastic mixing matrix — returns (a, b, c, d) for [[a,b],[c,d]].
fn mix_r(theta: f64) -> (f64, f64, f64, f64) {
    let c = 0.5 * (1.0 + theta.cos());
    let s = 0.5 * (1.0 + theta.sin());
    (c, s, 1.0 - c, 1.0 - s)
}

/// Asymmetry tilt matrix.
fn tilt_a(eps: f64) -> (f64, f64, f64, f64) {
    let e = eps.max(0.0).min(0.25);
    (1.0, e, 0.0, 1.0 - e)
}

/// Exposed to JS: stabilizeState([v0, v1]) → [s0, s1]
/// Returns a 2-element Vec<f64> (wasm-bindgen maps to Float64Array).
#[wasm_bindgen]
pub fn stabilize_state(v0: f64, v1: f64) -> Vec<f64> {
    let (s0, s1) = stabilize_state_inner(v0, v1);
    vec![s0, s1]
}

/// Exposed to JS: applyPhi(v0, v1, lam, thetaStep, eps) → [r0, r1]
///
/// Core recursive transformation Phi. Combines projection (lambda),
/// tilt (eps), and rotation (thetaStep).
#[wasm_bindgen]
pub fn apply_phi(
    v0: f64,
    v1: f64,
    lam: f64,
    theta_step: f64,
    eps_param: f64,
) -> Vec<f64> {
    let lam = lam.max(0.0).min(1.0);
    let theta = theta_step.max(-0.05).min(0.05);
    let (vs0, vs1) = stabilize_state_inner(v0, v1);
    let (p0, p1) = proj_p(vs0, vs1);

    // Step 1 — blend toward projection
    let v1_0 = (1.0 - lam) * vs0 + lam * p0;
    let v1_1 = (1.0 - lam) * vs1 + lam * p1;

    // Step 2 — tilt
    let (t0, t1, t2, t3) = tilt_a(eps_param);
    let v2_0 = t0 * v1_0 + t1 * v1_1;
    let v2_1 = t2 * v1_0 + t3 * v1_1;

    // Step 3 — rotation
    let (m0, m1, m2, m3) = mix_r(theta);
    let mut v3_0 = m0 * v2_0 + m1 * v2_1;
    let mut v3_1 = m2 * v2_0 + m3 * v2_1;

    // Renormalise
    v3_0 = v3_0.max(EPS).min(1.0);
    v3_1 = v3_1.max(EPS).min(1.0);
    let sum = v3_0 + v3_1;
    vec![v3_0 / sum, v3_1 / sum]
}

// ────────────────────────────────────────────────
// One-pole low-pass filter (smooth_envelope)
// ────────────────────────────────────────────────

/// y[n] = y[n-1] + alpha * (x[n] - y[n-1])
/// where alpha = 1 - exp(-2 pi fc / sr)
///
/// Mirrors the TypeScript `smoothEnvelope` in dsp.ts exactly.
/// Takes ownership of the input and returns a new Vec<f32> as a
/// JS-visible Float32Array.
#[wasm_bindgen]
pub fn smooth_envelope(
    input: &[f32],
    cutoff_hz: f32,
    sample_rate: f32,
    state: f32,
) -> Vec<f32> {
    let n = input.len();
    if n == 0 {
        return vec![];
    }

    // Guard: invalid cutoff returns a copy (matches TS behaviour)
    if !cutoff_hz.is_finite()
        || cutoff_hz <= 0.0
        || cutoff_hz >= 0.5 * sample_rate
    {
        return input.to_vec();
    }

    let alpha = 1.0 - (-TWO_PI * cutoff_hz / sample_rate).exp();
    let mut out = vec![0.0_f32; n];
    let mut acc = state;

    for i in 0..n {
        acc += alpha * (input[i] - acc);
        out[i] = acc;
    }

    out
}

// ────────────────────────────────────────────────
// Array helpers (linspace, interp)
// ────────────────────────────────────────────────

/// Generate `n` evenly spaced values from `start` to `end` (inclusive).
/// Mirrors the TypeScript `linspace` in dsp.ts.
#[wasm_bindgen]
pub fn linspace(start: f32, end: f32, n: usize) -> Vec<f32> {
    let mut a = vec![0.0_f32; n];
    if n <= 1 {
        if n == 1 {
            a[0] = start;
        }
        return a;
    }
    let step = (end - start) / (n as f32 - 1.0);
    for i in 0..n {
        a[i] = start + i as f32 * step;
    }
    a
}

/// 1-D linear interpolation — equivalent to np.interp(x, xp, fp).
/// Assumes `xp` is monotonically increasing.
/// Mirrors the TypeScript `interp` in dsp.ts.
#[wasm_bindgen]
pub fn interp(x: &[f32], xp: &[f32], fp: &[f32]) -> Vec<f32> {
    let nx = x.len();
    let nxp = xp.len();
    let mut out = vec![0.0_f32; nx];
    let mut j: usize = 0;

    for i in 0..nx {
        // Advance j so xp[j] <= x[i] < xp[j+1]
        while j < nxp.saturating_sub(2) && xp[j + 1] < x[i] {
            j += 1;
        }
        let dx = {
            let d = xp[j + 1] - xp[j];
            if d.abs() < 1e-12 { 1e-12 } else { d }
        };
        let t = (x[i] - xp[j]) / dx;
        out[i] = fp[j] + t * (fp[j + 1] - fp[j]);
    }

    out
}

// ────────────────────────────────────────────────
// Tests (run with `cargo test`)
// ────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn smooth_envelope_empty() {
        let result = smooth_envelope(&[], 1.0, 44100.0, 0.0);
        assert!(result.is_empty());
    }

    #[test]
    fn smooth_envelope_invalid_cutoff_returns_copy() {
        let input = vec![1.0, 2.0, 3.0];
        // Cutoff of 0 is invalid
        let result = smooth_envelope(&input, 0.0, 44100.0, 0.0);
        assert_eq!(result, input);
        // Cutoff above Nyquist is invalid
        let result2 = smooth_envelope(&input, 30000.0, 44100.0, 0.0);
        assert_eq!(result2, input);
    }

    #[test]
    fn smooth_envelope_step_response() {
        // Step input: should converge toward 1.0
        let input = vec![1.0; 1000];
        let result = smooth_envelope(&input, 10.0, 44100.0, 0.0);
        // First sample should be small (just alpha * 1.0)
        assert!(result[0] > 0.0 && result[0] < 0.01);
        // Last sample should be very close to 1.0
        assert!((result[999] - 1.0).abs() < 0.001);
        // Monotonically increasing
        for i in 1..result.len() {
            assert!(result[i] >= result[i - 1]);
        }
    }

    #[test]
    fn smooth_envelope_with_initial_state() {
        let input = vec![1.0; 100];
        let result = smooth_envelope(&input, 10.0, 44100.0, 0.5);
        // First sample should start from state=0.5 toward 1.0
        assert!(result[0] > 0.5);
    }

    // ── stabilize_state / apply_phi ────────────────

    #[test]
    fn stabilize_state_sums_to_one() {
        let result = stabilize_state(0.0, 1.0);
        let sum = result[0] + result[1];
        assert!((sum - 1.0).abs() < 1e-10);
    }

    #[test]
    fn stabilize_state_symmetric_input() {
        let result = stabilize_state(0.0, 0.0);
        // Equal inputs → equal outputs
        assert!((result[0] - result[1]).abs() < 1e-10);
    }

    #[test]
    fn apply_phi_output_sums_to_one() {
        let result = apply_phi(0.5, 0.5, 0.5, 0.01, 0.1);
        let sum = result[0] + result[1];
        assert!((sum - 1.0).abs() < 1e-10);
    }

    #[test]
    fn apply_phi_convergence() {
        // With high lambda, output should converge toward [1, 0]
        let result = apply_phi(0.3, 0.7, 0.99, 0.0, 0.0);
        assert!(result[0] > 0.9);
    }

    // ── SeededRNG ─────────────────────────────────

    #[test]
    fn rng_deterministic() {
        let mut a = SeededRNG::new(2025);
        let mut b = SeededRNG::new(2025);
        for _ in 0..100 {
            assert_eq!(a.next().to_bits(), b.next().to_bits());
        }
    }

    #[test]
    fn rng_uniform_range() {
        let mut rng = SeededRNG::new(42);
        for _ in 0..1000 {
            let v = rng.next();
            assert!(v >= 0.0 && v < 1.0);
        }
    }

    #[test]
    fn rng_normal_array_length() {
        let mut rng = SeededRNG::new(2025);
        let arr = rng.normal_array(0.0, 12.0, 5);
        assert_eq!(arr.len(), 5);
    }

    #[test]
    fn rng_uniform_array_range() {
        let mut rng = SeededRNG::new(2025);
        let arr = rng.uniform_array(0.0, 6.283185307, 10);
        assert_eq!(arr.len(), 10);
        for &v in &arr {
            assert!(v >= 0.0 && v < 6.3);
        }
    }

    // ── linspace ──────────────────────────────────

    #[test]
    fn linspace_basic() {
        let result = linspace(0.0, 1.0, 5);
        assert_eq!(result.len(), 5);
        assert!((result[0] - 0.0).abs() < 1e-7);
        assert!((result[4] - 1.0).abs() < 1e-7);
        assert!((result[2] - 0.5).abs() < 1e-7);
    }

    #[test]
    fn linspace_single() {
        let result = linspace(3.0, 10.0, 1);
        assert_eq!(result.len(), 1);
        assert!((result[0] - 3.0).abs() < 1e-7);
    }

    #[test]
    fn linspace_empty() {
        let result = linspace(0.0, 1.0, 0);
        assert!(result.is_empty());
    }

    // ── interp ────────────────────────────────────

    #[test]
    fn interp_basic() {
        let xp = vec![0.0, 1.0];
        let fp = vec![0.0, 10.0];
        let x = vec![0.0, 0.5, 1.0];
        let result = interp(&x, &xp, &fp);
        assert!((result[0] - 0.0).abs() < 1e-6);
        assert!((result[1] - 5.0).abs() < 1e-6);
        assert!((result[2] - 10.0).abs() < 1e-6);
    }

    #[test]
    fn interp_multi_segment() {
        let xp = vec![0.0, 0.5, 1.0];
        let fp = vec![0.0, 10.0, 0.0];
        let x = vec![0.25, 0.5, 0.75];
        let result = interp(&x, &xp, &fp);
        assert!((result[0] - 5.0).abs() < 1e-5);
        assert!((result[1] - 10.0).abs() < 1e-5);
        assert!((result[2] - 5.0).abs() < 1e-5);
    }
}
