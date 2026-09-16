// Runs the actual built app against a local fake Supabase HTTP service.
// Does not contact any real Supabase project or prove production SQL/RLS setup.
import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const adminId = randomUUID();
const rows = [];
const invitations = [];
const counts = new Map();
const mock = http.createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  const data = body ? JSON.parse(body) : null;
  const url = new URL(req.url, 'http://mock');
  const send = (status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(value));
  };
  if (url.pathname === '/auth/v1/token')
    return data.email === 'organizer@example.test' && data.password === 'test-password'
      ? send(200, {
          access_token: 'valid-test-token',
          expires_in: 3600,
          user: { id: adminId, email_confirmed_at: '2026-09-16' },
        })
      : send(400, { code: 'invalid_credentials' });
  if (url.pathname === '/auth/v1/user')
    return req.headers.authorization === 'Bearer valid-test-token'
      ? send(200, { id: adminId, email_confirmed_at: '2026-09-16' })
      : send(401, { code: 'bad_jwt' });
  if (req.headers.apikey !== 'sb_secret_TEST_ONLY') return send(403, { code: 'forbidden' });
  if (url.pathname === '/rest/v1/rpc/consume_rate_limit') {
    const count = (counts.get(data.p_key) || 0) + 1;
    counts.set(data.p_key, count);
    return send(200, count <= data.p_limit);
  }
  if (url.pathname === '/rest/v1/rsvps' && req.method === 'POST') {
    if (rows.some((r) => r.id === data.id || r.dedupe_key === data.dedupe_key))
      return send(409, { code: '23505' });
    if (data.invitation_code && !invitations.some((i) => i.code === data.invitation_code))
      return send(409, { code: '23503' });
    rows.push({ ...data, submitted_at: new Date().toISOString() });
    return send(201, null);
  }
  if (url.pathname === '/rest/v1/rsvps') {
    const id = url.searchParams.get('id')?.replace('eq.', '');
    return send(
      200,
      id ? rows.filter((r) => r.id === id).map((r) => ({ request_hash: r.request_hash })) : rows,
    );
  }
  if (url.pathname === '/rest/v1/invitations' && req.method === 'POST') {
    invitations.push({ ...data, id: randomUUID(), created_at: new Date().toISOString() });
    return send(201, null);
  }
  if (url.pathname === '/rest/v1/invitations') return send(200, invitations);
  return send(404, { code: 'not_found' });
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:3097';
let logs = '';
const app = spawn(process.execPath, ['.next/standalone/server.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOSTNAME: '127.0.0.1',
    PORT: '3097',
    APP_ORIGIN: origin,
    SUPABASE_URL: `http://127.0.0.1:${mock.address().port}`,
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_TEST_ONLY',
    SUPABASE_SECRET_KEY: 'sb_secret_TEST_ONLY',
    ADMIN_USER_ID: adminId,
    RATE_LIMIT_SECRET: 'test-only-rate-limit-secret-32-characters',
    MAIL_HOST: '',
    MAIL_USER: '',
    MAIL_PASS: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
app.stdout.on('data', (b) => (logs += b));
app.stderr.on('data', (b) => (logs += b));
const request = (
  path,
  { method = 'GET', body, cookie, originHeader = origin, headers = {} } = {},
) =>
  fetch(origin + path, {
    method,
    redirect: 'manual',
    headers: {
      Origin: originHeader,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await request('/')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(ready, 'App did not start');
  const home = await (await request('/')).text();
  assert(home.includes('merveille-portrait.webp'));
  assert(home.includes('11:30 AM'));
  assert(home.includes('4:30 PM'));
  assert.equal((await request('/merveille-portrait.webp')).status, 200);
  assert.equal((await request('/api/admin')).status, 401);
  assert.equal(
    (
      await request('/api/admin', {
        headers: {
          'oai-authenticated-user-id': adminId,
          'oai-authenticated-user-email': 'organizer@example.test',
        },
      })
    ).status,
    401,
    'Spoofed Sites headers must never grant admin access',
  );
  assert.equal((await request('/admin')).status, 307);
  assert.equal(
    (await request('/api/rsvp', { method: 'POST', body: {}, originHeader: 'https://evil.test' }))
      .status,
    403,
  );
  assert.equal(
    (await request('/api/rsvp', { method: 'POST', body: { full_name: '' } })).status,
    400,
  );
  const accepted = {
    id: randomUUID(),
    full_name: 'Test Accepted',
    email: 'accepted@example.test',
    response: 'accepted',
    party_size: 3,
    guest_names: 'Guest One, Guest Two',
    dietary_requirements: 'Vegetarian',
    message: 'Happy birthday',
  };
  assert.equal((await request('/api/rsvp', { method: 'POST', body: accepted })).status, 201);
  assert.equal(
    (await request('/api/rsvp', { method: 'POST', body: accepted })).status,
    200,
    'Retry must be idempotent',
  );
  assert.equal(
    (await request('/api/rsvp', { method: 'POST', body: { ...accepted, id: randomUUID() } }))
      .status,
    409,
  );
  assert.equal(
    (await request('/api/rsvp', { method: 'POST', body: { ...accepted, full_name: 'Changed' } }))
      .status,
    409,
  );
  assert.equal((await request('/api/rsvp')).status, 405, 'No public RSVP read endpoint');
  const declined = {
    id: randomUUID(),
    full_name: 'Test Declined',
    email: 'declined@example.test',
    response: 'declined',
    party_size: 2,
    guest_names: 'Must not be saved',
    dietary_requirements: 'Must not be saved',
  };
  assert.equal((await request('/api/rsvp', { method: 'POST', body: declined })).status, 201);
  assert.equal(rows[1].party_size, 0);
  assert.equal(rows[1].guest_names, '');
  assert.equal(rows[1].dietary_requirements, '');
  assert.equal(
    (
      await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'wrong@example.test', password: 'wrong' },
      })
    ).status,
    401,
  );
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'organizer@example.test', password: 'test-password' },
  });
  assert.equal(login.status, 200);
  const header = login.headers.get('set-cookie');
  assert(header.includes('HttpOnly'));
  assert(header.includes('Secure'));
  assert(header.toLowerCase().includes('samesite=strict'));
  const cookie = header.split(';')[0];
  const admin = await request('/api/admin', { cookie });
  assert.equal(admin.status, 200);
  assert.equal((await admin.json()).rsvps.length, 2);
  const invite = await request('/api/admin', {
    method: 'POST',
    cookie,
    body: { full_name: 'Invited Test', email: '' },
  });
  assert.equal(invite.status, 201);
  const { code } = await invite.json();
  assert.equal(
    (
      await request('/api/rsvp', {
        method: 'POST',
        body: {
          id: randomUUID(),
          full_name: 'Invited Test',
          response: 'accepted',
          party_size: 1,
          invitation_code: code,
        },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request('/api/rsvp', {
        method: 'POST',
        body: {
          id: randomUUID(),
          full_name: 'Invalid Link',
          response: 'accepted',
          invitation_code: randomUUID(),
        },
      })
    ).status,
    400,
  );
  let last;
  for (let i = 0; i < 31; i++)
    last = await request('/api/rsvp', { method: 'POST', body: accepted });
  assert.equal(last.status, 429);
  assert.equal(
    (await request('/api/admin', { cookie: '__Host-merveille-session=forged' })).status,
    401,
  );
  console.log(
    'PASS: page/image, updated schedule, validation, origin protection, idempotency, duplicate detection, decline cleanup, invitation codes, cookie security, admin authorization, header spoofing defense, and rate-limit response.',
  );
} catch (e) {
  console.error(logs);
  throw e;
} finally {
  app.kill('SIGTERM');
  await new Promise((r) => mock.close(r));
}
