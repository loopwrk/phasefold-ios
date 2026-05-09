/**
 * Phasefold — Audio generation Web Worker
 *
 * Runs generateAudio() off the main thread so the UI stays responsive.
 * Communicates via the WorkerRequest / WorkerResponse protocol defined
 * in types.ts.
 *
 * Progress is reported after each major DSP section (dev console only).
 * The final Float64Array buffers are transferred (zero-copy) back to
 * the main thread.
 */

import { generateAudio } from "./generator";
import type { WorkerRequest, WorkerResponse } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const worker = self as any;

worker.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { type, params } = e.data;

  if (type !== "generate") return;

  try {
    const t0 = performance.now();
    const audio = generateAudio(params, (percent, section) => {
      // Progress reports - dev console only
      if (import.meta.env.DEV) {
        console.log(`[phasefold worker] ${percent}% - ${section}`);
      }

      const msg: WorkerResponse = { type: "progress", percent, section };
      worker.postMessage(msg);
    });
    const dt = performance.now() - t0;
    console.log(`[phasefold worker] generated ${(audio.left.length / audio.sampleRate).toFixed(1)}s audio in ${dt.toFixed(0)}ms (TypeScript)`);

    // Transfer the underlying ArrayBuffers (zero-copy)
    const msg: WorkerResponse = {
      type: "result",
      left: audio.left,
      right: audio.right,
      sampleRate: audio.sampleRate,
    };
    worker.postMessage(msg, [audio.left.buffer, audio.right.buffer]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const msg: WorkerResponse = { type: "error", message };
    worker.postMessage(msg);
  }
};
