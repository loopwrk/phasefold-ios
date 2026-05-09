/**
 * Phasefold — Rust/Wasm audio generation Web Worker
 *
 * Identical to audio.worker.ts but swaps in the Wasm smoothEnvelope
 * before generating. This lets us A/B the Rust DSP against the
 * TypeScript original by pointing different views at different workers.
 */

import { generateAudio } from './generator'
import {
  setSmoothEnvelopeImpl,
  setLinspaceImpl,
  setInterpImpl,
  setSeededRNGFactory,
  setStabilizeStateImpl,
  setApplyPhiImpl,
  setSynthesizeLayerImpl,
  setMixLayersImpl,
  setApplyBaseToneAndHarmonicsImpl,
  setApplyStereoBinauralImpl,
  setFinalizeStereoImpl,
} from './dsp'
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
} from './wasm/dsp'
import type { WorkerRequest, WorkerResponse } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const worker = self as any

let wasmReady = false

worker.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { type, params } = e.data

  if (type !== 'generate') return

  try {
    // Initialise Wasm on first run
    if (!wasmReady) {
      await initWasm()
      setSmoothEnvelopeImpl(wasmSmoothEnvelope)
      setLinspaceImpl(wasmLinspace)
      setInterpImpl(wasmInterp)
      setSeededRNGFactory((seed) => new WasmSeededRNG(seed))
      setStabilizeStateImpl(wasmStabilizeState)
      setApplyPhiImpl(wasmApplyPhi)
      setSynthesizeLayerImpl(wasmSynthesizeLayer)
      setMixLayersImpl(wasmMixLayers)
      setApplyBaseToneAndHarmonicsImpl(wasmApplyBaseToneAndHarmonics)
      setApplyStereoBinauralImpl(wasmApplyStereoBinaural)
      setFinalizeStereoImpl(wasmFinalizeStereo)
      wasmReady = true
      console.log('[phasefold rust-worker] Wasm initialised, all DSP functions swapped')
    }

    const t0 = performance.now()
    const audio = generateAudio(params, (percent, section) => {
      if (import.meta.env.DEV) {
        console.log(`[phasefold rust-worker] ${percent}% - ${section}`)
      }

      const msg: WorkerResponse = { type: 'progress', percent, section }
      worker.postMessage(msg)
    })
    const dt = performance.now() - t0
    console.log(`[phasefold rust-worker] generated ${(audio.left.length / audio.sampleRate).toFixed(1)}s audio in ${dt.toFixed(0)}ms (Rust/Wasm)`)

    const msg: WorkerResponse = {
      type: 'result',
      left: audio.left,
      right: audio.right,
      sampleRate: audio.sampleRate,
    }
    worker.postMessage(msg, [audio.left.buffer, audio.right.buffer])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const msg: WorkerResponse = { type: 'error', message }
    worker.postMessage(msg)
  }
}
