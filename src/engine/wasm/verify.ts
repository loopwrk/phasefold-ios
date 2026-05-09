/**
 * Phasefold — Wasm verification script
 *
 * Compares the Rust/Wasm smoothEnvelope against the TypeScript original
 * sample-by-sample. Run from a browser console or import into a test page.
 *
 * Usage (from browser console after Vite dev server is running):
 *   import('/src/engine/wasm/verify.ts').then(m => m.verify())
 */

import {
  smoothEnvelope as tsSmoothEnvelope,
  linspace as tsLinspace,
  interp as tsInterp,
  stabilizeState as tsStabilizeState,
  applyPhi as tsApplyPhi,
  synthesizeLayer as tsSynthesizeLayer,
  mixLayers as tsMixLayers,
  applyBaseToneAndHarmonics as tsApplyBaseToneAndHarmonics,
  applyStereoBinaural as tsApplyStereoBinaural,
  finalizeStereo as tsFinalizeStereo,
  SeededRNG as TSSeededRNG,
} from '../dsp'
import {
  initWasm,
  smoothEnvelope as wasmSmoothEnvelope,
  linspace as wasmLinspace,
  interp as wasmInterp,
  stabilizeState as wasmStabilizeState,
  applyPhi as wasmApplyPhi,
  synthesizeLayer as wasmSynthesizeLayer,
  mixLayers as wasmMixLayers,
  applyBaseToneAndHarmonics as wasmApplyBaseToneAndHarmonics,
  applyStereoBinaural as wasmApplyStereoBinaural,
  finalizeStereo as wasmFinalizeStereo,
  SeededRNG as WasmSeededRNG,
} from './dsp'

interface VerifyResult {
  passed: boolean
  maxAbsError: number
  meanAbsError: number
  sampleCount: number
  failedAt?: number
}

function compareBuffers(
  a: Float32Array,
  b: Float32Array,
  tolerance = 1e-4,
): VerifyResult {
  if (a.length !== b.length) {
    return {
      passed: false,
      maxAbsError: Infinity,
      meanAbsError: Infinity,
      sampleCount: Math.max(a.length, b.length),
      failedAt: Math.min(a.length, b.length),
    }
  }

  let maxErr = 0
  let sumErr = 0
  let failedAt: number | undefined

  for (let i = 0; i < a.length; i++) {
    const err = Math.abs(a[i] - b[i])
    sumErr += err
    if (err > maxErr) maxErr = err
    if (err > tolerance && failedAt === undefined) failedAt = i
  }

  return {
    passed: maxErr <= tolerance,
    maxAbsError: maxErr,
    meanAbsError: sumErr / a.length,
    sampleCount: a.length,
    failedAt,
  }
}

