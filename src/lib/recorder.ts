export interface Recording {
  /** Stop and return base64 audio. */
  stop(): Promise<{ base64: string; mimeType: string; ms: number }>;
  cancel(): void;
  /** 0..1 loudness, cheap to call every animation frame. */
  level(): number;
}

const CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/aac'];

export const canRecord = () =>
  typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function startRecording(maxMs: number, onLimit: () => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const mimeType = CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);

  const started = performance.now();
  const limit = setTimeout(onLimit, maxMs);
  rec.start(250);

  const release = () => {
    clearTimeout(limit);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  return {
    level() {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      return Math.min(1, peak / 64);
    },
    cancel() {
      if (rec.state !== 'inactive') rec.stop();
      release();
    },
    stop() {
      return new Promise((resolve, reject) => {
        rec.onstop = () => {
          release();
          const type = (rec.mimeType || mimeType || 'audio/webm').split(';')[0]!;
          const blob = new Blob(chunks, { type });
          blobToBase64(blob)
            .then((base64) => resolve({ base64, mimeType: type, ms: performance.now() - started }))
            .catch(reject);
        };
        if (rec.state !== 'inactive') rec.stop();
      });
    },
  };
}
