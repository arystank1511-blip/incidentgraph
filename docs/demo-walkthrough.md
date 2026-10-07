# Three-minute demo

Run `npm ci`, `npm run db:generate`, and `npm run dev` from the repository root. Open [the workspace](http://localhost:3100/app/overview). Sign in using the unique credentials generated in the ignored `apps/api/.env` file. For a shared synthetic walkthrough with prefilled public credentials, use `npm run demo` instead. No external account or paid service is required. This is synthetic demo telemetry, not a connection to a production system.

## 0:00 — Recognize the incident

The overview shows two active incidents and five degraded production services. Error rate and latency rise around the same time. Open **Payment failures** (`INC-1042`).

Explain the problem: one database issue can appear as separate failures in payments, orders, and the gateway. The investigation should connect these symptoms.

## 0:30 — Follow the evidence

The leading hypothesis is **PostgreSQL connection pool exhaustion**. Open **How this score was calculated**, then select a timeline event to inspect the evidence.

Explain that 91% is a deterministic ranking score with a demonstration coverage multiplier. It is not a measured probability or proof of causation. The earlier deployment is context, not an automatically blamed root cause.

## 1:15 — Trace the dependency chain

Open the service map and inspect PostgreSQL. Edges point from callers to dependencies. The analysis walks upstream to see which services could be affected by a database failure.

Open Logs, filter to `payment-service`, and run `timeout OR connection`. Expand a row and use **Open trace**. The waterfall connects the user-visible failure to a database wait.

## 2:00 — Record the investigation

Sign in at [the demo login](http://localhost:3100/login) using the generated local credentials (or the prefilled credentials in explicit demo mode). Return to `INC-1042`, change its status, and add a note in Activity. Reload to demonstrate server-side persistence.

Use Ctrl/Cmd+K to search for an incident or switch views. Select Staging to demonstrate environment isolation and the empty incident state.

## 2:40 — Explain the implementation

Open [Architecture](http://localhost:3100/architecture). Point out the boundaries between ingestion, correlation, analysis, storage, and presentation.

For an engineering interview, open `packages/shared/src/analysis.ts` and `tests/analysis.test.ts`. Discuss bounded correlation windows, reverse graph traversal, cycle handling, and why the MVP uses deterministic scoring instead of an LLM.

Finish with the actual scope: tested portfolio MVP, PostgreSQL support, synthetic telemetry, single API process. Realtime collectors, multi-tenancy, and production scaling are not implemented.
