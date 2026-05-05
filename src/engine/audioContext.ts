/**
 * Shared AudioContext singleton.
 *
 * iOS WebKit requires that an AudioContext is created or resumed
 * inside a synchronous user-gesture handler (tap, click). Once
 * unlocked, the context stays alive across navigations and async
 * boundaries.
 *
 * Call warmup() from any tap handler to guarantee the context is
 * ready before async work (Web Worker generation, route navigation)
 * moves execution out of the gesture's call stack.
 */

import { AUDIO_SR } from "./types";

let ctx: AudioContext | null = null;

let unlocked = false;

/**
 * Create and/or resume the global AudioContext.
 * Safe to call multiple times - idempotent when already running.
 * MUST be called synchronously inside a user gesture on iOS.
 *
 * On first call, plays a silent buffer to force iOS WebKit to
 * transition the context to "running". This is the most reliable
 * unlock pattern across all iOS versions.
 */
export function warmup(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ sampleRate: AUDIO_SR });
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  // Play a silent buffer to force iOS to fully unlock the context.
  // Some iOS versions don't transition to "running" on resume() alone.
  if (!unlocked) {
    const silent = ctx.createBuffer(1, 1, AUDIO_SR);
    const src = ctx.createBufferSource();
    src.buffer = silent;
    src.connect(ctx.destination);
    src.start();
    unlocked = true;
  }

  return ctx;
}

/**
 * Return the shared AudioContext, creating it if needed.
 * Prefer warmup() when inside a user gesture handler.
 */
export function getAudioContext(): AudioContext {
  return warmup();
}
