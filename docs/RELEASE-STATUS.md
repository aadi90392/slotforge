# Release status â€” 7 November 2026

## Completed locally

- Email verification and single-use, expiring password recovery with transactional token consumption.
- Password storage upgraded to scrypt; legacy password migration, session revocation, account/IP rate limits and security headers.
- Room archival, member removal with invite rotation, account anonymization/deletion.
- Paginated searchable booking history independent of current availability.
- Four ordered database migrations, local initialization command, health endpoint, backup/restore guide and GitHub Actions checks.

## Validation

- TypeScript check: passed.
- Domain tests: 6 passed.
- Integration tests: 66 passed, including simultaneous bookings/reset requests, expired/replayed links, permissions, archival, account deletion and more than 1,000 history records.
- Production build: passed.
- Fresh database: all four migrations applied successfully.
- Local SQL export/restore: counts, integrity, foreign keys and four triggers preserved.
- Browser: verification link, verified sign-in, room archive confirmation and account settings checked.
- Production bundle on local Worker: health and page routes returned 200; unconfigured email signup/recovery returned 503; security headers verified. Development mailbox is not used by production.

## Production status — 7 November 2026

- Public Worker: https://slotforge.aditya-upadhyay1-dev.workers.dev, with D1 migrations applied.
- GitHub repository published; an earlier CI run was confirmed green by the owner.
- Production email settings configured through Cloudflare secrets. No credentials are stored in source.
- Fixed verification delivery diagnostics and partial-signup error handling; four mocked mail tests cover failures without sending real email.
- Owner confirmed real verification email receipt, verification and sign-in. The verification email arrived in Spam, so inbox placement remains a limitation.
- Temporary protected email diagnostics and their secret were removed after identifying an incorrectly saved API key.

## Remaining live acceptance and operations checks

- Exercise password recovery and password change on the hosted app.
- Exercise two real accounts joining a workspace, competing for a slot, rescheduling, and member removal on the hosted app. Local integration coverage does not replace this live check.
- Measure signup/login CPU and memory on Workers Free; one successful login does not prove capacity under concurrent usage. Do not weaken hashing or enable billing to hide a failed check.
- Create a private production backup and establish a backup/restore routine; local restore testing has passed.
- Monitor provider quotas, errors, key expiry and email deliverability. No provider can guarantee perpetual free service or inbox placement.

These are explicitly unverified production checks, not claims that the corresponding implemented features are absent. See OPERATIONS.md.
