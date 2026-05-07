/**
 * Phasefold — Vue composable for audio generation + playback
 *
 * Wraps the generator (via Web Worker) and Web Audio API into a
 * reactive interface.
 *
 * Generation runs in a dedicated Web Worker so the main thread
 * stays responsive regardless of track length.
 *
 * Playback design:
 *   - AudioBuffer is created once per generation and cached.
 *     Scrubbing reuses the cached buffer to avoid per-scrub
 *     allocation (~53 MB for a 10 min stereo track at 44.1 kHz).
 *   - A monotonic playbackId counter disambiguates onended callbacks
 *     from stale source nodes (e.g. during rapid scrubbing) so that
 *     only the CURRENT source's natural end-of-track triggers state
 *     changes. Without this, a rapid scrub sequence can race:
 *     stop() → play() → stale onended fires → kills new playback.
 *   - playbackTime is clamped to [0, duration] in the tick loop
 *     so the scrubber never overshoots the buffer boundary.
 *   - startTime in play() is clamped so we never pass an out-of-range
 *     offset to source.start().
 *
 * iOS note: AudioContext must be created / resumed inside a user-gesture
 * handler. The context is a shared singleton (engine/audioContext.ts).
 * Call warmup() from any tap handler BEFORE async work or navigation
 * so iOS unlocks the context while still in the gesture's call stack.
 */

import { ref, shallowRef } from "vue";
import type {
  SynthParams,
  StereoAudio,
  WorkerRequest,
  WorkerResponse,
} from "../engine/types";
import { getAudioContext } from "../engine/audioContext";
import { encodeWav } from "../engine/wav";

