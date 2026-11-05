import { GoogleGenAI, ThinkingLevel, type GenerateContentConfig, type Part } from '@google/genai';
import type { ModelRequest } from './handler.js';
import { groundingText, RESPONSE_SCHEMA, SYSTEM_PROMPT } from './prompt.js';

export interface GeminiOptions {
  apiKey: string | undefined;
  model?: string;
  /** minimal | low | medium | high | default. Parsing a shop command needs little thinking; less is faster. */
  thinking?: string;
}

const LEVELS: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

export function thinkingFor(model: string, setting?: string): GenerateContentConfig['thinkingConfig'] | undefined {
  const want = (setting || '').toLowerCase();
  if (want === 'default') return undefined;
  if (model.startsWith('gemini-2.5')) return want && want !== 'minimal' ? undefined : { thinkingBudget: 0 };
  // Gemini 3.x: LOW is accepted by every 3.x flash model; MINIMAL is rejected by some (3.8, flash-latest).
  return { thinkingLevel: LEVELS[want] ?? ThinkingLevel.LOW };
}

export const DEFAULT_MODEL = 'gemini-3.5-flash';

let cached: { key: string; ai: GoogleGenAI } | null = null;
function client(apiKey: string): GoogleGenAI {
  if (!cached || cached.key !== apiKey) cached = { key: apiKey, ai: new GoogleGenAI({ apiKey }) };
  return cached.ai;
}

export function makeGeminiGenerate(opts: GeminiOptions) {
  const model = opts.model || DEFAULT_MODEL;
  return async (req: ModelRequest, signal: AbortSignal): Promise<string> => {
    if (!opts.apiKey) throw new Error('GEMINI_API_KEY is not set');
    const parts: Part[] = [];
    if (req.audio && req.mimeType) {
      parts.push({ inlineData: { mimeType: req.mimeType.split(';')[0]!, data: req.audio } });
      parts.push({ text: 'The audio above is the shopkeeper speaking. Understand it and return the JSON.' });
    } else {
      parts.push({ text: `Shopkeeper said: """${req.text ?? ''}"""` });
    }
    parts.push({ text: groundingText(req.context) });

    const config: GenerateContentConfig = {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
      abortSignal: signal,
    };
    const thinking = thinkingFor(model, opts.thinking);
    if (thinking) config.thinkingConfig = thinking;

    const res = await client(opts.apiKey).models.generateContent({ model, contents: [{ role: 'user', parts }], config });
    return res.text ?? '';
  };
}
