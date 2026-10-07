'use client';
import { useState } from 'react';
import { ArrowRight, Check, FlaskConical, Info, Sparkles, Terminal } from 'lucide-react';
import type { Analysis } from '@incidentgraph/shared';
import { Badge, EmptyState, Panel } from './ui/primitives';
export function RootCausePanel({ analysis }: { analysis: Analysis }) {
  const [expanded, setExpanded] = useState(false);
  const best = analysis.candidates[0];
  return (
    <Panel
      className="root-cause-panel"
      title="Root cause analysis"
      action={
        <Badge tone="green">
          <Sparkles size={11} />
          Evidence engine
        </Badge>
      }
    >
      {best ? (
        <>
          <div className="root-cause-body">
            <div className="section-label">MOST LIKELY ROOT CAUSE</div>
            <h3>{best.title}</h3>
            <div className="root-confidence">
              <strong>
                {Math.round(best.score * 100)}
                <small>%</small>
              </strong>
              <div>
                <span>Confidence score</span>
                <small>Based on {best.evidence.length} supporting signals</small>
              </div>
              <span className="confidence-ring">
                <Check size={21} />
              </span>
            </div>
            <div className="confidence-track">
              <span style={{ width: `${best.score * 100}%` }} />
            </div>
            <h4>Supporting evidence</h4>
            <ol className="evidence-list">
              {best.evidence.map((e, i) => (
                <li key={e}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <p>{e}</p>
                </li>
              ))}
            </ol>
            <div className="recommendation">
              <div>
                <Terminal size={14} />
                <strong>Recommended next step</strong>
              </div>
              <p>{analysis.recommendation}</p>
            </div>
            <button
              className="method-toggle"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              <FlaskConical size={13} />
              How this score was calculated
              <ArrowRight size={12} />
            </button>
            {expanded && (
              <div className="scoring-breakdown">
                {Object.entries(best.factors).map(([key, value]) => (
                  <div key={key}>
                    <span>{key}</span>
                    <strong>{Math.round(value * 100)}%</strong>
                  </div>
                ))}
                <p>
                  30% temporal + 25% dependency + 25% anomaly + 20% propagation, multiplied by 0.91
                  for incomplete evidence coverage. Scores are not calibrated probabilities.
                </p>
              </div>
            )}
          </div>
          <div className="alternative-hypotheses">
            <h4>Other ranked candidates</h4>
            {analysis.candidates.slice(1).map((c) => (
              <div key={c.serviceId}>
                <span>{c.serviceId}</span>
                <strong>{Math.round(c.score * 100)}%</strong>
              </div>
            ))}
            {analysis.candidates.length === 1 && (
              <p className="muted">No other services have sufficient anomaly evidence.</p>
            )}
          </div>
          <div className="analysis-footnote">
            <Info size={12} />
            <span>Correlation is a starting point. Verify before mitigating.</span>
          </div>
        </>
      ) : (
        <EmptyState
          title="Awaiting evidence"
          description="Ingest anomalies from affected services to calculate candidate scores."
        />
      )}
    </Panel>
  );
}
