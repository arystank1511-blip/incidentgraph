# REST API

Base URL: `http://localhost:4100/api` (direct) or `http://localhost:3100/api` (Next.js proxy). All telemetry reads and writes require the opaque `ig_session` cookie. Health, login, session status, and the demo-mode flag are public. Mutations require `Content-Type: application/json` and `X-IncidentGraph-Request: 1`; foreign origins are rejected.

| Method | Route                               | Purpose                                                       |
| ------ | ----------------------------------- | ------------------------------------------------------------- |
| GET    | `/health`                           | Readiness after storage initialization                        |
| POST   | `/auth/login`                       | Email/password demo session                                   |
| POST   | `/auth/logout`                      | Clear current session                                         |
| GET    | `/auth/me`                          | User or `null`                                                |
| GET    | `/bootstrap?environment=production` | Workspace snapshot, dependencies, incidents, traces, releases |
| GET    | `/incidents`                        | Paginated filtered incident list                              |
| GET    | `/incidents/:id`                    | Incident, analysis, events, annotations                       |
| POST   | `/incidents`                        | Declare incident                                              |
| PATCH  | `/incidents/:id`                    | Update status and/or owner                                    |
| POST   | `/incidents/:id/analyze`            | Recalculate from incident evidence                            |
| POST   | `/incidents/:id/annotations`        | Add an investigation note                                     |
| POST   | `/ingest`                           | Validate, correlate, analyze and persist an anomaly batch     |
| GET    | `/logs`                             | Paginated logs and matching-event histogram                   |
| GET    | `/metrics`                          | Selected metric series; optional Redis read cache             |
| GET    | `/search`                           | Incidents, services, log messages, trace IDs                  |

Read filters: `environment=production|staging`, `q`, `service`, `level=ERROR|WARN|INFO|DEBUG|all`, `page`, `pageSize` (max 100), `range=15m|1h|6h|24h`. Incidents additionally accept `status`, `severity`, and ISO `from`.

Search supports case-insensitive substring matching, OR alternatives, and AND-required terms. It is deliberately not a SQL query language. Metrics use five-minute samples. Aggregated latency and error rate are request-weighted; throughput is summed; CPU and memory are averaged.

## Login

The commands below are for the explicit synthetic mode (`npm run demo`). In private mode, use your locally generated credentials from an untracked request file; avoid placing a real password in shell history. Keep cookie jars and request files inside the ignored `.data/` directory.

```sh
curl -c .data/cookies.txt http://localhost:4100/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'X-IncidentGraph-Request: 1' \
  -d '{"email":"demo@incidentgraph.dev","password":"investigate-demo"}'
```

## Ingest

```sh
curl -b .data/cookies.txt http://localhost:4100/api/ingest \
  -H 'Content-Type: application/json' \
  -H 'X-IncidentGraph-Request: 1' \
  --data-binary @docs/sample-ingestion.json
```

The adapter accepts up to 100 events per request, a 256 KB body, and 60 write requests per minute per IP per process. Event IDs are deduplicated against stored incident events. The synchronous processor serializes batch admission; production streaming should use a durable queue and transactional deduplication. Below-threshold noise does not create an incident. Batches are correlated independently in v1; cross-batch incident merging is a future improvement.

Errors use meaningful HTTP status codes and a `message` field: 400 validation, 401 authentication, 403 origin, 404 unknown incident, 413 oversized body, 415 unsupported content type, 429 rate limit. Unexpected errors return 500. Structured server logs include request ID, route, status, and duration without request bodies or credentials.

Sessions expire after eight hours and are invalidated by logout, replacement login, or an API restart. Anonymous telemetry requests return 401, including reads. Login is limited to 10 attempts per 15 minutes per observed IP; forwarding headers do not bypass this limit.
