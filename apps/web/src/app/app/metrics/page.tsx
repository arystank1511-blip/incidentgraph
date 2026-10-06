'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock3 } from 'lucide-react';
import { api } from '@/lib/utils';
import { useBootstrap, useWorkspace, useHydrated } from '@/components/providers';
import { Badge, EmptyState, LoadingState, PageHeading, Panel } from '@/components/ui/primitives';
import { MetricChart, type ChartPoint } from '@/components/metric-chart';
const charts: {
  key: keyof Omit<ChartPoint, 'timestamp'>;
  title: string;
  unit: string;
  color: string;
  detail: string;
}[] = [
  {
    key: 'latency',
    title: 'Request latency',
    unit: 'ms',
    color: 'var(--amber)',
    detail: 'Request-weighted p95 across selected services',
  },
  {
    key: 'errorRate',
    title: 'Error rate',
    unit: '%',
    color: 'var(--red)',
    detail: 'Failed requests / total requests',
  },
  {
    key: 'rps',
    title: 'Throughput',
    unit: 'req/s',
    color: 'var(--green)',
    detail: 'Total requests per second',
  },
  {
    key: 'cpu',
    title: 'CPU utilization',
    unit: '%',
    color: 'var(--blue)',
    detail: 'Average across selected services',
  },
  {
    key: 'memory',
    title: 'Memory utilization',
    unit: '%',
    color: 'var(--blue)',
    detail: 'Average resident memory / allocation',
  },
  {
    key: 'connections',
    title: 'Database connections',
    unit: '%',
    color: 'var(--red)',
    detail: 'Active / available pool connections',
  },
  {
    key: 'cacheHit',
    title: 'Cache hit rate',
    unit: '%',
    color: 'var(--green)',
    detail: 'Cache hits / total cache lookups',
  },
];
export default function Metrics() {
  const hydrated = useHydrated();
  const { environment } = useWorkspace();
  const { data: bootstrap } = useBootstrap();
  const [range, setRange] = useState('1h'),
    [service, setService] = useState('all');
  const actualService = bootstrap?.services.some((s) => s.id === service) ? service : 'all';
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['metrics', environment, range, actualService],
    queryFn: () =>
      api<ChartPoint[]>(
        `/metrics?environment=${environment}&range=${range}&service=${actualService}`,
      ),
  });
  const selectedService = bootstrap?.services.find((service) => service.id === actualService);
  const applicableCharts = charts.filter(
    (chart) =>
      !selectedService ||
      (chart.key !== 'connections' && chart.key !== 'cacheHit') ||
      (chart.key === 'connections' && selectedService.kind === 'database') ||
      (chart.key === 'cacheHit' && selectedService.kind === 'cache'),
  );
  if (!hydrated) return <LoadingState />;
  return (
    <>
      <PageHeading
        title="Metrics explorer"
        description="The shape of a failure, one signal at a time."
        actions={
          <Badge>
            <Activity size={12} />
            5-minute resolution
          </Badge>
        }
      />
      <div className="filter-toolbar">
        <select
          aria-label="Metrics service"
          value={actualService}
          onChange={(e) => setService(e.target.value)}
        >
          <option value="all">All services</option>
          {bootstrap?.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="filter-count muted">
          <Clock3 size={13} />
          Time window
        </span>
        <div className="segmented-control">
          {['15m', '1h', '6h', '24h'].map((r) => (
            <button key={r} className={range === r ? 'selected' : ''} onClick={() => setRange(r)}>
              Last {r}
            </button>
          ))}
        </div>
        <span className="filter-count muted">Ending Sep 13 · 14:50 UTC</span>
      </div>
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState title="Metrics unavailable" description={error.message} />
      ) : !data.length ? (
        <EmptyState title="No metrics in this window" />
      ) : (
        <div className="metrics-grid">
          {applicableCharts.map((chart) => (
            <Panel
              key={chart.key}
              title={chart.title}
              description={chart.detail}
              action={<span className="metric-live-dot" style={{ background: chart.color }} />}
            >
              <div className="metric-large-value">
                {data.at(-1)?.[chart.key].toLocaleString()}
                <span>{chart.unit}</span>
                <small>latest sample</small>
              </div>
              <MetricChart
                data={data}
                metric={chart.key}
                color={chart.color}
                unit={chart.unit === 'req/s' ? '' : chart.unit}
                height={210}
              />
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
