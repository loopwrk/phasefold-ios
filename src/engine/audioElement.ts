/**
 * Shared HTMLAudioElement singleton.
 *
 * Playback goes through an <audio> element rather than a Web Audio
 * graph because iOS classifies element playback as media: it keeps
 * playing when the phone is locked or the browser is backgrounded,
 * and it integrates with the lock screen through the Media Session
 * API. Web Audio output is treated as ambient page sound and gets
 * suspended on lock, which is fatal for a sleep app.
 *
 * iOS requires .play() to be blessed by a user gesture once per
 * element. warmupMedia() plays a few milliseconds of silence inside
 * a tap handler; after that, the same element accepts programmatic
 * play() calls (e.g. auto-play once generation completes).
 */

import { encodeWav } from "./wav";

let el: HTMLAudioElement | null = null;
let primed = false;
let primeUrl: string | null = null;

export function getAudioElement(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = "auto";
    // Dev-only escape hatch: the element never enters the DOM, so
    // this is the only way to inspect playback from the console.
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__phasefoldAudio = el;
    }
  }
  return el;
}

/**
 * Unlock the shared element for programmatic playback.
 * MUST be called synchronously inside a user gesture on iOS.
 * Safe to call multiple times - idempotent once primed.
 */
export function warmupMedia(): HTMLAudioElement {
  const a = getAudioElement();
  if (primed) return a;
  primed = true;

  const SILENT_SAMPLES = 220; // 5 ms of silence
  const silence = new Float32Array(SILENT_SAMPLES);
  const blob = new Blob([encodeWav(silence, silence, 44100)], {
    type: "audio/wav",
  });
  primeUrl = URL.createObjectURL(blob);
  a.src = primeUrl;
  a.play().catch(() => {
    // Rejected (e.g. called outside a real gesture): allow a retry
    // from the next gesture instead of believing we are unlocked.
    primed = false;
  });
  return a;
}

/** Revoke the priming blob URL once a real track replaces it. */
export function releasePrimeUrl(): void {
  if (primeUrl) {
    URL.revokeObjectURL(primeUrl);
    primeUrl = null;
  }
}

/**
 * Lock-screen metadata + controls. The play/pause handlers act on the
 * element directly; UI state stays in sync because useAudioEngine
 * listens to the element's play/pause events rather than assuming it
 * is the only controller.
 */
export function setMediaSessionMetadata(title: string): void {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist: "Soneuro",
  });
  navigator.mediaSession.setActionHandler("play", () => {
    getAudioElement()
      .play()
      .catch(() => {});
  });
  navigator.mediaSession.setActionHandler("pause", () => {
    getAudioElement().pause();
  });
}
