import { createHash } from 'node:crypto';
import { z } from 'zod';
import { BackendError, supabaseRequest } from '@/lib/supabase';
import { allowRequest, limitedJson, sameOrigin, privateHeaders } from '@/lib/security';
import { sendRsvpNotifications } from '@/lib/email';
export const runtime = 'nodejs';
const schema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(120),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).default(''),
  phone: z.string().trim().max(40).default(''),
  response: z.enum(['accepted', 'declined']),
  party_size: z.coerce.number().int().min(1).max(20).optional(),
  guest_names: z.string().trim().max(1000).default(''),
  dietary_requirements: z.string().trim().max(1000).default(''),
  message: z.string().trim().max(2000).default(''),
  invitation_code: z.string().uuid().nullable().optional(),
});
function reply(body: object, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return reply({ error: 'Request not allowed.' }, 403);
    let raw;
    try {
      raw = await limitedJson(request);
    } catch {
      return reply({ error: 'Invalid or oversized response.' }, 400);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success)
      return reply({ error: 'Please check your name, email and attendance details.' }, 400);
    if (!(await allowRequest(request, 'rsvp')))
      return reply({ error: 'Too many requests. Please try again in 15 minutes.' }, 429);
    const r = parsed.data;
    const yes = r.response === 'accepted';
    const identity = r.invitation_code
      ? 'code:' + r.invitation_code
      : r.email
        ? 'email:' + r.email.toLowerCase()
        : r.phone.replace(/\D/g, '').length >= 7
          ? 'phone:' + r.phone.replace(/\D/g, '')
          : 'name:' + r.full_name.toLowerCase().replace(/\s+/g, ' ');
    const row = {
      ...r,
      email: r.email.toLowerCase(),
      party_size: yes ? r.party_size || 1 : 0,
      guest_names: yes ? r.guest_names : '',
      dietary_requirements: yes ? r.dietary_requirements : '',
      invitation_code: r.invitation_code || null,
      dedupe_key: createHash('sha256').update(identity).digest('hex'),
    };
    const payloadHash = createHash('sha256').update(JSON.stringify(row)).digest('hex');
    const existing = await supabaseRequest<{ request_hash: string }[]>(
      `/rest/v1/rsvps?id=eq.${r.id}&select=request_hash`,
    );
    if (existing.length)
      return existing[0].request_hash === payloadHash
        ? reply({ ok: true })
        : reply(
            {
              error:
                'This submission ID was already used. Refresh the page to submit a new response.',
            },
            409,
          );
    try {
      await supabaseRequest('/rest/v1/rsvps', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ...row, request_hash: payloadHash }),
      });
    } catch (e) {
      if (e instanceof BackendError && e.code === '23505') {
        const raced = await supabaseRequest<{ request_hash: string }[]>(
          `/rest/v1/rsvps?id=eq.${r.id}&select=request_hash`,
        );
        if (raced[0]?.request_hash === payloadHash) return reply({ ok: true });
        return reply(
          {
            error:
              'An RSVP has already been received for these details. Please contact the organizer to make a change.',
          },
          409,
        );
      }
      if (e instanceof BackendError && e.code === '23503')
        return reply(
          { error: 'This invitation link is invalid. Please contact the organizer.' },
          400,
        );
      throw e;
    }
    try {
      await sendRsvpNotifications(row);
    } catch {
      console.error('RSVP email failed');
    }
    return reply({ ok: true }, 201);
  } catch (e) {
    console.error('RSVP save failed', e instanceof BackendError ? e.code : 'service_unavailable');
    return reply(
      {
        error:
          'We could not save your RSVP. Your answers are still here; please try again shortly.',
      },
      503,
    );
  }
}
