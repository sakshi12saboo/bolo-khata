import { GoogleGenAI, type GenerateContentConfig, type Part } from '@google/genai';
import type { ModelRequest } from './handler.js';
import { groundingText, RESPONSE_SCHEMA, SYSTEM_PROMPT } from './prompt.js';

export interface GeminiOptions {
  apiKey: string | undefined;
  model?: string;
}

export const DEFAULT_MODEL = 'gemini-2.5-flash';

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
    // 2.5 Flash thinks by default; parsing a shop command does not need it and it costs latency.
    if (model.startsWith('gemini-2.5-flash')) config.thinkingConfig = { thinkingBudget: 0 };

    const res = await client(opts.apiKey).models.generateContent({ model, contents: [{ role: 'user', parts }], config });
    return res.text ?? '';
  };
}
