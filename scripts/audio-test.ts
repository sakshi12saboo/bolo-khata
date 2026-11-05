// node scripts/audio-test.ts <file> <mimeType>
import { readFileSync } from 'node:fs';
import { BASE_URL, context } from './context.ts';

const [file, mimeType = 'audio/webm'] = process.argv.slice(2);
if (!file) throw new Error('usage: node scripts/audio-test.ts <file> [mimeType]');
const audio = readFileSync(file).toString('base64');
const t0 = performance.now();
const res = await fetch(`${BASE_URL}/api/understand`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ audio, mimeType, context }),
});
const body = await res.json();
console.log(`HTTP ${res.status} in ${Math.round(performance.now() - t0)} ms`);
console.log(JSON.stringify(body, null, 2));
if (!body.ok || body.intent.kind === 'unknown') process.exit(1);
