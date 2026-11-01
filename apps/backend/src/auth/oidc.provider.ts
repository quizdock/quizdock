import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { decodeJwt, type JWTPayload } from 'jose';
import type { AuthPrincipal, AuthProvider } from './auth-provider';
import type { AuthDeprecations } from './oidc/deprecations';
import { looksLikeIdToken, type OidcClient } from './oidc/oidc-client';
import type { OidcSessions } from './oidc/oidc-sessions';
import { readOurCookie, SESSION_COOKIE } from './oidc/session-cookie';
import { SETTINGS } from '@quiz-dock/contracts';
import { settings } from '../admin/settings/settings.service';

/** Reads a value by dotted path (`resource_access.app.roles`). */
function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * `AUTH_MODE=oidc`: resolves the identity from the tokens of **any OpenID Connect
 * provider**. Nothing here is provider-specific: everything comes from the
 * standards plus environment variables (see `oidcSettings`, and
 * `OIDC_ROLES_CLAIM` / `OIDC_NAME_CLAIM` below).
 *
 * Two ways in:
 * - the browser's **session cookie** (Backend for Frontend), QuizDock being the
 *   client: the tokens came from the token endpoint and stay server-side, in
 *   `OidcSessions`. The identity is the ID token's (OIDC Core §2), validated
 *   when it was received;
 * - a `Bearer` access token, for a client that is not a browser, QuizDock being
 *   the resource server: see `OidcClient.verifyBearer`.
 *
 * - `OIDC_ROLES_CLAIM` (optional): dotted path of the roles array claim. Default
 *   `roles`; adapt to your provider (`groups`, …).
 * - `OIDC_NAME_CLAIM` (optional): dotted path of the display-name claim, symmetric
 *   with the roles one. Unset, the standard fallback chain below applies.
 *
 * Standard claims used: `sub` (identity), `preferred_username` / `name` / `email`
 * (display), and the roles claim above.
 *
 * Deprecated until 1.0 (`AuthDeprecations`): roles read from the access token
 * when the ID token lacks them, and a `Bearer` token the provider vouched for
 * neither way, judged on its claims.
 */
@Injectable()
export class OidcProvider implements AuthProvider {
  private readonly logger = new Logger(OidcProvider.name);
  private readonly rolesClaim: string;

  constructor(
    private readonly client: OidcClient,
    private readonly sessions: OidcSessions,
    private readonly deprecations: AuthDeprecations,
  ) {
    this.rolesClaim = settings.get(SETTINGS.OIDC_ROLES_CLAIM);
  }

  async authenticate(req: Request): Promise<AuthPrincipal | null> {
    const header = req.headers.authorization;
    try {
      if (header?.startsWith('Bearer ')) {
        return await this.bearerPrincipal(header.slice('Bearer '.length).trim());
      }
      const sid = readOurCookie(req.headers.cookie, SESSION_COOKIE);
      const tokens = sid ? await this.sessions.tokens(sid) : null;
      if (!tokens?.idToken) return null;
      return this.sessionPrincipal(decodeJwt(tokens.idToken), tokens.accessToken);
    } catch (err) {
      this.logger.debug(`JWT rejected: ${(err as Error).message}`);
      return null;
    }
  }

  private async bearerPrincipal(token: string): Promise<AuthPrincipal | null> {
    const { payload, kind } = await this.client.verifyBearer(token);
    if (kind === 'unproven') {
      if (looksLikeIdToken(payload)) throw new Error('An ID token is not an access token.');
      this.deprecations.note('bearer-unproven');
    }
    return this.principalOf(payload);
  }

  /**
   * The identity of a browser session: the claims of its validated ID token.
   * The roles come from there too; when they are missing, from the access
   * token, as before (deprecated) — read without check, it came from the token
   * endpoint with the ID token.
   */
  sessionPrincipal(idClaims: JWTPayload, accessToken: string): AuthPrincipal | null {
    const principal = this.principalOf(idClaims);
    if (!principal || getByPath(idClaims, this.rolesClaim) !== undefined) return principal;
    let accessClaims: JWTPayload;
    try {
      accessClaims = decodeJwt(accessToken);
    } catch {
      return principal; // An opaque access token: nothing more to read.
    }
    const roles = this.rolesOf(accessClaims);
    if (roles === null) return principal;
    this.deprecations.note('roles-in-access-token');
    return { ...principal, roles };
  }

  /** The roles at `OIDC_ROLES_CLAIM`, or null when the claim is absent. */
  private rolesOf(payload: JWTPayload): string[] | null {
    const raw = getByPath(payload, this.rolesClaim);
    if (raw === undefined) return null;
    return Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string') : [];
  }

  /** The identity carried by a validated token's claims. */
  private principalOf(payload: JWTPayload): AuthPrincipal | null {
    const sub = payload.sub;
    if (!sub) {
      return null;
    }
    const username = payload['preferred_username'];
    const name = payload['name'];
    const email = payload['email'];
    // The configured claim wins when it carries a name; otherwise the standard
    // chain applies, so a deployment may point at `nickname` and still work for
    // the accounts that have none.
    // Read at each sign-in: the administration may change it (live).
    const nameClaim = settings.get(SETTINGS.OIDC_NAME_CLAIM) || undefined;
    const configured = nameClaim ? getByPath(payload, nameClaim) : undefined;
    return {
      sub,
      displayName:
        (typeof configured === 'string' && configured) ||
        (typeof username === 'string' && username) ||
        (typeof name === 'string' && name) ||
        (typeof email === 'string' && email) ||
        sub,
      // An address the provider says is not verified could be anyone's: not kept,
      // since accounts are found by it (`qd users.set-role user=<e-mail>`).
      email: typeof email === 'string' && payload['email_verified'] !== false ? email : null,
      roles: this.rolesOf(payload) ?? [],
    };
  }
}
