/**
 * Phasefold — Core audio generator
 *
 * Port of the Python generate_app() function.
 * Every section is annotated with the corresponding Python comment
 *
 * Computation is synchronous but designed to run inside a Web Worker
 * so the main thread stays responsive.
 *
 * All buffers use Float32 for memory efficiency (halves allocation vs
 * Float64) and faster ARM performance on iOS. Phase accumulators
 * (phaseCum, cumMod, basePhaseAcc, binLPhase, binRPhase) remain as
 * regular JS numbers (Float64) to avoid audible drift over long tracks.
 */

export type ProgressCallback = (percent: number, section: string) => void;

import type { SynthParams, StereoAudio } from "./types";
import { CONTROL_HZ } from "./types";
import {
  SeededRNG,
  linspace,
  interp,
  smoothEnvelope,
  stabilizeState,
  applyPhi,
} from "./dsp";

const TWO_PI = 2 * Math.PI;

export function generateAudio(
  params: SynthParams,
  onProgress?: ProgressCallback,
): StereoAudio {
  const {
    dur,
    sampleRate,
    baseF0,
    voices,
    layers,
    seed,
    fmIndex0,
    amIndex0,
    binauralDeltaHz0,
    binauralAmount,
    overtonePower,
    harmonicEven,
    harmonicOdd,
    voiceDelay,
    breathRate,
  } = params;

  // ── 1. Collapse curve (duration-adaptive) ─────
  // Computed from session duration using a log-scaled formula calibrated
  // to research-backed ranges (see collapse-curve-rationale.docx):
  //   Short  (60-120s):  1.2-1.8 - begin descent early for perceptible arc
  //   Medium (120-300s): 1.5-2.5 - balanced matching/guiding phases
  //   Long   (300-600s): 2.0-3.5 - hold complexity, slow late convergence
  //
  // The absolute time spent in the transition phase matters more to the
  // nervous system than the mathematical shape of the curve, so longer
  // sessions get higher exponents automatically.
  //
  // TODO: Revisit collapse curve interaction with other parameters
  // (binaural delta band, FM/AM depth, voice count) for more nuanced
  // therapeutic shaping. Multi-parameter coupling could improve outcomes
  // for specific use cases (e.g. sleep induction vs focused attention).
  // See collapse-curve-rationale.docx sections 5 and 7.
  const COLLAPSE_BASE = 1.5;
  const COLLAPSE_SCALE = 0.6;
  const COLLAPSE_REFERENCE_DUR = 60;
  const COLLAPSE_MIN = 1.2;
  const COLLAPSE_MAX = 3.5;
  const collapseCurve = Math.min(
    COLLAPSE_MAX,
    Math.max(
      COLLAPSE_MIN,
      COLLAPSE_BASE + COLLAPSE_SCALE * Math.log(dur / COLLAPSE_REFERENCE_DUR),
    ),
  );

  // ── 2. Time axis ──────────────────────────────
  const N = Math.floor(sampleRate * dur);
  const sampleTimes = new Float32Array(N);
  const progress = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    sampleTimes[i] = i / sampleRate;
    progress[i] = i / (N - 1 || 1);
  }

  // ── 3. Convergence envelope ───────────────────
  // 1 → 0 over the piece; shape set by collapseCurve
  const convGain = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    convGain[i] = 1.0 - Math.pow(progress[i], collapseCurve);
  }

  // ── 4. Voice emergence envelope ───────────────
  const voiceDelaySamps = Math.floor(voiceDelay * sampleRate);
  const voiceFadeSamps = Math.floor(1.5 * sampleRate); // 1.5 s fade-in
  const voiceEmergeEnv = new Float32Array(N).fill(1);

  for (let i = 0; i < voiceDelaySamps; i++) {
    voiceEmergeEnv[i] = 0;
  }
  const fadeLen = voiceFadeSamps;
  for (let i = 0; i < fadeLen; i++) {
    voiceEmergeEnv[voiceDelaySamps + i] = i / (fadeLen - 1);
  }

  // ── 5. Base effects emergence envelope ────────
  // Provides the "one → many" experience: pure tone first, effects fade in.
  // VoiceDelaySamps and all derived indices fit within N.
  const baseEffectsEnv = new Float32Array(N).fill(1);
  const pureToneVolEnv = new Float32Array(N).fill(1);
  const pureToneSamps = Math.floor(0.35 * voiceDelaySamps);

  // First 35 % of delay: pure tone (effects = 0)
  for (let i = 0; i < pureToneSamps; i++) {
    baseEffectsEnv[i] = 0;
    pureToneVolEnv[i] = (i / pureToneSamps) * 0.4;
  }

  // Remaining 65 %: effects ramp 0 → 1, volume ramp 0.4 → 1.0
  const effLen = voiceDelaySamps - pureToneSamps;
  for (let i = 0; i < effLen; i++) {
    const t = i / (effLen - 1);
    baseEffectsEnv[pureToneSamps + i] = t;
    pureToneVolEnv[pureToneSamps + i] = 0.4 + 0.6 * t;
  }

  onProgress?.(5, "Envelopes");

  // ── 6. Seeded detune / phase ──────────────────
  const rng = new SeededRNG(seed);
  const cents = rng.normalArray(0, 12, voices); // ±12 cents typical
  const phase0 = rng.uniformArray(0, TWO_PI, voices);

  // ── 7. Breath oscillation ─────────────────────
  const breath = new Float32Array(N);
  if (breathRate > 0) {
    for (let i = 0; i < N; i++) {
      const b = 0.5 * (1 + Math.sin(TWO_PI * breathRate * sampleTimes[i]));
      breath[i] = b * (0.3 + 0.7 * convGain[i]);
    }
  } else {
    breath.fill(0.5); // neutral when disabled
  }

  // 6b. Stereo-width LFO (synced to breath rate)
  // Modulates between 0.65 and 0.75 in-line with research.
  // Widens on inhale, narrows on exhale (parasympathetic peak).
  // Phase-inverted.
  // Floor raised to 0.65 to maintain ILD crossfeed above −15 dB binaural integrity threshold.
  // Fixed centre 0.70, depth ±0.05.

  const stereoWidthLFO = new Float32Array(N);
  const SW_CENTRE = 0.7;
  const SW_DEPTH = 0.05;
  for (let i = 0; i < N; i++) {
    stereoWidthLFO[i] =
      SW_CENTRE - SW_DEPTH * Math.sin(TWO_PI * breathRate * sampleTimes[i]);
  }

  onProgress?.(10, "Breath + stereo LFO");

  // ── 8. Control-rate recursion (60 Hz) ─────────
  const Nc = Math.max(2, Math.floor(dur * CONTROL_HZ));
  const ctrlProgress = linspace(0, 1, Nc);

  const convGainCtrl = new Float32Array(Nc);
  for (let i = 0; i < Nc; i++) {
    convGainCtrl[i] = 1.0 - Math.pow(ctrlProgress[i], collapseCurve);
  }

  const tiltAmplitude = new Float32Array(Nc);
  for (let i = 0; i < Nc; i++) {
    tiltAmplitude[i] = 0.08 * convGainCtrl[i];
  }

  // Evolve 2-state vector
  const vState0 = new Float32Array(Nc); // "marked" dimension
  const vState1 = new Float32Array(Nc);
  let state: [number, number] = stabilizeState([0, 1]);
  vState0[0] = state[0];
  vState1[0] = state[1];

  for (let i = 1; i < Nc; i++) {
    const thetaStep = (TWO_PI * (0.05 + 0.1 * convGainCtrl[i])) / CONTROL_HZ;
    state = applyPhi(
      [vState0[i - 1], vState1[i - 1]],
      convGainCtrl[i],
      thetaStep,
      tiltAmplitude[i],
    );
    vState0[i] = state[0];
    vState1[i] = state[1];
  }

  // ── 9. Control → audio upsample ───────────────
  // Activity envelope: tanh mapping of marked state, low-pass filtered
  const activityCtrl = new Float32Array(Nc);
  for (let i = 0; i < Nc; i++) {
    const m = Math.max(-8, Math.min(8, vState0[i]));
    activityCtrl[i] = 0.5 * (1 + Math.tanh(0.5 * 3.0 * m));
  }
  const activityCtrlSmooth = smoothEnvelope(activityCtrl, 0.5, CONTROL_HZ);
  const activityEnv = interp(progress, ctrlProgress, activityCtrlSmooth);

  // Marked state at audio rate (tiny pitch drift)
  const markedState = interp(progress, ctrlProgress, vState0);
  let meanMarked = 0;
  for (let i = 0; i < N; i++) meanMarked += markedState[i];
  meanMarked /= N;

  onProgress?.(18, "State evolution + upsample");

  // ── 10. Audio-rate envelopes ──────────────────
  const baseF = new Float32Array(N);
  const ampEnv = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const freqDev = 0.01 * (markedState[i] - meanMarked) * baseEffectsEnv[i];
    ampEnv[i] = 0.6 + 0.4 * activityEnv[i];
    baseF[i] = baseF0 * (1.0 + freqDev);
  }

  // ── 11. Per-layer control envelopes ───────────
  const LAYER_SLOWDOWN = 0.75;
  const layerCtrl: Float32Array[] = [];
  for (let ell = 0; ell < layers; ell++) {
    const fcEll = 1.0 / (1.0 + LAYER_SLOWDOWN * ell);
    const envCtrl = smoothEnvelope(activityCtrlSmooth, fcEll, CONTROL_HZ);
    layerCtrl.push(interp(progress, ctrlProgress, envCtrl));
  }

  // Shared slow drift phase
  const driftCoeff = 0.02 * ((layers * (layers + 1)) / 2.0);
  const driftPhase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    driftPhase[i] = TWO_PI * driftCoeff * convGain[i] * sampleTimes[i];
  }

  // Layer detune so layers don't phase-cancel
  const depthCents = 3.0;
  const layerDetune: number[] = [];
  for (let ell = 0; ell < layers; ell++) {
    layerDetune.push(
      Math.pow(2, ((ell - 0.5 * (layers - 1)) * depthCents) / 1200.0),
    );
  }

  const alphaFm = 0.82;
  const betaAm = 0.88;

  onProgress?.(25, "Layer envelopes");

  // ── 12. Layer synthesis ───────────────────────
  const layerSums: Float32Array[] = [];

  for (let ell = 0; ell < layers; ell++) {
    const ctrlL = layerCtrl[ell];
    const fmScale = fmIndex0 * Math.pow(alphaFm, ell);
    const amScale = amIndex0 * Math.pow(betaAm, ell);

    // FM phase modulation for this layer (1-D cumsum)
    const phaseModL = new Float32Array(N);
    let cumMod = 0;
    for (let i = 0; i < N; i++) {
      const fmL = Math.min(fmScale * convGain[i], 0.6);
      cumMod += (TWO_PI * ctrlL[i] * fmL) / sampleRate;
      phaseModL[i] = cumMod;
    }

    // Sum across voices (one voice at a time to save memory)
    const midsumL = new Float32Array(N);

    for (let v = 0; v < voices; v++) {
      const centV = cents[v];
      let phaseCum = phase0[v];

      for (let i = 0; i < N; i++) {
        // Time-varying detune: 2^((cents/1200) * convergenceGain)
        const df = Math.pow(2, (centV / 1200.0) * convGain[i]);
        phaseCum += (TWO_PI * df * baseF[i] * layerDetune[ell]) / sampleRate;

        const totalPhase = phaseCum + driftPhase[i] + phaseModL[i];

        // AM from this layer
        const amL = Math.min(amScale * convGain[i], 0.4);
        const amp = 1 - amL + amL * ctrlL[i];

        midsumL[i] += Math.sin(totalPhase) * amp;
      }
    }

    // Average across voices
    for (let i = 0; i < N; i++) midsumL[i] /= voices;

    layerSums.push(midsumL);
    onProgress?.(
      25 + Math.round(40 * ((ell + 1) / layers)),
      `Layer ${ell + 1}/${layers}`,
    );
  }

  // ── 13. Collapse-aware layer weighting ────────
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

  onProgress?.(68, "Layer weighting");

  // ── 14. Base tone ─────────────────────────────
  let basePhaseAcc = 0;
  for (let i = 0; i < N; i++) {
    basePhaseAcc += (TWO_PI * baseF0) / sampleRate;
    const core = Math.sin(basePhaseAcc) * ampEnv[i] * (0.5 + 0.5 * breath[i]);
    const gain = Math.max(
      0.75,
      Math.min(
        1.25,
        1.0 +
          0.15 * (1 - voiceEmergeEnv[i]) -
          0.1 * voiceEmergeEnv[i] * convGain[i],
      ),
    );
    const baseTone = core * gain;

    // Combine: base anchors, layers emerge via voiceEmergeEnv
    mix[i] = baseTone + (mix[i] - baseTone) * voiceEmergeEnv[i];
    mix[i] = Math.tanh(0.9 * mix[i]);
  }

  // ── 15. Chebyshev harmonics (even T2 / odd T3) ─
  for (let i = 0; i < N; i++) {
    const x = Math.max(-1, Math.min(1, mix[i]));
    const even = 2 * x * x - 1;
    const odd = 4 * x * x * x - 3 * x;
    const env = Math.pow(convGain[i], overtonePower) * baseEffectsEnv[i];
    mix[i] = Math.tanh(
      mix[i] + env * (harmonicEven * even + harmonicOdd * odd),
    );
  }

  onProgress?.(78, "Tone + harmonics");

  // ── 16. Stereo + binaural ─────────────────────
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  // Binaural oscillators (phase-accumulated for stability)
  // Binaural delta is gently modulated by the breath-rate LFO (±10% of set value)
  // creating a slowly drifting beat frequency that mirrors the spatial breath cycle.
  const bL = new Float32Array(N);
  const bR = new Float32Array(N);
  let binLPhase = 0;
  let binRPhase = 0;
  const BD_DEPTH = 0.1; // 10% of binauralDeltaHz0
  for (let i = 0; i < N; i++) {
    const binEnv = Math.pow(convGain[i], 1.4);
    const binauralDeltaModulated =
      binauralDeltaHz0 *
      (1 + BD_DEPTH * Math.sin(TWO_PI * breathRate * sampleTimes[i]));
    const deltaT = binauralDeltaModulated * binEnv * baseEffectsEnv[i];
    binLPhase += (TWO_PI * (baseF0 - 0.5 * deltaT)) / sampleRate;
    binRPhase += (TWO_PI * (baseF0 + 0.5 * deltaT)) / sampleRate;
    bL[i] = Math.sin(binLPhase);
    bR[i] = Math.sin(binRPhase);
  }

  // Stereo delay (48 samples ≈ 1.1 ms)
  const delaySamps = 48;
  const delayed = new Float32Array(N);
  for (let i = delaySamps; i < N; i++) {
    delayed[i] = mix[i - delaySamps];
  }

  // Compose L / R
  for (let i = 0; i < N; i++) {
    const binEnv = Math.pow(convGain[i], 1.4);
    const be = baseEffectsEnv[i];
    const breathL = 0.5 + be * (0.1 + 0.4 * breath[i] - 0.5);
    const breathR = 0.5 + be * (0.1 + 0.4 * (1 - breath[i]) - 0.5);

    const lBase = mix[i] * breathL + binauralAmount * binEnv * bL[i];
    const rBase = mix[i] * breathR + binauralAmount * binEnv * bR[i];

    const stEnv = 0.5 * stereoWidthLFO[i] * convGain[i] * be;
    L[i] = lBase + stEnv * delayed[i];
    R[i] = rBase - stEnv * delayed[i];
  }

  onProgress?.(88, "Stereo + binaural");

  // ── 17. Fade in (0.5 s) ──────────────────────
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

  // ── 18. Collapse detection ────────────────────
  // Measure control-rate d/dt of the activity envelope
  const dCtrl = new Float32Array(Nc);
  for (let i = 1; i < Nc; i++) {
    dCtrl[i] =
      Math.abs(activityCtrlSmooth[i] - activityCtrlSmooth[i - 1]) * CONTROL_HZ;
  }
  const dCtrlSmooth = smoothEnvelope(dCtrl, 0.5, CONTROL_HZ);

  const eps = 1e-3;
  const quietSecs = 21.0;
  const quietSteps = Math.max(1, Math.round(quietSecs * CONTROL_HZ));

  let lastActive = -1;
  for (let i = 0; i < Nc; i++) {
    if (dCtrlSmooth[i] > eps) lastActive = i;
  }

  const stopCtrlIdx =
    lastActive >= 0 ? Math.min(Nc - 1, lastActive + quietSteps) : Nc - 1;

  const stopT = ctrlProgress[stopCtrlIdx];
  let stopIdx = Math.max(1, Math.min(Math.round(stopT * N), N));

  // ── 19. Decide final length ───────────────────
  // If collapse detection wants to trim more than 15 % off the
  // requested duration, honour the user's duration instead.
  // The state evolution often converges early while the musical
  // envelopes (convergence gain, voice emergence, breath) are
  // still doing their job — so we only trust the detector when
  // it agrees the piece is nearly done anyway.
  const minLength = Math.floor(0.85 * N);
  const useFullLength = stopIdx < minLength;
  const outLen = useFullLength ? N : stopIdx;

  const finalL = new Float32Array(outLen);
  const finalR = new Float32Array(outLen);
  finalL.set(L.subarray(0, outLen));
  finalR.set(R.subarray(0, outLen));

  onProgress?.(95, "Collapse detection");

  // ── 20. Fade out (equal-power, 1 s) ──────────
  const fadeOutSamps = Math.max(
    1,
    Math.min(Math.round(1.0 * sampleRate), finalL.length),
  );
  for (let i = 0; i < fadeOutSamps; i++) {
    const f = Math.cos((0.5 * Math.PI * i) / (fadeOutSamps - 1 || 1));
    const idx = finalL.length - fadeOutSamps + i;
    finalL[idx] *= f;
    finalR[idx] *= f;
  }

  // ── 21. Headroom normalise (−1.5 dBFS) ───────
  let peak = 1e-12;
  for (let i = 0; i < finalL.length; i++) {
    peak = Math.max(peak, Math.abs(finalL[i]), Math.abs(finalR[i]));
  }
  const gain = Math.pow(10, -1.5 / 20) / peak;
  for (let i = 0; i < finalL.length; i++) {
    finalL[i] *= gain;
    finalR[i] *= gain;
  }

  onProgress?.(100, "Complete");

  return { left: finalL, right: finalR, sampleRate };
}
