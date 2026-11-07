# Operations and release checklist

## Configuration

Keep Workers on Free. Configure BREVO_API_KEY, EMAIL_FROM and APP_ORIGIN through Wrangler secrets or the Cloudflare dashboard; never commit their values. APP_ORIGIN must be the exact HTTPS deployment origin. Brevo requires an approved transactional email account and verified sender. Its current free allowance is 300 emails/day. A free-mail sender may be rewritten to brevosend.com; confirm actual delivery before launch. The owner confirmed production verification email delivery and sign-in on 7 November 2026; that message arrived in Spam.

Production fails closed when email is unconfigured. Only development builds receiving localhost requests use the local database mailbox. `npm run mail:local -- name@example.test` displays those development links; there is no HTTP mailbox endpoint. Production builds never capture email links in the local_mail table. Links use URL fragments, expire, and are consumed only by a POST action (email link scanners do not consume them).

## Local initialization

`npm ci`, `npm run build`, `npm run db:local`, then `npm run dev`. Migrations are tracked and repeatable. Existing data is retained. Never edit applied migrations. CI initializes a fresh database. Synthetic tests create their own accounts and do not send email.

## Before public release

1. Configure your own D1 database and Workers URL using README commands.
2. Set the three email settings securely and verify the sender in Brevo.
3. Deploy and test actual inbox verification, resend and forgot-password delivery, link expiry, and login from a second browser.
4. Check Workers CPU and memory metrics during signup/login. scrypt uses N=16384, r=8, p=5 (OWASP-listed parameters), about 16 MiB working memory per operation. Native cryptographic CPU accounting and concurrent request limits must be measured on the real Free plan. Local emulator performance does NOT establish that the 10 ms Free-plan CPU allowance is sufficient. Do not lower the password cost or enable billing to hide a failed check; revisit the auth/hosting choice if this fails.
5. Check two real users booking the same slot and member removal. Confirm /api/health returns 200 without exposing configuration.
6. Set a free external uptime check for /api/health if desired, inspect Workers errors and D1 usage, and export an initial backup.

## Backup

Backups contain private data and password hashes. Store encrypted outside the repository. `backups/` is ignored.

```sh
npx wrangler d1 export DB --remote --config dist/server/wrangler.json --output backups/slotforge-YYYY-MM-DD.sql
```

Create the backup directory first. Repeat before schema changes and at an interval appropriate to data-loss tolerance. Do not publish backups to GitHub. D1 Time Travel availability/retention depends on the account plan; manual SQL exports provide a portable additional recovery copy.

## Restore drill (new database only)

Create a new EMPTY D1 database named slotforge-restore. Import the export using `wrangler d1 execute slotforge-restore --remote --file <backup.sql>`. Do not run migrations before importing a full schema export. Create a separate Worker bound to the restored database, confirm counts, login, memberships, active-slot uniqueness and audit triggers. Only switch production's DB binding after validation and a fresh backup. Never import over the live database. Record restore time and verify app versions match the backup schema.

## Data lifecycle

Archiving hides a room and cancels future reservations while retaining history. Member removal cancels their future bookings and rotates the invite code. Account deletion requires the current password and an explicit DELETE confirmation. Shared-workspace owners must remove teammates first; profile/email/password are anonymized, sessions/tokens removed, owned rooms archived. Booking titles and audit details remain with their team, which the confirmation dialog discloses. Old local test accounts are not uploaded in source or builds.

## Incident response

For suspected account takeover, reset the password (revokes all sessions), rotate affected invite codes, inspect booking activity, and remove unauthorized members. For leaked mail credentials, revoke the key in Brevo and replace the Worker secret. Logs must never include email tokens, passwords, API keys or message bodies. Native Workers logs provide request/error visibility; /api/health checks D1 connectivity only.
