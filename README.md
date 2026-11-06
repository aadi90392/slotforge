# SlotForge

A TypeScript resource-booking application with a reference-inspired editorial landing page, authenticated workspaces, SQL-enforced slot exclusivity, five-minute holds, and an audit trail.

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
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lowly_thor.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_booking_audit.sql
npm run dev
```

Apply each SQL file once per local database, in filename order. The existing checkout's local database has already been initialized. Do not replay its migrations. Local data stays under ignored `.wrangler/state`; it is not included in publishing.

Open the Local URL printed by the dev server (normally http://127.0.0.1:5173). The landing page is public. Workspace access requires an account. New accounts start with an empty workspace: owners add their actual rooms, capacities, locations and amenities. No fake bookings or inventory are inserted.

## Features

- Create accounts, sign in, sign out; session revocation and expiry.
- Change passwords with current-password verification and revocation of all other sessions.
- Create/switch workspaces and join via a rotatable private invitation code.
- Owner/member authorization enforced on the backend, including ownership checks on bookings.
- Search and filter rooms; owners can add and edit spaces.
- One-hour slots from 08:00 to 19:00 in Asia/Kolkata, up to 60 days ahead.
- Temporary holds (at most five minutes, never past the slot start), explicit confirmation, cancellation and rescheduling.
- Atomic uniqueness at the database, not a frontend-only availability check.
- Idempotency keys: retries reuse a booking; changed payloads with the same key are rejected.
- Transactional audit triggers for reservation creation, status changes, and rescheduling.
- Workspace statistics, team list, booking history, and activity feed.
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

Replace `YOUR_D1_DATABASE_UUID` with the real value returned by Cloudflare. Use a new empty D1 database for the first deployment. After subsequent builds, rerun the configuration step before migration/deploy because builds regenerate the Wrangler file. Do not put tokens in source. The code runs without runtime API-key secrets; Wrangler authentication remains on your machine or in your CI secrets.

Cloudflare free plans have request, CPU, database and storage limits. The project avoids trial credits and paid integrations, but no provider's future pricing can be guaranteed. Stay on the free Workers plan and monitor actual usage. Account-level signup, any terms, and Cloudflare provisioning are not performed by the local build scripts.

## Release boundaries

This is a functional portfolio MVP, not a certified production reservation system.

- Email ownership verification, password recovery, MFA, and account deletion flows are not yet implemented. Use unique test passwords, and do not put sensitive business data in the demo.
- Password hashing uses PBKDF2-SHA256 at 100,000 iterations, the Web Crypto iteration limit in the target Workers runtime. This is below commonly recommended modern password-storage work factors. Harden authentication (for example, passkeys or an audited hosted identity option) before opening registration for sensitive production use. Sessions are random 256-bit tokens stored only as SHA-256 digests in D1.
- Login/registration have per-IP limits; broader abuse protection and credential-stuffing controls remain future work. Expired sessions and rate-limit entries are cleaned on session creation.
- Timezone is explicitly fixed to IST, not falsely advertised as arbitrary timezone support. All slots are one hour. No payments, email delivery, file uploads, recurring reservations, or background queue service.
- The UI refreshes workspace data every 30 seconds and revalidates writes server-side; it is not a WebSocket live-presence system.
- Booking history is capped at 1,000 rows per workspace in this release. Pagination, retention, archival and richer analytics remain future improvements.
- Resources use a neutral illustrated cover. Local test accounts/data are never uploaded with the build.

## Design and assets

The user-provided video guided the off-white editorial layout, floating cards, blue sculptural accent, rounded photography and generous whitespace. The blue object is CSS, not a downloaded model. Room photos are bundled from Unsplash image IDs `photo-1497366754035-f200968a6e72`, `photo-1497366811353-6870744d04b2`, `photo-1497366216548-37526070297c`, and `photo-1524758631624-e2822e304c36`. Font families: DM Sans and Manrope via Google Fonts, with sans-serif fallbacks.
