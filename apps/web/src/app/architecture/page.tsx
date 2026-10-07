import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Box,
  Database,
  GitBranch,
  Layers3,
  Network,
  ScanLine,
  Terminal,
  Workflow,
} from 'lucide-react';
import { PublicFooter, PublicNav } from '@/components/public-nav';
import { Badge } from '@/components/ui/primitives';
export const metadata = { title: 'Architecture' };
const stages = [
  {
    icon: Box,
    title: 'Applications',
    tech: '11 demo microservices',
    text: 'API Gateway, Auth, Orders, Payments, PostgreSQL, Redis, and supporting services.',
  },
  {
    icon: Network,
    title: 'Telemetry boundary',
    tech: 'OpenTelemetry concepts',
    text: 'Normalized timestamps, service identifiers, trace context, spans, and metric signals. Real OTLP ingestion is a future adapter.',
  },
  {
    icon: Terminal,
    title: 'Event ingestion',
    tech: 'NestJS REST + Zod',
    text: 'Authenticated, bounded batches. Validate schema and environment, reject unknown services, and deduplicate event IDs.',
  },
  {
    icon: Workflow,
    title: 'Event processing',
    tech: 'In-process EventProcessor',
    text: 'Deterministic processing with a replaceable queue boundary. Kafka can replace synchronous delivery without changing scoring.',
  },
  {
    icon: Database,
    title: 'Durable storage',
    tech: 'PostgreSQL + Prisma / demo file',
    text: 'Indexed relational models for incidents and telemetry. Redis caches derived read results when configured.',
  },
  {
    icon: GitBranch,
    title: 'Correlation engine',
    tech: 'Bounded graph components',
    text: 'Group anomalies within 120 seconds when services share a dependency path. Keep environments isolated.',
  },
  {
    icon: ScanLine,
    title: 'Root cause engine',
    tech: 'Weighted evidence scoring',
    text: 'Rank onset timing, dependency reach, anomaly magnitude, and upstream propagation. Return evidence, factors, and explanation.',
  },
  {
    icon: Layers3,
    title: 'Investigation workspace',
    tech: 'Next.js + React Flow + Recharts',
    text: 'Inspect timelines, follow service dependencies, open correlated logs and traces, and record mitigation decisions.',
  },
];
const code = [
  'score = coverage × (',
  '  temporal    × 0.30 +',
  '  dependency  × 0.25 +',
  '  anomaly     × 0.25 +',
  '  propagation × 0.20',
  ')',
  '',
  'coverage = 0.91',
  '',
  '// Evidence ranking, not probability.',
  '// No LLM in the scoring path.',
].join('\n');
export default function Architecture() {
  return (
    <div className="public-page architecture-page">
      <PublicNav />
      <main>
        <header className="architecture-heading">
          <div className="section-kicker">SYSTEM DESIGN / V1.0</div>
          <h1>
            From scattered signals
            <br />
            to a connected explanation.
          </h1>
          <p>
            IncidentGraph separates collection, correlation, and interpretation. The same evidence
            produces the same ranking, and every score can be inspected.
          </p>
          <div className="chip-row">
            <Badge>Monorepo</Badge>
            <Badge>Strict TypeScript</Badge>
            <Badge>Deterministic analysis</Badge>
          </div>
        </header>
        <section className="architecture-flow" aria-label="IncidentGraph architecture pipeline">
          {stages.map((stage, i) => (
            <div key={stage.title}>
              <article className="architecture-stage">
                <span className="architecture-stage-number">{String(i + 1).padStart(2, '0')}</span>
                <span className="architecture-stage-icon">
                  <stage.icon size={22} />
                </span>
                <div>
                  <h2>{stage.title}</h2>
                  <p>{stage.text}</p>
                </div>
                <Badge>{stage.tech}</Badge>
              </article>
              {i < stages.length - 1 && (
                <div className="architecture-arrow">
                  <ArrowDown size={16} />
                </div>
              )}
            </div>
          ))}
        </section>
        <section className="algorithm-section">
          <div>
            <div className="section-kicker">THE ROOT CAUSE ALGORITHM</div>
            <h2>
              Evidence first.
              <br />
              Explanation second.
            </h2>
            <p>
              Dependency edges point from callers to dependencies. To find the impact of a
              candidate, the engine traverses those edges in reverse using breadth-first search.
            </p>
            <p>
              The strongest candidate is the service that degraded early, experienced a substantial
              anomaly, and explains subsequent failures upstream.
            </p>
            <Link href="/app/incidents/INC-1042">
              Inspect the example result
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="algorithm-code">
            <div>
              <span className="live-dot" />
              <span className="mono">weighted-evidence-v1</span>
            </div>
            <pre>
              <code>{code}</code>
            </pre>
            <p>
              The coverage multiplier is an explicit demo heuristic for missing infrastructure
              signals, not a statistically calibrated confidence interval.
            </p>
          </div>
        </section>
        <section className="architecture-boundaries">
          <h2>Practical boundaries, honest tradeoffs.</h2>
          <div className="how-grid">
            <article>
              <h3>Two ways to run</h3>
              <p>
                Use the persisted server-side demo for a zero-infrastructure start, or Docker
                Compose for PostgreSQL and Redis. The UI and analysis engine use the same contracts.
              </p>
            </article>
            <article>
              <h3>A deliberate MVP</h3>
              <p>
                Single organization, bounded snapshots, synchronous ingestion, demo authentication.
                Durable records and query indexes are ready; large-scale streaming is a next step.
              </p>
            </article>
            <article>
              <h3>Built to evolve</h3>
              <p>
                Replace the event processor with Kafka, move log storage to ClickHouse, add real
                OTLP collectors, and integrate OAuth through the session boundary.
              </p>
            </article>
          </div>
        </section>
        <section className="architecture-cta">
          <h2>See the architecture in action.</h2>
          <Link href="/login" className="button button-primary">
            Open the investigation workspace
            <ArrowRight size={15} />
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
