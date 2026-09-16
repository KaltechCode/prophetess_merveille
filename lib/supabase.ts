import 'server-only';

export class BackendError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super('Supabase request failed');
  }
}
export function config(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
export async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
  publicAuth = false,
): Promise<T> {
  const key = config(publicAuth ? 'SUPABASE_PUBLISHABLE_KEY' : 'SUPABASE_SECRET_KEY');
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  // Legacy service_role keys need a JWT authorization header; new sb_secret keys use apikey alone.
  else if (!publicAuth && key.startsWith('eyJ')) headers.set('Authorization', `Bearer ${key}`);
  const response = await fetch(`${config('SUPABASE_URL').replace(/\/$/, '')}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  const body = await response.text();
  if (!response.ok) {
    let code = 'upstream_error';
    try {
      code = JSON.parse(body).code || code;
    } catch {}
    throw new BackendError(response.status, code);
  }
  return (body ? JSON.parse(body) : null) as T;
}
export async function readAll<T>(
  table: 'rsvps' | 'invitations',
  columns: string,
  order: string,
): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const rows = await supabaseRequest<T[]>(
      `/rest/v1/${table}?select=${columns}&order=${order},id.desc&limit=500&offset=${offset}`,
    );
    result.push(...rows);
    if (rows.length < 500) return result;
    if (result.length >= 20000) throw new Error('Guest list exceeds dashboard export limit');
  }
}
