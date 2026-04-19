/**
 * Phasefold — Vue composable for audio generation + playback
 *
 * Wraps the generator and Web Audio API into a reactive interface.
 *
 * iOS note: AudioContext must be created / resumed inside a user-gesture
 * handler.  The play() and generate() calls are always user-initiated
 * so this is handled automatically.
 */

import { ref, shallowRef } from "vue";
import type { SynthParams, StereoAudio } from "../engine/types";
import { generateAudio } from "../engine/generator";
import { encodeWav } from "../engine/wav";

export function useAudioEngine() {
  let ctx: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  let animFrame = 0;
  let startedAt = 0;
  let startOffset = 0;

  const isPlaying = ref(false);
  const isGenerating = ref(false);
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
   * Returns immediately with a reactive isGenerating flag.
   * A tiny setTimeout lets the UI paint the "Generating…" state.
   */
  async function generate(params: SynthParams): Promise<StereoAudio> {
    isGenerating.value = true;
    try {
      // Yield to the event loop so the UI can show a loading state
      await new Promise((r) => setTimeout(r, 50));
      const audio = generateAudio(params);
      currentAudio.value = audio;
      return audio;
    } finally {
      isGenerating.value = false;
    }
  }

  /** Start playback from startTime (seconds). */
  function play(startTime = 0) {
    const audio = currentAudio.value;
    if (!audio) return;

    stop(); // stop any existing playback

    const ac = ensureContext();
    const buf = ac.createBuffer(2, audio.left.length, audio.sampleRate);

    // Web Audio wants Float32; copy from our Float64 buffers
    const ch0 = buf.getChannelData(0);
    const ch1 = buf.getChannelData(1);
    for (let i = 0; i < audio.left.length; i++) {
      ch0[i] = audio.left[i];
      ch1[i] = audio.right[i];
    }

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
    currentAudio,
    playbackTime,
  };
}
