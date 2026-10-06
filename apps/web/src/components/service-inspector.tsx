'use client';
import Link from 'next/link';
import type { Service } from '@incidentgraph/shared';
import { Box, ExternalLink } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Badge, Status } from './ui/primitives';
import { useBootstrap } from './providers';
export function ServiceInspector({
  service,
  onClose,
}: {
  service: Service | null;
  onClose: () => void;
}) {
  const { data } = useBootstrap();
  return (
    <Dialog
      open={!!service}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={service?.name ?? 'Service details'}
      description={`${service?.team ?? ''} · ${service?.environment ?? ''}`}
    >
      {service && (
        <div className="service-inspector">
          <Status status={service.status} />
          <div className="inspector-stats">
            <div>
              <small>P95 LATENCY</small>
              <strong>
                {service.latency} <span>ms</span>
              </strong>
            </div>
            <div>
              <small>THROUGHPUT</small>
              <strong>
                {service.rps} <span>req/s</span>
              </strong>
            </div>
            <div>
              <small>ERROR RATE</small>
              <strong className={service.errorRate > 1 ? 'text-red' : ''}>
                {service.errorRate}%
              </strong>
            </div>
          </div>
          <h3>Dependencies</h3>
          <div className="chip-row">
            {data?.dependencies
              .filter((d) => d.source === service.id)
              .map((d) => (
                <Badge key={d.target}>
                  <Box size={12} />
                  {d.target}
                </Badge>
              ))}
            {!data?.dependencies.some((d) => d.source === service.id) && (
              <p className="muted">No downstream dependencies.</p>
            )}
          </div>
          <h3>Current alerts</h3>
          <p className="inspector-alert">
            {service.status === 'critical'
              ? 'Error budget burn rate exceeded. Check saturated resources and upstream timeouts.'
              : service.status === 'degraded'
                ? 'Latency is above the service baseline. Monitor upstream propagation.'
                : 'No active alerts. All thresholds are within baseline.'}
          </p>
          <h3>Recent incidents</h3>
          {data?.incidents
            .filter((i) => i.serviceIds.includes(service.id))
            .slice(0, 4)
            .map((i) => (
              <Link
                className="inspector-link"
                key={i.id}
                href={`/app/incidents/${i.id}`}
                onClick={onClose}
              >
                <span>{i.title}</span>
                <Status status={i.status} />
              </Link>
            ))}
          <Link
            className="button button-secondary"
            href={`/app/logs?service=${service.id}`}
            onClick={onClose}
          >
            Explore service logs
            <ExternalLink size={14} />
          </Link>
        </div>
      )}
    </Dialog>
  );
}
