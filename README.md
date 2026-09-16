# Prophetess Merveille — ScalaHosting + Supabase

Start with **DEPLOYMENT.md** for the complete setup and deployment sequence.

This is a standalone Next.js/React/TypeScript version of the invitation, with the supplied portrait, updated event schedule, envelope animation, conditional RSVP, personalized confirmation, calendar download and organizer dashboard.

- Runtime: Node.js 22 on ScalaHosting VPS, behind an HTTPS reverse proxy.
- Data: Supabase PostgreSQL; migration in supabase/001_initial.sql.
- Admin: Supabase Auth email/password, allowlisted by user UUID.
- Build: npm ci, npm run build, node scripts/package-standalone.mjs.
- Secrets: runtime environment only; see .env.example.
- Server examples: deploy/merveille.service and deploy/nginx.conf.example.

The existing Sites deployment remains separate. This source package does not provision a VPS, create a Supabase project, copy existing guest records, or change DNS. Configure your live credentials and follow the smoke-test checklist before sharing the new URL.
