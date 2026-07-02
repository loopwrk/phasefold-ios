/**
 * Phasefold: Vue composable for audio generation + playback
 *
 * Generation runs in a dedicated Web Worker, which also encodes the
 * final 16-bit WAV: the raw Float32 buffers never reach the main
 * thread, halving peak memory for long sessions.
 *
 * Playback design:
 *   - The WAV is wrapped in a Blob and played through the shared
 *     HTMLAudioElement (engine/audioElement.ts). iOS treats element
 *     playback as media, so audio keeps playing when the phone is
 *     locked, and the lock screen shows Media Session metadata with
 *     working play/pause controls.
 *   - isPlaying is driven by the element's play/pause/ended events
 *     rather than assumed by this composable, so lock-screen and
 *     control-centre actions stay in sync with the UI automatically.
 *   - playbackTime reads el.currentTime at display refresh rate while
 *     playing; because it reads the element's own clock, it
 *     self-corrects after the page is backgrounded and resumed.
 *   - The same Blob backs the WAV export, so export costs nothing.
 *
 * iOS note: the element must be primed inside a user gesture before
 * programmatic play() is allowed. Call warmupMedia() from any tap
 * handler BEFORE async work or navigation (see audioElement.ts).
 */

import { ref } from "vue";
import type { SynthParams, WorkerRequest, WorkerResponse } from "../engine/types";
import {
  getAudioElement,
  releasePrimeUrl,
  setMediaSessionMetadata,
} from "../engine/audioElement";

export interface GeneratedTrack {
  duration: number; // seconds
  sampleRate: number;
}

export function useAudioEngine() {
  let cachedBlob: Blob | null = null;
  let mediaUrl: string | null = null;
  let audioDuration = 0;
  let animFrame = 0;
  let activeWorker: Worker | null = null; // current generation worker
  let activeReject: ((reason: Error) => void) | null = null;

  const isPlaying = ref(false);
  const isGenerating = ref(false);
  const generationProgress = ref(0);
  const hasAudio = ref(false);
  const playbackTime = ref(0);

  // ── helpers ──────────────────────────────────

  /** Track playback position at display refresh rate. */
  function startTicker(el: HTMLAudioElement) {
    cancelAnimationFrame(animFrame);
    const tick = () => {
      if (!isPlaying.value) return;
      playbackTime.value = Math.min(el.currentTime, audioDuration);
      animFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  /**
   * Keep reactive state in sync with the element. Assigned on every
   * play() call so whichever view is active owns the handlers; the
   * element itself is a shared singleton.
   */
  function attachHandlers(el: HTMLAudioElement) {
    el.onplay = () => {
      isPlaying.value = true;
      startTicker(el);
    };
    el.onpause = () => {
      isPlaying.value = false;
      cancelAnimationFrame(animFrame);
    };
    el.onended = () => {
      isPlaying.value = false;
      cancelAnimationFrame(animFrame);
      playbackTime.value = audioDuration;
    };
  }

  // ── public API ───────────────────────────────

  /**
   * Generate audio from parameters.
   * Spawns a Web Worker; resolves once the encoded track is ready for
   * playback. Progress is exposed via the generationProgress ref.
   */
  function generate(params: SynthParams): Promise<GeneratedTrack> {
    // Cancel any in-flight generation before starting a new one
    cancelGeneration();

    // Set generating state AFTER cancelGeneration has cleared it
    isGenerating.value = true;
    generationProgress.value = 0;

    return new Promise<GeneratedTrack>((resolve, reject) => {
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
            cachedBlob = new Blob([msg.wav], { type: "audio/wav" });
            if (mediaUrl) URL.revokeObjectURL(mediaUrl);
            releasePrimeUrl();
            mediaUrl = URL.createObjectURL(cachedBlob);
            audioDuration = msg.sampleCount / msg.sampleRate;

            hasAudio.value = true;
            isGenerating.value = false;
            generationProgress.value = 100;
            activeWorker = null;
            activeReject = null;
            worker.terminate();
            resolve({ duration: audioDuration, sampleRate: msg.sampleRate });
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
    if (!mediaUrl) return;

    const el = getAudioElement();
    attachHandlers(el);

    if (el.src !== mediaUrl) {
      el.src = mediaUrl;
    }

    // Clamp startTime to valid range; if at/past the end just position
    // the scrubber there instead of playing a zero-length remainder.
    const safeStart = Math.max(0, Math.min(startTime, audioDuration - 0.01));
    if (audioDuration > 0 && safeStart >= audioDuration - 0.01) {
      playbackTime.value = audioDuration;
      return;
    }

    const seekAndPlay = () => {
      el.currentTime = safeStart;
      el.play().catch(() => {
        // Rejected (e.g. element not primed by a gesture yet): leave
        // the UI in the paused state; the user's next tap will work.
        isPlaying.value = false;
      });
    };

    // Seeking requires metadata; blob URLs load it near-instantly.
    if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
      seekAndPlay();
    } else {
      el.onloadedmetadata = seekAndPlay;
    }
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

  /** Pause playback (position is kept; views reset playbackTime for a
   *  full stop). */
  function stop() {
    if (!mediaUrl) return;
    getAudioElement().pause();
  }

  /** Lock-screen title for the current track. */
  function setNowPlaying(title: string) {
    setMediaSessionMetadata(title);
  }

  /** Download the current audio as a 16-bit WAV. */
  function exportWav(filename = "phasefold-export.wav") {
    if (!cachedBlob) return;

    const url = URL.createObjectURL(cachedBlob);
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
    return audioDuration;
  }

  return {
    generate,
    cancelGeneration,
    play,
    stop,
    setNowPlaying,
    exportWav,
    getDuration,
    isPlaying,
    isGenerating,
    generationProgress,
    hasAudio,
    playbackTime,
  };
}
