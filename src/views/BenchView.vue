<template>
  <div class="bench">
    <h1 class="bench-title">Engine benchmark</h1>
    <p class="bench-sub">Dev harness: not linked from the app. Times the generator inside its worker.</p>

    <div class="bench-controls">
      <label class="bench-field">
        <span>Workload</span>
        <select v-model="workloadKey">
          <option v-for="(w, key) in WORKLOADS" :key="key" :value="key">
            {{ w.label }}
          </option>
        </select>
      </label>

    </div>

    <div class="bench-buttons">
      <button class="bench-btn primary" :disabled="running" @click="runOne">
        {{ running ? runningLabel : 'Run selected' }}
      </button>
      <button class="bench-btn" :disabled="running" @click="runAll">Run all</button>
      <button class="bench-btn" :disabled="!report" @click="copyReport">{{ copied ? 'Copied' : 'Copy report' }}</button>
    </div>

    <pre class="bench-report" v-if="report">{{ report }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { PRESETS } from '../data/presets'
import { AUDIO_SR } from '../engine/types'
import type { SynthParams, WorkerRequest, WorkerResponse } from '../engine/types'

interface Workload {
  label: string
  presetKey: string
}

const WORKLOADS: Record<string, Workload> = {
  light: { label: 'Light: Moonrise (450s, 1v x 1l)', presetKey: 'Delta - Moonrise (Sleep and rest)' },
  medium: { label: 'Medium: Weightless Tide (360s, 5v x 3l)', presetKey: 'Delta - Weightless Tide (Sleep and rest)' },
  heavy: { label: 'Heavy: Unwavering Clarity (320s, 9v x 5l)', presetKey: 'Gamma - Unwavering Clarity (Cognitive enhancement)' },
}

const workloadKey = ref('medium')
const running = ref(false)
const runningLabel = ref('Running...')
const report = ref('')
const copied = ref(false)

// Same parameter mapping as PlaybackView.buildParams, dev flags all on
function buildParams(presetKey: string): SynthParams {
  const p = PRESETS[presetKey]
  return {
    dur: p.dur,
    sampleRate: AUDIO_SR,
    baseF0: p.baseF0,
    voices: Math.round(p.voices),
    layers: Math.round(p.layers),
    seed: 2025,
    fmIndex0: 1.6,
    amIndex0: 0.35,
    binauralDeltaHz0: p.binauralDeltaHz0,
    binauralAmount: p.binauralAmount,
    overtonePower: 1.3,
    voiceDelay: Math.min(30, Math.max(10, 0.08 * p.dur)),
    breathRate: p.breathRate,
  }
}

function makeWorker(): Worker {
  return new Worker(new URL('../engine/audio.worker.ts', import.meta.url), { type: 'module' })
}

interface RunResult {
  sampleCount: number
  totalMs: number
  wallMs: number
  sections: { name: string; ms: number }[]
}

function runGeneration(params: SynthParams, onSection?: (s: string) => void): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const worker = makeWorker()
    const wall0 = performance.now()
    const marks: { name: string; at: number }[] = []

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        marks.push({ name: msg.section, at: msg.elapsedMs ?? 0 })
        onSection?.(msg.section)
      } else if (msg.type === 'result') {
        const wallMs = performance.now() - wall0
        const totalMs = msg.elapsedMs ?? wallMs
        // Convert cumulative marks into per-section deltas. Each mark is
        // emitted when its section FINISHES, so delta from the previous
        // mark is that section's cost.
        const sections: { name: string; ms: number }[] = []
        let prev = 0
        for (const m of marks) {
          sections.push({ name: m.name, ms: m.at - prev })
          prev = m.at
        }
        worker.terminate()
        resolve({ sampleCount: msg.sampleCount, totalMs, wallMs, sections })
      } else {
        worker.terminate()
        reject(new Error(msg.message))
      }
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Worker failed'))
    }

    const request: WorkerRequest = { type: 'generate', params }
    worker.postMessage(request)
  })
}

function deviceLine(): string {
  const mem = (navigator as unknown as Record<string, unknown>).deviceMemory
  return `Device: ${navigator.userAgent}${mem ? ` | deviceMemory: ${mem}GB` : ''} | cores: ${navigator.hardwareConcurrency ?? '?'}`
}

function fmtRun(wKey: string, r: RunResult): string {
  const lines = [
    `${WORKLOADS[wKey].label}`,
    `  total: ${r.totalMs.toFixed(0)} ms (wall incl. transfer: ${r.wallMs.toFixed(0)} ms), output: ${(r.sampleCount / AUDIO_SR).toFixed(1)}s`,
  ]
  for (const s of r.sections) {
    if (s.ms >= 0.5) lines.push(`    ${s.name.padEnd(28)} ${s.ms.toFixed(0)} ms`)
  }
  return lines.join('\n')
}

async function runOne() {
  running.value = true
  copied.value = false
  try {
    const params = buildParams(WORKLOADS[workloadKey.value].presetKey)
    runningLabel.value = 'Running...'
    const r = await runGeneration(params, (s) => {
      runningLabel.value = s
    })
    report.value = `${deviceLine()}\n\n${fmtRun(workloadKey.value, r)}\n\n${report.value}`
  } catch (e) {
    report.value = `ERROR: ${e instanceof Error ? e.message : String(e)}\n\n${report.value}`
  } finally {
    running.value = false
  }
}

async function runAll() {
  running.value = true
  copied.value = false
  const out: string[] = [deviceLine(), '']
  try {
    for (const wKey of Object.keys(WORKLOADS)) {
      runningLabel.value = `${wKey}...`
      const r = await runGeneration(buildParams(WORKLOADS[wKey].presetKey), (s) => {
        runningLabel.value = `${wKey}: ${s}`
      })
      out.push(fmtRun(wKey, r), '')
      report.value = out.join('\n')
    }
  } catch (e) {
    out.push(`ERROR: ${e instanceof Error ? e.message : String(e)}`)
    report.value = out.join('\n')
  } finally {
    running.value = false
  }
}

async function copyReport() {
  await navigator.clipboard.writeText(report.value)
  copied.value = true
}
</script>

<style scoped>
.bench {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
  padding-top: calc(24px + env(safe-area-inset-top, 0px));
  color: var(--cs-text);
}

.bench-title {
  font-size: 22px;
  font-weight: 700;
}

.bench-sub {
  font-size: 13px;
  color: var(--cs-raised);
  margin: 4px 0 16px;
}

.bench-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.bench-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.bench-field select {
  padding: 8px;
  border-radius: 8px;
  font-size: 14px;
}

.bench-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.bench-btn {
  padding: 10px 14px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: var(--cs-surf);
  color: var(--cs-text);
  -webkit-tap-highlight-color: transparent;
}

.bench-btn.primary {
  background: var(--cs-action);
  color: var(--cs-bg);
}

.bench-btn:disabled {
  opacity: 0.5;
}

.bench-report {
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--cs-surf);
  border-radius: 10px;
  padding: 12px;
}
</style>
