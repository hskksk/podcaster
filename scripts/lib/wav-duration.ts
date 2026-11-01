/** Parse mono/stereo PCM WAV duration from the first 64 bytes. */
export function wavDurationMs(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = readAscii(bytes, 0, 4);
  const wave = readAscii(bytes, 8, 4);
  if (riff !== "RIFF" || wave !== "WAVE") return null;

  let offset = 12;
  let sampleRate = 0;
  let dataSize = 0;
  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === "fmt " && chunkSize >= 16) {
      sampleRate = view.getUint32(offset + 12, true);
    } else if (chunkId === "data") {
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  if (!sampleRate || !dataSize) return null;
  const bytesPerSecond = sampleRate * 2; // 16-bit mono assumed (legacy pipeline)
  return Math.round((dataSize / bytesPerSecond) * 1000);
}

function readAscii(bytes: Uint8Array, start: number, len: number): string {
  return new TextDecoder().decode(bytes.subarray(start, start + len));
}
