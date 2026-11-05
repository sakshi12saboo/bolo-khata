import { useEffect, useRef, useState } from 'react';
import { canRecord, startRecording, type Recording } from '../lib/recorder';

const MAX_MS = 30_000;
const TAP_MS = 350;

interface Props {
  busy: boolean;
  onAudio: (a: { base64: string; mimeType: string }) => void;
  onMicError: (reason: 'denied' | 'unsupported' | 'too-short') => void;
}

type State = 'idle' | 'starting' | 'holding' | 'latched';

/**
 * Hold to talk, release to send. A quick tap latches recording on; tap again to send.
 * Space/Enter work the same way from the keyboard.
 */
export function MicButton({ busy, onAudio, onMicError }: Props) {
  const [state, setState] = useState<State>('idle');
  const rec = useRef<Recording | null>(null);
  const pressedAt = useRef(0);
  const btn = useRef<HTMLButtonElement>(null);
  const raf = useRef(0);
  const supported = canRecord();

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    rec.current?.cancel();
  }, []);

  const meter = () => {
    const r = rec.current;
    if (r && btn.current) btn.current.style.setProperty('--level', r.level().toFixed(2));
    raf.current = requestAnimationFrame(meter);
  };

  const finish = async () => {
    const r = rec.current;
    rec.current = null;
    cancelAnimationFrame(raf.current);
    btn.current?.style.setProperty('--level', '0');
    setState('idle');
    if (!r) return;
    const out = await r.stop();
    if (out.ms < 500 || out.base64.length < 1000) return onMicError('too-short');
    onAudio(out);
  };

  const begin = async () => {
    if (busy || rec.current || state !== 'idle') return;
    pressedAt.current = performance.now();
    setState('starting');
    try {
      rec.current = await startRecording(MAX_MS, () => void finish());
      setState((s) => (s === 'starting' ? 'holding' : s));
      raf.current = requestAnimationFrame(meter);
    } catch {
      setState('idle');
      onMicError('denied');
    }
  };

  const release = () => {
    if (state === 'latched') return void finish();
    if (state !== 'holding' && state !== 'starting') return;
    if (performance.now() - pressedAt.current < TAP_MS) return setState('latched');
    void finish();
  };

  if (!supported) {
    return (
      <button type="button" className="mic mic--off" onClick={() => onMicError('unsupported')}>
        <span className="mic__label">Mic not available here. Type below.</span>
      </button>
    );
  }

  const live = state === 'holding' || state === 'latched' || state === 'starting';
  const label = busy
    ? { hi: 'समझ रहे हैं…', en: 'Understanding' }
    : state === 'latched'
      ? { hi: 'बोलिए, फिर दबाएँ', en: 'Speak, then tap to send' }
      : live
        ? { hi: 'छोड़ते ही भेजेंगे', en: 'Release to send' }
        : { hi: 'दबाकर बोलिए', en: 'Hold and speak' };

  return (
    <button
      ref={btn}
      type="button"
      className={`mic${live ? ' mic--live' : ''}${busy ? ' mic--busy' : ''}`}
      aria-pressed={live}
      aria-label={`${label.en}. ${label.hi}`}
      disabled={busy}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (state === 'latched') return;
        e.currentTarget.setPointerCapture(e.pointerId);
        void begin();
      }}
      onPointerUp={release}
      onPointerCancel={() => state === 'holding' && void finish()}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          if (state === 'latched') void finish();
          else void begin();
        }
      }}
      onKeyUp={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && state === 'holding') {
          e.preventDefault();
          release();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg className="mic__icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="mic__label" lang="hi" aria-hidden="true">
        {label.hi}
      </span>
      <span className="mic__sub" aria-hidden="true">
        {label.en}
      </span>
    </button>
  );
}
