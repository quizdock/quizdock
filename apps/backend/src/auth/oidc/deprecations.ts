import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';

/**
 * Ways of reading tokens kept for the installations that rely on them, until
 * 1.0: each use is logged, and remembered in Redis for `doctor`.
 */
export const AUTH_DEPRECATIONS = {
  /** The roles claim read from the access token, the ID token lacking it. */
  'roles-in-access-token':
    'Roles read from the access token: the ID token lacks OIDC_ROLES_CLAIM. Have the provider put the roles in the ID token; reading them from the access token ends in 1.0.',
  /** A Bearer token the provider vouched for neither by RFC 9068 nor by introspection. */
  'bearer-unproven':
    'A Bearer token was taken as an access token on its claims alone. Have the provider mark them (RFC 9068, `typ: at+jwt`) or give QuizDock a confidential client for introspection; the guess ends in 1.0.',
} as const;

export type AuthDeprecation = keyof typeof AUTH_DEPRECATIONS;

/** How long a use is remembered for `doctor`. */
const REMEMBER_S = 30 * 24 * 3600;
/** One log line per kind and process in this span. */
const LOG_EVERY_MS = 3600_000;

const keyOf = (kind: AuthDeprecation) => `auth:deprecated:${kind}`;

export class AuthDeprecations {
  private readonly logger = new Logger(AuthDeprecations.name);
  private readonly lastNoted = new Map<AuthDeprecation, number>();

  constructor(private readonly redis: Pick<Redis, 'set'>) {}

  /** Notes a use; the log and Redis are written once an hour at most. */
  note(kind: AuthDeprecation): void {
    const now = Date.now();
    if (now - (this.lastNoted.get(kind) ?? 0) < LOG_EVERY_MS) return;
    this.lastNoted.set(kind, now);
    this.logger.warn(AUTH_DEPRECATIONS[kind]);
    this.redis.set(keyOf(kind), new Date(now).toISOString(), 'EX', REMEMBER_S).catch(() => {});
  }
}

/** The deprecated ways used in the last 30 days, with the day of the last use. */
export async function readAuthDeprecations(
  redis: Pick<Redis, 'get'>,
): Promise<{ kind: AuthDeprecation; last: string }[]> {
  const found: { kind: AuthDeprecation; last: string }[] = [];
  for (const kind of Object.keys(AUTH_DEPRECATIONS) as AuthDeprecation[]) {
    const last = await redis.get(keyOf(kind));
    if (last) found.push({ kind, last: last.slice(0, 10) });
  }
  return found;
}
