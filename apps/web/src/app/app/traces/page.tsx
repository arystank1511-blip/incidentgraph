'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowUpRight,
  AudioLines,
  ChevronRight,
  Clock3,
  Search,
  TriangleAlert,
} from 'lucide-react';
import type { Span } from '@incidentgraph/shared';
import { useBootstrap } from '@/components/providers';
import {
  Badge,
  EmptyState,
  LoadingState,
  PageHeading,
  Panel,
  Status,
} from '@/components/ui/primitives';
import { clock } from '@/lib/utils';
import { Dialog } from '@/components/ui/dialog';
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Traces />
    </Suspense>
  );
}
function Traces() {
  const params = useSearchParams();
  const { data, isLoading, error } = useBootstrap();
  const [traceId, setTraceId] = useState(params.get('trace') ?? ''),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState('all'),
    [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  if (isLoading) return <LoadingState />;
  if (error || !data) return <EmptyState title="Traces unavailable" description={error?.message} />;
  const filtered = data.traces.filter(
    (t) =>
      (status === 'all' || t.status === status) &&
      `${t.id} ${t.operation}`.toLowerCase().includes(query.toLowerCase()),
  );
  const trace = filtered.find((t) => t.id === traceId) ?? filtered[0];
  const slowest = trace?.spans.reduce(
    (slow, s) => (s.duration > slow.duration ? s : slow),
    trace.spans[0],
  );
  return (
    <>
      <PageHeading
        title="Distributed traces"
        description="One request. Every service it touched."
        actions={
          <Badge>
            <AudioLines size={12} />
            {data.traces.length} sampled traces
          </Badge>
        }
      />
      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Search traces"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trace ID or operation…"
          />
        </label>
        <select
          aria-label="Trace status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="error">Error</option>
          <option value="ok">Success</option>
        </select>
      </div>
      {trace ? (
        <div className="trace-explorer">
          <Panel className="trace-list-panel" title="Recent traces">
            <div className="trace-list">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  className={trace.id === t.id ? 'selected' : ''}
                  onClick={() => setTraceId(t.id)}
                >
                  <div>
                    <span
                      className={`health-dot ${t.status === 'error' ? 'health-critical' : 'health-healthy'}`}
                    />
                    <strong>{t.operation}</strong>
                    <ChevronRight size={12} />
                  </div>
                  <span>
                    <span className="mono">{t.id.slice(0, 12)}…</span>
                    <time>{clock(t.timestamp)}</time>
                  </span>
                  <span>
                    <Badge tone={t.status === 'error' ? 'red' : 'green'}>
                      {t.status === 'error' ? '500' : '200'}
                    </Badge>
                    <strong>{t.duration.toLocaleString()} ms</strong>
                  </span>
                </button>
              ))}
            </div>
          </Panel>
          <div className="trace-detail">
            <Panel
              title={trace.operation}
              description={`Trace ${trace.id}`}
              action={<Status status={trace.status} />}
            >
              <div className="trace-summary">
                <span>
                  <Clock3 size={14} />
                  <strong>{trace.duration.toLocaleString()} ms</strong>duration
                </span>
                <span>
                  <AudioLines size={14} />
                  <strong>{trace.spans.length}</strong>spans
                </span>
                <span>{clock(trace.timestamp)} UTC</span>
              </div>
              <div className="waterfall-scroll">
                <div className="waterfall">
                  <div className="waterfall-axis">
                    <span>Service / operation</span>
                    <div>
                      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                        <span key={f}>{Math.round(trace.duration * f)} ms</span>
                      ))}
                    </div>
                  </div>
                  {trace.spans.map((span, i) => (
                    <button
                      key={span.id}
                      className={`waterfall-row ${slowest?.id === span.id ? 'slowest-span' : ''}`}
                      onClick={() => setSelectedSpan(span)}
                    >
                      <div style={{ paddingLeft: 12 + i * 14 }}>
                        <span
                          className={`health-dot ${span.status === 'error' ? 'health-critical' : 'health-healthy'}`}
                        />
                        <span>
                          <strong>{span.serviceId}</strong>
                          <small>{span.operation}</small>
                        </span>
                      </div>
                      <div className="waterfall-lane">
                        <span
                          className={`waterfall-bar bar-${i}`}
                          style={{
                            left: `${(span.startMs / trace.duration) * 100}%`,
                            width: `${(span.duration / trace.duration) * 100}%`,
                          }}
                        >
                          {span.duration} ms
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="waterfall-legend">
                <span className="legend-line" />
                Outlined span has the longest total duration. Nested spans include child time.
              </div>
            </Panel>
            <Panel
              title="Critical path insight"
              action={<TriangleAlert size={15} className="text-amber" />}
            >
              <div className="trace-insight">
                <h3>Most time is spent waiting for a database connection</h3>
                <p>
                  PostgreSQL accounts for{' '}
                  {Math.round(
                    ((trace.spans.find((s) => s.serviceId === 'postgres-main')?.duration ?? 0) /
                      trace.duration) *
                      100,
                  )}
                  % of total request duration. The payment and order spans include this wait, which
                  propagates to the gateway.
                </p>
                <Link href="/app/incidents/INC-1042">
                  Open related investigation
                  <ArrowUpRight size={13} />
                </Link>
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No matching traces"
          description="Try another trace ID, status, or environment."
        />
      )}
      <Dialog
        open={!!selectedSpan}
        onOpenChange={(open) => {
          if (!open) setSelectedSpan(null);
        }}
        title={selectedSpan?.operation ?? 'Span details'}
        description={selectedSpan?.serviceId}
      >
        {selectedSpan && (
          <div className="event-detail">
            <Status status={selectedSpan.status} />
            <div className="evidence-metric">
              <span>Start offset</span>
              <strong>{selectedSpan.startMs} ms</strong>
            </div>
            <div className="evidence-metric">
              <span>Duration</span>
              <strong>{selectedSpan.duration} ms</strong>
            </div>
            <pre className="json-block">{JSON.stringify(selectedSpan.attributes, null, 2)}</pre>
            <Link className="button button-secondary" href={`/app/logs?q=${trace?.id}`}>
              View correlated logs
              <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
      </Dialog>
    </>
  );
}
