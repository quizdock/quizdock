import type { RedisService } from '../../redis/redis.service';
import { OidcGrantError, type OidcClient, type TokenSet } from './oidc-client';
import { OidcSessions, SESSION_IDLE_S } from './oidc-sessions';

/** Just enough of Redis for the sessions: strings with NX, deletion, a get-and-delete pipeline. */
function fakeRedis() {
  const store = new Map<string, string>();
  const redis = {
    store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string, ...opts: unknown[]) => {
      if (opts.includes('NX') && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    expire: jest.fn(async () => 1),
    // The lock's release: delete the key only while it holds the given value.
    eval: jest.fn(async (_script: string, _n: number, key: string, owner: string) =>
      store.get(key) === owner ? (store.delete(key), 1) : 0,
    ),
    multi: jest.fn(() => {
      const ops: (() => unknown)[] = [];
      const pipe = {
        get: (key: string) => (ops.push(() => store.get(key) ?? null), pipe),
        del: (key: string) => (ops.push(() => (store.delete(key) ? 1 : 0)), pipe),
        exec: async () => ops.map((op) => [null, op()]),
      };
      return pipe;
    }),
  };
  return redis;
}

const tokens = (over: Partial<TokenSet> = {}): TokenSet => ({
  accessToken: 'at-1',
  refreshToken: 'rt-1',
  idToken: 'id-1',
  expiresAt: Date.now() + 300_000,
  ...over,
});

/** The access token the session serves, or null. */
const accessOf = async (sessions: OidcSessions, sid: string) =>
  (await sessions.tokens(sid))?.accessToken ?? null;

function setup(
  refresh: jest.Mock = jest.fn(),
  verifyIdToken: jest.Mock = jest.fn(async () => ({ sub: 'sub-1' })),
  lifetimeS?: number,
) {
  const redis = fakeRedis();
  const client = { refresh, verifyIdToken } as unknown as OidcClient;
  return {
    redis,
    refresh,
    verifyIdToken,
    sessions: new OidcSessions(redis as unknown as RedisService, client, lifetimeS),
  };
}

describe('OidcSessions', () => {
  it('opens a session under a random id, and stores only its hash', async () => {
    const { redis, sessions } = setup();
    const a = await sessions.create('sub-1', tokens());
    const b = await sessions.create('sub-1', tokens());
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    for (const key of redis.store.keys()) expect(key).not.toContain(a);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^auth:session:/),
      expect.any(String),
      'EX',
      SESSION_IDLE_S,
    );
  });

  it('serves the access token and restarts the idle timer', async () => {
    const { redis, sessions } = setup();
    const sid = await sessions.create('sub-1', tokens());
    expect(await accessOf(sessions, sid)).toBe('at-1');
    expect(redis.expire).toHaveBeenCalledWith(expect.any(String), SESSION_IDLE_S);
    expect(await accessOf(sessions, 'unknown')).toBeNull();
  });

  it('renews a token about to expire, keeping the ID token when none comes back', async () => {
    const refresh = jest.fn(async () =>
      tokens({ accessToken: 'at-2', refreshToken: 'rt-2', idToken: null }),
    );
    const { sessions } = setup(refresh);
    const sid = await sessions.create('sub-1', tokens({ expiresAt: Date.now() + 5_000 }));
    expect(await accessOf(sessions, sid)).toBe('at-2');
    expect(refresh).toHaveBeenCalledWith('rt-1');
    // Now fresh: no second renewal.
    expect(await accessOf(sessions, sid)).toBe('at-2');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect((await sessions.destroy(sid))?.idToken).toBe('id-1');
  });

  it('checks a renewed ID token, without nonce, and keeps it', async () => {
    const refresh = jest.fn(async () => tokens({ accessToken: 'at-2', idToken: 'id-2' }));
    const { sessions, verifyIdToken } = setup(refresh);
    const sid = await sessions.create('sub-1', tokens({ expiresAt: Date.now() + 5_000 }));
    expect(await accessOf(sessions, sid)).toBe('at-2');
    expect(verifyIdToken).toHaveBeenCalledWith('id-2', null);
    expect((await sessions.tokens(sid))?.idToken).toBe('id-2');
  });

  it('ends the session when the renewed ID token is invalid or names another user', async () => {
    const refresh = jest.fn(async () => tokens({ accessToken: 'at-2', idToken: 'id-2' }));
    for (const verify of [
      jest.fn(async () => ({ sub: 'sub-2' })),
      jest.fn(async () => {
        throw new Error('signature verification failed');
      }),
    ]) {
      const { sessions } = setup(refresh, verify);
      const sid = await sessions.create('sub-1', tokens({ expiresAt: Date.now() + 5_000 }));
      expect(await accessOf(sessions, sid)).toBeNull();
      expect(await sessions.tokens(sid)).toBeNull();
    }
  });

  it('renews once when two requests of the same session need it together', async () => {
    let release!: () => void;
    const refresh = jest.fn(
      () =>
        new Promise<TokenSet>((resolve) => {
          release = () => resolve(tokens({ accessToken: 'at-2' }));
        }),
    );
    const { sessions } = setup(refresh);
    const sid = await sessions.create('sub-1', tokens({ expiresAt: Date.now() + 5_000 }));
    const first = accessOf(sessions, sid);
    const second = accessOf(sessions, sid);
    await new Promise((r) => setTimeout(r, 20));
    release();
    expect(await Promise.all([first, second])).toEqual(['at-2', 'at-2']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("a renewal that outlived its lock leaves the next renewal's lock alone", async () => {
    const holder = { redis: null as ReturnType<typeof fakeRedis> | null };
    const refresh = jest.fn(async () => {
      // Our lock ran out meanwhile, and another renewal took the key.
      const store = holder.redis!.store;
      const key = [...store.keys()].find((k) => k.startsWith('auth:refresh:'))!;
      store.set(key, 'another-renewal');
      return tokens({ accessToken: 'at-2' });
    });
    const { sessions, redis } = setup(refresh);
    holder.redis = redis;
    const sid = await sessions.create('sub-1', tokens({ expiresAt: Date.now() + 5_000 }));
    expect(await accessOf(sessions, sid)).toBe('at-2');
    expect([...redis.store.values()]).toContain('another-renewal');
  });

  it('ends the session when the provider refuses to renew', async () => {
    const refresh = jest.fn(async () => {
      throw new OidcGrantError('invalid_grant');
    });
    const { sessions } = setup(refresh);
    const sid = await sessions.create('sub-1', tokens({ expiresAt: Date.now() + 5_000 }));
    expect(await accessOf(sessions, sid)).toBeNull();
    expect(await accessOf(sessions, sid)).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps serving a still-valid token while the provider is out of reach', async () => {
    const refresh = jest.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const { sessions } = setup(refresh);
    const sid = await sessions.create('sub-1', tokens({ expiresAt: Date.now() + 5_000 }));
    expect(await accessOf(sessions, sid)).toBe('at-1');
    const gone = await sessions.create('sub-1', tokens({ expiresAt: Date.now() - 1 }));
    expect(await accessOf(sessions, gone)).toBeNull();
  });

  it('ends a session without refresh token once its access token expires', async () => {
    const { sessions } = setup();
    const sid = await sessions.create(
      'sub-1',
      tokens({ refreshToken: null, expiresAt: Date.now() }),
    );
    expect(await accessOf(sessions, sid)).toBeNull();
  });

  it('gives a pending sign-in back once, for one callback', async () => {
    const { sessions } = setup();
    const login = { codeVerifier: 'v', nonce: 'n', redirectUri: 'http://app/auth/callback' };
    await sessions.savePendingLogin('state-1', login);
    expect(await sessions.takePendingLogin('state-1')).toEqual(login);
    expect(await sessions.takePendingLogin('state-1')).toBeNull();
  });

  describe('OIDC_SESSION_LIFETIME_S', () => {
    const YEAR_S = 365 * 24 * 3600;
    /** A session's record in Redis. */
    const recordOf = (redis: ReturnType<typeof fakeRedis>) =>
      JSON.parse([...redis.store.values()][0]!) as { endsAt?: number };
    const verify = jest.fn(async () => ({ sub: 'sub-1' }));

    afterEach(() => jest.useRealTimers());

    it.each([undefined, 0, -5, 0.5])('%s: nothing changes', async (lifetimeS) => {
      const { redis, sessions } = setup(jest.fn(), verify, lifetimeS);
      const sid = await sessions.create('sub-1', tokens());
      expect(sessions.lifetimeS).toBeUndefined();
      expect(recordOf(redis).endsAt).toBeUndefined();
      expect(redis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        SESSION_IDLE_S,
      );
      await sessions.tokens(sid);
      expect(redis.expire).toHaveBeenCalledWith(expect.any(String), SESSION_IDLE_S);
    });

    it('keeps the session for the lifetime, and use does not extend it', async () => {
      const { redis, sessions } = setup(jest.fn(), verify, YEAR_S);
      const sid = await sessions.create('sub-1', tokens());
      expect(sessions.lifetimeS).toBe(YEAR_S);
      expect(redis.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'EX', YEAR_S);
      expect(await accessOf(sessions, sid)).toBe('at-1');
      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('a renewal keeps the end of the session, not a fresh lifetime', async () => {
      jest.useFakeTimers({ now: 1_000_000_000, doNotFake: ['setTimeout'] });
      const refresh = jest.fn(async () => tokens({ accessToken: 'at-2' }));
      const { redis, sessions } = setup(refresh, verify, YEAR_S);
      const sid = await sessions.create(
        'sub-1',
        tokens({ expiresAt: Date.now() + 100 * 24 * 3600 * 1000 }),
      );
      const endsAt = recordOf(redis).endsAt;
      jest.setSystemTime(Date.now() + 100 * 24 * 3600 * 1000);
      expect(await accessOf(sessions, sid)).toBe('at-2');
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(recordOf(redis).endsAt).toBe(endsAt);
      expect(redis.set).toHaveBeenLastCalledWith(
        expect.stringMatching(/^auth:session:/),
        expect.any(String),
        'EX',
        YEAR_S - 100 * 24 * 3600,
      );
    });

    it('a session opened before the setting keeps its idle timer', async () => {
      const before = setup(jest.fn(), verify);
      const sid = await before.sessions.create('sub-1', tokens());
      const after = new OidcSessions(
        before.redis as unknown as RedisService,
        { refresh: jest.fn(), verifyIdToken: verify } as unknown as OidcClient,
        YEAR_S,
      );
      expect((await after.tokens(sid))?.accessToken).toBe('at-1');
      expect(before.redis.expire).toHaveBeenCalledWith(expect.any(String), SESSION_IDLE_S);
    });
  });
});
