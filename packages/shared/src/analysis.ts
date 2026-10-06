import type { Analysis, Anomaly, Candidate, Dependency, Service } from './index';

function compareAnomalies(a: Anomaly, b: Anomaly): number {
  return Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id);
}

// Edges point from a caller to its dependency. A failure propagates in reverse.
export function upstreamDistances(root: string, edges: Dependency[]): Map<string, number> {
  const distances = new Map<string, number>([[root, 0]]);
  const queue = [root];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.target === current && !distances.has(edge.source)) {
        distances.set(edge.source, distances.get(current)! + 1);
        queue.push(edge.source);
      }
    }
  }
  return distances;
}
function connected(a: string, b: string, edges: Dependency[]): boolean {
  return a === b || upstreamDistances(a, edges).has(b) || upstreamDistances(b, edges).has(a);
}

/** Connected components with a bounded total window prevent endless incident chaining. */
export function correlateAnomalies(
  events: Anomaly[],
  edges: Dependency[],
  windowMs = 120_000,
): Anomaly[][] {
  const sorted = [...new Map(events.map((e) => [e.id, e])).values()]
    .filter((e) => e.magnitude >= 0.3)
    .sort(compareAnomalies);
  const groups: Anomaly[][] = [];
  for (const event of sorted) {
    const matches = groups.filter(
      (g) =>
        g[0].environment === event.environment &&
        Date.parse(event.timestamp) - Date.parse(g[0].timestamp) <= windowMs &&
        g.some((e) => connected(e.serviceId, event.serviceId, edges)),
    );
    if (!matches.length) groups.push([event]);
    else {
      const merged = [...matches.flat(), event].sort(compareAnomalies);
      for (const g of matches) groups.splice(groups.indexOf(g), 1);
      groups.push(merged);
    }
  }
  return groups;
}

/** Scores are evidence rankings, not calibrated probabilities or proof of causality. */
export function analyzeRootCause(
  events: Anomaly[],
  edges: Dependency[],
  services: Service[],
  calculatedAt: string,
): Analysis {
  const sorted = [...events].sort(compareAnomalies);
  const first = sorted.length ? Date.parse(sorted[0].timestamp) : 0;
  const affected = [...new Set(sorted.map((e) => e.serviceId))];
  const firstAnomaly = new Map<string, Anomaly>();
  for (const event of sorted) {
    if (!firstAnomaly.has(event.serviceId)) firstAnomaly.set(event.serviceId, event);
  }
  const candidates: Candidate[] = affected
    .map((serviceId) => {
      const own = sorted.filter((e) => e.serviceId === serviceId);
      const onset = Date.parse(own[0].timestamp);
      const upstream = upstreamDistances(
        serviceId,
        edges.filter((e) => affected.includes(e.source) && affected.includes(e.target)),
      );
      const reachable = affected.filter((id) => id !== serviceId && upstream.has(id));
      // Propagation requires the service to degrade later for the first time.
      // A repeated symptom must not reverse the observed causal ordering.
      const following = reachable.filter(
        (id) => Date.parse(firstAnomaly.get(id)!.timestamp) > onset,
      );
      const factors = {
        temporal: Math.max(0, 1 - (onset - first) / 120000),
        dependency: reachable.length / Math.max(1, affected.length - 1),
        anomaly: Math.max(...own.map((e) => e.magnitude)),
        propagation: following.length / Math.max(1, affected.length - 1),
      };
      // A 0.91 evidence coverage multiplier encodes unobserved infrastructure and sampling.
      const score =
        Math.round(
          Math.min(
            0.99,
            (factors.temporal * 0.3 +
              factors.dependency * 0.25 +
              factors.anomaly * 0.25 +
              factors.propagation * 0.2) *
              0.91,
          ) * 100,
        ) / 100;
      const service = services.find((s) => s.id === serviceId);
      const title =
        service?.kind === 'database'
          ? 'PostgreSQL connection pool exhaustion'
          : service?.kind === 'cache'
            ? 'Redis saturation'
            : `${service?.name ?? serviceId} degradation`;
      const evidence = [
        ...own.map((e) => `${e.timestamp.slice(11, 19)} · ${e.description}`),
        ...following.map((id) => {
          const e = firstAnomaly.get(id)!;
          return `${services.find((s) => s.id === id)?.name ?? id} degraded ${Math.round((Date.parse(e.timestamp) - onset) / 1000)}s later (${upstream.get(id)} dependency hops).`;
        }),
      ];
      return {
        serviceId,
        title,
        score,
        evidence,
        explanation: `${following.length} upstream services degraded after this anomaly. Ranked using event order, dependency reach, anomaly magnitude, and observed propagation.`,
        factors,
      };
    })
    .sort((a, b) => b.score - a.score || a.serviceId.localeCompare(b.serviceId));
  const root = services.find((s) => s.id === candidates[0]?.serviceId);
  return {
    candidates,
    recommendation:
      root?.kind === 'database'
        ? 'Inspect long-running queries and temporarily increase pool capacity. Validate connection recovery before resolving.'
        : root?.kind === 'cache'
          ? 'Inspect slow commands, memory pressure, and eviction policy. Verify cache latency before restoring traffic.'
          : 'Compare recent changes with the first anomaly. Validate the affected dependency before rolling back.',
    calculatedAt,
    methodVersion: 'weighted-evidence-v1',
  };
}
