'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useId } from 'react';
export interface ChartPoint {
  timestamp: string;
  latency: number;
  errorRate: number;
  rps: number;
  cpu: number;
  memory: number;
  connections: number;
  cacheHit: number;
}
export function MetricChart({
  data,
  metric = 'errorRate',
  color = 'var(--red)',
  height = 180,
  unit = '%',
  compact = false,
}: {
  data: ChartPoint[];
  metric?: keyof Omit<ChartPoint, 'timestamp'>;
  color?: string;
  height?: number;
  unit?: string;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <div
      className="chart-container"
      style={{ height }}
      role="img"
      aria-label={`${metric} over time. Latest value ${data.at(-1)?.[metric] ?? 0}${unit}.`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 0, left: compact ? -26 : -18 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.17} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 4" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) => String(v).slice(11, 16)}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={50}
          />
          <YAxis
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickFormatter={(v) => `${v}${unit === 'ms' ? '' : unit}`}
            axisLine={false}
            tickLine={false}
            tickCount={4}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelFormatter={(label) => `${String(label).slice(11, 19)} UTC`}
            formatter={(value) => [
              `${Number(value).toLocaleString()} ${unit}`,
              metric.replace(/([A-Z])/g, ' $1'),
            ]}
          />
          {data.length > 6 && (
            <ReferenceLine
              x={data.find((p) => p.timestamp.slice(11, 16) >= '14:30')?.timestamp}
              stroke="var(--red)"
              strokeDasharray="3 4"
            />
          )}
          <Area
            type="monotone"
            dataKey={metric}
            stroke={color}
            strokeWidth={1.8}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 3, stroke: 'var(--surface)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Sparkline({ tone = 'green', points }: { tone?: string; points?: number[] }) {
  return (
    <svg className={`sparkline text-${tone}`} viewBox="0 0 80 34" fill="none" aria-hidden="true">
      <path
        d={
          points?.length
            ? points
                .map(
                  (v, i) =>
                    `${i ? 'L' : 'M'}${(i * 78) / Math.max(1, points.length - 1)} ${30 - ((v - Math.min(...points)) * 26) / Math.max(1, Math.max(...points) - Math.min(...points))}`,
                )
                .join(' ')
            : 'M0 28L78 28'
        }
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
