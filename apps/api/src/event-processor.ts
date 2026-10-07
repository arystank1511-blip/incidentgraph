import { Inject, Injectable } from '@nestjs/common';
import type { Anomaly } from '../../../packages/shared/src';
import { IncidentService } from './incident-service';
export interface EventProcessor {
  process(events: Anomaly[]): ReturnType<IncidentService['ingest']>;
}
/** Serial admission prevents duplicate batches racing within the single API worker. */
@Injectable()
export class InProcessEventProcessor implements EventProcessor {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(@Inject(IncidentService) private readonly incidents: IncidentService) {}
  process(events: Anomaly[]) {
    const next = this.tail.then(() => this.incidents.ingest(events));
    this.tail = next.catch(() => undefined);
    return next;
  }
}
