import 'server-only';
import { createHmac } from 'node:crypto';
import { config, supabaseRequest } from './supabase';

export function sameOrigin(request: Request): boolean {
  return request.headers.get('origin') === new URL(config('APP_ORIGIN')).origin;
}
export async function limitedJson(request: Request, limit = 16000): Promise<unknown> {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new Error('body_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('missing_body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error('body_too_large');
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function allowRequest(request: Request, scope: 'login' | 'rsvp'): Promise<boolean> {
  // nginx MUST overwrite X-Real-IP. Node listens only on loopback behind nginx.
  const ip = request.headers.get('x-real-ip') || 'local';
  const key = createHmac('sha256', config('RATE_LIMIT_SECRET'))
    .update(`${scope}:${ip}`)
    .digest('hex');
  return supabaseRequest<boolean>('/rest/v1/rpc/consume_rate_limit', {
    method: 'POST',
    body: JSON.stringify({ p_key: key, p_limit: scope === 'login' ? 10 : 30, p_seconds: 900 }),
  });
}
export const privateHeaders = { 'Cache-Control': 'no-store, private' };
