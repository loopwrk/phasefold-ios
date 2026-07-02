/**
 * Phasefold — Audio generation Web Worker
 *
 * Runs generateAudio() off the main thread so the UI stays responsive,
 * then encodes the 16-bit WAV here as well: encoding a long track on
 * the main thread would jank the UI for seconds, and shipping the WAV
 * instead of raw Float32 buffers halves the transferred payload.
 * Communicates via the WorkerRequest / WorkerResponse protocol defined
 * in types.ts. The WAV ArrayBuffer is transferred (zero-copy).
 */

import { generateAudio } from "./generator";
import { encodeWav } from "./wav";
import type { WorkerRequest, WorkerResponse } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const worker = self as any;

worker.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { type, params } = e.data;

  if (type !== "generate") return;

  try {
    // Wall-clock start inside the worker: progress/result messages carry
    // elapsedMs so the benchmark page can compute per-section timings
    // without cross-thread clock skew.
    const t0 = performance.now();

    const audio = generateAudio(params, (percent, section) => {
      // Progress reports - dev console only
      if (import.meta.env.DEV) {
        console.log(`[phasefold worker] ${percent}% - ${section}`);
      }

      const msg: WorkerResponse = {
        type: "progress",
        percent,
        section,
        elapsedMs: performance.now() - t0,
      };
      worker.postMessage(msg);
    });

    const encodeMark: WorkerResponse = {
      type: "progress",
      percent: 100,
      section: "Encoding WAV",
      elapsedMs: performance.now() - t0,
    };
    worker.postMessage(encodeMark);

    const wav = encodeWav(audio.left, audio.right, audio.sampleRate);

    // Transfer the WAV buffer (zero-copy); the Float32 buffers die
    // with this worker.
    const msg: WorkerResponse = {
      type: "result",
      wav,
      sampleCount: audio.left.length,
      sampleRate: audio.sampleRate,
      elapsedMs: performance.now() - t0,
    };
    worker.postMessage(msg, [wav]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const msg: WorkerResponse = { type: "error", message };
    worker.postMessage(msg);
  }
};
