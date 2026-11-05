import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import type { RedisService } from '../../redis/redis.service';
import { OidcGrantError, type OidcClient, randomToken, type TokenSet } from './oidc-client';

/** A signed-in browser, as kept server-side. */
interface StoredSession extends TokenSet {
  sub: string;
  /** When it ends (ms), under `OIDC_SESSION_LIFETIME_S`; without it, the idle timer rules. */
  endsAt?: number;
}

/** A sign-in on its way to the provider and back (state, nonce, PKCE verifier). */
export interface PendingLogin {
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
}

/**
 * A session unused for this long is forgotten, unless `OIDC_SESSION_LIFETIME_S` sets
 * a lifetime instead. The provider bounds both: once its refresh token is refused,
 * the session ends whatever this says.
 */
export const SESSION_IDLE_S = 24 * 3600;
/** A sign-in not completed within ten minutes is dropped. */
export const LOGIN_TTL_S = 600;
/** Renew the access token this long before it expires. */
const RENEW_BEFORE_MS = 30_000;
/** How long a refresh may hold the lock, and how long another request waits for it. */
const REFRESH_LOCK_MS = 10_000;
const REFRESH_WAIT_MS = 5_000;
/** Deletes a lock if it still holds the value its taker set. */
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

/**
 * Only a hash of the session id is stored: the cookie is the one copy of the id,
 * and a look at Redis gives nothing to present as someone's cookie.
 */
const hashOf = (sid: string): string => createHash('sha256').update(sid).digest('base64url');
const sessionKey = (sid: string) => `auth:session:${hashOf(sid)}`;
const lockKey = (sid: string) => `auth:refresh:${hashOf(sid)}`;
const loginKey = (state: string) => `auth:login:${hashOf(state)}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What a session has left in Redis: to its end when it has one, else the idle time. */
const ttlOf = (session: StoredSession): number =>
  session.endsAt ? Math.max(1, Math.ceil((session.endsAt - Date.now()) / 1000)) : SESSION_IDLE_S;

/** Reads and deletes a key in one step, on any Redis version (GETDEL needs 6.2). */
async function take(redis: RedisService, key: string): Promise<string | null> {
  const res = await redis.multi().get(key).del(key).exec();
  const value = res?.[0]?.[1];
  return typeof value === 'string' ? value : null;
}

/** The session as it is while its access token has not expired yet, else nothing. */
const stillValid = (session: StoredSession): StoredSession | null =>
  session.expiresAt > Date.now() ? session : null;

/**
 * The browser sessions of `AUTH_MODE=oidc` (Backend for Frontend): the tokens
 * stay in Redis, the browser holds a random id in an `httpOnly` cookie. Every
 * sign-in gets a fresh id (no session fixation); the access token is renewed
 * here, one request at a time per session.
 */
export class OidcSessions {
  private readonly logger = new Logger(OidcSessions.name);
  /** Seconds a sign-in lasts, and its cookie; undefined: the idle timer, a browser-session cookie. */
  readonly lifetimeS: number | undefined;

  constructor(
    private readonly redis: RedisService,
    private readonly client: OidcClient,
    lifetimeS = 0,
  ) {
    this.lifetimeS = Math.floor(lifetimeS) > 0 ? Math.floor(lifetimeS) : undefined;
  }

  async savePendingLogin(state: string, login: PendingLogin): Promise<void> {
    await this.redis.set(loginKey(state), JSON.stringify(login), 'EX', LOGIN_TTL_S);
  }

  /** Reads and forgets a pending sign-in: a state is good for one callback. */
  async takePendingLogin(state: string): Promise<PendingLogin | null> {
    const raw = await take(this.redis, loginKey(state));
    return raw ? (JSON.parse(raw) as PendingLogin) : null;
  }

  /** Opens a session for fresh tokens; returns the id to set in the cookie. */
  async create(sub: string, tokens: TokenSet): Promise<string> {
    const sid = randomToken();
    const session: StoredSession = { sub, ...tokens };
    if (this.lifetimeS) session.endsAt = Date.now() + this.lifetimeS * 1000;
    await this.redis.set(sessionKey(sid), JSON.stringify(session), 'EX', ttlOf(session));
    return sid;
  }

  async destroy(sid: string): Promise<StoredSession | null> {
    const raw = await take(this.redis, sessionKey(sid));
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  }

  private async read(sid: string): Promise<StoredSession | null> {
    const raw = await this.redis.get(sessionKey(sid));
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  }

  /**
   * The session's tokens, the access token valid and renewed when it is about
   * to expire; null when the session is unknown, or over (the provider refused
   * to renew). The idle timer restarts on every use; a session with an end keeps it.
   */
  async tokens(sid: string): Promise<TokenSet | null> {
    let session = await this.read(sid);
    if (!session) return null;
    if (session.expiresAt - Date.now() < RENEW_BEFORE_MS) {
      session = await this.renew(sid, session);
      if (!session) return null;
    }
    if (!session.endsAt) await this.redis.expire(sessionKey(sid), SESSION_IDLE_S);
    return session;
  }

  /**
   * Renews under a per-session lock: tabs share the session, and with rotating
   * refresh tokens two renewals at once would revoke each other. The request
   * that does not get the lock waits for the other's result.
   */
  private async renew(sid: string, session: StoredSession): Promise<StoredSession | null> {
    if (!session.refreshToken) {
      await this.destroy(sid);
      return null;
    }
    const owner = randomToken();
    const locked = await this.redis.set(lockKey(sid), owner, 'PX', REFRESH_LOCK_MS, 'NX');
    if (!locked) {
      const deadline = Date.now() + REFRESH_WAIT_MS;
      while (Date.now() < deadline) {
        await sleep(150);
        const current = await this.read(sid);
        if (!current) return null;
        if (current.expiresAt !== session.expiresAt) return current;
      }
      return stillValid(session);
    }
    try {
      const tokens = await this.client.refresh(session.refreshToken);
      if (tokens.idToken) await this.checkRenewedIdToken(tokens.idToken, session.sub);
      const renewed: StoredSession = {
        ...session,
        ...tokens,
        idToken: tokens.idToken ?? session.idToken,
      };
      await this.redis.set(sessionKey(sid), JSON.stringify(renewed), 'EX', ttlOf(renewed));
      return renewed;
    } catch (err) {
      if (err instanceof OidcGrantError) {
        // The provider ended the session (logout, expiry, revocation): so do we.
        await this.destroy(sid);
        return null;
      }
      // The provider is out of reach for now: the token serves until it expires.
      this.logger.warn(`Token renewal failed: ${(err as Error).message}`);
      return stillValid(session);
    } finally {
      // Only our own lock: one taken over after ours ran out belongs to another renewal.
      await this.redis.eval(RELEASE_SCRIPT, 1, lockKey(sid), owner);
    }
  }

  /**
   * A renewed ID token is validated as the first one was, and must name the
   * same user (OIDC Core §12.2); otherwise the session ends.
   */
  private async checkRenewedIdToken(idToken: string, sub: string): Promise<void> {
    let claims: JWTPayload;
    try {
      claims = await this.client.verifyIdToken(idToken, null);
    } catch (err) {
      throw new OidcGrantError(`renewed ID token rejected: ${(err as Error).message}`);
    }
    if (claims.sub !== sub) throw new OidcGrantError('renewed ID token names another user');
  }
}
