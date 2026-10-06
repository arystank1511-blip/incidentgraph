import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from './config';
/** Optional short-lived read cache. Failure falls through to the authoritative repository. */
@Injectable()
export class ReadCache implements OnModuleDestroy {
  private readonly redis = config.REDIS_URL
    ? new Redis(config.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        retryStrategy: () => null,
      })
    : null;
  constructor() {
    this.redis?.on('error', () => undefined);
  }
  async remember<T>(key: string, read: () => Promise<T> | T): Promise<T> {
    if (this.redis) {
      try {
        const cached = await this.redis.get(`incidentgraph:v1:${key}`);
        if (cached) return JSON.parse(cached) as T;
      } catch {
        /* Cache unavailability must not stop investigations. */
      }
    }
    const value = await read();
    if (this.redis) {
      try {
        await this.redis.set(`incidentgraph:v1:${key}`, JSON.stringify(value), 'EX', 15);
      } catch {
        /* Repository result is still usable. */
      }
    }
    return value;
  }
  async onModuleDestroy() {
    this.redis?.disconnect();
  }
}
