'use client';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import type { Incident } from '@incidentgraph/shared';
import { durationMinutes } from '@incidentgraph/shared';
import { dateLabel, initials } from '@/lib/utils';
import { Badge, EmptyState, SeverityBadge, Status } from './ui/primitives';
export function IncidentTable({
  incidents,
  now,
  compact = false,
}: {
  incidents: Incident[];
  now: string;
  compact?: boolean;
}) {
  if (!incidents.length)
    return (
      <EmptyState
        title="No incidents in this view"
        description="Your services are clear, or no incidents match these filters."
      />
    );
  return (
    <div className="table-scroll">
      <table className={`data-table incident-table ${compact ? 'compact-table' : ''}`}>
        <thead>
          <tr>
            <th>Incident</th>
            <th>Severity</th>
            <th>Status</th>
            {!compact && <th>Affected services</th>}
            <th>Duration</th>
            <th>Owner</th>
            <th aria-label="Open incident" />
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i.id}>
              <td>
                <Link className="incident-title-link" href={`/app/incidents/${i.id}`}>
                  <span
                    className={`incident-state-line ${i.status === 'Resolved' ? 'state-resolved' : i.severity === 'SEV-1' ? 'state-critical' : 'state-warning'}`}
                  />
                  <span>
                    <strong>{i.title}</strong>
                    <small>
                      <span className="mono">{i.id}</span>
                      <span>·</span>
                      {compact ? dateLabel(i.startedAt) : i.rootCause}
                    </small>
                  </span>
                </Link>
              </td>
              <td>
                <SeverityBadge severity={i.severity} />
              </td>
              <td>
                <Status status={i.status} />
              </td>
              {!compact && (
                <td>
                  <div className="chip-row">
                    <Badge>{i.serviceIds[0]}</Badge>
                    {i.serviceIds.length > 1 && (
                      <span className="muted">+{i.serviceIds.length - 1}</span>
                    )}
                  </div>
                </td>
              )}
              <td className="mono muted">{durationMinutes(i, now)}m</td>
              <td>
                <span className="avatar avatar-small" title={i.owner}>
                  {initials(i.owner)}
                </span>
              </td>
              <td>
                <Link
                  href={`/app/incidents/${i.id}`}
                  className="table-row-link"
                  aria-label={`Investigate ${i.title}`}
                >
                  {compact ? <ArrowUpRight size={15} /> : <ChevronRight size={15} />}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
