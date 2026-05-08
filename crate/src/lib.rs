//! Phasefold DSP — Rust/Wasm engine
//!
//! Incremental port of the TypeScript DSP helpers. Each function is
//! exposed to JS via wasm-bindgen and accepts/returns raw f32 slices
//! through shared linear memory.

use wasm_bindgen::prelude::*;
use std::f32::consts::PI;

const TWO_PI: f32 = 2.0 * PI;

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
}
