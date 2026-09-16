import { cookies } from 'next/headers';
import { cookieName } from '@/lib/auth';
import { sameOrigin } from '@/lib/security';
import { supabaseRequest, config } from '@/lib/supabase';
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: 'Request not allowed.' }, { status: 403 });
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  jar.set(cookieName, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  if (token) {
    try {
      await supabaseRequest('/auth/v1/logout?scope=local', { method: 'POST' }, token, true);
    } catch {}
  }
  return Response.redirect(new URL('/admin/login', config('APP_ORIGIN')), 303);
}
