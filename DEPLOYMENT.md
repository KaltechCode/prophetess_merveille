# ScalaHosting + Supabase deployment

This package contains the updated invitation as a standard Next.js Node.js application. The celebrant portrait, September 18 at 7:00 PM CT, and September 19 from 11:30 AM to 4:30 PM CT are included. The existing Sites URL remains a separate installation until you switch guest links to your own domain.

## 1. Confirm the ScalaHosting environment

Use a VPS or hosting plan that explicitly supports a persistent Node.js 22 process and HTTPS reverse proxy. Ask ScalaHosting support to confirm this for your specific plan. A static upload to public_html is not enough: the RSVP and organizer endpoints require Node.js.

For managed VPS/SPanel, ask support to configure the domain, HTTPS, an unprivileged app user, and a reverse proxy to 127.0.0.1:3000. Do not replace SPanel-managed Apache, Nginx or OpenLiteSpeed configuration. The supplied nginx example is for a self-managed server or an administrator adapting the same settings.

Required inputs before live deployment:

- Final domain/subdomain and access to its DNS.
- ScalaHosting SSH host, user and deployment directory, or support-assisted deployment.
- Supabase project URL, publishable key and secret key, entered privately on the server.
- Supabase organizer user UUID.

Do not paste SSH private keys, passwords or Supabase secret keys into chat or commit them to Git.

## 2. Create and secure the Supabase database

1. Create a dedicated Supabase project, or use an empty project reserved for this event.
2. Open SQL Editor and execute `supabase/001_initial.sql` once. This creates invitations, RSVPs and durable rate-limit counters. It is an initial migration, not a script to rerun on existing tables.
3. Run `supabase/verify-security.sql`. All tables should report RLS enabled, and browser roles must have no SELECT/INSERT privileges on them or execution rights on the rate-limit function.
4. Copy the project URL and the publishable and secret API keys from the project's API key settings. The application uses these only in Node.js. No Supabase keys are included in browser bundles.
5. In Authentication > Users, create the organizer with email and a strong password and confirm the email. Copy that user's UUID into `ADMIN_USER_ID`. Disable public signups if this project is dedicated to this invitation. Configure the Auth site URL to your HTTPS domain.
6. Only that confirmed user UUID may access /admin. An ordinary Supabase user cannot read the guest list. The server validates each admin request against Supabase Auth; it does not trust browser state or forwarded identity headers.

Organizer sign-in uses a secure HttpOnly cookie. The session lasts at most one hour and requires signing in again afterward; there is no automatic refresh token stored by this application. For password reset, use Supabase's administrator controls. There is no guest account/signup flow.

## 3. Configure runtime values

Copy `.env.example` to a private server file, such as `/etc/merveille.env`, and fill in every value:

| Variable | Value |
| --- | --- |
| APP_ORIGIN | Exact HTTPS origin, e.g. https://celebrate.yourdomain.com; no trailing slash |
| SUPABASE_URL | https://YOUR_PROJECT.supabase.co |
| SUPABASE_PUBLISHABLE_KEY | Supabase publishable key |
| SUPABASE_SECRET_KEY | Supabase secret key; legacy service_role JWT is also accepted |
| ADMIN_USER_ID | Confirmed organizer's Supabase Auth UUID |
| RATE_LIMIT_SECRET | Independent random value generated with `openssl rand -hex 32` |

Set the file's owner and permissions so only your deployment administrator/service can read it. The example systemd service reads this file separately from the application. Never put it under public/, never add NEXT_PUBLIC_ to a secret variable, and never include it in a release archive.

Validate the environment without printing values:

```bash
node --env-file=/etc/merveille.env scripts/check-config.mjs
```

For development only, copy `.env.example` to `.env.local`, use `APP_ORIGIN=http://localhost:3000`, then `npm run dev`. Production requires HTTPS for the organizer cookie.

## 4. Build on the VPS or a compatible Linux build host

Install a supported Node.js 22 release and npm. Upload/unzip the source into a release directory owned by your deployment user. From that directory:

```bash
npm ci
npm run build
node scripts/package-standalone.mjs
```

No live Supabase credentials are needed at build time. The release is `.next/standalone/`, including server.js, node_modules, public/ and .next/static/. Do not upload only the public folder. Build on the target OS/architecture because native dependencies may differ across machines.

Copy the contents of `.next/standalone/` into `/srv/merveille/releases/RELEASE_NAME/`, then point `/srv/merveille/current` to that release. Keep the previous release for rollback. Create `.next/cache` inside the release and give the app user ownership.

