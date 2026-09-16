import { cookies } from 'next/headers';
import { z } from 'zod';
import { cookieName, adminConfigured } from '@/lib/auth';
import { supabaseRequest } from '@/lib/supabase';
import { allowRequest, limitedJson, sameOrigin, privateHeaders } from '@/lib/security';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request))
      return Response.json({ error: 'Request not allowed.' }, { status: 403 });
    if (!adminConfigured())
      return Response.json(
        { error: 'Organizer sign-in has not been configured yet.' },
        { status: 503 },
      );
    if (!(await allowRequest(request, 'login')))
      return Response.json(
        { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
        { status: 429 },
      );
    const parsed = z
      .object({ email: z.string().email().max(254), password: z.string().min(1).max(256) })
      .safeParse(await limitedJson(request, 2048));
    if (!parsed.success)
      return Response.json({ error: 'Enter your email and password.' }, { status: 400 });
    const session = await supabaseRequest<{
      access_token: string;
      expires_in: number;
      user: { id: string; email_confirmed_at?: string };
    }>(
      '/auth/v1/token?grant_type=password',
      { method: 'POST', body: JSON.stringify(parsed.data) },
      undefined,
      true,
    );
    if (session.user.id !== process.env.ADMIN_USER_ID || !session.user.email_confirmed_at)
      return Response.json(
        { error: 'Unable to sign in with these organizer credentials.' },
        { status: 401, headers: privateHeaders },
      );
    (await cookies()).set(cookieName, session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: Math.min(session.expires_in, 3600),
    });
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch {
    return Response.json(
      { error: 'Unable to sign in. Check your credentials or try again shortly.' },
      { status: 401, headers: privateHeaders },
    );
  }
}
