# Security

Use **v1.0.1 or later**. Version 1.0.0 was a demonstration with anonymous telemetry reads and public demo credentials; it must not be used for confidential information.

## Access model

The default configuration is a private, single-account workspace. Every telemetry read and write requires a valid server-side session. Only health, login, session status and the non-sensitive demo-mode flag are public API endpoints. There is no tenant boundary or role model: the authenticated administrator can access the entire workspace.

Run `npm run setup` to generate unique credentials in ignored local `.env` files. Existing files are not overwritten. Keep these files on the machine running the project. Never upload them to GitHub, a chat, screenshots, support tickets, build artifacts or public container registries.

The optional `npm run demo` mode deliberately uses public credentials and a separate synthetic dataset. It cannot connect to PostgreSQL or use `DEMO_DATA_PATH`. Do not enter real telemetry or confidential notes in that mode.

## Sessions and request protection

Session tokens contain 256 bits of randomness. Only their hashes and expiry times are kept in API memory. They expire after eight hours and are revoked on logout or replacement login. Restarting the API invalidates all sessions. Cookies are HTTP-only and SameSite=Strict, with Secure enabled in production. There is no reusable signing key in source control.

Mutations require JSON and `X-IncidentGraph-Request: 1`. Foreign Origin and cross-site Fetch Metadata are rejected. CORS allows only the configured origin. Password guessing is limited to 10 attempts per 15 minutes; other limits are 60 writes and 600 total requests per minute, per observed IP and API process. Forwarding headers are not trusted, so clients behind the same reverse proxy share a bucket. These controls are not a distributed DDoS defense.

The web UI uses a fresh CSP script nonce for each HTML response, denies framing, and disables referrer transmission and unnecessary browser permissions. Dynamic style attributes are allowed for chart/graph libraries. Development also allows script evaluation for Next.js tooling; production does not. User content is rendered as text. Logout reloads the page and clears cached query data.

## Storage and network boundaries

The Node processes bind to loopback by default. Docker publishes only the frontend on loopback; API, database and Redis ports are not published. Remote origins require HTTPS. An internet-facing installation also needs a trusted TLS reverse proxy, access controls, shared session/rate-limit storage when scaling, and monitored backups.

**Application data is not encrypted at rest by this code.** PostgreSQL volumes, Redis persistence, JSON snapshots and `.env` files must be protected by OS permissions and encrypted disks/backups as required by your environment. POSIX setup files use mode 0600 and snapshot directories 0700; Windows access follows NTFS permissions. Administrators or malware with access to the host can still read data and credentials. Use TLS for databases/caches outside a trusted local network.

The current release is a hardened portfolio MVP, not a security certification or a substitute for enterprise identity, MFA, multi-tenant authorization, an independent penetration test, retention controls, or production operational hardening.

## GitHub and secret handling

Only source, deliberately synthetic fixtures, documentation and screenshots from isolated tests belong in the repository. Environment files, snapshots, databases, credential files, exports, browser sessions and common backup formats are ignored. `.gitignore` can be bypassed with `git add -f`; review staged files before publishing. CI runs Gitleaks against the complete history and audits npm dependencies. Dependabot update configuration is included. GitHub secret scanning and push protection are repository settings; confirm their current status in Settings before relying on them. Scanners cannot identify every possible secret or personal detail.

If a real credential is exposed, revoke or rotate it at its provider immediately. Deleting the current file or making the repository private does not invalidate a copied credential or erase Git history. Then remove the exposed data from affected history/artifacts as appropriate and rescan.

## Reporting

Use the repository's private vulnerability reporting option if it is available. Do not create a public issue containing credentials, customer data, exploit payloads with real tokens, or private telemetry. Reports should describe the affected version and a minimal reproduction using synthetic data.

Reference guidance: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), and [Next.js CSP](https://nextjs.org/docs/app/guides/content-security-policy).
