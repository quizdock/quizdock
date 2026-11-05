import type { Request, Response } from 'express';
import type { UsersService } from '../users/users.service';
import { OidcSessionController } from './oidc-session.controller';
import type { OidcProvider } from './oidc.provider';
import type { OidcClient } from './oidc/oidc-client';
import type { OidcSessions } from './oidc/oidc-sessions';

/** A sign-in that succeeds, and the session cookie it sets. */
async function signIn(lifetimeS: number | undefined, secure = true): Promise<string> {
  const client = {
    settings: { issuer: 'https://id.example.org' },
    exchangeCode: jest.fn(async () => ({ accessToken: 'at', idToken: 'id', expiresAt: 0 })),
    verifyIdToken: jest.fn(async () => ({ sub: 'sub-1' })),
  } as unknown as OidcClient;
  const sessions = {
    lifetimeS,
    takePendingLogin: jest.fn(async () => ({
      codeVerifier: 'v',
      nonce: 'n',
      redirectUri: 'https://app/auth/callback',
    })),
    create: jest.fn(async () => 'sid-1'),
    destroy: jest.fn(async () => null),
  } as unknown as OidcSessions;
  const provider = {
    sessionPrincipal: jest.fn(() => ({ sub: 'sub-1', displayName: 'Ada', roles: [] })),
  } as unknown as OidcProvider;
  const users = { upsertFromPrincipal: jest.fn(async () => ({})) } as unknown as UsersService;
  const controller = new OidcSessionController(client, sessions, provider, users);

  const append = jest.fn();
  await controller.callback(
    { secure, headers: { cookie: 'qd_login=state-1' } } as unknown as Request,
    { append } as unknown as Response,
    { code: 'code-1', state: 'state-1' },
  );
  const cookies = append.mock.calls.map((call) => call[1] as string);
  return cookies.find((c) => c.includes('qd_session='))!;
}

describe('OidcSessionController: the session cookie', () => {
  it('ends with the browser by default', async () => {
    expect(await signIn(undefined)).toBe(
      '__Host-qd_session=sid-1; Path=/; HttpOnly; SameSite=Lax; Secure',
    );
  });

  it('carries the lifetime when the instance sets one', async () => {
    expect(await signIn(2_592_000)).toBe(
      '__Host-qd_session=sid-1; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000',
    );
    expect(await signIn(2_592_000, false)).toBe(
      'qd_session=sid-1; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000',
    );
  });
});
