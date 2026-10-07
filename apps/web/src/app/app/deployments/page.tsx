'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, GitBranch, Info } from 'lucide-react';
import { useBootstrap } from '@/components/providers';
import {
  Badge,
  EmptyState,
  LoadingState,
  PageHeading,
  Panel,
  Status,
} from '@/components/ui/primitives';
import { clock, dateLabel, initials } from '@/lib/utils';
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Deployments />
    </Suspense>
  );
}
function Deployments() {
  const params = useSearchParams();
  const { data, isLoading, error } = useBootstrap();
  const [service, setService] = useState(params.get('service') ?? 'all');
  if (isLoading) return <LoadingState />;
  if (error || !data)
    return <EmptyState title="Deployments unavailable" description={error?.message} />;
  const deployments = data.deployments
    .filter((d) => service === 'all' || d.serviceId === service)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return (
    <>
      <PageHeading
        title="Deployments"
        description="See what changed before the system changed."
        actions={
          <Badge>
            <GitBranch size={12} />
            Release history
          </Badge>
        }
      />
      <div className="info-banner">
        <Info size={16} />
        <span>
          A nearby deployment is a useful lead, not proof of a regression. Compare release timing
          with the first anomaly.
        </span>
      </div>
      <div className="filter-toolbar">
        <select
          aria-label="Deployment service"
          value={service}
          onChange={(e) => setService(e.target.value)}
        >
          <option value="all">All services</option>
          {data.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="muted filter-count">{deployments.length} deployments</span>
      </div>
      <Panel>
        {deployments.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Service / version</th>
                  <th>Commit</th>
                  <th>Status</th>
                  <th>Deployed at</th>
                  <th>Author</th>
                  <th>Incident correlation</th>
                  <th>Investigation</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="deployment-table-name">
                        <GitBranch size={16} />
                        <span>
                          <strong>{d.serviceId}</strong>
                          <small className="mono">{d.version}</small>
                        </span>
                      </div>
                    </td>
                    <td className="mono muted">{d.commit}</td>
                    <td>
                      <Status status={d.status} />
                    </td>
                    <td className="mono">
                      {dateLabel(d.timestamp)} · {clock(d.timestamp).slice(0, 5)}
                    </td>
                    <td>
                      <span className="avatar avatar-small" title={d.author}>
                        {initials(d.author)}
                      </span>
                    </td>
                    <td>
                      <Badge tone={d.correlation === 'Medium' ? 'amber' : 'neutral'}>
                        {d.correlation}
                      </Badge>
                    </td>
                    <td>
                      {d.correlation === 'Medium' ? (
                        <Link className="small-link" href="/app/incidents/INC-1042">
                          INC-1042
                          <ArrowUpRight size={13} />
                        </Link>
                      ) : (
                        <span className="muted">No linked incident</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No deployments found"
            description="No releases match this service and environment."
          />
        )}
      </Panel>
      {data.deployments.some((deployment) => deployment.serviceId === 'payment-service') && (
        <div className="deployment-explainer">
          <div>
            <span className="section-label">CORRELATION WINDOW</span>
            <h3>34 minutes between release and detection</h3>
            <p>
              The payment service release preceded the incident. Database saturation appeared before
              application errors, so the evidence engine ranks the database above the deployment
              hypothesis.
            </p>
          </div>
          <div className="release-time-visual">
            <div>
              <GitBranch size={17} />
              <strong>13:58</strong>
              <small>v2.4.1 deployed</small>
            </div>
            <span className="release-connector">34 minutes</span>
            <div>
              <span className="health-dot health-critical" />
              <strong>14:32</strong>
              <small>Incident detected</small>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