## 5. Run Node.js as a service

`deploy/merveille.service` assumes:

- Unprivileged service account and group named merveille.
- Node executable at /usr/bin/node (verify with `command -v node` and adjust if needed).
- App at /srv/merveille/current/server.js.
- Private environment file at /etc/merveille.env.

Have your server administrator adapt and install the unit in /etc/systemd/system/. After installing it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now merveille
sudo systemctl status merveille
```

For subsequent releases, update the current symlink and restart with `sudo systemctl restart merveille`. A single-process restart may briefly interrupt requests; schedule changes outside active guest-response periods. Inspect logs with `sudo journalctl -u merveille --since '10 minutes ago'`.

The Node process must listen on 127.0.0.1:3000, not a publicly exposed interface. No credentials are embedded in the service file.

## 6. Configure the domain, reverse proxy and HTTPS

Point the domain's A record at the VPS IPv4 address. Add an AAAA record only if IPv6 is correctly configured. Provision a valid TLS certificate through your ScalaHosting panel or administrator.

Adapt `deploy/nginx.conf.example` if using self-managed Nginx. Replace all example domains and certificate paths. The proxy must overwrite X-Real-IP with the actual connecting client IP; the rate limiter trusts this header only because the app port is private. If using a CDN, have the administrator configure trusted CDN IP ranges correctly instead of blindly trusting caller-provided forwarding headers.

Do not cache /api or /admin responses. The application verifies POST Origin against APP_ORIGIN, so a wrong domain/origin will reject submissions. Test Nginx configuration before reloading it. On SPanel, have ScalaHosting support implement equivalent proxy settings in the panel-managed web server.

## 7. Verify before sharing the URL

1. Load the final HTTPS domain on desktop and mobile. The envelope waits three seconds, opens, raises the portrait, and reveals the invitation.
2. Confirm September 18 is 7 PM CT and September 19 is 11:30 AM–4:30 PM CT. Calendar entries should show those exact local times.
3. Submit one accepted and one declined test RSVP using distinct test identities. Confirm both in Supabase and /admin. Re-submit to verify duplicates are blocked.
4. Open /admin in a signed-out/incognito session: it must require organizer sign-in. Verify an unauthorized account cannot access /api/admin.
5. Sign in as the allowlisted organizer, add an invitation, submit its code-bearing link, and check accepted/pending counts, plus-ones, diet filters and CSV export.
6. Confirm the publishable key cannot directly read RSVP rows; use verify-security.sql to inspect grants.
7. Remove only your marked test records in Supabase after verification. Keep backups according to your project's backup plan.
8. Supply the full Hampton Inn & Suites address before sending the invitation to guests.

## 8. Existing Sites responses and cutover

This package does NOT copy any existing Sites/D1 RSVPs into Supabase, and does not change or disable the Sites URL. Check whether responses already exist before switching. If they do, export them through the authorized organizer/database controls, map them to the PostgreSQL schema and reconcile counts before cutover. Preserve invitation codes and record identifiers where compatible. Do not publish two guest links to separate databases without a plan to reconcile responses.

Point new invitations at the new domain after the live checks pass. Keep the previous deployment available for rollback. Rolling back application code does not roll back Supabase data; take care with later schema changes.

## Architecture and operation

Browser → same-origin Next.js API → Supabase PostgreSQL/Auth. Guests never access the database directly. RLS and revoked anon/authenticated grants deny browser access; server operations use a secret key after validation/authorization. Database uniqueness protects duplicate submissions, including concurrent requests. RSVP request IDs make safe retries idempotent.

The guest dashboard fetches batches of 500 to avoid Supabase's default result-size cap. It refuses partial exports above 20,000 records. Expected attendees include the responding guest; plus-ones are party size minus one. Pending counts come only from organizer-created invitations, not guessed visitor counts.

Rate limits: 30 RSVP attempts or 10 login attempts per IP per 15 minutes. Counters persist in Supabase and expire through cleanup in the rate-limit function. Configure the reverse proxy correctly so guests do not all share one apparent IP. No rate-limiter data or public guest read endpoint is exposed.

## Official references

- Next.js self-hosting: https://nextjs.org/docs/app/guides/self-hosting
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase row-level security: https://supabase.com/docs/guides/database/postgres/row-level-security
- ScalaHosting Node.js VPS guidance: https://www.scalahosting.com/blog/installing-node-js-on-a-vps-server-2/
