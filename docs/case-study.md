# IncidentGraph — engineering case study

## Context

IncidentGraph is a full-stack portfolio project exploring incident investigation in distributed systems. Its central question is: how can an engineer distinguish a likely cause from the many symptoms of a failure?

The demo models a commerce platform where database connection exhaustion propagates into payment timeouts, order failures, and gateway errors. All organizations, users, incidents, and telemetry in the fixtures are synthetic. This project has no claimed production customers, business impact measurements, or load-test results.

## Product decisions

The incident detail is the primary workflow. It combines a ranked hypothesis, timeline, dependency graph, and investigation activity. The supporting logs, metrics, traces, and deployment views provide inspectable evidence instead of disconnected dashboard widgets.

The public landing page communicates the product, while an architecture page explains the implementation. A fixed telemetry clock makes the same story reproducible for reviewers. Server-side persistence lets them change status and add notes without losing those actions on refresh.

## Architecture decisions

| Decision                                                 | Reason                                                                                   | Tradeoff                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Next.js frontend and NestJS API in an npm monorepo       | Separate presentation from domain workflows while sharing validated TypeScript contracts | Two services to build and operate                                   |
| Deterministic scoring with explicit factors              | Reproducible tests and explanations without a model service                              | Heuristic rankings, not calibrated causal inference                 |
| Bounded time window plus graph connectivity              | Group related anomalies without indefinitely extending an incident                       | Independent batches cannot merge into an existing incident          |
| PostgreSQL with Prisma and transactional incident writes | Durable relationships, migrations, and reproducible setup                                | The current read snapshot is bounded and single-process             |
| Atomic JSON snapshot for the default demo                | Reviewers can run the product without infrastructure                                     | Suitable for demonstration, not multi-instance writes               |
| Optional Redis query cache                               | Demonstrate cache-aside reads and graceful fallback                                      | Short stale windows; no distributed invalidation                    |
| Serialized read-modify-write operations per incident     | Avoid lost updates when status, owner, and analysis change concurrently                  | Cross-process concurrency would require database-level coordination |

## Root cause analysis

The shared engine traverses the dependency graph upstream from each candidate. It considers anomaly timing, affected reachable services, anomaly magnitude, and later upstream degradation. Traversal is cycle-safe. Correlation isolates environments and enforces a maximum two-minute span from the first event.

The factors are visible in the interface and covered by tests. The score does not claim certainty, and proximity to a deployment does not imply that deployment caused the incident.

## Verification

The repository includes engine/service tests, an isolated Playwright suite, real PostgreSQL migration and reconnect checks, and GitHub Actions. The browser suite exercises all primary routes, internal links, mobile overflow, and automated accessibility rules alongside the investigation workflow.

An audit identified a lost-update race between concurrent incident changes. Read, transformation, and persistence now execute together per incident; a regression test checks that simultaneous owner, status, and analysis updates survive and persist.

The API validates inputs, limits request bodies and writes, checks origins, and issues revocable HTTP-only sessions. These controls do not turn the single-user demonstration into enterprise identity or authorization. The shared synthetic demo must never contain confidential information. See SECURITY.md for the private mode and deployment boundaries.

Docker Compose is provided for PostgreSQL, Redis, API, and frontend. Native PostgreSQL integration has been exercised; Compose itself was not executed on the development host because Docker was unavailable. CI results are visible in the repository's Actions tab.

## Next engineering steps

For a real installation: implement service authentication and tenant isolation, telemetry collectors and privacy controls, a durable queue with transactional deduplication, cross-batch incident reconciliation, database-backed pagination and retention, shared rate limiting, and load testing. These are future work, not capabilities of the current release.
