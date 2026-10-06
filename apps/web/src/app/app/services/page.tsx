'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Box, Database, Layers3, Network, Search } from 'lucide-react';
import type { Service } from '@incidentgraph/shared';
import { useBootstrap } from '@/components/providers';
import {
  Badge,
  EmptyState,
  LoadingState,
  PageHeading,
  Panel,
  Status,
} from '@/components/ui/primitives';
import { ServiceInspector } from '@/components/service-inspector';
import { Sparkline } from '@/components/metric-chart';
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Services />
    </Suspense>
  );
}
function Services() {
  const params = useSearchParams();
  const [selection, setSelection] = useState<string | null>(params.get('service'));
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState('all');
  const { data, isLoading, error } = useBootstrap();
  if (isLoading) return <LoadingState />;
  if (error || !data)
    return <EmptyState title="Unable to load services" description={error?.message} />;
  const selected = data.services.find((s) => s.id === selection) ?? null;
  const services = data.services.filter(
    (s) => (status === 'all' || s.status === status) && s.name.includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Service catalog"
        description="Every service, its health, and the dependencies behind it."
        actions={
          <Link href="/app/service-map" className="button button-secondary">
            <Network size={14} />
            View service map
          </Link>
        }
      />
      <div className="service-summary-cards">
        {['healthy', 'degraded', 'critical'].map((s) => (
          <button
            key={s}
            className={status === s ? 'selected' : ''}
            onClick={() => setStatus(status === s ? 'all' : s)}
          >
            <span className={`health-dot health-${s}`} />
            <strong>{data.services.filter((service) => service.status === s).length}</strong>
            <span>{s} services</span>
          </button>
        ))}
      </div>
      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Search services"
            placeholder="Find a service…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Service health filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All health states</option>
          <option value="healthy">Healthy</option>
          <option value="degraded">Degraded</option>
          <option value="critical">Critical</option>
        </select>
        <span className="muted filter-count">{services.length} services</span>
      </div>
      <Panel>
        {services.length ? (
          <div className="table-scroll">
            <table className="data-table service-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Status</th>
                  <th>P95 latency</th>
                  <th>Error rate</th>
                  <th>Throughput</th>
                  <th>Team</th>
                  <th>Trend</th>
                  <th aria-label="Inspect" />
                </tr>
              </thead>
              <tbody>
                {services.map((s) => {
                  const Icon =
                    s.kind === 'database' ? Database : s.kind === 'cache' ? Layers3 : Box;
                  return (
                    <tr key={s.id}>
                      <td>
                        <button className="service-name-button" onClick={() => setSelection(s.id)}>
                          <span className={`service-table-icon service-icon-${s.status}`}>
                            <Icon size={16} />
                          </span>
                          <span>
                            <strong>{s.name}</strong>
                            <small>
                              {s.kind} · {s.environment}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <Status status={s.status} />
                      </td>
                      <td className="mono">
                        {s.latency.toLocaleString()} <span className="muted">ms</span>
                      </td>
                      <td className={`mono ${s.errorRate > 1 ? 'text-red' : 'muted'}`}>
                        {s.errorRate}%
                      </td>
                      <td className="mono">
                        {s.rps.toLocaleString()} <span className="muted">req/s</span>
                      </td>
                      <td>
                        <Badge>{s.team}</Badge>
                      </td>
                      <td>
                        <Sparkline
                          tone={
                            s.status === 'critical'
                              ? 'red'
                              : s.status === 'degraded'
                                ? 'amber'
                                : 'green'
                          }
                          points={data.serviceTrends[s.id]}
                        />
                      </td>
                      <td>
                        <button
                          className="button button-ghost button-icon"
                          aria-label={`Inspect ${s.name}`}
                          onClick={() => setSelection(s.id)}
                        >
                          <ArrowUpRight size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState />
        )}
      </Panel>
      <ServiceInspector service={selected as Service | null} onClose={() => setSelection(null)} />
    </>
  );
}
