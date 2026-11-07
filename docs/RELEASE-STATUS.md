# Release status — 7 November 2026

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

## Deliberately deferred to deployment

No GitHub push, public deployment, provider signup, real email delivery, owner account provisioning or paid-plan activation has been performed. GitHub Actions has been authored but has not run on GitHub.

Configure the user's hosting and email-provider accounts, verify the sender, run real inbox tests, and measure strong-password hashing against Workers Free CPU/memory limits. Local checks do not establish hosted free-tier suitability. If the Free plan cannot support it, revisit hosting/authentication without weakening password storage or enabling paid billing. See OPERATIONS.md.
