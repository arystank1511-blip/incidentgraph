# Security review — v1.0.1

This report is preserved from the original source snapshot. It describes that implementation review, not independently verified security settings or completed CI runs for this repository. Check the current Actions results and repository Settings before relying on operational claims.

Scope: application code, API access boundaries, browser behavior, local/container configuration, npm dependencies, repository history and GitHub security settings. Tests use synthetic data and isolated local/CI instances. No third-party production systems were targeted.

## Findings and changes

| Finding in v1.0.0                                                                      | Change in v1.0.1                                                                                      | Verification                                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Telemetry endpoints were readable without authentication                               | A default-deny global API guard protects all telemetry; the UI gates the workspace                    | Anonymous and forged-cookie probes against every read endpoint                  |
| Public default signing key and shared credentials could be mistaken for private access | Opaque random sessions; unique generated private credentials; public demo is explicit and isolated    | Fail-closed configuration, token tampering and demo/PostgreSQL isolation checks |
| Logout removed only the browser cookie                                                 | Server-side revocation and replacement-login rotation                                                 | Replay of old cookies returns 401                                               |
| Weak browser mutation boundary                                                         | JSON-only writes, a required custom header, exact-origin and Fetch Metadata checks                    | Cross-site, null-origin, missing-header and text/plain probes                   |
| Limited protection against abusive requests                                            | Bounded rate-limit/session maps, login throttling, read/write limits and HTTP timeouts                | Limit/reset/capacity and spoofed-forwarding-header tests                        |
| Browser HTML lacked a script policy                                                    | Per-response nonce CSP, frame denial, no-referrer and permissions policy                              | Inline script blocking and escaped stored-content tests                         |
| Error/path logs could contain user-supplied values                                     | Generic parser/server errors and route-template logging without payloads, cookies or query strings    | Synthetic canary checks against errors and logs                                 |
| Database/API ports and known database password were exposed in local Compose           | Unique setup credentials; only frontend loopback port published                                       | Full Docker smoke test and post-restart persistence                             |
| Secret detection was a manual release check                                            | Full-history Gitleaks and npm audit in CI; SHA-pinned Actions and checksum-pinned scanner; Dependabot | GitHub Actions and repository security settings                                 |

## Repository review

The original review recorded a redacted Gitleaks history scan with no matching credentials and an empty secret-scanning alert list at that time. Those historical results do not establish the current repository's scan coverage or settings. The public login/password strings in the original demo were intentional fixtures, not business credentials; they are no longer accepted in private mode. There was no finding requiring secret rotation at an external provider or a destructive history rewrite.

Generated administrator/database passwords, local environment files, snapshots and scanner reports remain outside Git. Screenshots come from an isolated synthetic test dataset. A scan result is evidence for the checked revision, not a guarantee that future commits cannot contain private data.

## Remaining boundaries

This application has one administrator account, one workspace and one API process. It does not implement SSO/MFA, per-user roles, tenant isolation, encryption at rest, database retention, a distributed abuse defense, or a hardened internet-facing deployment. The local Docker network assumes a trusted host. Infrastructure administrators can inspect environment variables and data volumes.

The deterministic incident-analysis engine is not a security monitoring or attack detection service. An independent penetration test and a deployment-specific threat model remain appropriate before handling real business data.
