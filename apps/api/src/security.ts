import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { config } from './config';
export class WindowLimiter {
  private readonly entries = new Map<string, { count: number; until: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly capacity = 10000,
    private readonly now = Date.now,
  ) {}
  allow(key: string) {
    const now = this.now();
    for (const [id, entry] of this.entries) if (entry.until <= now) this.entries.delete(id);
    const entry = this.entries.get(key);
    if (!entry && this.entries.size >= this.capacity) return false;
    const next = entry ?? { count: 0, until: now + this.windowMs };
    next.count++;
    this.entries.set(key, next);
    return next.count <= this.limit;
  }
}
export function securityMiddleware() {
  const reads = new WindowLimiter(600, 60000);
  const writes = new WindowLimiter(60, 60000);
  const login = new WindowLimiter(10, 15 * 60000);
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID(),
      start = Date.now();
    res.setHeader('x-request-id', requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () =>
      console.log(
        JSON.stringify({
          level: 'info',
          requestId,
          method: req.method,
          route: (req.route as { path?: string } | undefined)?.path ?? '[unmatched]',
          status: res.statusCode,
          durationMs: Date.now() - start,
        }),
      ),
    );
    const key = req.ip ?? 'unknown'; // Do not trust client-supplied forwarding headers.
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (write) {
      const origin = req.get('origin');
      if (
        (origin && origin !== config.WEB_ORIGIN) ||
        req.get('sec-fetch-site') === 'cross-site' ||
        req.get('x-incidentgraph-request') !== '1'
      ) {
        res.status(403).json({ message: 'Request origin or CSRF header is invalid' });
        return;
      }
      if (!req.is('application/json')) {
        res.status(415).json({ message: 'Use application/json requests' });
        return;
      }
    }
    if (
      !reads.allow(key) ||
      (write && !writes.allow(key)) ||
      (req.path.toLowerCase().replace(/\/+$/, '') === '/api/auth/login' && !login.allow(key))
    ) {
      res.setHeader('Retry-After', req.path.toLowerCase().includes('/auth/login') ? '900' : '60');
      res.status(429).json({ message: 'Too many requests. Try again later.' });
      return;
    }
    next();
  };
}
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const parserType = (error as { type?: string })?.type;
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : parserType === 'entity.too.large'
          ? 413
          : parserType === 'entity.parse.failed'
            ? 400
            : 500;
    const message =
      status < 500 && error instanceof HttpException
        ? error.getResponse()
        : {
            message:
              status === 413
                ? 'Request body too large'
                : status === 400
                  ? 'Invalid JSON body'
                  : 'Internal server error',
          };
    if (status >= 500)
      console.error(
        JSON.stringify({ level: 'error', requestId: res.getHeader('x-request-id'), status }),
      );
    res.status(status).json(typeof message === 'string' ? { message } : message);
  }
}
