import Link from 'next/link';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  Database,
  GitBranch,
  Network,
  Radar,
  ScanLine,
  Terminal,
  TriangleAlert,
} from 'lucide-react';
import { PublicFooter, PublicNav } from '@/components/public-nav';
import { Badge } from '@/components/ui/primitives';
export default function Landing() {
  return (
    <div className="public-page">
      <PublicNav />
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="live-dot" /> INTELLIGENT INCIDENT INVESTIGATION
            </div>
            <h1>
              Understand why
              <br />
              your systems <span>fail.</span>
            </h1>
            <p>
              Logs tell you what happened. IncidentGraph connects the signals to show you why — and
              where to look next.
            </p>
            <div className="hero-buttons">
              <Link href="/login" className="button button-primary">
                Explore demo
                <ArrowRight size={16} />
              </Link>
              <Link href="/architecture" className="button button-secondary">
                View architecture
                <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="hero-proof">
              <span>
                <Check size={13} />
                No setup required
              </span>
              <span>
                <Check size={13} />
                Real incident scenarios
              </span>
            </div>
          </div>
          <div className="hero-investigation">
            <div className="hero-case-heading">
              <span>
                <TriangleAlert size={14} />
                DEMO INVESTIGATION
              </span>
              <Badge tone="red">SEV-1</Badge>
            </div>
            <div className="hero-case-title">
              <h2>Payment failures</h2>
              <span className="mono muted">INC-1042</span>
            </div>
            <div className="hero-propagation">
              {[
                {
                  name: 'PostgreSQL',
                  detail: 'Connection pool exhausted',
                  metric: '98%',
                  icon: Database,
                  root: true,
                },
                {
                  name: 'Payment Service',
                  detail: 'Connection acquisition timeout',
                  metric: '940 ms',
                  icon: Box,
                },
                {
                  name: 'Order Service',
                  detail: 'Upstream request failed',
                  metric: '12.3%',
                  icon: Box,
                },
                {
                  name: 'API Gateway',
                  detail: 'HTTP 500 responses',
                  metric: '8.42%',
                  icon: Network,
                },
              ].map((n, i) => (
                <div className="hero-propagation-step" key={n.name}>
                  {i > 0 && (
                    <div className="propagation-connector">
                      <ArrowDown size={13} />
                      <span>{i === 1 ? '+22 seconds' : '+3 seconds'}</span>
                    </div>
                  )}
                  <Link
                    href="/app/incidents/INC-1042"
                    className={`propagation-node ${n.root ? 'propagation-root' : ''}`}
                  >
                    <span className="propagation-icon">
                      <n.icon size={18} />
                    </span>
                    <div>
                      <strong>{n.name}</strong>
                      <small>{n.detail}</small>
                    </div>
                    <span className="mono">{n.metric}</span>
                    {n.root && <span className="propagation-root-tag">ROOT CAUSE</span>}
                  </Link>
                </div>
              ))}
            </div>
            <div className="hero-confidence">
              <span>
                <ScanLine size={17} />
                <strong>One cause. A complete explanation.</strong>
              </span>
              <strong>
                91<small>% confidence</small>
              </strong>
            </div>
          </div>
        </section>
        <section className="telemetry-strip">
          <span>CONNECT THE SIGNALS</span>
          <div>
            <Terminal size={15} />
            Logs
          </div>
          <div>
            <Activity size={15} />
            Metrics
          </div>
          <div>
            <GitBranch size={15} />
            Traces
          </div>
          <div>
            <Box size={15} />
            Deployments
          </div>
          <div>
            <Network size={15} />
            Dependencies
          </div>
        </section>
        <section className="problem-section">
          <div className="section-kicker">THE PROBLEM</div>
          <h2>
            More telemetry.
            <br />
            <span>Still too many unanswered questions.</span>
          </h2>
          <p>
            A database saturates. Payments time out. Orders fail. Your gateway raises the alarm. The
            service reporting the error is rarely where the problem started.
          </p>
          <div className="problem-callout">
            <span className="mono">500</span>
            <div>
              <strong>
                The symptom is obvious.
                <br />
                The source shouldn’t be a guessing game.
              </strong>
              <p>Move from disconnected dashboards to one evidence-backed investigation.</p>
            </div>
          </div>
        </section>
        <section id="how-it-works" className="how-section">
          <div className="section-kicker">FROM SIGNAL TO UNDERSTANDING</div>
          <h2>Less searching. More connecting.</h2>
          <div className="how-grid">
            {[
              {
                n: '01',
                icon: Radar,
                title: 'Collect the context',
                text: 'Bring logs, metrics, traces, and deployment events into one timeline. Keep the original evidence attached.',
              },
              {
                n: '02',
                icon: Network,
                title: 'Follow the dependencies',
                text: 'Group related anomalies by time and service relationships. Trace how failures move upstream.',
              },
              {
                n: '03',
                icon: ScanLine,
                title: 'Rank the evidence',
                text: 'Score possible causes using timing, anomaly strength, dependency reach, and observed propagation.',
              },
            ].map((c) => (
              <article key={c.n}>
                <div>
                  <c.icon size={24} />
                  <span>{c.n}</span>
                </div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-features">
          <article>
            <div className="section-kicker">SERVICE GRAPH</div>
            <h2>
              See the system.
              <br />
              Follow the failure.
            </h2>
            <p>
              An interactive dependency map shows healthy, degraded, and critical services together.
              Click through to latency, errors, throughput, and related investigations.
            </p>
            <Link href="/app/service-map">
              Explore the service map
              <ArrowUpRight size={15} />
            </Link>
            <div className="mini-service-chain">
              <span>
                <Database size={17} />
                Database
              </span>
              <ArrowRight size={16} />
              <span>
                <Box size={17} />
                Payments
              </span>
              <ArrowRight size={16} />
              <span>
                <Network size={17} />
                Gateway
              </span>
            </div>
          </article>
          <article>
            <div className="section-kicker">ROOT CAUSE ANALYSIS</div>
            <h2>
              A hypothesis you
              <br />
              can actually inspect.
            </h2>
            <p>
              Every candidate comes with a score, supporting events, and the factors behind the
              ranking. A deterministic engine does the analysis; evidence stays the source of truth.
            </p>
            <Link href="/app/incidents/INC-1042">
              Inspect the evidence
              <ArrowUpRight size={15} />
            </Link>
            <div className="landing-score">
              <span>PostgreSQL connection pool exhaustion</span>
              <strong>91%</strong>
              <div>
                <span />
              </div>
            </div>
          </article>
        </section>
        <section className="landing-timeline-section">
          <div>
            <div className="section-kicker">INCIDENT TIMELINE</div>
            <h2>
              Every second
              <br />
              tells part of the story.
            </h2>
            <p>
              See the first anomaly, the cascade of failures, and the moment the dots connect. Open
              any event to inspect the underlying evidence.
            </p>
            <Link href="/app/incidents/INC-1042" className="button button-secondary">
              Follow the investigation
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="landing-timeline">
            {[
              ['14:31:42', 'Database connections rise to 90%'],
              ['14:31:58', 'Connection pool reaches 98%'],
              ['14:32:04', 'Payment latency increases'],
              ['14:32:10', 'Gateway error rate spikes'],
              ['14:32:24', 'PostgreSQL ranked as likely root cause'],
            ].map(([time, text], i) => (
              <div key={time}>
                <time className="mono">{time}</time>
                <span className={`health-dot ${i === 4 ? 'health-healthy' : 'health-critical'}`} />
                <strong>{text}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="landing-architecture">
          <div>
            <div className="section-kicker">ENGINEERED TO BE EXPLAINED</div>
            <h2>No black box. Just connected evidence.</h2>
            <p>
              Explore the ingestion pipeline, storage boundaries, correlation logic, and weighted
              scoring model.
            </p>
          </div>
          <Link href="/architecture" className="button button-primary">
            Inside the architecture
            <ArrowUpRight size={15} />
          </Link>
        </section>
        <div className="tech-strip">
          <span>BUILT WITH</span>
          {[
            'Next.js',
            'TypeScript',
            'NestJS',
            'PostgreSQL',
            'Prisma',
            'Redis',
            'OpenTelemetry concepts',
          ].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <section className="landing-final">
          <span className="logo-symbol">
            <Network size={21} />
          </span>
          <h2>
            The next outage deserves
            <br />a clearer explanation.
          </h2>
          <Link href="/login" className="button button-primary">
            Start investigating
            <ArrowRight size={15} />
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
