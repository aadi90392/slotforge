# SlotForge

A TypeScript resource-booking application with a reference-inspired editorial landing page, authenticated workspaces, SQL-enforced slot exclusivity, five-minute holds, and an audit trail.

Live app: https://slotforge.aditya-upadhyay1-dev.workers.dev

## Stack

- React 19 + TypeScript; Vinext (Next-compatible routing) + Vite on Cloudflare Workers.
- Cloudflare D1 (SQLite) and Drizzle-managed migrations.
- CSS design system, Lucide icons, local sample photography.
- First-party email/password login with opaque, revocable sessions in HttpOnly, SameSite=Lax cookies (Secure on HTTPS). No Clerk, AWS, Docker, AI API, or paid auth SDK.

Vinext is used to keep the full-stack Sites preview and standalone Cloudflare build aligned. The implementation does not use Hono or PostgreSQL; describe the actual stack above on your resume.

## Run locally

Requires Node 22.13+ (Node 24 recommended). On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`.

```sh
npm ci
npm run build
npm run db:local
npm run dev
```

`db:local` applies pending migrations and records them; it is safe to run again. Local data remains in ignored `.wrangler/state`.

Open the Local URL printed by the dev server (normally http://127.0.0.1:5173). The landing page is public. Workspace access requires an account. New accounts start with an empty workspace: owners add their actual rooms, capacities, locations and amenities. No fake bookings or inventory are inserted.

## Features

- Verify email before sign-in; expiring single-use verification and password-reset links.
- Create accounts, sign in, sign out; session revocation and expiry.
- Change passwords with current-password verification and revocation of all other sessions.
- Create/switch workspaces and join via a rotatable private invitation code.
- Owner/member authorization enforced on the backend, including ownership checks on bookings.
- Search and filter rooms; owners can add, edit and archive spaces.
- Remove teammates, cancel their future bookings and rotate the invitation code.
- Delete and anonymize your account with password confirmation.
- One-hour slots from 08:00 to 19:00 in Asia/Kolkata, up to 60 days ahead.
- Temporary holds (at most five minutes, never past the slot start), explicit confirmation, cancellation and rescheduling.
- Atomic uniqueness at the database, not a frontend-only availability check.
- Idempotency keys: retries reuse a booking; changed payloads with the same key are rejected.
- Transactional audit triggers for reservation creation, status changes, and rescheduling.
- Workspace statistics, team list, paginated booking history, and activity feed.
- Mobile navigation, dialogs, accessible labels, keyboard focus, and reduced-motion styles.

## Data integrity

`active_slot_unique` is a partial unique index on `(resource_id, day, hour)` for held and confirmed records. Expired holds are transitioned before workspace operations. Competing inserts cannot both occupy the same slot. A failed single-statement reschedule rolls back without losing the old reservation. Audit triggers run in the same transaction as the booking write.

Tenancy is checked with membership before querying resources. Resource IDs are verified against the active workspace when creating a booking. Cancellation/rescheduling require the booking owner or workspace owner. Invitation codes grant member access, not owner access.

## Verify

With the dev server running and migrations applied:

```sh
npm run typecheck
npm run test:domain
npm run test:integration
npm run build
```

Integration tests are restricted to localhost and create synthetic test accounts/workspaces. They exercise 50 concurrent requests for the same slot, idempotency, conflict-safe rescheduling, cross-workspace access denial, member permissions, CSRF, and login/logout. They are correctness checks on a local emulator, not a production throughput benchmark.

## Deployment options

The connected Sites workflow publishes a private review deployment. Its audience is separate from application sign-in. A private Sites URL is not a public recruiter portfolio URL.

For a public `workers.dev` deployment in your own Cloudflare account (no purchased domain required):

```sh
npx wrangler login
npx wrangler d1 create slotforge-db
npm run build
node scripts/configure-cloudflare.mjs YOUR_D1_DATABASE_UUID slotforge
npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json
npx wrangler deploy --config dist/server/wrangler.json
```

Replace `YOUR_D1_DATABASE_UUID` with the real value returned by Cloudflare. Use a new empty D1 database for the first deployment. After subsequent builds, rerun the configuration step before migration/deploy because builds regenerate the Wrangler file. Do not put tokens in source. Wrangler authentication remains on your machine or in CI secrets. Production email requires the BREVO_API_KEY, EMAIL_FROM and APP_ORIGIN settings described below; signup/recovery are unavailable until they are configured.

Cloudflare free plans have request, CPU, database and storage limits. The project avoids trial credits and paid integrations, but no provider's future pricing can be guaranteed. Stay on the free Workers plan and monitor actual usage. Account-level signup, any terms, and Cloudflare provisioning are not performed by the local build scripts.

## Security, email and operations

Passwords use versioned scrypt hashes (N=16384, r=8, p=5); legacy PBKDF2 records upgrade after a verified successful login. Session and email-link tokens are random 256-bit values stored as SHA-256 digests. Password changes/resets revoke sessions and outstanding links. Email tokens are consumed transactionally. Authentication is rate-limited per IP and per account; workspace writes have per-user limits. Database guards reject bookings if a room was archived or membership removed concurrently.

Production email requires `BREVO_API_KEY`, `EMAIL_FROM` and `APP_ORIGIN` configured securely. A development build on localhost captures messages in a LOCAL database mailbox instead of sending them. After local signup, run:

```sh
npm run mail:local -- your-test-email@example.test
```

Open the captured verification link, confirm verification and sign in. This development command is not a public mailbox endpoint and is not enabled in production. Production verification email delivery and verified sign-in were confirmed by the owner on 7 November 2026. The email arrived in Spam; inbox placement is not guaranteed. Hosted password recovery and CPU limits still need separate acceptance checks.

See [operations guide](docs/OPERATIONS.md) for sender setup, backup/restore, monitoring, account deletion semantics and launch checks. Strong password hashing must be measured on Workers Free before launch; local tests cannot prove its CPU allowance is sufficient. Never silently reduce hashing strength or upgrade to a paid plan.

## Product boundaries

- Fixed IST timezone, one-hour slots, 8 AM-7 PM, 60-day booking window.
- No payments, recurring bookings, file uploads, custom schedules or MFA.
- Workspace availability refreshes every 30 seconds and writes are validated server-side.
- History is paginated in 25-record pages; availability loads active bookings from today onwards independently of historical volume.
- New workspaces are empty. Room covers use a neutral illustration. Test accounts/data remain local and are not published.
- Public Cloudflare hosting, production email configuration and owner verification/sign-in are complete. See the release status for remaining live acceptance checks.

## Design and assets

The user-provided video guided the off-white editorial layout, floating cards, blue sculptural accent, rounded photography and generous whitespace. The blue object is CSS, not a downloaded model. Room photos are bundled from Unsplash image IDs `photo-1497366754035-f200968a6e72`, `photo-1497366811353-6870744d04b2`, `photo-1497366216548-37526070297c`, and `photo-1524758631624-e2822e304c36`. Font families: DM Sans and Manrope via Google Fonts, with sans-serif fallbacks.
