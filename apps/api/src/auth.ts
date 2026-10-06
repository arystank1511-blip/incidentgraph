import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash, randomBytes } from 'node:crypto';
import type { Request } from 'express';
const publicRoute = 'incidentgraph:public';
export const Public = () => SetMetadata(publicRoute, true);
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export class SessionStore {
  private readonly sessions = new Map<string, number>();
  constructor(
    private readonly now = Date.now,
    private readonly ttl = 8 * 60 * 60 * 1000,
    private readonly capacity = 1000,
  ) {}
  issue() {
    for (const [id, expires] of this.sessions) if (expires <= this.now()) this.sessions.delete(id);
    if (this.sessions.size >= this.capacity)
      this.sessions.delete(this.sessions.keys().next().value!);
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(hash(token), this.now() + this.ttl);
    return token;
  }
  valid(token: unknown) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
    const id = hash(token),
      expires = this.sessions.get(id);
    if (!expires || expires <= this.now()) {
      this.sessions.delete(id);
      return false;
    }
    return true;
  }
  revoke(token: unknown) {
    if (typeof token === 'string') this.sessions.delete(hash(token));
  }
}
// Single-worker MVP: restarting the API invalidates sessions, failing closed.
const sessions = new SessionStore();
export const issueSession = () => sessions.issue();
export const validSession = (token: unknown) => sessions.valid(token);
export const revokeSession = (token: unknown) => sessions.revoke(token);
@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (
      new Reflector().getAllAndOverride<boolean>(publicRoute, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (!validSession((req.cookies as Record<string, unknown> | undefined)?.ig_session))
      throw new UnauthorizedException('Sign in to access this workspace.');
    return true;
  }
}
