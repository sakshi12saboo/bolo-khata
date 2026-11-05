import { understand } from '../server/instance.js';

export const maxDuration = 15;

export function POST(request: Request): Promise<Response> {
  return understand(request);
}

export function GET(request: Request): Promise<Response> {
  return understand(request);
}
