"use client";

/* ---------------- Photos ---------------- */

/** Resize & compress a photo in the browser (max 1024px, JPEG) → { dataUrl, base64 }. */
export async function compressImage(file: Blob, max = 1024, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl, base64: dataUrl.split(",")[1], mime: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function urlToBlob(src: string) {
  const r = await fetch(src);
  return r.blob();
}

/* ---------------- Voice recording → 16 kHz mono WAV ---------------- */

export class VoiceRecorder {
  private rec?: MediaRecorder;
  private chunks: Blob[] = [];
  private stream?: MediaStream;
  startedAt = 0;

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", ""];
    const mimeType = types.find((t) => !t || MediaRecorder.isTypeSupported(t)) || "";
    this.rec = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(250);
    this.startedAt = Date.now();
  }

  async stop(): Promise<{ base64: string; mime: string; seconds: number }> {
    const rec = this.rec;
    if (!rec) throw new Error("not recording");
    const done = new Promise<void>((res) => (rec.onstop = () => res()));
    rec.stop();
    await done;
    this.stream?.getTracks().forEach((t) => t.stop());
    const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
    const seconds = (Date.now() - this.startedAt) / 1000;
    const wav = await toWav16k(blob);
    return { base64: await blobToBase64(wav), mime: "audio/wav", seconds };
  }

  cancel() {
    try {
      this.rec?.stop();
    } catch {}
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}

async function toWav16k(blob: Blob): Promise<Blob> {
  const buf = await blob.arrayBuffer();
  const AC: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const decoded = await new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(buf, res, rej));
  ctx.close();
  const rate = 16000;
  const length = Math.max(1, Math.ceil(decoded.duration * rate));
  const off = new OfflineAudioContext(1, length, rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return encodeWav(tidy(rendered.getChannelData(0), rate), rate);
}

/**
 * Helps speech recognition with quiet phones and noisy sites: trims leading and
 * trailing silence (keeping a short margin) and normalises the volume.
 */
function tidy(samples: Float32Array, rate: number): Float32Array {
  const win = Math.round(rate * 0.02);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 0.003) return samples; // silence: leave it, the guide will ask to try again
  const threshold = Math.max(0.01, peak * 0.06);
  const loud = (i: number) => {
    let sum = 0;
    const end = Math.min(samples.length, i + win);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    return Math.sqrt(sum / Math.max(1, end - i)) > threshold;
  };
  let start = 0;
  while (start < samples.length && !loud(start)) start += win;
  let end = samples.length;
  while (end > start && !loud(Math.max(0, end - win))) end -= win;
  const margin = Math.round(rate * 0.3);
  const out = samples.slice(Math.max(0, start - margin), Math.min(samples.length, end + margin));
  const gain = Math.min(8, 0.9 / peak);
  if (gain > 1.05) for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out.length > rate * 0.3 ? out : samples;
}

export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}
