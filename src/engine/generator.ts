/**
 * Phasefold: Core audio generator (fused block engine)
 *
 * Mobile-optimised rewrite of the original stage-by-stage generator
 * (see generatorLegacy.ts while validation is in progress). The audible
 * output is unchanged; the computation is restructured around two ideas:
 *
 * 1. No per-sample transcendentals. The original called Math.pow and
 *    Math.sin inside the voice loop (over a billion calls for a dense
 *    preset). Everything that evolves slowly (convergence gain and its
 *    powers, detune factors) is now computed exactly at block edges and
 *    linearly interpolated across a 128-sample block; the curvature of
 *    these envelopes over 2.9 ms makes the interpolation error land far
 *    below the 16-bit noise floor. Oscillators read a shared sine table.
 *
 * 2. One pass, no intermediate track-length buffers. The original held
 *    ~25 full-length Float32Arrays alive at once (gigabytes for long,
 *    dense presets), sweeping each through the cache stage by stage.
 *    Here all per-sample state lives in 128-sample scratch buffers that
 *    stay in L1, and each block is written straight into the two output
 *    channels. Only control-rate tables (60 Hz, a few kB) and the output
 *    itself are ever allocated at full length.
 *
 * Collapse detection needs only control-rate data, so it now runs BEFORE
 * synthesis: a trimmed tail is never rendered at all.
 *
 * Determinism: same params + seed still produce bit-identical output on
 * every run. Output differs from the legacy engine only at the level of
 * its own Float32 rounding grain (validated by null test).
 *
 * Phase accumulators (voicePhase, cumMod, basePhaseAcc, binLPhase,
 * binRPhase) remain f64 to avoid audible drift over long tracks.
 */

export type ProgressCallback = (percent: number, section: string) => void;

import type { SynthParams, StereoAudio } from "./types";
import { CONTROL_HZ, ENGINE_VERSION } from "./types";
import { SeededRNG, linspace, smoothEnvelope, stabilizeState, applyPhi } from "./dsp";

const TWO_PI = 2 * Math.PI;

/* Sine lookup table: 65 536 entries + wrap guard, Float64.
 * Linear interpolation error is ~1e-9 (about -180 dB), which matters
 * because the binaural oscillators integrate table error into phase:
 * a coarser table would show up in the null test against the legacy
 * engine. 512 kB, built once at module load (~2 ms). */
const SIN_TABLE_BITS = 16;
const SIN_TABLE_SIZE = 1 << SIN_TABLE_BITS; // 65 536
const SIN_TABLE = new Float64Array(SIN_TABLE_SIZE + 1);
for (let i = 0; i <= SIN_TABLE_SIZE; i++) {
  SIN_TABLE[i] = Math.sin((TWO_PI * i) / SIN_TABLE_SIZE);
}
const SIN_INV_TWO_PI = 1 / TWO_PI;

/** sin(phase) via table + linear interpolation. Accepts any phase >= 0. */
function lutSin(phase: number): number {
  let x = phase * SIN_INV_TWO_PI;
  x -= Math.floor(x); // fractional turn in [0, 1)
  const pos = x * SIN_TABLE_SIZE;
  const j = pos | 0;
  const frac = pos - j;
  return SIN_TABLE[j] + frac * (SIN_TABLE[j + 1] - SIN_TABLE[j]);
}

/** tanh via a single exp: identical to Math.tanh within 1e-16 but ~40%
 *  faster in both V8 and JSC (measured), and it runs twice per sample. */
function fastTanh(x: number): number {
  const e = Math.exp(2 * x);
  return (e - 1) / (e + 1);
}

/* Samples per fused block. Small enough that all scratch buffers stay
 * in L1 cache and slow envelopes are effectively linear across a block
 * (2.9 ms), large enough to amortise the block-edge computations. */
const BLOCK = 128;

