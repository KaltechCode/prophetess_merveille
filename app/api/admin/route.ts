import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { isAdmin } from '@/lib/auth';
import { readAll, supabaseRequest } from '@/lib/supabase';
import { limitedJson, sameOrigin, privateHeaders } from '@/lib/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!(await isAdmin()))
    return Response.json(
      { error: 'Your organizer session has expired. Please sign in again.' },
      { status: 401, headers: privateHeaders },
    );
  try {
    const [rsvps, invitations] = await Promise.all([
      readAll(
        'rsvps',
        'id,full_name,email,phone,response,party_size,guest_names,dietary_requirements,message,invitation_code,submitted_at,checked_in',
        'submitted_at.desc',
      ),
      readAll('invitations', 'id,full_name,email,code,created_at', 'created_at.desc'),
    ]);
    return Response.json({ rsvps, invitations }, { headers: privateHeaders });
  } catch {
    return Response.json(
      { error: 'Guest list unavailable. Please try again.' },
      { status: 503, headers: privateHeaders },
    );
  }
}
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request) || !(await isAdmin()))
      return Response.json({ error: 'Organizer access is required.' }, { status: 403 });
    const data = z
      .object({
        full_name: z.string().trim().min(1).max(120),
        email: z.union([z.string().trim().email().max(254), z.literal('')]),
      })
      .safeParse(await limitedJson(request));
    if (!data.success)
      return Response.json(
        { error: 'Please enter a guest name and a valid email, if provided.' },
        { status: 400 },
      );
    const code = randomUUID();
    await supabaseRequest('/rest/v1/invitations', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...data.data, code }),
    });
    return Response.json({ code }, { status: 201, headers: privateHeaders });
  } catch {
    return Response.json({ error: 'Could not add invitation. Please try again.' }, { status: 503 });
  }
}