export async function verify(): Promise<void> {
  console.log('[verify] Initialising Wasm module...')
  await initWasm()
  console.log('[verify] Wasm ready. Running comparison tests...\n')

  const tests = [
    {
      name: 'Step response (10 Hz cutoff, 44100 Hz SR)',
      input: new Float32Array(44100).fill(1.0),
      cutoff: 10.0,
      sr: 44100,
      state: 0,
    },
    {
      name: 'Ramp input (0.5 Hz cutoff, 60 Hz control rate)',
      input: Float32Array.from({ length: 600 }, (_, i) => i / 599),
      cutoff: 0.5,
      sr: 60,
      state: 0,
    },
    {
      name: 'Sine input with initial state',
      input: Float32Array.from(
        { length: 4410 },
        (_, i) => Math.sin(2 * Math.PI * 440 * (i / 44100)),
      ),
      cutoff: 100.0,
      sr: 44100,
      state: 0.5,
    },
    {
      name: 'Empty input',
      input: new Float32Array(0),
      cutoff: 10.0,
      sr: 44100,
      state: 0,
    },
    {
      name: 'Invalid cutoff (zero)',
      input: new Float32Array([1, 2, 3]),
      cutoff: 0,
      sr: 44100,
      state: 0,
    },
    {
      name: 'Invalid cutoff (above Nyquist)',
      input: new Float32Array([1, 2, 3]),
      cutoff: 30000,
      sr: 44100,
      state: 0,
    },
  ]

  let allPassed = true

  function runTest(name: string, tsResult: Float32Array, wasmResult: Float32Array) {
    const cmp = compareBuffers(tsResult, wasmResult)
    const status = cmp.passed ? 'PASS' : 'FAIL'
    console.log(
      `[${status}] ${name}` +
        ` — ${cmp.sampleCount} samples` +
        `, max error: ${cmp.maxAbsError.toExponential(3)}` +
        `, mean error: ${cmp.meanAbsError.toExponential(3)}` +
        (cmp.failedAt !== undefined ? ` (first divergence at sample ${cmp.failedAt})` : ''),
    )
    if (!cmp.passed) allPassed = false
  }

  // ── smoothEnvelope tests ──────────────────────

  console.log('── smoothEnvelope ──')
  for (const t of tests) {
    runTest(
      t.name,
      tsSmoothEnvelope(t.input, t.cutoff, t.sr, t.state),
      wasmSmoothEnvelope(t.input, t.cutoff, t.sr, t.state),
    )
  }

  // ── linspace tests ────────────────────────────

  console.log('\n── linspace ──')
  runTest(
    'linspace(0, 1, 1000)',
    tsLinspace(0, 1, 1000),
    wasmLinspace(0, 1, 1000),
  )
  runTest(
    'linspace(0, 1, 1) — single element',
    tsLinspace(0, 1, 1),
    wasmLinspace(0, 1, 1),
  )
  runTest(
    'linspace(-100, 100, 44100) — large range',
    tsLinspace(-100, 100, 44100),
    wasmLinspace(-100, 100, 44100),
  )

  // ── interp tests ──────────────────────────────

  console.log('\n── interp ──')

  // Simple linear ramp
  const xp2 = new Float32Array([0, 1])
  const fp2 = new Float32Array([0, 10])
  const xi2 = tsLinspace(0, 1, 100)
  runTest(
    'interp — linear ramp (2 knots, 100 query points)',
    tsInterp(xi2, xp2, fp2),
    wasmInterp(xi2, xp2, fp2),
  )

  // Multi-segment (triangle)
  const xp3 = new Float32Array([0, 0.5, 1])
  const fp3 = new Float32Array([0, 1, 0])
  const xi3 = tsLinspace(0, 1, 500)
  runTest(
    'interp — triangle (3 knots, 500 query points)',
    tsInterp(xi3, xp3, fp3),
    wasmInterp(xi3, xp3, fp3),
  )

  // Realistic: control-rate to audio-rate upsample (mimics generator usage)
  const Nc = 600  // control-rate frames for a 10s session at 60 Hz
  const Ns = 441000  // audio-rate samples for 10s at 44.1 kHz
  const ctrlProgress = tsLinspace(0, 1, Nc)
  const audioProgress = tsLinspace(0, 1, Ns)
  const ctrlData = Float32Array.from({ length: Nc }, (_, i) => Math.sin(2 * Math.PI * 3 * (i / Nc)))
  runTest(
    'interp — control-to-audio upsample (600 → 441000)',
    tsInterp(audioProgress, ctrlProgress, ctrlData),
    wasmInterp(audioProgress, ctrlProgress, ctrlData),
  )

  // ── stabilizeState / applyPhi tests ────────────

  console.log('\n── stabilizeState / applyPhi ──')

  function compareTuples(
    name: string,
    ts: [number, number],
    wasm: [number, number],
    tolerance = 1e-12,
  ) {
    const err0 = Math.abs(ts[0] - wasm[0])
    const err1 = Math.abs(ts[1] - wasm[1])
    const maxErr = Math.max(err0, err1)
    const passed = maxErr <= tolerance
    console.log(
      `[${passed ? 'PASS' : 'FAIL'}] ${name}` +
        ` — max error: ${maxErr.toExponential(3)}` +
        ` (TS: [${ts[0].toFixed(8)}, ${ts[1].toFixed(8)}]` +
        `, Wasm: [${wasm[0].toFixed(8)}, ${wasm[1].toFixed(8)}])`,
    )
    if (!passed) allPassed = false
  }

  // stabilizeState
  compareTuples(
    'stabilizeState([0, 1])',
    tsStabilizeState([0, 1]),
    wasmStabilizeState([0, 1]),
  )
  compareTuples(
    'stabilizeState([0, 0]) — symmetric',
    tsStabilizeState([0, 0]),
    wasmStabilizeState([0, 0]),
  )
  compareTuples(
    'stabilizeState([-5, 3]) — asymmetric',
    tsStabilizeState([-5, 3]),
    wasmStabilizeState([-5, 3]),
  )

  // applyPhi — single step
  compareTuples(
    'applyPhi([0.5, 0.5], 0.5, 0.01, 0.1)',
    tsApplyPhi([0.5, 0.5], 0.5, 0.01, 0.1),
    wasmApplyPhi([0.5, 0.5], 0.5, 0.01, 0.1),
  )

  // applyPhi — high convergence
  compareTuples(
    'applyPhi([0.3, 0.7], 0.99, 0.0, 0.0) — high lambda',
    tsApplyPhi([0.3, 0.7], 0.99, 0.0, 0.0),
    wasmApplyPhi([0.3, 0.7], 0.99, 0.0, 0.0),
  )

  // applyPhi — iterated (mimics the generator's control-rate loop)
  {
    let tsState: [number, number] = tsStabilizeState([0, 1])
    let wasmState: [number, number] = wasmStabilizeState([0, 1])
    const Nc = 600
    for (let i = 1; i < Nc; i++) {
      const lam = i / Nc
      const thetaStep = (2 * Math.PI * (0.05 + 0.1 * lam)) / 60
      tsState = tsApplyPhi(tsState, lam, thetaStep, 0.1)
      wasmState = wasmApplyPhi(wasmState, lam, thetaStep, 0.1)
    }
    compareTuples(
      `applyPhi iterated ${Nc} steps (full control-rate sim)`,
      tsState,
      wasmState,
    )
  }

  // ── SeededRNG tests ────────────────────────────

  console.log('\n── SeededRNG ──')

  // next() — 100 sequential calls must be bit-identical (f64)
  {
    const tsRng = new TSSeededRNG(2025)
    const wasmRng = new WasmSeededRNG(2025)
    let nextPassed = true
    for (let i = 0; i < 100; i++) {
      const tsVal = tsRng.next()
      const wasmVal = wasmRng.next()
      if (tsVal !== wasmVal) {
        console.log(`[FAIL] next() diverged at call ${i}: TS=${tsVal}, Wasm=${wasmVal}`)
        nextPassed = false
        allPassed = false
        break
      }
    }
    if (nextPassed) {
      console.log('[PASS] next() — 100 sequential calls, bit-identical')
    }
  }

  // normalArray — exact match for the generator's actual usage (seed 2025, 5 voices)
  {
    const tsRng = new TSSeededRNG(2025)
    const wasmRng = new WasmSeededRNG(2025)
    const tsArr = tsRng.normalArray(0, 12, 5)
    const wasmArr = wasmRng.normalArray(0, 12, 5)
    runTest('normalArray(0, 12, 5) — seed 2025 (generator detune)', tsArr, wasmArr)
  }

  // uniformArray — exact match for the generator's actual usage
  {
    const tsRng = new TSSeededRNG(2025)
    const wasmRng = new WasmSeededRNG(2025)
    // Consume the same calls as normalArray first to align state
    tsRng.normalArray(0, 12, 5)
    wasmRng.normalArray(0, 12, 5)
    const tsArr = tsRng.uniformArray(0, 2 * Math.PI, 5)
    const wasmArr = wasmRng.uniformArray(0, 2 * Math.PI, 5)
    runTest('uniformArray(0, 2pi, 5) — seed 2025 (generator phase)', tsArr, wasmArr)
  }

  // Full generator sequence — normalArray then uniformArray in one go
  {
    const tsRng = new TSSeededRNG(2025)
    const wasmRng = new WasmSeededRNG(2025)
    const tsCents = tsRng.normalArray(0, 12, 5)
    const tsPhase = tsRng.uniformArray(0, 2 * Math.PI, 5)
    const wasmCents = wasmRng.normalArray(0, 12, 5)
    const wasmPhase = wasmRng.uniformArray(0, 2 * Math.PI, 5)
    // Concatenate for a single comparison
    const tsAll = new Float32Array([...tsCents, ...tsPhase])
    const wasmAll = new Float32Array([...wasmCents, ...wasmPhase])
    runTest('Full generator RNG sequence (5 cents + 5 phases)', tsAll, wasmAll)
  }

  // ── synthesizeLayer tests ─────────────────────

  console.log('\n── synthesizeLayer ──')

  // Single voice, no modulation
  {
    const N = 4410
    const conv = new Float32Array(N).fill(0.0)
    const ctrl = new Float32Array(N).fill(0.5)
    const bf = new Float32Array(N).fill(440.0)
    const drift = new Float32Array(N).fill(0.0)
    const c = new Float32Array([0.0])
    const p = new Float32Array([0.0])
    runTest(
      'synthesizeLayer - single voice, no modulation',
      tsSynthesizeLayer(conv, ctrl, bf, drift, c, p, 1.0, 0.1, 0.1, 44100),
      wasmSynthesizeLayer(conv, ctrl, bf, drift, c, p, 1.0, 0.1, 0.1, 44100),
    )
  }

  // Realistic: 5 voices, full modulation
  {
    const N = 44100
    const sr = 44100
    const conv = Float32Array.from({ length: N }, (_, i) => 0.9 * (1 - Math.pow(i / (N - 1), 2)))
    const ctrl = Float32Array.from({ length: N }, (_, i) => 0.5 + 0.3 * Math.sin(2 * Math.PI * 0.1 * (i / sr)))
    const bf = new Float32Array(N).fill(174.0)
    const drift = Float32Array.from({ length: N }, (_, i) => 2 * Math.PI * 0.02 * conv[i] * (i / sr))
    const rng = new TSSeededRNG(2025)
    const c = rng.normalArray(0, 12, 5)
    const p = rng.uniformArray(0, 2 * Math.PI, 5)
    runTest(
      'synthesizeLayer - 5 voices, realistic (1s @ 44.1kHz)',
      tsSynthesizeLayer(conv, ctrl, bf, drift, c, p, 1.001, 0.3, 0.2, sr),
      wasmSynthesizeLayer(conv, ctrl, bf, drift, c, p, 1.001, 0.3, 0.2, sr),
    )
  }

  // Empty
  {
    runTest(
      'synthesizeLayer - empty',
      tsSynthesizeLayer(new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array([1]), new Float32Array([0]), 1.0, 0.0, 0.0, 44100),
      wasmSynthesizeLayer(new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array([1]), new Float32Array([0]), 1.0, 0.0, 0.0, 44100),
    )
  }

  // ── mixLayers tests ──────────────────────────

  console.log('\n── mixLayers ──')

  // Single layer
  {
    const N = 1000
    const layer = Float32Array.from({ length: N }, (_, i) => Math.sin(2 * Math.PI * 440 * (i / 44100)))
    const activity = new Float32Array(N).fill(0.8)
    runTest(
      'mixLayers - single layer',
      tsMixLayers([layer], activity),
      wasmMixLayers([layer], activity),
    )
  }

  // 3 layers, decaying activity
  {
    const N = 44100
    const activity = Float32Array.from({ length: N }, (_, i) => 0.9 * (1 - Math.pow(i / (N - 1), 2)))
    const layers: Float32Array[] = []
    for (let ell = 0; ell < 3; ell++) {
      layers.push(Float32Array.from({ length: N }, (_, i) =>
        Math.sin(2 * Math.PI * (174 + ell * 5) * (i / 44100)) * (1 - ell * 0.2)
      ))
    }
    runTest(
      'mixLayers - 3 layers, decaying activity (1s)',
      tsMixLayers(layers, activity),
      wasmMixLayers(layers, activity),
    )
  }

  // Empty
  {
    runTest(
      'mixLayers - empty',
      tsMixLayers([], new Float32Array(0)),
      wasmMixLayers([], new Float32Array(0)),
    )
  }

  // ── applyBaseToneAndHarmonics tests ──────────

  console.log('\n── applyBaseToneAndHarmonics ──')

  // Realistic params
  {
    const N = 44100
    const mix = Float32Array.from({ length: N }, (_, i) => 0.3 * Math.sin(2 * Math.PI * 174 * (i / 44100)))
    const amp = Float32Array.from({ length: N }, (_, i) => 0.6 + 0.4 * (i / (N - 1)))
    const breath = Float32Array.from({ length: N }, (_, i) => 0.5 * (1 + Math.sin(2 * Math.PI * 0.15 * (i / 44100))))
    const ve = Float32Array.from({ length: N }, (_, i) => Math.min(1, i / 22050))
    const conv = Float32Array.from({ length: N }, (_, i) => 0.9 * (1 - Math.pow(i / (N - 1), 2)))
    const be = Float32Array.from({ length: N }, (_, i) => Math.min(1, i / 10000))
    runTest(
      'applyBaseToneAndHarmonics - realistic (1s @ 44.1kHz)',
      tsApplyBaseToneAndHarmonics(mix, 174.0, 44100, amp, breath, ve, conv, be, 1.0, 0.08, 0.05),
      wasmApplyBaseToneAndHarmonics(mix, 174.0, 44100, amp, breath, ve, conv, be, 1.0, 0.08, 0.05),
    )
  }

  // No harmonics (even=0, odd=0)
  {
    const N = 4410
    const mix = Float32Array.from({ length: N }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 440 * (i / 44100)))
    const amp = new Float32Array(N).fill(0.8)
    const breath = new Float32Array(N).fill(0.5)
    const ve = new Float32Array(N).fill(1.0)
    const conv = new Float32Array(N).fill(0.5)
    const be = new Float32Array(N).fill(1.0)
    runTest(
      'applyBaseToneAndHarmonics - no harmonics',
      tsApplyBaseToneAndHarmonics(mix, 440.0, 44100, amp, breath, ve, conv, be, 1.0, 0.0, 0.0),
      wasmApplyBaseToneAndHarmonics(mix, 440.0, 44100, amp, breath, ve, conv, be, 1.0, 0.0, 0.0),
    )
  }

  // Empty
  {
    runTest(
      'applyBaseToneAndHarmonics - empty',
      tsApplyBaseToneAndHarmonics(new Float32Array(0), 174.0, 44100, new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), 1.0, 0.1, 0.1),
      wasmApplyBaseToneAndHarmonics(new Float32Array(0), 174.0, 44100, new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), 1.0, 0.1, 0.1),
    )
  }

  // ── applyStereoBinaural tests ─────────────────

  console.log('\n── applyStereoBinaural ──')

  // Helper to compare stereo pairs
  function runStereoTest(
    name: string,
    ts: { left: Float32Array; right: Float32Array },
    wasm: { left: Float32Array; right: Float32Array },
  ) {
    const cmpL = compareBuffers(ts.left, wasm.left)
    const cmpR = compareBuffers(ts.right, wasm.right)
    const passed = cmpL.passed && cmpR.passed
    const maxErr = Math.max(cmpL.maxAbsError, cmpR.maxAbsError)
    const meanErr = (cmpL.meanAbsError + cmpR.meanAbsError) / 2
    console.log(
      `[${passed ? 'PASS' : 'FAIL'}] ${name}` +
        ` — ${cmpL.sampleCount} samples/ch` +
        `, max error: ${maxErr.toExponential(3)}` +
        `, mean error: ${meanErr.toExponential(3)}` +
        (!cmpL.passed && cmpL.failedAt !== undefined ? ` (L diverged at ${cmpL.failedAt})` : '') +
        (!cmpR.passed && cmpR.failedAt !== undefined ? ` (R diverged at ${cmpR.failedAt})` : ''),
    )
    if (!passed) allPassed = false
  }

  // Realistic stereo rendering
  {
    const N = 44100
    const sr = 44100
    const mix = Float32Array.from({ length: N }, (_, i) => 0.3 * Math.sin(2 * Math.PI * 174 * (i / sr)))
    const conv = Float32Array.from({ length: N }, (_, i) => 0.9 * (1 - Math.pow(i / (N - 1), 2)))
    const be = Float32Array.from({ length: N }, (_, i) => Math.min(1, i / 10000))
    const br = Float32Array.from({ length: N }, (_, i) => 0.5 * (1 + Math.sin(2 * Math.PI * 0.15 * (i / sr))))
    const sw = Float32Array.from({ length: N }, (_, i) => 0.7 - 0.05 * Math.sin(2 * Math.PI * 0.15 * (i / sr)))
    const st = Float32Array.from({ length: N }, (_, i) => i / sr)
    runStereoTest(
      'applyStereoBinaural - realistic (1s @ 44.1kHz)',
      tsApplyStereoBinaural(mix, conv, be, br, sw, st, 174.0, sr, 4.0, 0.3, 0.15),
      wasmApplyStereoBinaural(mix, conv, be, br, sw, st, 174.0, sr, 4.0, 0.3, 0.15),
    )
  }

  // Zero binaural delta (mono binaural)
  {
    const N = 4410
    const sr = 44100
    const mix = Float32Array.from({ length: N }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 440 * (i / sr)))
    const conv = new Float32Array(N).fill(0.5)
    const be = new Float32Array(N).fill(1.0)
    const br = new Float32Array(N).fill(0.5)
    const sw = new Float32Array(N).fill(0.7)
    const st = Float32Array.from({ length: N }, (_, i) => i / sr)
    runStereoTest(
      'applyStereoBinaural - zero binaural delta',
      tsApplyStereoBinaural(mix, conv, be, br, sw, st, 440.0, sr, 0.0, 0.3, 0.15),
      wasmApplyStereoBinaural(mix, conv, be, br, sw, st, 440.0, sr, 0.0, 0.3, 0.15),
    )
  }

  // Empty
  {
    const empty = new Float32Array(0)
    runStereoTest(
      'applyStereoBinaural - empty',
      tsApplyStereoBinaural(empty, empty, empty, empty, empty, empty, 174.0, 44100, 4.0, 0.3, 0.15),
      wasmApplyStereoBinaural(empty, empty, empty, empty, empty, empty, 174.0, 44100, 4.0, 0.3, 0.15),
    )
  }

  // ── finalizeStereo tests ──────────────────────

  console.log('\n── finalizeStereo ──')

  // Realistic 1-second signal
  {
    const N = 44100
    const sr = 44100
    const Nc = 60
    const l = Float32Array.from({ length: N }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 174 * (i / sr)))
    const r = Float32Array.from({ length: N }, (_, i) => 0.5 * Math.cos(2 * Math.PI * 174 * (i / sr)))
    const ptve = new Float32Array(N).fill(1.0)
    const acs = Float32Array.from({ length: Nc }, (_, i) => 0.5 * (1 - i / (Nc - 1)))
    const cp = Float32Array.from({ length: Nc }, (_, i) => i / (Nc - 1))
    const tsResult = tsFinalizeStereo(l, r, ptve, acs, cp, sr, 60)
    const wasmResult = wasmFinalizeStereo(l, r, ptve, acs, cp, sr, 60)
    // Output lengths must match
    const lenMatch = tsResult.left.length === wasmResult.left.length
    if (!lenMatch) {
      console.log(`[FAIL] finalizeStereo - length mismatch: TS=${tsResult.left.length}, Wasm=${wasmResult.left.length}`)
      allPassed = false
    } else {
      runStereoTest('finalizeStereo - realistic (1s @ 44.1kHz)', tsResult, wasmResult)
    }
  }

  // Constant activity (no collapse trimming)
  {
    const N = 4410
    const sr = 44100
    const Nc = 60
    const l = Float32Array.from({ length: N }, (_, i) => 0.3 * Math.sin(2 * Math.PI * 440 * (i / sr)))
    const r = Float32Array.from(l)
    const ptve = new Float32Array(N).fill(1.0)
    // Constant high activity = always active = no trimming
    const acs = new Float32Array(Nc).fill(0.8)
    const cp = Float32Array.from({ length: Nc }, (_, i) => i / (Nc - 1))
    const tsResult = tsFinalizeStereo(l, r, ptve, acs, cp, sr, 60)
    const wasmResult = wasmFinalizeStereo(l, r, ptve, acs, cp, sr, 60)
    const lenMatch = tsResult.left.length === wasmResult.left.length
    if (!lenMatch) {
      console.log(`[FAIL] finalizeStereo constant - length mismatch: TS=${tsResult.left.length}, Wasm=${wasmResult.left.length}`)
      allPassed = false
    } else {
      runStereoTest('finalizeStereo - constant activity (no trim)', tsResult, wasmResult)
    }
  }

  // Empty
  {
    const tsResult = tsFinalizeStereo(new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), 44100, 60)
    const wasmResult = wasmFinalizeStereo(new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), 44100, 60)
    runStereoTest('finalizeStereo - empty', tsResult, wasmResult)
  }

  console.log(
    allPassed
      ? '\n[verify] All tests passed - Rust output matches TypeScript.'
      : '\n[verify] Some tests FAILED - check output above.',
  )
}
