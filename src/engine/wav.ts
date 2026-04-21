/**
 * Phasefold — WAV encoder
 *
 * Encodes stereo Float32 audio into a 16-bit PCM WAV ArrayBuffer
 * suitable for download or Capacitor Filesystem writes.
 */

export function encodeWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const numSamples = left.length;
  const bytesPerSample = 2; // 16-bit
  const numChannels = 2;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const bufferSize = 44 + dataSize;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // Helper: write ASCII string into the DataView
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i));
  };

  // ---- RIFF header ----
  writeStr(0, "RIFF");
  view.setUint32(4, bufferSize - 8, true);
  writeStr(8, "WAVE");

  // ---- fmt  sub-chunk ----
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample

  // ---- data sub-chunk ----
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  // Interleaved 16-bit signed samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, Math.round(l * 32767), true);
    view.setInt16(offset + 2, Math.round(r * 32767), true);
    offset += 4;
  }

  return buffer;
}
