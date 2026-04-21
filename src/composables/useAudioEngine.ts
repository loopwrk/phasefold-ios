/**
 * Phasefold — Vue composable for audio generation + playback
 *
 * Wraps the generator (via Web Worker) and Web Audio API into a
 * reactive interface.
 *
 * Generation runs in a dedicated Web Worker so the main thread
 * stays responsive regardless of track length.
 *
 * iOS note: AudioContext must be created / resumed inside a user-gesture
 * handler.  The play() and generate() calls are always user-initiated
 * so this is handled automatically.
 */

import { ref, shallowRef } from "vue";
import type {
  SynthParams,
  StereoAudio,
  WorkerRequest,
  WorkerResponse,
} from "../engine/types";
import { encodeWav } from "../engine/wav";

export function useAudioEngine() {
  let ctx: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  let animFrame = 0;
  let startedAt = 0;
  let startOffset = 0;

  const isPlaying = ref(false);
  const isGenerating = ref(false);
  const generationProgress = ref(0);
  const currentAudio = shallowRef<StereoAudio | null>(null);
  const playbackTime = ref(0);

  // ── helpers ──────────────────────────────────

  /** Lazily create & resume AudioContext (must be inside a user gesture). */
  function ensureContext(): AudioContext {
    if (!ctx) {
      ctx = new AudioContext({ sampleRate: 44100 });
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    return ctx;
  }

  // ── public API ───────────────────────────────

  /**
   * Generate audio from parameters.
   * Spawns a Web Worker, returns a promise that resolves with the
   * generated StereoAudio. Progress is exposed via generationProgress ref.
   */
  function generate(params: SynthParams): Promise<StereoAudio> {
    isGenerating.value = true;
    generationProgress.value = 0;

    return new Promise<StereoAudio>((resolve, reject) => {
      const worker = new Worker(
        new URL("../engine/audio.worker.ts", import.meta.url),
        { type: "module" },
      );

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;

        switch (msg.type) {
          case "progress":
            generationProgress.value = msg.percent;
            break;

          case "result": {
            // Reconstruct StereoAudio from transferred buffers
            const audio: StereoAudio = {
              left: msg.left,
              right: msg.right,
              sampleRate: msg.sampleRate,
            };
            currentAudio.value = audio;
            isGenerating.value = false;
            generationProgress.value = 100;
            worker.terminate();
            resolve(audio);
            break;
          }

          case "error":
            isGenerating.value = false;
            generationProgress.value = 0;
            worker.terminate();
            reject(new Error(msg.message));
            break;
        }
      };

      worker.onerror = (e) => {
        isGenerating.value = false;
        generationProgress.value = 0;
        worker.terminate();
        reject(new Error(e.message || "Worker failed"));
      };

      // Send params to the worker
      const request: WorkerRequest = { type: "generate", params };
      worker.postMessage(request);
    });
  }

  /** Start playback from startTime (seconds). */
  function play(startTime = 0) {
    const audio = currentAudio.value;
    if (!audio) return;

    stop(); // stop any existing playback

    const ac = ensureContext();
    const buf = ac.createBuffer(2, audio.left.length, audio.sampleRate);

    buf.copyToChannel(new Float32Array(audio.left), 0);
    buf.copyToChannel(new Float32Array(audio.right), 1);

    source = ac.createBufferSource();
    source.buffer = buf;
    source.connect(ac.destination);
    source.start(0, startTime);

    startOffset = startTime;
    startedAt = ac.currentTime;
    isPlaying.value = true;

    source.onended = () => {
      isPlaying.value = false;
      cancelAnimationFrame(animFrame);
    };

    // Track playback position at display refresh rate
    const tick = () => {
      if (!isPlaying.value || !ctx) return;
      playbackTime.value = startOffset + (ctx.currentTime - startedAt);
      animFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Stop playback. */
  function stop() {
    if (source) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      source = null;
    }
    isPlaying.value = false;
    cancelAnimationFrame(animFrame);
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
    const audio = currentAudio.value;
    if (!audio) return 0;
    return audio.left.length / audio.sampleRate;
  }

  return {
    generate,
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