export function useAudioEngine() {
  let source: AudioBufferSourceNode | null = null;
  let cachedBuffer: AudioBuffer | null = null;
  let audioDuration = 0;
  let animFrame = 0;
  let startedAt = 0;
  let startOffset = 0;
  let playbackId = 0; // monotonic counter to identify the current source
  let activeWorker: Worker | null = null; // current generation worker
  let activeReject: ((reason: Error) => void) | null = null;

  const isPlaying = ref(false);
  const isGenerating = ref(false);
  const generationProgress = ref(0);
  const currentAudio = shallowRef<StereoAudio | null>(null);
  const playbackTime = ref(0);

  // ── helpers ──────────────────────────────────

  /**
   * Build and cache an AudioBuffer from the current audio data.
   * Called once after generation; subsequent play/scrub calls reuse
   * the cached buffer.
   */
  function ensureBuffer(): AudioBuffer | null {
    if (cachedBuffer) return cachedBuffer;

    const audio = currentAudio.value;
    if (!audio) return null;

    const ac = getAudioContext();
    const buf = ac.createBuffer(2, audio.left.length, audio.sampleRate);
    // Float32Array from the worker may carry an ArrayBufferLike
    // (SharedArrayBuffer-compatible type). copyToChannel requires a
    // plain ArrayBuffer-backed Float32Array, so we wrap once here.
    buf.copyToChannel(new Float32Array(audio.left), 0);
    buf.copyToChannel(new Float32Array(audio.right), 1);

    cachedBuffer = buf;
    audioDuration = audio.left.length / audio.sampleRate;
    return buf;
  }

  // ── public API ───────────────────────────────

  /**
   * Generate audio from parameters.
   * Spawns a Web Worker, returns a promise that resolves with the
   * generated StereoAudio. Progress is exposed via generationProgress ref.
   */
  function generate(params: SynthParams): Promise<StereoAudio> {
    // Cancel any in-flight generation before starting a new one
    cancelGeneration();

    // Invalidate cached buffer from previous generation
    cachedBuffer = null;
    audioDuration = 0;

    // Set generating state AFTER cancelGeneration has cleared it
    isGenerating.value = true;
    generationProgress.value = 0;

    return new Promise<StereoAudio>((resolve, reject) => {
      const worker = new Worker(
        new URL("../engine/audio.worker.ts", import.meta.url),
        { type: "module" },
      );

      activeWorker = worker;
      activeReject = reject;

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;

        switch (msg.type) {
          case "progress":
            generationProgress.value = msg.percent;
            break;

          case "result": {
            const audio: StereoAudio = {
              left: msg.left,
              right: msg.right,
              sampleRate: msg.sampleRate,
            };
            currentAudio.value = audio;
            isGenerating.value = false;
            generationProgress.value = 100;
            activeWorker = null;
            activeReject = null;
            worker.terminate();
            resolve(audio);
            break;
          }

          case "error":
            isGenerating.value = false;
            generationProgress.value = 0;
            activeWorker = null;
            activeReject = null;
            worker.terminate();
            reject(new Error(msg.message));
            break;
        }
      };

      worker.onerror = (e) => {
        isGenerating.value = false;
        generationProgress.value = 0;
        activeWorker = null;
        activeReject = null;
        worker.terminate();
        reject(new Error(e.message || "Worker failed"));
      };

      const request: WorkerRequest = { type: "generate", params };
      worker.postMessage(request);
    });
  }

  /** Start playback from startTime (seconds). */
  function play(startTime = 0) {
    const buf = ensureBuffer();
    if (!buf) return;

    stop(); // stop any existing playback

    // Clamp startTime to valid buffer range
    const safeStart = Math.max(0, Math.min(startTime, audioDuration - 0.01));

    // If clamped start is at or past the end, just position the
    // scrubber there without starting a source that would
    // immediately fire onended.
    if (safeStart >= audioDuration - 0.01) {
      playbackTime.value = audioDuration;
      return;
    }

    const ac = getAudioContext();
    source = ac.createBufferSource();
    source.buffer = buf;
    source.connect(ac.destination);
    source.start(0, safeStart);

    startOffset = safeStart;
    startedAt = ac.currentTime;
    isPlaying.value = true;

    const myId = ++playbackId;

    source.onended = () => {
      // Ignore if this callback came from a stale source that was
      // replaced by a newer play() call (e.g. rapid scrubbing).
      if (myId !== playbackId) return;

      // Only act if playback wasn't already stopped manually.
      // stop() sets isPlaying = false before calling source.stop(),
      if (isPlaying.value) {
        isPlaying.value = false;
        cancelAnimationFrame(animFrame);
        playbackTime.value = audioDuration;
      }
    };

    // Track playback position at display refresh rate
    const tick = () => {
      if (!isPlaying.value) return;
      if (myId !== playbackId) return; // stale tick from replaced source

      const elapsed = startOffset + (ac.currentTime - startedAt);
      playbackTime.value = Math.min(elapsed, audioDuration);

      animFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Cancel an in-flight generation, terminating the worker immediately. */
  function cancelGeneration() {
    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
    }
    if (activeReject) {
      const reject = activeReject;
      activeReject = null;
      reject(new Error("Generation cancelled"));
    }
    isGenerating.value = false;
    generationProgress.value = 0;
  }

  /** Stop playback. */
  function stop() {
    // Set isPlaying FIRST so that any subsequent onended callback
    // from this source knows it was an explicit stop, not a
    // natural end-of-track.
    isPlaying.value = false;
    cancelAnimationFrame(animFrame);

    if (source) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      source = null;
    }
  }

  /** Download the current audio as a 16-bit WAV. */
  function exportWav(filename = "phasefold-export.wav") {
    const audio = currentAudio.value;
    if (!audio) return;

    const buffer = encodeWav(audio.left, audio.right, audio.sampleRate);
    const blob = new Blob([buffer], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Duration of current audio in seconds. */
  function getDuration(): number {
    if (audioDuration > 0) return audioDuration;
    const audio = currentAudio.value;
    if (!audio) return 0;
    return audio.left.length / audio.sampleRate;
  }

  return {
    generate,
    cancelGeneration,
    play,
    stop,
    exportWav,
    getDuration,
    isPlaying,
    isGenerating,
    generationProgress,
    currentAudio,
    playbackTime,
  };
}
