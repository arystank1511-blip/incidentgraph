'use client';
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ListFilter, Search, X } from 'lucide-react';
import type { Incident, PageResult } from '@incidentgraph/shared';
import { useBootstrap, useWorkspace, useHydrated } from '@/components/providers';
import { IncidentTable } from '@/components/incident-table';
import { CreateIncidentButton } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState, PageHeading, Panel } from '@/components/ui/primitives';
import { api } from '@/lib/utils';
export default function Incidents() {
  const hydrated = useHydrated();
  const { environment } = useWorkspace();
  const { data: bootstrap } = useBootstrap();
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState(''),
    [severity, setSeverity] = useState(''),
    [service, setService] = useState('all'),
    [date, setDate] = useState('all'),
    [page, setPage] = useState(1);
  const params = new URLSearchParams({
    environment,
    q: query,
    service,
    page: String(page),
    pageSize: '10',
  });
  if (status) params.set('status', status);
  if (severity) params.set('severity', severity);
  if (date === 'today') params.set('from', '2026-09-13T00:00:00.000Z');
  const { data, isLoading, error } = useQuery({
    queryKey: ['incidents', params.toString()],
    queryFn: () => api<PageResult<Incident>>(`/incidents?${params}`),
    placeholderData: keepPreviousData,
  });
  const reset = () => {
    setQuery('');
    setStatus('');
    setSeverity('');
    setService('all');
    setDate('all');
    setPage(1);
  };
  if (!hydrated) return <LoadingState />;
  return (
    <>
      <PageHeading
        title="Incidents"
        description="From the first signal to a confident resolution."
        actions={<CreateIncidentButton />}
      />
      <div className="view-tabs">
        <button
          className={!status ? 'selected' : ''}
          onClick={() => {
            setStatus('');
            setPage(1);
          }}
        >
          All incidents <span>{bootstrap?.incidents.length ?? 0}</span>
        </button>
        <button
          className={status === 'Investigating' ? 'selected' : ''}
          onClick={() => {
            setStatus('Investigating');
            setPage(1);
          }}
        >
          Investigating
          <span>
            {bootstrap?.incidents.filter((i) => i.status === 'Investigating').length ?? 0}
          </span>
        </button>
        <button
          className={status === 'Monitoring' ? 'selected' : ''}
          onClick={() => {
            setStatus('Monitoring');
            setPage(1);
          }}
        >
          Monitoring
        </button>
        <button
          className={status === 'Resolved' ? 'selected' : ''}
          onClick={() => {
            setStatus('Resolved');
            setPage(1);
          }}
        >
          Resolved
        </button>
      </div>
      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Search incidents"
            placeholder="Search incidents, IDs, or root causes…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <ListFilter size={15} className="muted" />
        <select
          aria-label="Filter severity"
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All severities</option>
          {['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Filter status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All states</option>
          {['Investigating', 'Identified', 'Monitoring', 'Resolved'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Filter service"
          value={service}
          onChange={(e) => {
            setService(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All services</option>
          {bootstrap?.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter incident date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Last 7 days</option>
          <option value="today">Sep 13</option>
        </select>
        {(query || severity || status || service !== 'all' || date !== 'all') && (
          <Button variant="ghost" size="icon" aria-label="Clear incident filters" onClick={reset}>
            <X size={16} />
          </Button>
        )}
      </div>
      <Panel>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <EmptyState title="Couldn’t load incidents" description={error.message} />
        ) : (
          <IncidentTable
            incidents={data?.items ?? []}
            now={bootstrap?.demoTime ?? new Date().toISOString()}
          />
        )}
        <div className="pagination">
          <span>
            {data?.total ?? 0} incidents <span className="muted">· {environment}</span>
          </span>
          <div>
            <Button
              size="sm"
              aria-label="Previous incident page"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ArrowLeft size={13} />
            </Button>
            <span>
              Page {page} of {Math.max(1, Math.ceil((data?.total ?? 0) / 10))}
            </span>
            <Button
              size="sm"
              aria-label="Next incident page"
              disabled={page * 10 >= (data?.total ?? 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              <ArrowRight size={13} />
            </Button>
          </div>
        </div>
      </Panel>
      <p className="workspace-hint">
        Root cause scores rank observed evidence. Validate the hypothesis before applying a fix.
      </p>
    </>
  );
}
