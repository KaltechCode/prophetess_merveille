# Validation completed

- Next.js 16.3.4 production build completed successfully, including TypeScript checks.
- Standalone output assembled with static assets and portrait.
- Built Node server tested against a local simulated Supabase HTTP service:
  - Invitation and portrait served; revised September 19 time present.
  - Required-field and cross-origin rejection.
  - Idempotent retry, duplicate detection and request-ID payload conflict.
  - Declined responses discard attendance fields.
  - No public RSVP read endpoint.
  - Supabase organizer session cookie uses HttpOnly, Secure and SameSite=Strict.
  - Missing/forged sessions and spoofed Sites identity headers rejected.
  - Authenticated admin listing and invitation creation.
  - Valid and invalid invitation codes.
  - Rate-limit rejection response.

Reproduce after building with:

```bash
node scripts/package-standalone.mjs
node scripts/smoke-test.mjs
```

Limitations: no live Supabase project or ScalaHosting account was connected. PostgreSQL migration/RLS grants, real authentication, DNS, TLS and production proxy configuration must be verified with the supplied deployment checklist. The local HTTP stub validates application behavior, not real Supabase SQL execution. No live guest data was migrated. The browser animation was preserved from the existing site; no new browser-driven visual test was performed for this export.
