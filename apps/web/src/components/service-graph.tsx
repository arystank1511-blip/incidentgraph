'use client';
import { useEffect, useMemo, useRef } from 'react';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useReactFlow,
  type NodeProps,
  type Node,
} from '@xyflow/react';
import { Box, Database, Globe, Layers3, Network } from 'lucide-react';
import type { Dependency, Service } from '@incidentgraph/shared';
import '@xyflow/react/dist/style.css';
type ServiceNode = Node<{ service: Service; root: boolean }>;
function ServiceCard({ data }: NodeProps<ServiceNode>) {
  const { service: s, root } = data;
  const Icon =
    s.kind === 'database'
      ? Database
      : s.kind === 'cache'
        ? Layers3
        : s.kind === 'external'
          ? Globe
          : s.name === 'api-gateway'
            ? Network
            : Box;
  return (
    <div className={`graph-node graph-node-${s.status} ${root ? 'graph-root' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="graph-node-top">
        <span className="graph-node-icon">
          <Icon size={17} />
        </span>
        <strong>{s.name}</strong>
        <span className={`health-dot health-${s.status}`} />
      </div>
      <div className="graph-node-meta">
        <span>
          {s.latency.toLocaleString()} <small>ms</small>
        </span>
        <span className={s.status === 'critical' ? 'text-red' : ''}>
          {s.errorRate}% <small>errors</small>
        </span>
      </div>
      {root && <span className="graph-root-label">PROBABLE ROOT CAUSE</span>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { service: ServiceCard };
function FitToContainer({
  container,
  signature,
}: {
  container: React.RefObject<HTMLDivElement | null>;
  signature: string;
}) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const target = container.current;
    if (!target) return;
    const observer = new ResizeObserver(() => {
      void fitView({ padding: 0.1, duration: 0 });
    });
    observer.observe(target);
    void fitView({ padding: 0.1, duration: 0 });
    return () => observer.disconnect();
  }, [container, fitView, signature]);
  return null;
}
export function ServiceGraph({
  services,
  dependencies,
  onSelect,
  compact = false,
}: {
  services: Service[];
  dependencies: Dependency[];
  onSelect?: (service: Service) => void;
  compact?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const nodes = useMemo(() => {
    const layout: Record<string, [number, number]> = {
      'web-app': [0, 135],
      'api-gateway': [240, 135],
      'auth-service': [480, -35],
      'user-service': [480, 305],
      'order-service': [480, 135],
      'payment-service': [735, 45],
      'inventory-service': [735, 240],
      redis: [735, -145],
      'postgres-main': [990, 45],
      'notification-service': [990, 240],
      'payment-provider': [990, -145],
    };
    const selected =
      compact && services.length > 5
        ? services.filter((s) =>
            ['api-gateway', 'order-service', 'payment-service', 'postgres-main', 'redis'].includes(
              s.name,
            ),
          )
        : services;
    return selected.map((s, i) => ({
      id: s.id,
      type: 'service',
      position: compact
        ? ({
            'api-gateway': { x: 0, y: 85 },
            'order-service': { x: 240, y: 85 },
            'payment-service': { x: 480, y: 0 },
            'postgres-main': { x: 720, y: 0 },
            redis: { x: 480, y: 170 },
          }[s.name] ?? { x: i * 220, y: 0 })
        : { x: layout[s.name]?.[0] ?? i * 230, y: layout[s.name]?.[1] ?? 0 },
      data: { service: s, root: s.name === 'postgres-main' && s.status === 'critical' },
    }));
  }, [services, compact]);
  const edges = useMemo(
    () =>
      dependencies
        .filter((d) => nodes.some((n) => n.id === d.source) && nodes.some((n) => n.id === d.target))
        .map((d) => {
          const critical = ['payment-service', 'postgres-main', 'order-service'].some(
            (n) => d.target === n,
          );
          return {
            id: `${d.source}-${d.target}`,
            source: d.source,
            target: d.target,
            type: 'smoothstep',
            animated: false,
            style: {
              stroke: critical ? '#b56762' : '#4c5553',
              strokeWidth: 1.5,
              strokeDasharray: critical ? '5 4' : undefined,
            },
          };
        }),
    [dependencies, nodes],
  );
  return (
    <div ref={container} className={`service-graph ${compact ? 'graph-compact' : ''}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={1.5}
        onNodeClick={(_, node) => onSelect?.(node.data.service)}
        nodesDraggable={!compact}
        nodesConnectable={false}
        zoomOnScroll={false}
        panOnDrag={!compact}
        aria-label="Service dependency graph. Arrows follow caller to dependency."
      >
        <FitToContainer container={container} signature={nodes.map((node) => node.id).join(',')} />
        <Background color="#343b39" gap={22} size={1} />
        {!compact && <Controls showInteractive={false} />}
      </ReactFlow>
      {compact && (
        <div className="graph-caption">
          <span className="legend-line" /> Failure propagation{' '}
          <span className="muted">· caller → dependency</span>
        </div>
      )}
    </div>
  );
}
export default ServiceGraph;
