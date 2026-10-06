'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, Search } from 'lucide-react';
import type { Service } from '@incidentgraph/shared';
import { useBootstrap } from '@/components/providers';
import { EmptyState, LoadingState, PageHeading, Panel } from '@/components/ui/primitives';
import { ServiceInspector } from '@/components/service-inspector';
const ServiceGraph = dynamic(() => import('@/components/service-graph'), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 550 }} />,
});
export default function MapPage() {
  const { data, isLoading, error } = useBootstrap();
  const [selected, setSelected] = useState<Service | null>(null),
    [query, setQuery] = useState(''),
    [criticalOnly, setCriticalOnly] = useState(false);
  if (isLoading) return <LoadingState />;
  if (error || !data)
    return <EmptyState title="Service map unavailable" description={error?.message} />;
  const visible = data.services.filter(
    (s) =>
      (!criticalOnly || s.status !== 'healthy') && (!query || s.name.includes(query.toLowerCase())),
  );
  return (
    <>
      <PageHeading
        title="Service map"
        description="Follow the dependencies. See where the failure begins."
        actions={
          <div className="graph-health-legend">
            {['healthy', 'degraded', 'critical'].map((s) => (
              <span key={s}>
                <span className={`health-dot health-${s}`} />
                {s}
              </span>
            ))}
          </div>
        }
      />
      <div className="filter-toolbar">
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Find service in map"
            value={query}
            placeholder="Find a service…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className={`button ${criticalOnly ? 'button-primary' : 'button-secondary'}`}
          aria-pressed={criticalOnly}
          onClick={() => setCriticalOnly((v) => !v)}
        >
          Affected services only
        </button>
        <span className="filter-count muted">
          <Box size={13} />
          {visible.length} services
        </span>
      </div>
      <Panel>
        {visible.length ? (
          <ServiceGraph
            services={visible}
            dependencies={data.dependencies}
            onSelect={setSelected}
          />
        ) : (
          <EmptyState title="No matching services" />
        )}
        <div className="graph-bottom-bar">
          <span>Click a service to inspect · Drag to pan · Use + / − to zoom</span>
          <span>Caller → dependency</span>
        </div>
      </Panel>
      <div className="map-context">
        <h3>Read the failure path</h3>
        <p>
          Dashed edges highlight the affected dependency chain. The source of the incident is often
          downstream from the services reporting errors. Inspect PostgreSQL to trace the saturation
          back through payments, orders, and the gateway.
        </p>
      </div>
      <ServiceInspector service={selected} onClose={() => setSelected(null)} />
    </>
  );
}