const HAAS_DELAY_SAMPS = 48; // ~1.1 ms stereo delay
const VOICE_FADE_SECS = 1.5; // voice emergence ramp
const PURE_TONE_FRACTION = 0.35; // share of voice delay that is pure tone
const FADE_IN_SECS = 0.5;
const FADE_OUT_SECS = 1.0;
const QUIET_TAIL_SECS = 21.0; // stillness required by collapse detection
const MIN_KEEP_FRACTION = 0.85; // honour user duration below this
const HEADROOM_DB = -1.5;

export function generateAudio(
  params: SynthParams,
  onProgress?: ProgressCallback,
): StereoAudio {
  const t0 = performance.now();

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
    voiceDelay,
    breathRate,
    enableStereoWidthLfo = true,
    enableHaasDelay = true,
    enableStateEvolution = true,
    enableFm = true,
    enableDetuneConvergence = true,
  } = params;

  // 1. Collapse curve (duration-adaptive)
  // Identical to the original engine: a log-scaled exponent so short
  // sessions begin guiding early and long sessions hold complexity.
  // The convergence envelope 0.9 * (1 - progress^collapseCurve) drives
  // every time-varying parameter; see the legacy header comment and
  // collapse-curve-rationale.docx for the full therapeutic rationale.
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

  const CONV_INITIAL = 0.9;

  /** Convergence gain as an exact function of sample index. Called at
   *  block edges only; samples in between are linearly interpolated.
   *  Clamped at zero: the trailing block edge sits one sample past the
   *  end of the track, where progress exceeds 1 and the raw curve goes
   *  negative (and Math.pow(negative, 1.4) would be NaN downstream). */
  const N = Math.floor(sampleRate * dur);
  const progressDenom = N - 1 || 1;
  const convGainAt = (i: number): number =>
    Math.max(
      0,
      CONV_INITIAL * (1.0 - Math.pow(i / progressDenom, collapseCurve)),
    );

  // 2. Control-rate axis (60 Hz)
  const Nc = Math.max(2, Math.floor(dur * CONTROL_HZ));
  const ctrlProgress = linspace(0, 1, Nc);

  const convGainCtrl = new Float32Array(Nc);
  for (let i = 0; i < Nc; i++) {
    convGainCtrl[i] =
      CONV_INITIAL * (1.0 - Math.pow(ctrlProgress[i], collapseCurve));
  }

  const tiltAmplitude = new Float32Array(Nc);
  for (let i = 0; i < Nc; i++) {
    tiltAmplitude[i] = 0.08 * convGainCtrl[i];
  }

  // 3. Control-rate state recursion (60 Hz)
  const vState0 = new Float32Array(Nc); // "marked" dimension

  if (enableStateEvolution) {
    let state: [number, number] = stabilizeState([0, 1]);
    vState0[0] = state[0];
    let s1 = state[1];

    for (let i = 1; i < Nc; i++) {
      const thetaStep = (TWO_PI * (0.05 + 0.1 * convGainCtrl[i])) / CONTROL_HZ;
      state = applyPhi([vState0[i - 1], s1], convGainCtrl[i], thetaStep, tiltAmplitude[i]);
      vState0[i] = state[0];
      s1 = state[1];
    }
  }
  // When disabled, vState0 stays zeroed: activity is flat, no pitch
  // drift, layers contribute evenly.

  // Activity envelope at control rate: tanh mapping, low-pass filtered
  const activityCtrl = new Float32Array(Nc);
  for (let i = 0; i < Nc; i++) {
    const m = Math.max(-8, Math.min(8, vState0[i]));
    activityCtrl[i] = 0.5 * (1 + Math.tanh(0.5 * 3.0 * m));
  }
  const activityCtrlSmooth = smoothEnvelope(activityCtrl, 0.5, CONTROL_HZ);

  // 4. Per-layer control envelopes (progressively slower low-pass)
  const LAYER_SLOWDOWN = 0.75;
  const layerCtrlC: Float32Array[] = [];
  for (let ell = 0; ell < layers; ell++) {
    const fcEll = 1.0 / (1.0 + LAYER_SLOWDOWN * ell);
    layerCtrlC.push(smoothEnvelope(activityCtrlSmooth, fcEll, CONTROL_HZ));
  }

  onProgress?.(5, "Control precompute");

  // 5. Collapse detection + length decision
  // Needs only the control-rate activity envelope, so it runs before
  // synthesis: a trimmed tail is never rendered. The maths is identical
  // to the original post-hoc trim.
  const dCtrl = new Float32Array(Nc);
  for (let i = 1; i < Nc; i++) {
    dCtrl[i] =
      Math.abs(activityCtrlSmooth[i] - activityCtrlSmooth[i - 1]) * CONTROL_HZ;
  }
  const dCtrlSmooth = smoothEnvelope(dCtrl, 0.5, CONTROL_HZ);

  const stillnessEps = 1e-3;
  const quietSteps = Math.max(1, Math.round(QUIET_TAIL_SECS * CONTROL_HZ));

  let lastActive = -1;
  for (let i = 0; i < Nc; i++) {
    if (dCtrlSmooth[i] > stillnessEps) lastActive = i;
  }
  const stopCtrlIdx =
    lastActive >= 0 ? Math.min(Nc - 1, lastActive + quietSteps) : Nc - 1;

  const stopT = ctrlProgress[stopCtrlIdx];
  const stopIdx = Math.max(1, Math.min(Math.round(stopT * N), N));

  // If trimming would remove more than 15% of the requested duration,
  // honour the user's duration: the state evolution often settles early
  // while the musical envelopes are still doing their job.
  const minLength = Math.floor(MIN_KEEP_FRACTION * N);
  const outLen = stopIdx < minLength ? N : stopIdx;

  onProgress?.(8, "Collapse detection");

  // 6. Seeded detune / phase
  const rng = new SeededRNG(seed);
  const cents = rng.normalArray(0, 12, voices); // ±12 cents typical
  const phase0 = rng.uniformArray(0, TWO_PI, voices);

  // 7. Mean marked state
  // The pitch drift is centred on the mean of the audio-rate marked
  // state. One cheap pass (adds only, nothing stored) over the full
  // duration N: the mean must not depend on where the track is trimmed.
  const ctrlStep = (Nc - 1) / progressDenom; // control index per sample
  let meanMarked = 0;
  {
    let pos = 0;
    for (let i = 0; i < N; i++) {
      let j = pos | 0;
      if (j > Nc - 2) j = Nc - 2;
      meanMarked += vState0[j] + (pos - j) * (vState0[j + 1] - vState0[j]);
      pos += ctrlStep;
    }
    meanMarked /= N;
  }

  // 8. Derived per-voice / per-layer constants
  const driftCoeff = 0.02 * ((layers * (layers + 1)) / 2.0);

  const depthCents = 3.0;
  const layerDetune: number[] = [];
  for (let ell = 0; ell < layers; ell++) {
    layerDetune.push(
      Math.pow(2, ((ell - 0.5 * (layers - 1)) * depthCents) / 1200.0),
    );
  }

  const alphaFm = 0.82;
  const betaAm = 0.88;
  const fmScale: number[] = [];
  const amScale: number[] = [];
  for (let ell = 0; ell < layers; ell++) {
    fmScale.push(fmIndex0 * Math.pow(alphaFm, ell));
    amScale.push(amIndex0 * Math.pow(betaAm, ell));
  }

  // Fixed detune factors (used when detune convergence is disabled)
  const fixedDf = new Float64Array(voices);
  for (let v = 0; v < voices; v++) {
    fixedDf[v] = Math.pow(2, cents[v] / 1200.0);
  }

  // Envelope breakpoints (sample indices), identical to the original
  const voiceDelaySamps = Math.floor(voiceDelay * sampleRate);
  const voiceFadeDenom = Math.floor(VOICE_FADE_SECS * sampleRate) - 1;
  const pureToneSamps = Math.floor(PURE_TONE_FRACTION * voiceDelaySamps);
  const effRampDenom = voiceDelaySamps - pureToneSamps - 1;
  const fadeInSamps = Math.floor(FADE_IN_SECS * sampleRate);
  const fadeInDenom = fadeInSamps - 1 || 1;

  // Harmonic coefficients, auto-computed from baseF0 and binauralDeltaHz0.
  // Low carriers get more enrichment (pushes energy into the sensitive
  // hearing range); the even/odd split follows the binaural band (warm
  // for delta/theta, bright for beta/gamma). See legacy engine for the
  // full research annotations.
  const HARM_TOTAL_MAX = 0.3;
  const HARM_TOTAL_MIN = 0.05;
  const HARM_FREQ_LO = 20;
  const HARM_FREQ_HI = 220;
  const HARM_ODD_RATIO_MIN = 0.15;
  const HARM_ODD_RATIO_MAX = 0.8;
  const HARM_ODD_RATIO_REF = 50; // Hz: delta at which oddRatio saturates

  const freqT = Math.min(
    1,
    Math.max(0, (baseF0 - HARM_FREQ_LO) / (HARM_FREQ_HI - HARM_FREQ_LO)),
  );
  const harmonicTotal =
    HARM_TOTAL_MAX - freqT * (HARM_TOTAL_MAX - HARM_TOTAL_MIN);
  const oddRatio = Math.min(
    HARM_ODD_RATIO_MAX,
    HARM_ODD_RATIO_MIN +
      (HARM_ODD_RATIO_MAX - HARM_ODD_RATIO_MIN) *
        (binauralDeltaHz0 / HARM_ODD_RATIO_REF),
  );
  const harmonicEven = harmonicTotal * (1 - oddRatio);
  const harmonicOdd = harmonicTotal * oddRatio;

  const BIN_ENV_POWER = 1.4; // binaural convergence exponent
  const BD_DEPTH = 0.1; // breath modulation of binaural delta (±10%)
  const SW_CENTRE = 0.7; // stereo width LFO centre
  const SW_DEPTH = 0.05; // stereo width LFO depth

  // 9. Fused block synthesis
  const finalL = new Float32Array(outLen);
  const finalR = new Float32Array(outLen);

  // Persistent oscillator state (f64 phase accumulators)
  const voicePhase = new Float64Array(layers * voices);
  for (let ell = 0; ell < layers; ell++) {
    for (let v = 0; v < voices; v++) voicePhase[ell * voices + v] = phase0[v];
  }
  const cumMod = new Float64Array(layers); // FM phase integral per layer
  let basePhaseAcc = 0;
  let binLPhase = 0;
  let binRPhase = 0;

  // Haas delay ring buffer replaces the full-length delayed copy
  const haasRing = new Float64Array(HAAS_DELAY_SAMPS);
  let haasPos = 0;

  // Block scratch (L1-resident)
  const sConvGain = new Float64Array(BLOCK);
  const sConvPowO = new Float64Array(BLOCK); // convGain^overtonePower
  const sConvPowB = new Float64Array(BLOCK); // convGain^1.4
  const sBreathSin = new Float64Array(BLOCK); // sin(2*pi*breathRate*t)
  const sActivity = new Float64Array(BLOCK);
  const sBaseF = new Float64Array(BLOCK);
  const sAmpEnv = new Float64Array(BLOCK);
  const sBaseEff = new Float64Array(BLOCK);
  const sVoiceEmerge = new Float64Array(BLOCK);
  const sDrift = new Float64Array(BLOCK);
  const sPhaseMod = new Float64Array(BLOCK); // per-layer, refilled
  const sCtrl = new Float64Array(BLOCK); // per-layer, refilled
  const sVoiceAcc = new Float64Array(BLOCK); // per-layer voice sum
  const layerBlock: Float64Array[] = [];
  for (let ell = 0; ell < layers; ell++) layerBlock.push(new Float64Array(BLOCK));

  const df0 = new Float64Array(voices); // detune factor at block start
  const dfSlope = new Float64Array(voices); // per-sample detune increment

  // Block-edge carries: exact values computed once per edge, reused as
  // the next block's start (one pow per curve per block, not per sample)
  let edgeConvGain = convGainAt(0);
  let edgeConvPowO = Math.pow(edgeConvGain, overtonePower);
  let edgeConvPowB = Math.pow(edgeConvGain, BIN_ENV_POWER);
  const edgeDf = new Float64Array(voices);
  for (let v = 0; v < voices; v++) {
    edgeDf[v] = enableDetuneConvergence
      ? Math.pow(2, (cents[v] / 1200.0) * edgeConvGain)
      : fixedDf[v];
  }

  const invSampleRate = 1 / sampleRate;
  const invVoices = 1 / voices;
  const progressStride = Math.max(1, Math.floor(outLen / 16));
  let nextProgress = progressStride;

  for (let b0 = 0; b0 < outLen; b0 += BLOCK) {
    const bn = Math.min(BLOCK, outLen - b0);
    const bEnd = b0 + bn;
    const invBn = 1 / bn;

    // Block-edge values at bEnd; start values carried from previous block
    const g0 = edgeConvGain;
    const g1 = convGainAt(bEnd);
    const pO0 = edgeConvPowO;
    const pO1 = Math.pow(g1, overtonePower);
    const pB0 = edgeConvPowB;
    const pB1 = Math.pow(g1, BIN_ENV_POWER);
    edgeConvGain = g1;
    edgeConvPowO = pO1;
    edgeConvPowB = pB1;

    // Shared per-sample scratch
    let ctrlPos = b0 * ctrlStep;
    for (let j = 0; j < bn; j++) {
      const i = b0 + j;
      const t = j * invBn;
      const g = g0 + t * (g1 - g0);
      sConvGain[j] = g;
      sConvPowO[j] = pO0 + t * (pO1 - pO0);
      sConvPowB[j] = pB0 + t * (pB1 - pB0);

      // One LFO phase serves breath, stereo width and binaural drift
      sBreathSin[j] =
        breathRate > 0 ? lutSin(TWO_PI * breathRate * (i * invSampleRate)) : 0;

      // Control-rate lerps (activity + marked state)
      let cj = ctrlPos | 0;
      if (cj > Nc - 2) cj = Nc - 2;
      const cf = ctrlPos - cj;
      sActivity[j] =
        activityCtrlSmooth[cj] +
        cf * (activityCtrlSmooth[cj + 1] - activityCtrlSmooth[cj]);
      const marked = vState0[cj] + cf * (vState0[cj + 1] - vState0[cj]);
      ctrlPos += ctrlStep;

      // Emergence envelopes (piecewise linear, exact)
      const emerge =
        i < voiceDelaySamps
          ? 0
          : Math.min((i - voiceDelaySamps) / voiceFadeDenom, 1);
      sVoiceEmerge[j] = emerge;
      const baseEff =
        voiceDelaySamps === 0
          ? 1
          : i < pureToneSamps
            ? 0
            : i < voiceDelaySamps
              ? (i - pureToneSamps) / effRampDenom
              : 1;
      sBaseEff[j] = baseEff;

      sAmpEnv[j] = 0.6 + 0.4 * sActivity[j];
      sBaseF[j] = baseF0 * (1.0 + 0.01 * (marked - meanMarked) * baseEff);
      sDrift[j] = TWO_PI * driftCoeff * g * (i * invSampleRate);
    }

    // Per-layer synthesis into layerBlock
    for (let ell = 0; ell < layers; ell++) {
      const ctrlTable = layerCtrlC[ell];
      let cPos = b0 * ctrlStep;
      for (let j = 0; j < bn; j++) {
        let cj = cPos | 0;
        if (cj > Nc - 2) cj = Nc - 2;
        sCtrl[j] = ctrlTable[cj] + (cPos - cj) * (ctrlTable[cj + 1] - ctrlTable[cj]);
        cPos += ctrlStep;
      }

      // FM phase integral (shared across voices in the layer)
      if (enableFm) {
        const fmS = fmScale[ell];
        let cm = cumMod[ell];
        for (let j = 0; j < bn; j++) {
          const fmL = Math.min(fmS * sConvGain[j], 0.6);
          cm += TWO_PI * sCtrl[j] * fmL * invSampleRate;
          sPhaseMod[j] = cm;
        }
        cumMod[ell] = cm;
      } else {
        sPhaseMod.fill(0, 0, bn);
      }

      // Voice oscillators: the hot loop. Per voice-sample this is one
      // f64 phase add, one table sin and one accumulate; the detune
      // factor advances by a per-sample increment instead of pow().
      sVoiceAcc.fill(0, 0, bn);
      const phaseK = TWO_PI * layerDetune[ell] * invSampleRate;

      if (ell === 0) {
        // Detune factors are layer-independent: compute once per block
        for (let v = 0; v < voices; v++) {
          const dfEnd = enableDetuneConvergence
            ? Math.pow(2, (cents[v] / 1200.0) * g1)
            : fixedDf[v];
          df0[v] = edgeDf[v];
          dfSlope[v] = (dfEnd - edgeDf[v]) * invBn;
          edgeDf[v] = dfEnd;
        }
      }

      for (let v = 0; v < voices; v++) {
        let ph = voicePhase[ell * voices + v];
        let df = df0[v];
        const dDf = dfSlope[v];
        for (let j = 0; j < bn; j++) {
          ph += phaseK * df * sBaseF[j];
          df += dDf;
          sVoiceAcc[j] += lutSin(ph + sDrift[j] + sPhaseMod[j]);
        }
        voicePhase[ell * voices + v] = ph;
      }

      // AM is identical for every voice in the layer, so it is applied
      // once to the averaged sum rather than inside the voice loop.
      const amS = amScale[ell];
      const lb = layerBlock[ell];
      for (let j = 0; j < bn; j++) {
        const amL = Math.min(amS * sConvGain[j], 0.4);
        lb[j] = sVoiceAcc[j] * invVoices * (1 - amL + amL * sCtrl[j]);
      }
    }

    // Combine: layer weighting, base tone, harmonics, stereo + binaural
    for (let j = 0; j < bn; j++) {
      const i = b0 + j;
      const g = sConvGain[j];
      const emerge = sVoiceEmerge[j];
      const baseEff = sBaseEff[j];

      // Collapse-aware layer weighting (iterative powers of activity)
      const a = sActivity[j];
      let w = a;
      let wSum = 0;
      let signal = 0;
      for (let ell = 0; ell < layers; ell++) {
        signal += w * layerBlock[ell][j];
        wSum += w;
        w *= a;
      }
      let mix = signal / Math.max(1e-9, wSum);

      // Base tone: the listener's anchor through the whole session
      basePhaseAcc += TWO_PI * baseF0 * invSampleRate;
      const breath = breathRate > 0 ? 0.5 * (1 + sBreathSin[j]) * g : 0.5;
      const core = lutSin(basePhaseAcc) * sAmpEnv[j] * (0.5 + 0.5 * breath);
      const baseGain = Math.max(
        0.75,
        Math.min(1.25, 1.0 + 0.15 * (1 - emerge) - 0.1 * emerge * g),
      );
      const baseTone = core * baseGain;

      mix = baseTone + (mix - baseTone) * emerge;
      mix = fastTanh(0.9 * mix);

      // Chebyshev harmonics (even T2 / odd T3)
      const x = Math.max(-1, Math.min(1, mix));
      const even = 2 * x * x - 1;
      const odd = 4 * x * x * x - 3 * x;
      mix = fastTanh(
        mix + sConvPowO[j] * baseEff * (harmonicEven * even + harmonicOdd * odd),
      );

      // Binaural oscillators with breath-modulated delta
      const binEnv = sConvPowB[j];
      const deltaT =
        binauralDeltaHz0 * (1 + BD_DEPTH * sBreathSin[j]) * binEnv * baseEff;
      binLPhase += TWO_PI * (baseF0 - 0.5 * deltaT) * invSampleRate;
      binRPhase += TWO_PI * (baseF0 + 0.5 * deltaT) * invSampleRate;

      // Haas delay via ring buffer (read the 48-samples-ago value)
      let delayed = 0;
      if (enableHaasDelay) {
        delayed = i >= HAAS_DELAY_SAMPS ? haasRing[haasPos] : 0;
        haasRing[haasPos] = mix;
        haasPos = haasPos + 1 === HAAS_DELAY_SAMPS ? 0 : haasPos + 1;
      }

      // Compose stereo: breath panning converges to centre with the rest
      const breathPan = g * baseEff;
      const breathL = 0.5 + breathPan * (0.1 + 0.4 * breath - 0.5);
      const breathR = 0.5 + breathPan * (0.1 + 0.4 * (1 - breath) - 0.5);

      const width = enableStereoWidthLfo
        ? SW_CENTRE - SW_DEPTH * sBreathSin[j]
        : SW_CENTRE;
      const stEnv = 0.5 * width * g * baseEff;

      let outL = mix * breathL + binauralAmount * binEnv * lutSin(binLPhase) + stEnv * delayed;
      let outR = mix * breathR + binauralAmount * binEnv * lutSin(binRPhase) - stEnv * delayed;

      // Fade-in and pure-tone volume envelope
      if (i < fadeInSamps) {
        const f = i / fadeInDenom;
        outL *= f;
        outR *= f;
      }
      const pureVol =
        voiceDelaySamps === 0
          ? 1
          : i < pureToneSamps
            ? (i / pureToneSamps) * 0.4
            : i < voiceDelaySamps
              ? 0.4 + 0.6 * ((i - pureToneSamps) / effRampDenom)
              : 1;

      finalL[i] = outL * pureVol;
      finalR[i] = outR * pureVol;
    }

    if (bEnd >= nextProgress) {
      onProgress?.(
        10 + Math.round(80 * (bEnd / outLen)),
        "Synthesis (fused)",
      );
      nextProgress += progressStride;
    }
  }

  // 10. Fade out (equal-power, 1 s)
  const fadeOutSamps = Math.max(
    1,
    Math.min(Math.round(FADE_OUT_SECS * sampleRate), outLen),
  );
  for (let i = 0; i < fadeOutSamps; i++) {
    const f = Math.cos((0.5 * Math.PI * i) / (fadeOutSamps - 1 || 1));
    const idx = outLen - fadeOutSamps + i;
    finalL[idx] *= f;
    finalR[idx] *= f;
  }

  // 11. Headroom normalise (-1.5 dBFS)
  let peak = 1e-12;
  for (let i = 0; i < outLen; i++) {
    peak = Math.max(peak, Math.abs(finalL[i]), Math.abs(finalR[i]));
  }
  const gain = Math.pow(10, HEADROOM_DB / 20) / peak;
  for (let i = 0; i < outLen; i++) {
    finalL[i] *= gain;
    finalR[i] *= gain;
  }

  const elapsed = performance.now() - t0;
  console.log(
    `[Phasefold] Generation complete: ${elapsed.toFixed(1)}ms (${dur}s @ ${sampleRate}Hz, engine v${ENGINE_VERSION})`,
  );

  onProgress?.(100, "Complete");

  return { left: finalL, right: finalR, sampleRate };
}
