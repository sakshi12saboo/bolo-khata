import { toSpeech } from '../domain/queries';

let voice: SpeechSynthesisVoice | null | undefined;

function hindiVoice(): SpeechSynthesisVoice | null {
  if (voice !== undefined && voice !== null) return voice;
  const all = window.speechSynthesis.getVoices();
  voice = all.find((v) => v.lang === 'hi-IN') ?? all.find((v) => v.lang.startsWith('hi')) ?? null;
  return voice;
}

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Speak a Hindi sentence (₹ amounts read as "रुपये"). Silently does nothing without TTS. */
export function speak(text: string): void {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(toSpeech(text));
  u.lang = 'hi-IN';
  u.rate = 0.95;
  const v = hindiVoice();
  if (v) u.voice = v;
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
