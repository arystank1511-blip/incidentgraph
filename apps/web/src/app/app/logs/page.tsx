'use client';
import { Suspense, useState, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Search,
  Terminal,
} from 'lucide-react';
import type { LogEntry, PageResult } from '@incidentgraph/shared';
import { useBootstrap, useWorkspace, useHydrated } from '@/components/providers';
import { Badge, EmptyState, LoadingState, PageHeading, Panel } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { api, clock } from '@/lib/utils';
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Logs />
    </Suspense>
  );
}
function Logs() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const { environment } = useWorkspace();
  const { data: bootstrap } = useBootstrap();
  const [query, setQuery] = useState(params.get('q') ?? ''),
    [draft, setDraft] = useState(params.get('q') ?? ''),
    [service, setService] = useState(params.get('service') ?? 'all'),
    [level, setLevel] = useState('all'),
    [page, setPage] = useState(1),
    [expanded, setExpanded] = useState<string | null>(null);
  const search = new URLSearchParams({
    environment,
    q: query,
    service: bootstrap?.services.some((s) => s.id === service) ? service : 'all',
    level,
    page: String(page),
    pageSize: '25',
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ['logs', search.toString()],
    queryFn: () =>
      api<
        PageResult<LogEntry> & { histogram: { timestamp: string; count: number; errors: number }[] }
      >(`/logs?${search}`),
    placeholderData: keepPreviousData,
  });
  if (!hydrated) return <LoadingState />;
  return (
    <>
      <PageHeading
        title="Logs explorer"
        description="Find the event that explains everything."
        actions={
          <Badge>
            <Terminal size={12} />
            Structured telemetry
          </Badge>
        }
      />
      <form
        className="log-query"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft);
          setPage(1);
        }}
      >
        <Search size={17} />
        <input
          aria-label="Log search query"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search messages · timeout OR connection"
        />
        <kbd>↵</kbd>
        <Button variant="default" type="submit">
          Run query
        </Button>
      </form>
      <div className="filter-toolbar">
        <label className="inline-filter">
          Service
          <select
            aria-label="Log service"
            value={bootstrap?.services.some((s) => s.id === service) ? service : 'all'}
            onChange={(e) => {
              setService(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All services</option>
            {bootstrap?.services.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-filter">
          Level
          <select
            aria-label="Log level"
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setPage(1);
            }}
          >
            {['all', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map((l) => (
              <option key={l} value={l}>
                {l === 'all' ? 'All levels' : l}
              </option>
            ))}
          </select>
        </label>
        <span className="filter-count">
          <span className="live-dot" />
          {environment}
        </span>
        <span className="muted filter-count">{data?.total ?? 0} matching events</span>
      </div>
      <Panel>
        <div className="log-distribution" aria-hidden="true">
          {data?.histogram.map((bucket) => (
            <span
              key={bucket.timestamp}
              title={`${clock(bucket.timestamp)} · ${bucket.count} events`}
              style={{
                height: `${(bucket.count / Math.max(1, ...data.histogram.map((b) => b.count))) * 60}px`,
                background: bucket.errors ? 'var(--red)' : '#779b83',
              }}
            />
          ))}
        </div>
        <div className="log-distribution-labels">
          <span>14:31</span>
          <span>14:35</span>
          <span>14:40</span>
          <span>14:45</span>
          <span>14:50 UTC</span>
        </div>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <EmptyState title="Couldn’t load logs" description={error.message} />
        ) : data?.items.length ? (
          <div className="table-scroll">
            <table className="data-table logs-table">
              <thead>
                <tr>
                  <th aria-label="Expand log" />
                  <th>Timestamp (UTC)</th>
                  <th>Level</th>
                  <th>Service</th>
                  <th>Message</th>
                  <th>Trace ID</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <Fragment key={log.id}>
                    <tr className={expanded === log.id ? 'expanded-row' : ''}>
                      <td>
                        <button
                          className="log-expand"
                          aria-label={`Expand log ${log.id}`}
                          aria-expanded={expanded === log.id}
                          onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        >
                          {expanded === log.id ? (
                            <ChevronDown size={13} />
                          ) : (
                            <ChevronRight size={13} />
                          )}
                        </button>
                      </td>
                      <td className="mono muted">
                        {clock(log.timestamp)}.{log.timestamp.slice(20, 23)}
                      </td>
                      <td>
                        <Badge
                          tone={
                            log.level === 'ERROR' ? 'red' : log.level === 'WARN' ? 'amber' : 'blue'
                          }
                        >
                          {log.level}
                        </Badge>
                      </td>
                      <td className="mono">{log.serviceId}</td>
                      <td className="log-message">
                        <button onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                          {log.message}
                        </button>
                      </td>
                      <td>
                        <Link className="trace-link mono" href={`/app/traces?trace=${log.traceId}`}>
                          {log.traceId.slice(0, 10)}…<ArrowUpRight size={11} />
                        </Link>
                      </td>
                    </tr>
                    {expanded === log.id && (
                      <tr>
                        <td colSpan={6} className="log-json">
                          <div>
                            <span>STRUCTURED CONTEXT</span>
                            <Link href={`/app/traces?trace=${log.traceId}`}>
                              Open trace
                              <ArrowUpRight size={12} />
                            </Link>
                          </div>
                          <pre>
                            {JSON.stringify(
                              {
                                timestamp: log.timestamp,
                                level: log.level,
                                service: log.serviceId,
                                environment: log.environment,
                                message: log.message,
                                traceId: log.traceId,
                                ...log.context,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No logs match this query"
            description="Try a broader query, another service, or a different level."
          />
        )}
        <div className="pagination">
          <span>{data?.total ?? 0} events · showing up to 25 per page</span>
          <div>
            <Button
              size="sm"
              aria-label="Previous log page"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ArrowLeft size={13} />
            </Button>
            <span>
              Page {page} of {Math.max(1, Math.ceil((data?.total ?? 0) / 25))}
            </span>
            <Button
              size="sm"
              aria-label="Next log page"
              disabled={page * 25 >= (data?.total ?? 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              <ArrowRight size={13} />
            </Button>
          </div>
        </div>
      </Panel>
      <p className="workspace-hint">
        Query syntax: use OR between alternatives, AND between required terms. Search includes
        messages, service names, and trace IDs.
      </p>
    </>
  );
}
